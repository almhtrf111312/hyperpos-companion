ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS stock_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoice_items_stock_warehouse_idx
ON public.invoice_items (invoice_id, product_id, stock_warehouse_id);

CREATE OR REPLACE FUNCTION public.process_pos_sale_atomic(
  _operation_id text, _payment_type text, _customer_name text, _customer_phone text,
  _subtotal numeric, _discount numeric, _discount_percentage numeric, _tax_rate numeric,
  _tax_amount numeric, _total numeric, _profit numeric, _currency text,
  _warehouse_id uuid, _items jsonb
)
RETURNS TABLE(success boolean, already_processed boolean, invoice_id uuid, invoice_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid(); _owner uuid; _existing public.invoices%ROWTYPE;
  _new_invoice public.invoices%ROWTYPE; _next bigint; _number text; _item jsonb;
  _product_id uuid; _quantity numeric; _available numeric; _product_name text;
  _warehouse_name text; _track_inventory boolean := true;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);
  IF _owner IS NULL THEN RAISE EXCEPTION 'Owner context is required'; END IF;
  IF _operation_id IS NULL OR length(trim(_operation_id)) < 8 OR length(_operation_id) > 128 THEN RAISE EXCEPTION 'Invalid operation id'; END IF;
  IF _payment_type NOT IN ('cash','debt') THEN RAISE EXCEPTION 'Invalid payment type'; END IF;
  IF COALESCE(_total,-1) < 0 OR COALESCE(_subtotal,-1) < 0 OR COALESCE(_discount,-1) < 0 OR COALESCE(_tax_amount,-1) < 0 THEN RAISE EXCEPTION 'Invalid financial values'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items)=0 THEN RAISE EXCEPTION 'Sale items are required'; END IF;

  SELECT i.* INTO _existing FROM public.invoices i WHERE i.user_id=_owner AND i.operation_id=trim(_operation_id) LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT true,true,_existing.id,_existing.invoice_number; RETURN; END IF;

  SELECT NOT (COALESCE(s.store_type,'general') IN ('bakery','repair')) INTO _track_inventory
  FROM public.stores s WHERE s.user_id=_owner LIMIT 1;
  _track_inventory := COALESCE(_track_inventory,true);

  IF _warehouse_id IS NOT NULL THEN
    SELECT w.name INTO _warehouse_name FROM public.warehouses w
    WHERE w.id=_warehouse_id AND w.user_id=_owner AND COALESCE(w.is_active,true);
    IF NOT FOUND THEN RAISE EXCEPTION 'Warehouse not found'; END IF;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.pos_sale_items(
    product_id uuid PRIMARY KEY, product_name text NOT NULL, quantity numeric(14,3) NOT NULL,
    unit_price numeric, cost_price numeric, amount_original numeric, amount_usd numeric,
    profit numeric, unit text, conversion_factor numeric
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.pos_sale_items;

  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    BEGIN
      _product_id := (_item->>'product_id')::uuid;
      IF (_item->>'quantity') IS NULL OR (_item->>'quantity') !~ '^[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
      _quantity := round((_item->>'quantity')::numeric,3);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Invalid sale item'; END;
    IF _product_id IS NULL OR _quantity<=0 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    INSERT INTO pg_temp.pos_sale_items(product_id,product_name,quantity,unit_price,cost_price,amount_original,amount_usd,profit,unit,conversion_factor)
    VALUES (_product_id,COALESCE(NULLIF(_item->>'product_name',''),'Product'),_quantity,
      round(COALESCE(NULLIF(_item->>'unit_price','')::numeric,0),2),round(COALESCE(NULLIF(_item->>'cost_price','')::numeric,0),2),
      round(COALESCE(NULLIF(_item->>'amount_original','')::numeric,0),2),round(COALESCE(NULLIF(_item->>'amount_usd','')::numeric,0),2),
      round(COALESCE(NULLIF(_item->>'profit','')::numeric,0),2),COALESCE(NULLIF(_item->>'unit',''),'piece'),
      GREATEST(COALESCE(NULLIF(_item->>'conversion_factor','')::numeric,1),1))
    ON CONFLICT(product_id) DO UPDATE SET
      quantity=pg_temp.pos_sale_items.quantity+EXCLUDED.quantity,
      amount_original=pg_temp.pos_sale_items.amount_original+EXCLUDED.amount_original,
      amount_usd=pg_temp.pos_sale_items.amount_usd+EXCLUDED.amount_usd,
      profit=pg_temp.pos_sale_items.profit+EXCLUDED.profit;
  END LOOP;

  FOR _product_id,_product_name,_quantity IN SELECT psi.product_id,psi.product_name,psi.quantity FROM pg_temp.pos_sale_items psi LOOP
    PERFORM 1 FROM public.products p WHERE p.id=_product_id AND p.user_id=_owner AND COALESCE(p.archived,false)=false;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found (%)',_product_id; END IF;
    IF _track_inventory THEN
      IF _warehouse_id IS NOT NULL THEN
        SELECT ws.quantity INTO _available FROM public.warehouse_stock ws
        WHERE ws.warehouse_id=_warehouse_id AND ws.product_id=_product_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Product % is not assigned to warehouse %',_product_name,_warehouse_name; END IF;
      ELSE
        SELECT p.quantity INTO _available FROM public.products p WHERE p.id=_product_id AND p.user_id=_owner FOR UPDATE;
      END IF;
      IF COALESCE(_available,0)<_quantity THEN RAISE EXCEPTION 'Insufficient stock for % (%): available %, requested %',_product_name,COALESCE(_warehouse_name,'main inventory'),COALESCE(_available,0),_quantity; END IF;
    END IF;
  END LOOP;

  _next:=public.get_next_invoice_number(_owner);
  _number:=to_char(CURRENT_DATE,'YYYYMMDD')||'-'||lpad(_next::text,5,'0');
  INSERT INTO public.invoices(user_id,invoice_number,invoice_sequence,operation_id,invoice_type,date,time,cashier_id,cashier_name,customer_name,customer_phone,subtotal,discount,discount_percentage,tax_rate,tax_amount,total,profit,currency,exchange_rate,payment_type,status,debt_paid,debt_remaining,warehouse_id)
  SELECT _owner,_number,_next,trim(_operation_id),'sale',CURRENT_DATE,CURRENT_TIME,_caller::text,p.full_name,NULLIF(trim(_customer_name),''),NULLIF(trim(_customer_phone),''),round(COALESCE(_subtotal,0),2),round(COALESCE(_discount,0),2),COALESCE(_discount_percentage,0),COALESCE(_tax_rate,0),round(COALESCE(_tax_amount,0),2),round(COALESCE(_total,0),2),round(COALESCE(_profit,0),2),COALESCE(NULLIF(_currency,''),'USD'),1,_payment_type,CASE WHEN _payment_type='debt' THEN 'pending' ELSE 'paid' END,0,CASE WHEN _payment_type='debt' THEN round(COALESCE(_total,0),2) ELSE 0 END,_warehouse_id
  FROM (SELECT 1) seed LEFT JOIN public.profiles p ON p.user_id=_caller LIMIT 1 RETURNING * INTO _new_invoice;

  INSERT INTO public.invoice_items(invoice_id,product_id,product_name,quantity,unit_price,cost_price,currency,amount_original,amount_usd,profit,unit,conversion_factor,stock_warehouse_id)
  SELECT _new_invoice.id,psi.product_id,psi.product_name,psi.quantity,psi.unit_price,psi.cost_price,COALESCE(NULLIF(_currency,''),'USD'),psi.amount_original,psi.amount_usd,psi.profit,psi.unit,psi.conversion_factor,
    CASE WHEN _track_inventory THEN _warehouse_id ELSE NULL END
  FROM pg_temp.pos_sale_items psi;

  IF _track_inventory THEN
    PERFORM set_config('app.stock_movement_type','sale',true); PERFORM set_config('app.stock_invoice_id',_new_invoice.id::text,true);
    PERFORM set_config('app.stock_invoice_number',_new_invoice.invoice_number,true); PERFORM set_config('app.stock_actor_id',_caller::text,true);
    PERFORM set_config('app.stock_source','atomic_pos_sale',true);
    IF _warehouse_id IS NOT NULL THEN
      UPDATE public.warehouse_stock ws SET quantity=ws.quantity-psi.quantity,last_updated=now()
      FROM pg_temp.pos_sale_items psi WHERE ws.warehouse_id=_warehouse_id AND ws.product_id=psi.product_id;
    ELSE
      UPDATE public.products p SET quantity=COALESCE(p.quantity,0)-psi.quantity,updated_at=now()
      FROM pg_temp.pos_sale_items psi WHERE p.id=psi.product_id AND p.user_id=_owner;
    END IF;
  END IF;

  IF _payment_type='debt' THEN
    INSERT INTO public.debts(user_id,invoice_id,customer_name,customer_phone,total_debt,total_paid,remaining_debt,due_date,status,is_cash_debt,cashier_id)
    VALUES(_owner,_new_invoice.invoice_number,COALESCE(NULLIF(trim(_customer_name),''),'عميل بيع مؤجل'),NULLIF(trim(_customer_phone),''),round(COALESCE(_total,0),2),0,round(COALESCE(_total,0),2),CURRENT_DATE+30,'due',false,_caller);
  END IF;
  RETURN QUERY SELECT true,false,_new_invoice.id,_new_invoice.invoice_number;
EXCEPTION WHEN unique_violation THEN
  SELECT i.* INTO _existing FROM public.invoices i WHERE i.user_id=_owner AND i.operation_id=trim(_operation_id) LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT true,true,_existing.id,_existing.invoice_number; RETURN; END IF;
  RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text,_source text DEFAULT 'online'::text)
RETURNS TABLE(success boolean,already_refunded boolean,invoice_id uuid,invoice_number text,invoice_total numeric,invoice_currency text,restored_item_count integer,restored_unit_count numeric,deleted_debt_amount numeric,customer_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid:=auth.uid(); _owner uuid; _invoice public.invoices%ROWTYPE;
  _restored_items integer:=0; _restored_units numeric:=0; _deleted_debt numeric:=0; _has_refund boolean:=false;
  _row record;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner:=public.get_owner_id(_caller);
  SELECT i.* INTO _invoice FROM public.invoices i WHERE i.invoice_number=_invoice_number AND i.user_id=_owner FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false,false,NULL::uuid,_invoice_number,0::numeric,NULL::text,0,0::numeric,0::numeric,NULL::text; RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.stock_movements sm WHERE sm.user_id=_owner AND sm.invoice_id=_invoice.id AND sm.movement_type='refund') INTO _has_refund;
  IF _invoice.status='refunded' OR _has_refund THEN RETURN QUERY SELECT false,true,_invoice.id,_invoice.invoice_number,COALESCE(_invoice.total,0)::numeric,_invoice.currency::text,0,0::numeric,0::numeric,_invoice.customer_name::text; RETURN; END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.refund_items(product_id uuid NOT NULL,warehouse_id uuid,quantity numeric(14,3) NOT NULL,PRIMARY KEY(product_id,warehouse_id)) ON COMMIT DROP;
  TRUNCATE pg_temp.refund_items;
  INSERT INTO pg_temp.refund_items(product_id,warehouse_id,quantity)
  SELECT ii.product_id,ii.stock_warehouse_id,SUM(GREATEST(COALESCE(ii.quantity,0),0))
  FROM public.invoice_items ii WHERE ii.invoice_id=_invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NOT NULL
  GROUP BY ii.product_id,ii.stock_warehouse_id;
  INSERT INTO pg_temp.refund_items(product_id,warehouse_id,quantity)
  SELECT ii.product_id,NULL::uuid,SUM(GREATEST(COALESCE(ii.quantity,0),0))
  FROM public.invoice_items ii WHERE ii.invoice_id=_invoice.id AND ii.product_id IS NOT NULL AND ii.stock_warehouse_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.stock_movements sm WHERE sm.invoice_id=_invoice.id AND sm.product_id=ii.product_id AND sm.movement_type='sale')
  GROUP BY ii.product_id ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=pg_temp.refund_items.quantity+EXCLUDED.quantity;
  INSERT INTO pg_temp.refund_items(product_id,warehouse_id,quantity)
  SELECT sm.product_id,sm.warehouse_id,SUM(ABS(sm.quantity_delta))
  FROM public.stock_movements sm
  WHERE sm.invoice_id=_invoice.id AND sm.movement_type='sale'
    AND NOT EXISTS(SELECT 1 FROM public.invoice_items ii WHERE ii.invoice_id=_invoice.id AND ii.product_id=sm.product_id AND ii.stock_warehouse_id IS NOT NULL)
  GROUP BY sm.product_id,sm.warehouse_id
  ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=EXCLUDED.quantity;

  PERFORM set_config('app.stock_movement_type','refund',true); PERFORM set_config('app.stock_invoice_id',_invoice.id::text,true);
  PERFORM set_config('app.stock_invoice_number',_invoice.invoice_number,true); PERFORM set_config('app.stock_actor_id',_caller::text,true);
  PERFORM set_config('app.stock_source',CASE WHEN _source='offline-sync' THEN 'offline-sync' ELSE 'online' END,true);
  PERFORM set_config('app.refund_context','allowed',true);
  FOR _row IN SELECT * FROM pg_temp.refund_items LOOP
    IF _row.warehouse_id IS NULL THEN
      UPDATE public.products SET quantity=COALESCE(quantity,0)+_row.quantity WHERE id=_row.product_id AND user_id=_owner;
    ELSE
      UPDATE public.warehouse_stock ws SET quantity=COALESCE(ws.quantity,0)+_row.quantity,last_updated=now()
      WHERE ws.warehouse_id=_row.warehouse_id AND ws.product_id=_row.product_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Original warehouse stock row is missing for refunded product %',_row.product_id; END IF;
    END IF;
  END LOOP;
  SELECT COUNT(*)::integer,COALESCE(SUM(quantity),0)::numeric INTO _restored_items,_restored_units FROM pg_temp.refund_items;
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

REVOKE ALL ON FUNCTION public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.refund_invoice_atomic(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text,text) TO authenticated, service_role;