CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text)
RETURNS TABLE (
  success boolean,
  already_refunded boolean,
  invoice_id uuid,
  invoice_number text,
  invoice_total numeric,
  invoice_currency text,
  restored_item_count integer,
  restored_unit_count numeric,
  deleted_debt_amount numeric,
  customer_name text
)
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
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  _owner := public.get_owner_id(_caller);

  SELECT i.*
    INTO _invoice
  FROM public.invoices i
  WHERE i.invoice_number = _invoice_number
    AND i.user_id = _owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, _invoice_number, 0::numeric,
      NULL::text, 0, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  IF _invoice.status = 'refunded' THEN
    RETURN QUERY SELECT false, true, _invoice.id, _invoice.invoice_number,
      COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text, 0, 0::numeric,
      0::numeric, _invoice.customer_name::text;
    RETURN;
  END IF;

  IF _invoice.cashier_id IS NOT NULL THEN
    SELECT w.id
      INTO _warehouse_id
    FROM public.warehouses w
    WHERE w.assigned_cashier_id = _invoice.cashier_id
      AND w.user_id = _owner
    LIMIT 1;
  END IF;

  IF _warehouse_id IS NOT NULL THEN
    INSERT INTO public.warehouse_stock (warehouse_id, product_id, quantity)
    SELECT _warehouse_id, ii.product_id, SUM(COALESCE(ii.quantity, 0))
    FROM public.invoice_items ii
    WHERE ii.invoice_id = _invoice.id
      AND ii.product_id IS NOT NULL
      AND COALESCE(ii.quantity, 0) > 0
    GROUP BY ii.product_id
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = COALESCE(public.warehouse_stock.quantity, 0) + EXCLUDED.quantity;
  ELSE
    UPDATE public.products p
    SET quantity = COALESCE(p.quantity, 0) + restored.quantity
    FROM (
      SELECT ii.product_id, SUM(COALESCE(ii.quantity, 0))::integer AS quantity
      FROM public.invoice_items ii
      WHERE ii.invoice_id = _invoice.id
        AND ii.product_id IS NOT NULL
        AND COALESCE(ii.quantity, 0) > 0
      GROUP BY ii.product_id
    ) restored
    WHERE p.id = restored.product_id
      AND p.user_id = _owner;
  END IF;

  SELECT COUNT(DISTINCT ii.product_id)::integer,
         COALESCE(SUM(ii.quantity), 0)::numeric
    INTO _restored_items, _restored_units
  FROM public.invoice_items ii
  WHERE ii.invoice_id = _invoice.id
    AND ii.product_id IS NOT NULL
    AND COALESCE(ii.quantity, 0) > 0;

  SELECT COALESCE(SUM(d.remaining_debt), 0)::numeric
    INTO _deleted_debt
  FROM public.debts d
  WHERE d.user_id = _owner
    AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);

  DELETE FROM public.debts d
  WHERE d.user_id = _owner
    AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);

  IF _invoice.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET total_purchases = stats.total_purchases,
        total_debt = stats.total_debt,
        invoice_count = stats.invoice_count
    FROM (
      SELECT COALESCE(SUM(i.total) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded'), 0)::numeric AS total_purchases,
             COALESCE(SUM(i.total) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded' AND i.payment_type = 'debt' AND i.status <> 'paid'), 0)::numeric AS total_debt,
             COUNT(*) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded')::integer AS invoice_count
      FROM public.invoices i
      WHERE i.user_id = _owner AND i.customer_id = _invoice.customer_id
    ) stats
    WHERE c.id = _invoice.customer_id AND c.user_id = _owner;
  END IF;

  UPDATE public.invoices
  SET status = 'refunded',
      notes = concat_ws(E'\n', NULLIF(_invoice.notes, ''), 'Refunded at ' || now()::text),
      updated_at = now()
  WHERE id = _invoice.id;

  RETURN QUERY SELECT true, false, _invoice.id, _invoice.invoice_number,
    COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text,
    _restored_items, _restored_units, _deleted_debt, _invoice.customer_name::text;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_invoice_atomic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text) TO service_role;