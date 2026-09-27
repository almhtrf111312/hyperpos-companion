CREATE OR REPLACE FUNCTION public.refund_invoice_partial_atomic(_invoice_number text, _items jsonb, _operation_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid(); _owner uuid; _inv public.invoices%ROWTYPE;
  _item jsonb; _pid uuid; _pname text; _qty numeric; _avail numeric; _take numeric; _left numeric;
  _row record; _line_sum numeric := 0; _cogs numeric := 0; _units numeric := 0; _lines integer := 0;
  _ratio numeric; _refund numeric; _profit_red numeric; _remaining_units numeric; _full boolean;
  _debt_red numeric := 0; _cash numeric := 0; _new_total numeric;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _operation_id IS NULL OR length(trim(_operation_id)) < 8 OR length(_operation_id) > 128 THEN RAISE EXCEPTION 'Invalid operation id'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items selected'; END IF;
  _owner := public.get_owner_id(_caller);

  SELECT * INTO _inv FROM public.invoices WHERE invoice_number = _invoice_number AND user_id = _owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = _owner AND action_type = 'invoice_partial_refund' AND metadata->>'operation_id' = trim(_operation_id)) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'refunded_amount', 0, 'cash_to_refund', 0, 'debt_reduced', 0,
      'restored_items', 0, 'restored_units', 0, 'is_fully_refunded', _inv.status = 'refunded', 'new_total', COALESCE(_inv.total,0), 'refunded_profit', 0, 'refunded_cogs', 0);
  END IF;
  IF _inv.status IN ('refunded','cancelled') THEN RAISE EXCEPTION 'Invoice already refunded'; END IF;

  PERFORM set_config('app.stock_movement_type','partial_refund',true);
  PERFORM set_config('app.stock_invoice_id',_inv.id::text,true);
  PERFORM set_config('app.stock_invoice_number',_inv.invoice_number,true);
  PERFORM set_config('app.stock_actor_id',_caller::text,true);
  PERFORM set_config('app.stock_source','partial_refund',true);

  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    _pid := NULLIF(_item->>'product_id','')::uuid;
    _pname := NULLIF(trim(COALESCE(_item->>'product_name','')),'');
    _qty := round(COALESCE(NULLIF(_item->>'quantity','')::numeric,0),3);
    IF _qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(quantity),0) INTO _avail FROM public.invoice_items
    WHERE invoice_id = _inv.id AND ((_pid IS NOT NULL AND product_id = _pid) OR (_pid IS NULL AND product_name = _pname));
    IF _avail < _qty THEN RAISE EXCEPTION 'Refund quantity % exceeds remaining % for %', _qty, _avail, COALESCE(_pname,'item'); END IF;

    _left := _qty; _lines := _lines + 1; _units := _units + _qty;
    FOR _row IN SELECT * FROM public.invoice_items
      WHERE invoice_id = _inv.id AND ((_pid IS NOT NULL AND product_id = _pid) OR (_pid IS NULL AND product_name = _pname)) AND quantity > 0
      ORDER BY id FOR UPDATE LOOP
      EXIT WHEN _left <= 0;
      _take := LEAST(_left, _row.quantity);
      _left := _left - _take;
      _line_sum := _line_sum + _take * COALESCE(_row.unit_price,0);
      _cogs := _cogs + _take * COALESCE(_row.cost_price,0);

      UPDATE public.invoice_items SET quantity = quantity - _take,
        amount_original = round((quantity - _take) * COALESCE(unit_price,0),2),
        amount_usd = round((quantity - _take) * COALESCE(unit_price,0),2),
        profit = round((quantity - _take) * (COALESCE(unit_price,0) - COALESCE(cost_price,0)),2)
      WHERE id = _row.id;

      IF _row.product_id IS NOT NULL THEN
        IF _row.stock_warehouse_id IS NOT NULL THEN
          UPDATE public.warehouse_stock SET quantity = COALESCE(quantity,0) + _take, last_updated = now()
          WHERE warehouse_id = _row.stock_warehouse_id AND product_id = _row.product_id;
          IF NOT FOUND THEN
            UPDATE public.products SET quantity = COALESCE(quantity,0) + _take WHERE id = _row.product_id AND user_id = _owner;
          END IF;
        ELSE
          UPDATE public.products SET quantity = COALESCE(quantity,0) + _take WHERE id = _row.product_id AND user_id = _owner;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF _units <= 0 THEN RAISE EXCEPTION 'No items selected'; END IF;

  -- distribute invoice-level discount/tax proportionally
  _ratio := CASE WHEN COALESCE(_inv.subtotal,0) > 0 THEN COALESCE(_inv.total,0) / _inv.subtotal ELSE 1 END;
  _refund := round(_line_sum * _ratio, 2);
  _cogs := round(_cogs, 2);
  _profit_red := round(_refund - _cogs, 2);

  SELECT COALESCE(SUM(quantity),0) INTO _remaining_units FROM public.invoice_items WHERE invoice_id = _inv.id;
  _full := _remaining_units <= 0;
  IF _full THEN _refund := COALESCE(_inv.total,0); _profit_red := COALESCE(_inv.profit,0); END IF;
  _new_total := GREATEST(round(COALESCE(_inv.total,0) - _refund,2),0);

  IF _inv.payment_type = 'debt' THEN
    _debt_red := LEAST(_refund, GREATEST(COALESCE(_inv.debt_remaining,0),0));
    _cash := round(_refund - _debt_red,2);
  ELSE
    _cash := _refund;
  END IF;

  PERFORM set_config('app.refund_context','allowed',true);
  UPDATE public.invoices SET
    subtotal = CASE WHEN _full THEN 0 ELSE GREATEST(round(COALESCE(subtotal,0) - _line_sum,2),0) END,
    discount = CASE WHEN _full THEN discount ELSE GREATEST(round(COALESCE(discount,0) - (_line_sum - _refund),2),0) END,
    total = _new_total,
    profit = CASE WHEN _full THEN 0 ELSE round(COALESCE(profit,0) - _profit_red,2) END,
    debt_remaining = CASE WHEN payment_type='debt' THEN GREATEST(round(COALESCE(debt_remaining,0) - _debt_red,2),0) ELSE debt_remaining END,
    debt_paid = CASE WHEN payment_type='debt' THEN GREATEST(round(COALESCE(debt_paid,0) - _cash,2),0) ELSE debt_paid END,
    status = CASE WHEN _full THEN 'refunded'
                  WHEN payment_type='debt' AND GREATEST(round(COALESCE(debt_remaining,0) - _debt_red,2),0) <= 0 THEN 'paid'
                  ELSE status END,
    notes = concat_ws(E'\n', NULLIF(notes,''), 'Partial refund '||_refund::text||' at '||now()::text),
    updated_at = now()
  WHERE id = _inv.id;

  IF _inv.payment_type = 'debt' THEN
    IF _full THEN
      DELETE FROM public.debts WHERE user_id = _owner AND (invoice_id = _inv.invoice_number OR invoice_id = _inv.id::text);
    ELSE
      UPDATE public.debts SET
        total_debt = GREATEST(round(COALESCE(total_debt,0) - _refund,2),0),
        total_paid = GREATEST(round(COALESCE(total_paid,0) - _cash,2),0),
        remaining_debt = GREATEST(round(COALESCE(remaining_debt,0) - _debt_red,2),0),
        status = CASE WHEN GREATEST(round(COALESCE(remaining_debt,0) - _debt_red,2),0) <= 0 THEN 'fully_paid' ELSE status END
      WHERE user_id = _owner AND (invoice_id = _inv.invoice_number OR invoice_id = _inv.id::text);
    END IF;
  END IF;

  UPDATE public.profit_records SET
    revenue = round(revenue - _refund,2), cogs = round(cogs - _cogs,2), gross_profit = round(gross_profit - _profit_red,2)
  WHERE user_id = _owner AND invoice_id = _inv.invoice_number AND is_reversed = false;

  IF _inv.customer_id IS NOT NULL THEN
    UPDATE public.customers c SET total_purchases = s.tp, total_debt = s.td, invoice_count = s.ic
    FROM (SELECT COALESCE(SUM(i.total) FILTER (WHERE i.status NOT IN ('refunded','cancelled')),0)::numeric tp,
                 COALESCE(SUM(i.debt_remaining) FILTER (WHERE i.status NOT IN ('refunded','cancelled','paid') AND i.payment_type='debt'),0)::numeric td,
                 COUNT(*) FILTER (WHERE i.status NOT IN ('refunded','cancelled'))::integer ic
          FROM public.invoices i WHERE i.user_id = _owner AND i.customer_id = _inv.customer_id) s
    WHERE c.id = _inv.customer_id AND c.user_id = _owner;
  END IF;

  INSERT INTO public.activity_log(user_id,actor_id,actor_name,actor_role,action_type,entity_type,entity_id,entity_name,description,metadata)
  SELECT _owner,_caller,COALESCE(p.full_name,'مستخدم'),ur.role::text,'invoice_partial_refund','invoice',_inv.id::text,_inv.invoice_number,
    'استرداد جزئي للفاتورة '||_inv.invoice_number,
    jsonb_build_object('operation_id',trim(_operation_id),'refunded_amount',_refund,'refunded_profit',_profit_red,'refunded_cogs',_cogs,
      'cash_to_refund',_cash,'debt_reduced',_debt_red,'units',_units,'items',_items,'fully_refunded',_full)
  FROM (SELECT 1) seed LEFT JOIN public.profiles p ON p.user_id=_caller LEFT JOIN public.user_roles ur ON ur.user_id=_caller LIMIT 1;

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'refunded_amount', _refund, 'cash_to_refund', _cash,
    'debt_reduced', _debt_red, 'restored_items', _lines, 'restored_units', _units, 'is_fully_refunded', _full,
    'new_total', _new_total, 'refunded_profit', _profit_red, 'refunded_cogs', _cogs);
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_invoice_partial_atomic(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice_partial_atomic(text, jsonb, text) TO authenticated;

-- Full refund after partial refunds: net out partial_refund movements from the sale ledger
CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text, _source text DEFAULT 'online'::text)
 RETURNS TABLE(success boolean, already_refunded boolean, invoice_id uuid, invoice_number text, invoice_total numeric, invoice_currency text, restored_item_count integer, restored_unit_count numeric, deleted_debt_amount numeric, customer_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid:=auth.uid(); _owner uuid; _invoice public.invoices%ROWTYPE;
  _restored_items integer:=0; _restored_units numeric:=0; _deleted_debt numeric:=0; _has_refund boolean:=false;
  _row record;
  _main constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner:=public.get_owner_id(_caller);
  SELECT i.* INTO _invoice FROM public.invoices i WHERE i.invoice_number=_invoice_number AND i.user_id=_owner FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false,false,NULL::uuid,_invoice_number,0::numeric,NULL::text,0,0::numeric,0::numeric,NULL::text; RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.stock_movements sm WHERE sm.user_id=_owner AND sm.invoice_id=_invoice.id AND sm.movement_type='refund') INTO _has_refund;
  IF _invoice.status='refunded' OR _has_refund THEN RETURN QUERY SELECT false,true,_invoice.id,_invoice.invoice_number,COALESCE(_invoice.total,0)::numeric,_invoice.currency::text,0,0::numeric,0::numeric,_invoice.customer_name::text; RETURN; END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.refund_items(
    product_id uuid NOT NULL, warehouse_key uuid NOT NULL, quantity numeric(14,3) NOT NULL,
    PRIMARY KEY(product_id, warehouse_key)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.refund_items;

  INSERT INTO pg_temp.refund_items(product_id,warehouse_key,quantity)
  SELECT ii.product_id, ii.stock_warehouse_id, SUM(GREATEST(COALESCE(ii.quantity,0),0))
  FROM public.invoice_items ii
  WHERE ii.invoice_id=_invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NOT NULL
  GROUP BY ii.product_id, ii.stock_warehouse_id
  ON CONFLICT(product_id,warehouse_key) DO UPDATE SET quantity=pg_temp.refund_items.quantity+EXCLUDED.quantity;

  INSERT INTO pg_temp.refund_items(product_id,warehouse_key,quantity)
  SELECT sm.product_id, COALESCE(sm.warehouse_id,_main), GREATEST(-SUM(sm.quantity_delta),0)
  FROM public.stock_movements sm
  WHERE sm.invoice_id=_invoice.id AND sm.movement_type IN ('sale','partial_refund')
    AND NOT EXISTS(
      SELECT 1 FROM public.invoice_items ii
      WHERE ii.invoice_id=_invoice.id AND ii.product_id=sm.product_id AND ii.stock_warehouse_id IS NOT NULL
    )
    AND EXISTS(SELECT 1 FROM public.stock_movements s2 WHERE s2.invoice_id=_invoice.id AND s2.product_id=sm.product_id AND s2.movement_type='sale')
  GROUP BY sm.product_id, COALESCE(sm.warehouse_id,_main)
  ON CONFLICT(product_id,warehouse_key) DO UPDATE SET quantity=EXCLUDED.quantity;

  INSERT INTO pg_temp.refund_items(product_id,warehouse_key,quantity)
  SELECT ii.product_id, _main, SUM(GREATEST(COALESCE(ii.quantity,0),0))
  FROM public.invoice_items ii
  WHERE ii.invoice_id=_invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NULL
    AND NOT EXISTS(
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.invoice_id=_invoice.id AND sm.product_id=ii.product_id AND sm.movement_type='sale'
    )
  GROUP BY ii.product_id
  ON CONFLICT(product_id,warehouse_key) DO UPDATE SET quantity=pg_temp.refund_items.quantity+EXCLUDED.quantity;

  PERFORM set_config('app.stock_movement_type','refund',true); PERFORM set_config('app.stock_invoice_id',_invoice.id::text,true);
  PERFORM set_config('app.stock_invoice_number',_invoice.invoice_number,true); PERFORM set_config('app.stock_actor_id',_caller::text,true);
  PERFORM set_config('app.stock_source',CASE WHEN _source='offline-sync' THEN 'offline-sync' ELSE 'online' END,true);
  PERFORM set_config('app.refund_context','allowed',true);

  FOR _row IN SELECT * FROM pg_temp.refund_items WHERE quantity > 0 LOOP
    IF _row.warehouse_key = _main THEN
      UPDATE public.products SET quantity=COALESCE(quantity,0)+_row.quantity WHERE id=_row.product_id AND user_id=_owner;
    ELSE
      UPDATE public.warehouse_stock ws SET quantity=COALESCE(ws.quantity,0)+_row.quantity,last_updated=now()
      WHERE ws.warehouse_id=_row.warehouse_key AND ws.product_id=_row.product_id;
      IF NOT FOUND THEN
        UPDATE public.products SET quantity=COALESCE(quantity,0)+_row.quantity WHERE id=_row.product_id AND user_id=_owner;
      END IF;
    END IF;
  END LOOP;

  SELECT COUNT(*)::integer,COALESCE(SUM(quantity),0)::numeric INTO _restored_items,_restored_units FROM pg_temp.refund_items WHERE quantity > 0;
  SELECT COALESCE(SUM(d.remaining_debt),0)::numeric INTO _deleted_debt FROM public.debts d WHERE d.user_id=_owner AND (d.invoice_id=_invoice.invoice_number OR d.invoice_id=_invoice.id::text);
  DELETE FROM public.debts d WHERE d.user_id=_owner AND (d.invoice_id=_invoice.invoice_number OR d.invoice_id=_invoice.id::text);
  IF _invoice.customer_id IS NOT NULL THEN
    UPDATE public.customers c SET total_purchases=s.total_purchases,total_debt=s.total_debt,invoice_count=s.invoice_count
    FROM (SELECT COALESCE(SUM(i.total) FILTER(WHERE i.id<>_invoice.id AND i.status<>'refunded'),0)::numeric total_purchases,COALESCE(SUM(i.total) FILTER(WHERE i.id<>_invoice.id AND i.status<>'refunded' AND i.payment_type='debt' AND i.status<>'paid'),0)::numeric total_debt,COUNT(*) FILTER(WHERE i.id<>_invoice.id AND i.status<>'refunded')::integer invoice_count FROM public.invoices i WHERE i.user_id=_owner AND i.customer_id=_invoice.customer_id) s
    WHERE c.id=_invoice.customer_id AND c.user_id=_owner;
  END IF;
  UPDATE public.invoices SET status='refunded',notes=concat_ws(E'\n',NULLIF(_invoice.notes,''),'Refunded at '||now()::text),updated_at=now() WHERE id=_invoice.id;
  INSERT INTO public.activity_log(user_id,actor_id,actor_name,actor_role,action_type,entity_type,entity_id,entity_name,description,metadata)
  SELECT _owner,_caller,COALESCE(p.full_name,_invoice.cashier_name,'مستخدم'),ur.role::text,'invoice_refunded','invoice',_invoice.id::text,_invoice.invoice_number,'تم استرداد الفاتورة '||_invoice.invoice_number,jsonb_build_object('invoice_number',_invoice.invoice_number,'invoice_total',COALESCE(_invoice.total,0),'invoice_currency',_invoice.currency,'restored_items',_restored_items,'restored_units',_restored_units,'deleted_debt_amount',_deleted_debt,'source',CASE WHEN _source='offline-sync' THEN 'offline-sync' ELSE 'online' END)
  FROM (SELECT 1) seed LEFT JOIN public.profiles p ON p.user_id=_caller LEFT JOIN public.user_roles ur ON ur.user_id=_caller LIMIT 1;
  RETURN QUERY SELECT true,false,_invoice.id,_invoice.invoice_number,COALESCE(_invoice.total,0)::numeric,_invoice.currency::text,_restored_items,_restored_units,_deleted_debt,_invoice.customer_name::text;
END;
$function$;