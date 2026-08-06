-- 1) Allow fractional quantities across stock-related columns
DROP TRIGGER IF EXISTS record_main_stock_movement_trigger ON public.products;
DROP TRIGGER IF EXISTS record_warehouse_stock_movement_trigger ON public.warehouse_stock;
ALTER TABLE public.products ALTER COLUMN quantity TYPE numeric(14,3);
ALTER TABLE public.warehouse_stock ALTER COLUMN quantity TYPE numeric(14,3);
ALTER TABLE public.invoice_items ALTER COLUMN quantity TYPE numeric(14,3);
ALTER TABLE public.stock_movements ALTER COLUMN quantity_delta TYPE numeric(14,3);
ALTER TABLE public.stock_movements ALTER COLUMN quantity_before TYPE numeric(14,3);
ALTER TABLE public.stock_movements ALTER COLUMN quantity_after TYPE numeric(14,3);

-- 2) Stock movement triggers with numeric quantities

CREATE OR REPLACE FUNCTION public.record_main_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _before numeric;
  _after numeric;
  _movement_type text;
  _invoice_id uuid;
  _invoice_number text;
  _actor uuid;
  _source text;
  _key text;
BEGIN
  _before := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.quantity, 0) END;
  _after := COALESCE(NEW.quantity, 0);
  IF _before = _after THEN RETURN NEW; END IF;

  _movement_type := COALESCE(NULLIF(current_setting('app.stock_movement_type', true), ''),
    CASE WHEN TG_OP = 'INSERT' THEN 'opening_balance' WHEN _after > _before THEN 'adjustment_in' ELSE 'adjustment_out' END);
  _invoice_id := NULLIF(current_setting('app.stock_invoice_id', true), '')::uuid;
  _invoice_number := NULLIF(current_setting('app.stock_invoice_number', true), '');
  _actor := COALESCE(NULLIF(current_setting('app.stock_actor_id', true), '')::uuid, auth.uid());
  _source := COALESCE(NULLIF(current_setting('app.stock_source', true), ''), 'database_trigger');
  _key := CASE
    WHEN _movement_type = 'refund' AND _invoice_id IS NOT NULL
      THEN 'refund:' || _invoice_id::text || ':' || NEW.id::text || ':main'
    ELSE 'movement:' || gen_random_uuid()::text
  END;

  INSERT INTO public.stock_movements (
    user_id, invoice_id, invoice_number, product_id, product_name,
    warehouse_id, warehouse_name, movement_type, quantity_delta,
    quantity_before, quantity_after, unit_cost, created_by, source,
    idempotency_key, metadata
  ) VALUES (
    NEW.user_id, _invoice_id, _invoice_number, NEW.id, NEW.name,
    NULL, 'المخزون الرئيسي', _movement_type, _after - _before,
    _before, _after, COALESCE(NEW.cost_price, 0), _actor, _source,
    _key, '{}'::jsonb
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER record_main_stock_movement_trigger
AFTER INSERT OR UPDATE OF quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.record_main_stock_movement();

CREATE OR REPLACE FUNCTION public.record_warehouse_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _before numeric;
  _after numeric;
  _owner uuid;
  _product_name text;
  _warehouse_name text;
  _unit_cost numeric;
  _movement_type text;
  _invoice_id uuid;
  _invoice_number text;
  _actor uuid;
  _source text;
  _key text;
BEGIN
  _before := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.quantity, 0) END;
  _after := COALESCE(NEW.quantity, 0);
  IF _before = _after THEN RETURN NEW; END IF;

  SELECT w.user_id, w.name INTO _owner, _warehouse_name
  FROM public.warehouses w WHERE w.id = NEW.warehouse_id;
  SELECT p.name, COALESCE(p.cost_price, 0) INTO _product_name, _unit_cost
  FROM public.products p WHERE p.id = NEW.product_id;

  IF _owner IS NULL THEN RAISE EXCEPTION 'Warehouse owner not found'; END IF;

  _movement_type := COALESCE(NULLIF(current_setting('app.stock_movement_type', true), ''),
    CASE WHEN TG_OP = 'INSERT' THEN 'opening_balance' WHEN _after > _before THEN 'adjustment_in' ELSE 'adjustment_out' END);
  _invoice_id := NULLIF(current_setting('app.stock_invoice_id', true), '')::uuid;
  _invoice_number := NULLIF(current_setting('app.stock_invoice_number', true), '');
  _actor := COALESCE(NULLIF(current_setting('app.stock_actor_id', true), '')::uuid, auth.uid());
  _source := COALESCE(NULLIF(current_setting('app.stock_source', true), ''), 'database_trigger');
  _key := CASE
    WHEN _movement_type = 'refund' AND _invoice_id IS NOT NULL
      THEN 'refund:' || _invoice_id::text || ':' || NEW.product_id::text || ':' || NEW.warehouse_id::text
    ELSE 'movement:' || gen_random_uuid()::text
  END;

  INSERT INTO public.stock_movements (
    user_id, invoice_id, invoice_number, product_id, product_name,
    warehouse_id, warehouse_name, movement_type, quantity_delta,
    quantity_before, quantity_after, unit_cost, created_by, source,
    idempotency_key, metadata
  ) VALUES (
    _owner, _invoice_id, _invoice_number, NEW.product_id, _product_name,
    NEW.warehouse_id, _warehouse_name, _movement_type, _after - _before,
    _before, _after, COALESCE(_unit_cost, 0), _actor, _source,
    _key, '{}'::jsonb
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER record_warehouse_stock_movement_trigger
AFTER INSERT OR UPDATE OF quantity ON public.warehouse_stock
FOR EACH ROW EXECUTE FUNCTION public.record_warehouse_stock_movement();

-- 3) POS sale: fractional quantities + warehouse fallback + clearer errors
CREATE OR REPLACE FUNCTION public.process_pos_sale_atomic(_operation_id text, _payment_type text, _customer_name text, _customer_phone text, _subtotal numeric, _discount numeric, _discount_percentage numeric, _tax_rate numeric, _tax_amount numeric, _total numeric, _profit numeric, _currency text, _warehouse_id uuid, _items jsonb)
 RETURNS TABLE(success boolean, already_processed boolean, invoice_id uuid, invoice_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _existing public.invoices%ROWTYPE;
  _new_invoice public.invoices%ROWTYPE;
  _next bigint;
  _number text;
  _item jsonb;
  _product_id uuid;
  _quantity numeric;
  _available numeric;
  _product_name text;
  _warehouse_name text;
  _unit text;
  _conversion_factor numeric;
  _track_inventory boolean := true;
  _use_warehouse boolean;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);
  IF _owner IS NULL THEN RAISE EXCEPTION 'Owner context is required'; END IF;

  IF _operation_id IS NULL OR length(trim(_operation_id)) < 8 OR length(_operation_id) > 128 THEN
    RAISE EXCEPTION 'Invalid operation id';
  END IF;
  IF _payment_type NOT IN ('cash', 'debt') THEN RAISE EXCEPTION 'Invalid payment type'; END IF;
  IF COALESCE(_total, -1) < 0 OR COALESCE(_subtotal, -1) < 0 OR COALESCE(_discount, -1) < 0 OR COALESCE(_tax_amount, -1) < 0 THEN
    RAISE EXCEPTION 'Invalid financial values';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Sale items are required';
  END IF;

  SELECT i.* INTO _existing FROM public.invoices i
  WHERE i.user_id = _owner AND i.operation_id = trim(_operation_id) LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true, true, _existing.id, _existing.invoice_number;
    RETURN;
  END IF;

  SELECT NOT (COALESCE(s.store_type, 'general') IN ('bakery', 'repair'))
  INTO _track_inventory
  FROM public.stores s WHERE s.user_id = _owner LIMIT 1;
  _track_inventory := COALESCE(_track_inventory, true);

  IF _warehouse_id IS NOT NULL THEN
    SELECT w.name INTO _warehouse_name FROM public.warehouses w
    WHERE w.id = _warehouse_id AND w.user_id = _owner AND COALESCE(w.is_active, true);
    IF NOT FOUND THEN RAISE EXCEPTION 'Warehouse not found'; END IF;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.pos_sale_items(
    product_id uuid PRIMARY KEY,
    quantity numeric(14,3) NOT NULL,
    from_warehouse boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.pos_sale_items;

  FOR _item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    BEGIN
      _product_id := (_item->>'product_id')::uuid;
      IF (_item->>'quantity') IS NULL OR (_item->>'quantity') !~ '^[0-9]+(\.[0-9]+)?$' THEN
        RAISE EXCEPTION 'Invalid item quantity';
      END IF;
      _quantity := round((_item->>'quantity')::numeric, 3);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Invalid sale item';
    END;
    IF _product_id IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    INSERT INTO pg_temp.pos_sale_items(product_id, quantity) VALUES (_product_id, _quantity)
    ON CONFLICT (product_id) DO UPDATE SET quantity = pg_temp.pos_sale_items.quantity + EXCLUDED.quantity;
  END LOOP;

  FOR _product_id, _quantity IN SELECT psi.product_id, psi.quantity FROM pg_temp.pos_sale_items psi
  LOOP
    SELECT p.name INTO _product_name FROM public.products p
    WHERE p.id = _product_id AND p.user_id = _owner AND COALESCE(p.archived, false) = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found (%)', _product_id; END IF;

    _use_warehouse := false;

    IF _track_inventory THEN
      IF _warehouse_id IS NOT NULL THEN
        SELECT ws.quantity INTO _available FROM public.warehouse_stock ws
        WHERE ws.warehouse_id = _warehouse_id AND ws.product_id = _product_id
        FOR UPDATE OF ws;
        _use_warehouse := FOUND;
      END IF;

      IF NOT _use_warehouse THEN
        -- No warehouse row (or main stock sale): fall back to the product's main stock
        SELECT p.quantity INTO _available FROM public.products p
        WHERE p.id = _product_id AND p.user_id = _owner FOR UPDATE;
      END IF;

      IF COALESCE(_available, 0) < _quantity THEN
        RAISE EXCEPTION 'Insufficient stock for % (%): available %, requested %',
          _product_name, COALESCE(_warehouse_name, 'المخزون الرئيسي'), COALESCE(_available, 0), _quantity;
      END IF;
    END IF;

    UPDATE pg_temp.pos_sale_items SET from_warehouse = _use_warehouse WHERE product_id = _product_id;
  END LOOP;

  _next := public.get_next_invoice_number(_owner);
  _number := to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(_next::text, 5, '0');

  INSERT INTO public.invoices (
    user_id, invoice_number, invoice_sequence, operation_id, invoice_type, date, time,
    cashier_id, cashier_name, customer_name, customer_phone, subtotal, discount,
    discount_percentage, tax_rate, tax_amount, total, profit, currency, exchange_rate,
    payment_type, status, debt_paid, debt_remaining, warehouse_id
  )
  SELECT _owner, _number, _next, trim(_operation_id), 'sale', CURRENT_DATE, CURRENT_TIME,
    _caller::text, p.full_name, NULLIF(trim(_customer_name), ''), NULLIF(trim(_customer_phone), ''),
    round(COALESCE(_subtotal, 0), 2), round(COALESCE(_discount, 0), 2),
    COALESCE(_discount_percentage, 0), COALESCE(_tax_rate, 0), round(COALESCE(_tax_amount, 0), 2),
    round(COALESCE(_total, 0), 2), round(COALESCE(_profit, 0), 2),
    COALESCE(NULLIF(_currency, ''), 'USD'), 1, _payment_type,
    CASE WHEN _payment_type = 'debt' THEN 'pending' ELSE 'paid' END,
    0, CASE WHEN _payment_type = 'debt' THEN round(COALESCE(_total, 0), 2) ELSE 0 END,
    _warehouse_id
  FROM (SELECT 1) seed LEFT JOIN public.profiles p ON p.user_id = _caller LIMIT 1
  RETURNING * INTO _new_invoice;

  PERFORM set_config('app.stock_movement_type', 'sale', true);
  PERFORM set_config('app.stock_invoice_id', _new_invoice.id::text, true);
  PERFORM set_config('app.stock_invoice_number', _new_invoice.invoice_number, true);
  PERFORM set_config('app.stock_actor_id', _caller::text, true);
  PERFORM set_config('app.stock_source', 'atomic_pos_sale', true);

  FOR _item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    _product_id := (_item->>'product_id')::uuid;
    _quantity := round((_item->>'quantity')::numeric, 3);
    _unit := COALESCE(NULLIF(_item->>'unit', ''), 'piece');
    _conversion_factor := GREATEST(COALESCE(NULLIF(_item->>'conversion_factor', '')::numeric, 1), 1);
    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, variant_id, variant_name, quantity, unit_price,
      cost_price, currency, amount_original, amount_usd, profit, unit, conversion_factor
    ) VALUES (
      _new_invoice.id, _product_id, COALESCE(NULLIF(_item->>'product_name', ''), 'Product'),
      NULLIF(_item->>'variant_id', ''), NULLIF(_item->>'variant_name', ''), _quantity,
      round(COALESCE(NULLIF(_item->>'unit_price', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(_item->>'cost_price', '')::numeric, 0), 2), COALESCE(NULLIF(_currency, ''), 'USD'),
      round(COALESCE(NULLIF(_item->>'amount_original', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(_item->>'amount_usd', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(_item->>'profit', '')::numeric, 0), 2), _unit, _conversion_factor
    );
  END LOOP;

  IF _track_inventory THEN
    FOR _product_id, _quantity, _use_warehouse IN
      SELECT psi.product_id, psi.quantity, psi.from_warehouse FROM pg_temp.pos_sale_items psi
    LOOP
      IF _use_warehouse THEN
        UPDATE public.warehouse_stock SET quantity = quantity - _quantity, last_updated = now()
        WHERE warehouse_id = _warehouse_id AND product_id = _product_id;
      ELSE
        UPDATE public.products SET quantity = COALESCE(quantity, 0) - _quantity, updated_at = now()
        WHERE id = _product_id AND user_id = _owner;
      END IF;
    END LOOP;
  END IF;

  IF _payment_type = 'debt' THEN
    INSERT INTO public.debts (
      user_id, invoice_id, customer_name, customer_phone, total_debt, total_paid,
      remaining_debt, due_date, status, is_cash_debt, cashier_id
    ) VALUES (
      _owner, _new_invoice.invoice_number, COALESCE(NULLIF(trim(_customer_name), ''), 'عميل دين'),
      NULLIF(trim(_customer_phone), ''), round(COALESCE(_total, 0), 2), 0,
      round(COALESCE(_total, 0), 2), CURRENT_DATE + 30, 'due', false, _caller
    );
  END IF;

  RETURN QUERY SELECT true, false, _new_invoice.id, _new_invoice.invoice_number;
EXCEPTION WHEN unique_violation THEN
  SELECT i.* INTO _existing FROM public.invoices i
  WHERE i.user_id = _owner AND i.operation_id = trim(_operation_id) LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true, true, _existing.id, _existing.invoice_number;
    RETURN;
  END IF;
  RAISE;
END;
$function$;

-- 4) Refund: fractional quantities
CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text, _source text DEFAULT 'online'::text)
 RETURNS TABLE(success boolean, already_refunded boolean, invoice_id uuid, invoice_number text, invoice_total numeric, invoice_currency text, restored_item_count integer, restored_unit_count numeric, deleted_debt_amount numeric, customer_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    quantity numeric(14,3) NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.refund_items;

  INSERT INTO pg_temp.refund_items(product_id, quantity)
  SELECT grouped.product_id, SUM(grouped.quantity)
  FROM (
    SELECT ii.product_id,
           COALESCE(ii.variant_id, '') AS variant_key,
           COALESCE(ii.unit_price, 0) AS price_key,
           COALESCE(ii.unit, '') AS unit_key,
           MAX(GREATEST(COALESCE(ii.quantity, 0), 0)) AS quantity
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
$function$;