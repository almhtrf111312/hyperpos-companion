CREATE OR REPLACE FUNCTION public.add_product_quantity(_product_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_qty integer;
  _owner uuid := public.get_owner_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid stock adjustment';
  END IF;

  PERFORM set_config('app.stock_movement_type', 'adjustment_in', true);
  PERFORM set_config('app.stock_actor_id', auth.uid()::text, true);
  PERFORM set_config('app.stock_source', 'authenticated_rpc', true);

  UPDATE public.products
  SET quantity = COALESCE(quantity, 0) + _amount
  WHERE id = _product_id AND user_id = _owner
  RETURNING quantity INTO _new_qty;

  IF _new_qty IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  RETURN _new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_product_quantity(_product_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_qty integer;
  _new_qty integer;
  _owner uuid := public.get_owner_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid stock adjustment';
  END IF;

  SELECT quantity INTO _current_qty
  FROM public.products
  WHERE id = _product_id AND user_id = _owner
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF COALESCE(_current_qty, 0) < _amount THEN RAISE EXCEPTION 'Insufficient stock'; END IF;

  PERFORM set_config('app.stock_movement_type', 'sale', true);
  PERFORM set_config('app.stock_actor_id', auth.uid()::text, true);
  PERFORM set_config('app.stock_source', 'authenticated_rpc', true);

  _new_qty := _current_qty - _amount;
  UPDATE public.products SET quantity = _new_qty WHERE id = _product_id AND user_id = _owner;
  RETURN _new_qty;
END;
$$;

DROP TRIGGER IF EXISTS record_main_stock_movement_trigger ON public.products;
CREATE TRIGGER record_main_stock_movement_trigger
AFTER INSERT OR UPDATE OF quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.record_main_stock_movement();

DROP TRIGGER IF EXISTS record_warehouse_stock_movement_trigger ON public.warehouse_stock;
CREATE TRIGGER record_warehouse_stock_movement_trigger
AFTER INSERT OR UPDATE OF quantity ON public.warehouse_stock
FOR EACH ROW EXECUTE FUNCTION public.record_warehouse_stock_movement();

DROP TRIGGER IF EXISTS guard_refunded_invoice_status_trigger ON public.invoices;
CREATE TRIGGER guard_refunded_invoice_status_trigger
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_refunded_invoice_status();

CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text, _source text DEFAULT 'online'::text)
RETURNS TABLE(success boolean, already_refunded boolean, invoice_id uuid, invoice_number text, invoice_total numeric, invoice_currency text, restored_item_count integer, restored_unit_count numeric, deleted_debt_amount numeric, customer_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _invoice public.invoices%ROWTYPE;
  _warehouse_id uuid;
  _restored_items integer := 0;
  _restored_units numeric := 0;
  _deleted_debt numeric := 0;
  _has_refund_movement boolean := false;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);

  SELECT i.* INTO _invoice FROM public.invoices i
  WHERE i.invoice_number = _invoice_number AND i.user_id = _owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, _invoice_number, 0::numeric, NULL::text, 0, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.user_id = _owner AND sm.invoice_id = _invoice.id AND sm.movement_type = 'refund'
  ) INTO _has_refund_movement;

  IF _invoice.status = 'refunded' OR _has_refund_movement THEN
    RETURN QUERY SELECT false, true, _invoice.id, _invoice.invoice_number,
      COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text, 0, 0::numeric, 0::numeric, _invoice.customer_name::text;
    RETURN;
  END IF;

  IF _invoice.warehouse_id IS NOT NULL THEN
    SELECT w.id INTO _warehouse_id FROM public.warehouses w
    WHERE w.id = _invoice.warehouse_id AND w.user_id = _owner LIMIT 1;
  ELSIF _invoice.cashier_id IS NOT NULL THEN
    SELECT w.id INTO _warehouse_id FROM public.warehouses w
    WHERE w.assigned_cashier_id::text = _invoice.cashier_id AND w.user_id = _owner LIMIT 1;
  END IF;

  PERFORM set_config('app.stock_movement_type', 'refund', true);
  PERFORM set_config('app.stock_invoice_id', _invoice.id::text, true);
  PERFORM set_config('app.stock_invoice_number', _invoice.invoice_number, true);
  PERFORM set_config('app.stock_actor_id', _caller::text, true);
  PERFORM set_config('app.stock_source', CASE WHEN _source = 'offline-sync' THEN 'offline-sync' ELSE 'online' END, true);
  PERFORM set_config('app.refund_context', 'allowed', true);

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.refund_items (
    product_id uuid PRIMARY KEY,
    quantity integer NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.refund_items;

  INSERT INTO pg_temp.refund_items(product_id, quantity)
  SELECT grouped.product_id, SUM(grouped.quantity)::integer
  FROM (
    SELECT ii.product_id,
           COALESCE(ii.variant_id, '') AS variant_key,
           COALESCE(ii.unit_price, 0) AS price_key,
           COALESCE(ii.unit, '') AS unit_key,
           MAX(GREATEST(COALESCE(ii.quantity, 0), 0))::integer AS quantity
    FROM public.invoice_items ii
    WHERE ii.invoice_id = _invoice.id AND ii.product_id IS NOT NULL AND COALESCE(ii.quantity, 0) > 0
    GROUP BY ii.product_id, COALESCE(ii.variant_id, ''), COALESCE(ii.unit_price, 0), COALESCE(ii.unit, '')
  ) grouped
  GROUP BY grouped.product_id;

  IF _warehouse_id IS NOT NULL THEN
    INSERT INTO public.warehouse_stock (warehouse_id, product_id, quantity)
    SELECT _warehouse_id, ri.product_id, ri.quantity FROM pg_temp.refund_items ri
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = COALESCE(public.warehouse_stock.quantity, 0) + EXCLUDED.quantity;
  ELSE
    UPDATE public.products p
    SET quantity = COALESCE(p.quantity, 0) + ri.quantity
    FROM pg_temp.refund_items ri
    WHERE p.id = ri.product_id AND p.user_id = _owner;
  END IF;

  SELECT COUNT(*)::integer, COALESCE(SUM(ri.quantity), 0)::numeric
  INTO _restored_items, _restored_units FROM pg_temp.refund_items ri;

  SELECT COALESCE(SUM(d.remaining_debt), 0)::numeric INTO _deleted_debt
  FROM public.debts d WHERE d.user_id = _owner
    AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);
  DELETE FROM public.debts d WHERE d.user_id = _owner
    AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);

  IF _invoice.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET total_purchases = stats.total_purchases, total_debt = stats.total_debt, invoice_count = stats.invoice_count
    FROM (
      SELECT COALESCE(SUM(i.total) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded'), 0)::numeric AS total_purchases,
             COALESCE(SUM(i.total) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded' AND i.payment_type = 'debt' AND i.status <> 'paid'), 0)::numeric AS total_debt,
             COUNT(*) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded')::integer AS invoice_count
      FROM public.invoices i WHERE i.user_id = _owner AND i.customer_id = _invoice.customer_id
    ) stats
    WHERE c.id = _invoice.customer_id AND c.user_id = _owner;
  END IF;

  UPDATE public.invoices SET status = 'refunded',
    notes = concat_ws(E'\n', NULLIF(_invoice.notes, ''), 'Refunded at ' || now()::text), updated_at = now()
  WHERE id = _invoice.id;

  INSERT INTO public.activity_log(user_id, actor_id, actor_name, actor_role, action_type, entity_type, entity_id, entity_name, description, metadata)
  SELECT _owner, _caller, COALESCE(p.full_name, _invoice.cashier_name, 'مستخدم'), ur.role::text,
    'invoice_refunded', 'invoice', _invoice.id::text, _invoice.invoice_number,
    'تم استرداد الفاتورة ' || _invoice.invoice_number,
    jsonb_build_object('invoice_number', _invoice.invoice_number, 'invoice_total', COALESCE(_invoice.total, 0),
      'invoice_currency', _invoice.currency, 'restored_items', _restored_items, 'restored_units', _restored_units,
      'deleted_debt_amount', _deleted_debt, 'warehouse_id', _warehouse_id,
      'source', CASE WHEN _source = 'offline-sync' THEN 'offline-sync' ELSE 'online' END)
  FROM (SELECT 1) seed
  LEFT JOIN public.profiles p ON p.user_id = _caller
  LEFT JOIN public.user_roles ur ON ur.user_id = _caller LIMIT 1;

  RETURN QUERY SELECT true, false, _invoice.id, _invoice.invoice_number,
    COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text,
    _restored_items, _restored_units, _deleted_debt, _invoice.customer_name::text;
END;
$$;

REVOKE ALL ON FUNCTION public.add_product_quantity(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_product_quantity(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_invoice_atomic(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_product_quantity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_product_quantity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_product_quantity(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_product_quantity(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text, text) TO service_role;