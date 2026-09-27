CREATE OR REPLACE FUNCTION public.refund_invoice_partial_atomic(_invoice_number text, _items jsonb, _operation_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices%ROWTYPE;
  _owner uuid;
  _item jsonb;
  _pid uuid;
  _pname text;
  _qty numeric;
  _avail numeric;
  _ratio numeric;
  _refund numeric := 0;
  _profit_red numeric := 0;
  _remaining_units numeric;
  _full boolean;
  _debt_red numeric := 0;
  _restored numeric := 0;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE invoice_number = _invoice_number FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invoice_not_found');
  END IF;
  _owner := _inv.user_id;

  IF _inv.status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'already_refunded', true, 'invoice_id', _inv.id, 'invoice_number', _inv.invoice_number);
  END IF;

  IF _operation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.activity_log
    WHERE user_id = _owner AND action_type = 'partial_refund' AND metadata->>'operation_id' = _operation_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'invoice_id', _inv.id, 'invoice_number', _inv.invoice_number);
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := NULLIF(_item->>'product_id','')::uuid;
    _pname := NULLIF(trim(COALESCE(_item->>'product_name','')),'') ;
    _qty := COALESCE((_item->>'quantity')::numeric, 0);
    IF _qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(quantity),0) INTO _avail FROM public.invoice_items
    WHERE invoice_id = _inv.id AND ((_pid IS NOT NULL AND product_id = _pid) OR (_pid IS NULL AND trim(product_name) = _pname));
    IF _avail < _qty THEN
      RAISE EXCEPTION 'Refund quantity % exceeds remaining % for %', _qty, _avail, COALESCE(_pname,'item');
    END IF;

    UPDATE public.invoice_items SET quantity = quantity - _qty
    WHERE id IN (
      SELECT id FROM public.invoice_items
      WHERE invoice_id = _inv.id AND ((_pid IS NOT NULL AND product_id = _pid) OR (_pid IS NULL AND trim(product_name) = _pname)) AND quantity > 0
      ORDER BY id FOR UPDATE
    );

    _refund := _refund + round(_qty * COALESCE((_item->>'unit_price')::numeric, 0), 2);
    _profit_red := _profit_red + round(_qty * (COALESCE((_item->>'unit_price')::numeric,0) - COALESCE((_item->>'cost_price')::numeric,0)), 2);

    UPDATE public.products SET quantity = COALESCE(quantity,0) + _qty, updated_at = now()
    WHERE id = COALESCE(_pid, (SELECT product_id FROM public.invoice_items WHERE invoice_id = _inv.id AND trim(product_name) = _pname LIMIT 1));
    _restored := _restored + _qty;
  END LOOP;

  SELECT COALESCE(SUM(quantity),0) INTO _remaining_units FROM public.invoice_items WHERE invoice_id = _inv.id;
  _full := _remaining_units <= 0;

  IF _inv.payment_type = 'debt' THEN
    _debt_red := LEAST(_refund, GREATEST(COALESCE(_inv.debt_remaining,0),0));
  END IF;

  UPDATE public.invoices SET
    total = GREATEST(round(COALESCE(total,0) - _refund, 2), 0),
    profit = GREATEST(round(COALESCE(profit,0) - _profit_red, 2), 0),
    debt_remaining = CASE WHEN payment_type='debt' THEN GREATEST(round(COALESCE(debt_remaining,0) - _debt_red,2),0) ELSE debt_remaining END,
    status = CASE WHEN _full THEN 'refunded'
                  WHEN payment_type='debt' AND GREATEST(round(COALESCE(debt_remaining,0) - _debt_red,2),0) <= 0 THEN 'paid'
                  ELSE status END,
    updated_at = now()
  WHERE id = _inv.id;

  IF _inv.payment_type = 'debt' AND _debt_red > 0 THEN
    UPDATE public.debts SET
      remaining_debt = GREATEST(round(COALESCE(remaining_debt,0) - _debt_red,2),0),
      total_paid = round(COALESCE(total_paid,0) + _debt_red,2),
      status = CASE WHEN GREATEST(round(COALESCE(remaining_debt,0) - _debt_red,2),0) <= 0 THEN 'fully_paid' ELSE status END,
      updated_at = now()
    WHERE user_id = _owner AND (invoice_id = _inv.invoice_number OR invoice_id = _inv.id::text);
  END IF;

  IF _inv.customer_id IS NOT NULL THEN
    UPDATE public.customers c SET
      total_purchases = sub.tp, total_debt = sub.td, invoice_count = sub.ic, updated_at = now()
    FROM (
      SELECT
        COALESCE(SUM(i.total) FILTER (WHERE i.status NOT IN ('refunded','cancelled')),0)::numeric tp,
        COALESCE(SUM(i.debt_remaining) FILTER (WHERE i.status NOT IN ('refunded','cancelled','paid') AND i.payment_type='debt'),0)::numeric td,
        COUNT(*) FILTER (WHERE i.status NOT IN ('refunded','cancelled'))::int ic
      FROM public.invoices i WHERE i.customer_id = _inv.customer_id
    ) sub
    WHERE c.id = _inv.customer_id;
  END IF;

  UPDATE public.profit_records SET
    gross_profit = GREATEST(round(gross_profit - _profit_red,2),0),
    revenue = GREATEST(round(revenue - _refund,2),0)
  WHERE user_id = _owner AND invoice_id = _inv.invoice_number AND NOT is_reversed;

  INSERT INTO public.activity_log (user_id, action_type, entity_type, entity_id, entity_name, description, metadata)
  VALUES (_owner, 'partial_refund', 'invoice', _inv.id::text, _inv.invoice_number,
          'استرداد جزئي للفاتورة ' || _inv.invoice_number,
          jsonb_build_object('operation_id', _operation_id, 'refund_amount', _refund, 'restored_units', _restored, 'full', _full));

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'invoice_id', _inv.id,
    'invoice_number', _inv.invoice_number, 'refund_amount', _refund, 'restored_units', _restored, 'is_full_refund', _full);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_invoice_partial_atomic(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice_partial_atomic(text, jsonb, text) TO authenticated;