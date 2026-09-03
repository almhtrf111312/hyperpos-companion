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

  -- warehouse_key uses a zero-UUID sentinel for main inventory so it can be part of the primary key
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.refund_items(
    product_id uuid NOT NULL,
    warehouse_key uuid NOT NULL,
    quantity numeric(14,3) NOT NULL,
    PRIMARY KEY(product_id, warehouse_key)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.refund_items;

  -- 1) Items that recorded the exact warehouse they were deducted from
  INSERT INTO pg_temp.refund_items(product_id,warehouse_key,quantity)
  SELECT ii.product_id, ii.stock_warehouse_id, SUM(GREATEST(COALESCE(ii.quantity,0),0))
  FROM public.invoice_items ii
  WHERE ii.invoice_id=_invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NOT NULL
  GROUP BY ii.product_id, ii.stock_warehouse_id
  ON CONFLICT(product_id,warehouse_key) DO UPDATE SET quantity=pg_temp.refund_items.quantity+EXCLUDED.quantity;

  -- 2) Legacy/main-inventory items: prefer the recorded ledger movement when it exists
  INSERT INTO pg_temp.refund_items(product_id,warehouse_key,quantity)
  SELECT sm.product_id, COALESCE(sm.warehouse_id,_main), SUM(ABS(sm.quantity_delta))
  FROM public.stock_movements sm
  WHERE sm.invoice_id=_invoice.id AND sm.movement_type='sale'
    AND NOT EXISTS(
      SELECT 1 FROM public.invoice_items ii
      WHERE ii.invoice_id=_invoice.id AND ii.product_id=sm.product_id AND ii.stock_warehouse_id IS NOT NULL
    )
  GROUP BY sm.product_id, COALESCE(sm.warehouse_id,_main)
  ON CONFLICT(product_id,warehouse_key) DO UPDATE SET quantity=EXCLUDED.quantity;

  -- 3) Items with neither a warehouse nor a ledger movement -> restore to main inventory
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
        -- warehouse row vanished: fall back to main inventory instead of failing the refund
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