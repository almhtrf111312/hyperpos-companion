-- Fix column reference "invoice_id" is ambiguous in refund functions
-- Adds #variable_conflict use_column and explicitly qualifies all table columns with aliases

CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text, _source text DEFAULT 'online'::text)
 RETURNS TABLE(success boolean, already_refunded boolean, invoice_id uuid, invoice_number text, invoice_total numeric, invoice_currency text, restored_item_count integer, restored_unit_count numeric, deleted_debt_amount numeric, customer_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _invoice public.invoices%ROWTYPE;
  _restored_items integer := 0;
  _restored_units numeric := 0;
  _deleted_debt numeric := 0;
  _has_refund boolean := false;
  _row record;
  _main constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);
  SELECT i.* INTO _invoice FROM public.invoices i WHERE i.invoice_number = _invoice_number AND i.user_id = _owner FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, _invoice_number, 0::numeric, NULL::text, 0, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.user_id = _owner AND sm.invoice_id = _invoice.id AND sm.movement_type = 'refund'
  ) INTO _has_refund;

  IF _invoice.status = 'refunded' OR _has_refund THEN
    RETURN QUERY SELECT false, true, _invoice.id, _invoice.invoice_number, COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text, 0, 0::numeric, 0::numeric, _invoice.customer_name::text;
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.refund_items(
    product_id uuid NOT NULL, warehouse_key uuid NOT NULL, quantity numeric(14,3) NOT NULL,
    PRIMARY KEY(product_id, warehouse_key)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.refund_items;

  INSERT INTO pg_temp.refund_items(product_id, warehouse_key, quantity)
  SELECT ii.product_id, ii.stock_warehouse_id, SUM(GREATEST(COALESCE(ii.quantity, 0), 0))
  FROM public.invoice_items ii
  WHERE ii.invoice_id = _invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NOT NULL
  GROUP BY ii.product_id, ii.stock_warehouse_id
  ON CONFLICT(product_id, warehouse_key) DO UPDATE SET quantity = pg_temp.refund_items.quantity + EXCLUDED.quantity;

  INSERT INTO pg_temp.refund_items(product_id, warehouse_key, quantity)
  SELECT sm.product_id, COALESCE(sm.warehouse_id, _main), GREATEST(-SUM(sm.quantity_delta), 0)
  FROM public.stock_movements sm
  WHERE sm.invoice_id = _invoice.id AND sm.movement_type IN ('sale', 'partial_refund')
    AND NOT EXISTS(
      SELECT 1 FROM public.invoice_items ii
      WHERE ii.invoice_id = _invoice.id AND ii.product_id = sm.product_id AND ii.stock_warehouse_id IS NOT NULL
    )
    AND EXISTS(
      SELECT 1 FROM public.stock_movements s2
      WHERE s2.invoice_id = _invoice.id AND s2.product_id = sm.product_id AND s2.movement_type = 'sale'
    )
  GROUP BY sm.product_id, COALESCE(sm.warehouse_id, _main)
  ON CONFLICT(product_id, warehouse_key) DO UPDATE SET quantity = EXCLUDED.quantity;

  INSERT INTO pg_temp.refund_items(product_id, warehouse_key, quantity)
  SELECT ii.product_id, _main, SUM(GREATEST(COALESCE(ii.quantity, 0), 0))
  FROM public.invoice_items ii
  WHERE ii.invoice_id = _invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NULL
    AND NOT EXISTS(
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.invoice_id = _invoice.id AND sm.product_id = ii.product_id AND sm.movement_type = 'sale'
    )
  GROUP BY ii.product_id
  ON CONFLICT(product_id, warehouse_key) DO UPDATE SET quantity = pg_temp.refund_items.quantity + EXCLUDED.quantity;

  PERFORM set_config('app.stock_movement_type', 'refund', true);
  PERFORM set_config('app.stock_invoice_id', _invoice.id::text, true);
  PERFORM set_config('app.stock_invoice_number', _invoice.invoice_number, true);
  PERFORM set_config('app.stock_actor_id', _caller::text, true);
  PERFORM set_config('app.stock_source', CASE WHEN _source = 'offline-sync' THEN 'offline-sync' ELSE 'online' END, true);
  PERFORM set_config('app.refund_context', 'allowed', true);

  FOR _row IN SELECT * FROM pg_temp.refund_items WHERE quantity > 0 LOOP
    IF _row.warehouse_key = _main THEN
      UPDATE public.products p SET quantity = COALESCE(p.quantity, 0) + _row.quantity WHERE p.id = _row.product_id AND p.user_id = _owner;
    ELSE
      UPDATE public.warehouse_stock ws SET quantity = COALESCE(ws.quantity, 0) + _row.quantity, last_updated = now()
      WHERE ws.warehouse_id = _row.warehouse_key AND ws.product_id = _row.product_id;
      IF NOT FOUND THEN
        UPDATE public.products p SET quantity = COALESCE(p.quantity, 0) + _row.quantity WHERE p.id = _row.product_id AND p.user_id = _owner;
      END IF;
    END IF;
  END LOOP;

  SELECT COUNT(*)::integer, COALESCE(SUM(quantity), 0)::numeric INTO _restored_items, _restored_units FROM pg_temp.refund_items WHERE quantity > 0;
  SELECT COALESCE(SUM(d.remaining_debt), 0)::numeric INTO _deleted_debt FROM public.debts d WHERE d.user_id = _owner AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);
  DELETE FROM public.debts d WHERE d.user_id = _owner AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);

  IF _invoice.customer_id IS NOT NULL THEN
    UPDATE public.customers c SET total_purchases = s.total_purchases, total_debt = s.total_debt, invoice_count = s.invoice_count
    FROM (
      SELECT
        COALESCE(SUM(i.total) FILTER(WHERE i.id <> _invoice.id AND i.status <> 'refunded'), 0)::numeric total_purchases,
        COALESCE(SUM(i.total) FILTER(WHERE i.id <> _invoice.id AND i.status <> 'refunded' AND i.payment_type = 'debt' AND i.status <> 'paid'), 0)::numeric total_debt,
        COUNT(*) FILTER(WHERE i.id <> _invoice.id AND i.status <> 'refunded')::integer invoice_count
      FROM public.invoices i
      WHERE i.user_id = _owner AND i.customer_id = _invoice.customer_id
    ) s
    WHERE c.id = _invoice.customer_id AND c.user_id = _owner;
  END IF;

  UPDATE public.invoices i
  SET status = 'refunded',
      notes = concat_ws(E'\n', NULLIF(_invoice.notes, ''), 'Refunded at ' || now()::text),
      updated_at = now()
  WHERE i.id = _invoice.id;

  INSERT INTO public.activity_log(user_id, actor_id, actor_name, actor_role, action_type, entity_type, entity_id, entity_name, description, metadata)
  SELECT _owner, _caller, COALESCE(p.full_name, _invoice.cashier_name, 'مستخدم'), ur.role::text, 'invoice_refunded', 'invoice', _invoice.id::text, _invoice.invoice_number,
    'تم استرداد الفاتورة ' || _invoice.invoice_number,
    jsonb_build_object('invoice_number', _invoice.invoice_number, 'invoice_total', COALESCE(_invoice.total, 0), 'invoice_currency', _invoice.currency, 'restored_items', _restored_items, 'restored_units', _restored_units, 'deleted_debt_amount', _deleted_debt, 'source', CASE WHEN _source = 'offline-sync' THEN 'offline-sync' ELSE 'online' END)
  FROM (SELECT 1) seed
  LEFT JOIN public.profiles p ON p.user_id = _caller
  LEFT JOIN public.user_roles ur ON ur.user_id = _caller
  LIMIT 1;

  RETURN QUERY SELECT true, false, _invoice.id, _invoice.invoice_number, COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text, _restored_items, _restored_units, _deleted_debt, _invoice.customer_name::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_invoice_atomic(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text, text) TO authenticated;

-- Partial refund function with fully qualified table column names and #variable_conflict use_column
CREATE OR REPLACE FUNCTION public.refund_invoice_partial_atomic(_invoice_number text, _items jsonb, _operation_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  _inv public.invoices%ROWTYPE; _owner uuid; _item jsonb; _pid uuid; _pname text; _qty numeric; _avail numeric;
  _line record; _take numeric; _factor numeric;
  _gross numeric := 0; _refund numeric := 0; _cogs numeric := 0; _restored numeric := 0;
  _new_sub numeric; _new_disc numeric; _new_tax numeric; _new_total numeric; _new_profit numeric;
  _remaining_units numeric; _full boolean; _debt_red numeric := 0; _cash numeric := 0; _new_debt numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(auth.uid());
  SELECT i.* INTO _inv FROM public.invoices i WHERE i.invoice_number=_invoice_number AND i.user_id=_owner FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','invoice_not_found'); END IF;
  IF _inv.status='refunded' THEN
    RETURN jsonb_build_object('success',true,'already_refunded',true,'invoice_id',_inv.id,'invoice_number',_inv.invoice_number,'new_total',_inv.total);
  END IF;
  IF _operation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.activity_log al WHERE al.user_id=_owner AND al.action_type='partial_refund' AND al.metadata->>'operation_id'=_operation_id) THEN
    RETURN jsonb_build_object('success',true,'already_processed',true,'invoice_id',_inv.id,'invoice_number',_inv.invoice_number,'new_total',_inv.total,'new_profit',_inv.profit,'new_debt_remaining',_inv.debt_remaining);
  END IF;

  _factor := CASE WHEN COALESCE(_inv.subtotal,0) > 0 THEN COALESCE(_inv.total,0)/_inv.subtotal ELSE 1 END;

  PERFORM set_config('app.stock_movement_type','partial_refund',true);
  PERFORM set_config('app.stock_invoice_id',_inv.id::text,true);
  PERFORM set_config('app.stock_invoice_number',_inv.invoice_number,true);
  PERFORM set_config('app.stock_actor_id',auth.uid()::text,true);
  PERFORM set_config('app.stock_source','partial_refund',true);

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(_items,'[]'::jsonb)) LOOP
    _pid := NULLIF(_item->>'product_id','')::uuid;
    _pname := NULLIF(regexp_replace(trim(COALESCE(_item->>'product_name','')),'\s+',' ','g'),'');
    _qty := round(COALESCE(NULLIF(_item->>'quantity','')::numeric,0),3);
    IF _qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(ii.quantity),0) INTO _avail FROM public.invoice_items ii
    WHERE ii.invoice_id=_inv.id AND ((_pid IS NOT NULL AND ii.product_id=_pid) OR (_pid IS NULL AND regexp_replace(trim(ii.product_name),'\s+',' ','g')=_pname));
    IF _avail < _qty THEN RAISE EXCEPTION 'Refund quantity % exceeds remaining % for %',_qty,_avail,COALESCE(_pname,'item'); END IF;

    FOR _line IN SELECT * FROM public.invoice_items ii
      WHERE ii.invoice_id=_inv.id AND ii.quantity>0 AND ((_pid IS NOT NULL AND ii.product_id=_pid) OR (_pid IS NULL AND regexp_replace(trim(ii.product_name),'\s+',' ','g')=_pname))
      ORDER BY ii.id FOR UPDATE
    LOOP
      EXIT WHEN _qty <= 0;
      _take := LEAST(_qty, _line.quantity);
      UPDATE public.invoice_items ii SET quantity=ii.quantity-_take,
        amount_original=round(COALESCE(ii.unit_price,0)*(ii.quantity-_take),2),
        amount_usd=round(COALESCE(ii.unit_price,0)*(ii.quantity-_take),2),
        profit=round((COALESCE(ii.unit_price,0)-COALESCE(ii.cost_price,0))*(ii.quantity-_take),2)
      WHERE ii.id=_line.id;
      _gross := _gross + _take*COALESCE(_line.unit_price,0);
      _cogs := _cogs + _take*COALESCE(_line.cost_price,0);
      IF _line.product_id IS NOT NULL THEN
        IF _line.stock_warehouse_id IS NOT NULL THEN
          UPDATE public.warehouse_stock ws SET quantity=COALESCE(ws.quantity,0)+_take,last_updated=now()
          WHERE ws.warehouse_id=_line.stock_warehouse_id AND ws.product_id=_line.product_id;
          IF NOT FOUND THEN
            UPDATE public.products p SET quantity=COALESCE(p.quantity,0)+_take WHERE p.id=_line.product_id AND p.user_id=_owner;
          END IF;
        ELSE
          UPDATE public.products p SET quantity=COALESCE(p.quantity,0)+_take WHERE p.id=_line.product_id AND p.user_id=_owner;
        END IF;
      END IF;
      _restored := _restored + _take;
      _qty := _qty - _take;
    END LOOP;
  END LOOP;

  IF _restored <= 0 THEN RAISE EXCEPTION 'No items selected for refund'; END IF;

  _refund := round(_gross*_factor,2);
  _new_sub := GREATEST(round(COALESCE(_inv.subtotal,0)-_gross,2),0);
  IF COALESCE(_inv.subtotal,0) > 0 THEN
    _new_disc := round(COALESCE(_inv.discount,0)*_new_sub/_inv.subtotal,2);
    _new_tax := round(COALESCE(_inv.tax_amount,0)*_new_sub/_inv.subtotal,2);
  ELSE _new_disc := 0; _new_tax := 0; END IF;
  _new_total := GREATEST(round(COALESCE(_inv.total,0)-_refund,2),0);
  _new_profit := round(COALESCE(_inv.profit,0)-(_refund-_cogs),2);

  SELECT COALESCE(SUM(ii.quantity),0) INTO _remaining_units FROM public.invoice_items ii WHERE ii.invoice_id=_inv.id;
  _full := _remaining_units <= 0;
  IF _full THEN _new_total := 0; _new_profit := 0; _new_sub := 0; _new_disc := 0; _new_tax := 0; END IF;

  IF _inv.payment_type='debt' THEN
    _debt_red := LEAST(_refund, GREATEST(COALESCE(_inv.debt_remaining,0),0));
    _cash := round(_refund-_debt_red,2);
  ELSE
    _cash := _refund;
  END IF;
  _new_debt := CASE WHEN _inv.payment_type='debt' THEN GREATEST(round(COALESCE(_inv.debt_remaining,0)-_debt_red,2),0) ELSE COALESCE(_inv.debt_remaining,0) END;

  IF _full THEN PERFORM set_config('app.refund_context','allowed',true); END IF;
  UPDATE public.invoices i SET subtotal=_new_sub, discount=_new_disc, tax_amount=_new_tax, total=_new_total, profit=_new_profit,
    debt_remaining=_new_debt,
    status=CASE WHEN _full THEN 'refunded' WHEN i.payment_type='debt' AND _new_debt<=0 THEN 'paid' ELSE i.status END,
    notes=concat_ws(E'\n',NULLIF(i.notes,''),'Partial refund '||_refund::text||' at '||now()::text),
    updated_at=now()
  WHERE i.id=_inv.id;

  IF _inv.payment_type='debt' THEN
    IF _full THEN
      DELETE FROM public.debts d WHERE d.user_id=_owner AND (d.invoice_id=_inv.invoice_number OR d.invoice_id=_inv.id::text);
    ELSIF _debt_red > 0 THEN
      UPDATE public.debts d SET total_debt=GREATEST(round(COALESCE(d.total_debt,0)-_debt_red,2),0),
        remaining_debt=GREATEST(round(COALESCE(d.remaining_debt,0)-_debt_red,2),0),
        status=CASE WHEN GREATEST(round(COALESCE(d.remaining_debt,0)-_debt_red,2),0)<=0 THEN 'fully_paid' ELSE d.status END,
        updated_at=now()
      WHERE d.user_id=_owner AND (d.invoice_id=_inv.invoice_number OR d.invoice_id=_inv.id::text);
    END IF;
  END IF;

  IF _inv.customer_id IS NOT NULL THEN
    UPDATE public.customers c SET total_purchases=s.tp,total_debt=s.td,invoice_count=s.ic,updated_at=now()
    FROM (SELECT COALESCE(SUM(i.total) FILTER (WHERE i.status NOT IN ('refunded','cancelled')),0)::numeric tp,
      COALESCE(SUM(i.debt_remaining) FILTER (WHERE i.status NOT IN ('refunded','cancelled','paid') AND i.payment_type='debt'),0)::numeric td,
      COUNT(*) FILTER (WHERE i.status NOT IN ('refunded','cancelled'))::int ic
      FROM public.invoices i WHERE i.user_id=_owner AND i.customer_id=_inv.customer_id) s
    WHERE c.id=_inv.customer_id AND c.user_id=_owner;
  END IF;

  UPDATE public.profit_records pr SET gross_profit=_new_profit, revenue=_new_total, cogs=GREATEST(round(pr.cogs-_cogs,2),0)
  WHERE pr.user_id=_owner AND pr.invoice_id=_inv.invoice_number AND NOT pr.is_reversed;

  INSERT INTO public.activity_log(user_id,actor_id,action_type,entity_type,entity_id,entity_name,description,metadata)
  VALUES (_owner,auth.uid(),'partial_refund','invoice',_inv.id::text,_inv.invoice_number,'استرداد جزئي للفاتورة '||_inv.invoice_number,
    jsonb_build_object('operation_id',_operation_id,'refund_amount',_refund,'restored_units',_restored,'full',_full,'cogs',_cogs));

  RETURN jsonb_build_object('success',true,'already_processed',false,'invoice_id',_inv.id,'invoice_number',_inv.invoice_number,
    'refunded_amount',_refund,'refund_amount',_refund,'refunded_profit',round(_refund-_cogs,2),'refunded_cogs',round(_cogs,2),
    'cash_to_refund',_cash,'debt_reduced',_debt_red,'restored_units',_restored,
    'new_total',_new_total,'new_profit',_new_profit,'new_debt_remaining',_new_debt,'is_full_refund',_full);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.refund_invoice_partial_atomic(text,jsonb,text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_invoice_partial_atomic(text,jsonb,text) TO authenticated;
