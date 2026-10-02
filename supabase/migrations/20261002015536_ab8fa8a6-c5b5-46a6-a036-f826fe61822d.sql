DROP FUNCTION IF EXISTS public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric);

CREATE FUNCTION public.process_pos_sale_atomic(_operation_id text, _payment_type text, _customer_name text, _customer_phone text, _subtotal numeric, _discount numeric, _discount_percentage numeric, _tax_rate numeric, _tax_amount numeric, _total numeric, _profit numeric, _currency text, _warehouse_id uuid, _items jsonb, _down_payment numeric DEFAULT 0)
 RETURNS TABLE(success boolean, already_processed boolean, invoice_id uuid, invoice_number text, subtotal numeric, discount numeric, tax_amount numeric, total numeric, cogs numeric, profit numeric, debt_paid numeric, debt_remaining numeric, stock_shortage boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid(); _owner uuid; _existing public.invoices%ROWTYPE;
  _new_invoice public.invoices%ROWTYPE; _next bigint; _number text; _item jsonb;
  _product_id uuid; _quantity numeric; _available numeric; _product_name text;
  _warehouse_name text; _track_inventory boolean := true; _src uuid;
  _dp numeric := 0; _sub numeric; _disc numeric; _rate numeric := 0; _tax numeric; _tot numeric;
  _tax_enabled boolean; _store_rate numeric; _shortage boolean := false; _cust uuid; _cname text;
  _remaining numeric; _cogs numeric;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);
  IF _owner IS NULL THEN RAISE EXCEPTION 'Owner context is required'; END IF;
  IF _operation_id IS NULL OR length(trim(_operation_id)) < 8 OR length(_operation_id) > 128 THEN RAISE EXCEPTION 'Invalid operation id'; END IF;
  IF _payment_type NOT IN ('cash','debt') THEN RAISE EXCEPTION 'Invalid payment type'; END IF;
  IF COALESCE(_discount,0) < 0 OR COALESCE(_down_payment,0) < 0 THEN RAISE EXCEPTION 'Invalid financial values'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items)=0 THEN RAISE EXCEPTION 'Sale items are required'; END IF;

  SELECT i.* INTO _existing FROM public.invoices i WHERE i.user_id=_owner AND i.operation_id=trim(_operation_id) LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true,true,_existing.id,_existing.invoice_number,_existing.subtotal,_existing.discount,_existing.tax_amount,_existing.total,
      (SELECT COALESCE(SUM(ii.cost_price*ii.quantity),0) FROM public.invoice_items ii WHERE ii.invoice_id=_existing.id),
      _existing.profit,_existing.debt_paid,_existing.debt_remaining,false;
    RETURN;
  END IF;

  SELECT NOT (COALESCE(s.store_type,'general') IN ('bakery','repair')), COALESCE(s.tax_enabled,false), COALESCE(s.tax_rate,0)
    INTO _track_inventory, _tax_enabled, _store_rate
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
    profit numeric, unit text, conversion_factor numeric, source_warehouse_id uuid
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.pos_sale_items;

  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    BEGIN
      _product_id := (_item->>'product_id')::uuid;
      IF (_item->>'quantity') IS NULL OR (_item->>'quantity') !~ '^[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
      _quantity := round((_item->>'quantity')::numeric,3);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Invalid sale item'; END;
    IF _product_id IS NULL OR _quantity<=0 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    IF COALESCE(NULLIF(_item->>'unit_price','')::numeric,0) < 0 OR COALESCE(NULLIF(_item->>'amount_usd','')::numeric,0) < 0 THEN RAISE EXCEPTION 'Invalid item price'; END IF;
    -- cost_price/profit from the client are ignored: the server fills them from products below
    INSERT INTO pg_temp.pos_sale_items(product_id,product_name,quantity,unit_price,cost_price,amount_original,amount_usd,profit,unit,conversion_factor,source_warehouse_id)
    VALUES (_product_id,COALESCE(NULLIF(_item->>'product_name',''),'Product'),_quantity,
      round(COALESCE(NULLIF(_item->>'unit_price','')::numeric,0),2),0,
      round(COALESCE(NULLIF(_item->>'amount_original','')::numeric,0),2),round(COALESCE(NULLIF(_item->>'amount_usd','')::numeric,0),2),
      0,COALESCE(NULLIF(_item->>'unit',''),'piece'),
      GREATEST(COALESCE(NULLIF(_item->>'conversion_factor','')::numeric,1),1), NULL)
    ON CONFLICT(product_id) DO UPDATE SET
      quantity=pg_temp.pos_sale_items.quantity+EXCLUDED.quantity,
      amount_original=pg_temp.pos_sale_items.amount_original+EXCLUDED.amount_original,
      amount_usd=pg_temp.pos_sale_items.amount_usd+EXCLUDED.amount_usd;
  END LOOP;

  FOR _product_id,_product_name,_quantity IN SELECT psi.product_id,psi.product_name,psi.quantity FROM pg_temp.pos_sale_items psi LOOP
    PERFORM 1 FROM public.products p WHERE p.id=_product_id AND p.user_id=_owner AND COALESCE(p.archived,false)=false;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found (%)',_product_id; END IF;
    IF NOT _track_inventory THEN CONTINUE; END IF;
    _src := NULL; _available := NULL;
    IF _warehouse_id IS NOT NULL THEN
      SELECT ws.quantity INTO _available FROM public.warehouse_stock ws
      WHERE ws.warehouse_id=_warehouse_id AND ws.product_id=_product_id FOR UPDATE;
      IF FOUND THEN _src := _warehouse_id; END IF;
    END IF;
    IF _src IS NULL THEN
      SELECT p.quantity INTO _available FROM public.products p WHERE p.id=_product_id AND p.user_id=_owner FOR UPDATE;
    END IF;
    -- Negative stock is allowed (offline sales syncing late); the shortage is flagged, never blocks the invoice
    IF COALESCE(_available,0) < _quantity THEN _shortage := true; END IF;
    UPDATE pg_temp.pos_sale_items SET source_warehouse_id=_src WHERE product_id=_product_id;
  END LOOP;

  -- Server-authoritative totals (tax is never part of profit)
  SELECT round(COALESCE(SUM(amount_usd),0),2) INTO _sub FROM pg_temp.pos_sale_items;
  _disc := round(LEAST(GREATEST(COALESCE(_discount,0),0),_sub),2);
  IF _tax_enabled THEN _rate := LEAST(GREATEST(COALESCE(_tax_rate,0),0),100); END IF;
  _tax := round((_sub-_disc)*_rate/100,2);
  _tot := round(_sub-_disc+_tax,2);

  _dp := round(COALESCE(_down_payment,0),2);
  IF _payment_type <> 'debt' THEN _dp := 0; END IF;
  _dp := LEAST(_dp,_tot);
  _remaining := CASE WHEN _payment_type='debt' THEN round(_tot-_dp,2) ELSE 0 END;

  _cname := NULLIF(trim(_customer_name),'');
  IF _cname IS NOT NULL AND _cname NOT IN ('عميل نقدي','عميل بيع مؤجل') THEN
    SELECT c.id INTO _cust FROM public.customers c WHERE c.user_id=_owner AND lower(trim(c.name))=lower(_cname) ORDER BY c.created_at LIMIT 1 FOR UPDATE;
    IF _cust IS NULL THEN
      INSERT INTO public.customers(user_id,name,phone,cashier_id) VALUES(_owner,_cname,NULLIF(trim(_customer_phone),''),_caller) RETURNING id INTO _cust;
    END IF;
  END IF;

  _next:=public.get_next_invoice_number(_owner);
  _number:=to_char(CURRENT_DATE,'YYYYMMDD')||'-'||lpad(_next::text,5,'0');
  INSERT INTO public.invoices(user_id,invoice_number,invoice_sequence,operation_id,invoice_type,date,time,cashier_id,cashier_name,customer_id,customer_name,customer_phone,subtotal,discount,discount_percentage,tax_rate,tax_amount,total,profit,currency,exchange_rate,payment_type,status,debt_paid,debt_remaining,warehouse_id)
  SELECT _owner,_number,_next,trim(_operation_id),'sale',CURRENT_DATE,CURRENT_TIME,_caller::text,p.full_name,_cust,_cname,NULLIF(trim(_customer_phone),''),_sub,_disc,COALESCE(_discount_percentage,0),_rate,_tax,_tot,0,COALESCE(NULLIF(_currency,''),'USD'),1,_payment_type,
    CASE WHEN _remaining > 0 THEN 'pending' ELSE 'paid' END,
    CASE WHEN _payment_type='debt' THEN _dp ELSE 0 END, _remaining, _warehouse_id
  FROM (SELECT 1) seed LEFT JOIN public.profiles p ON p.user_id=_caller LIMIT 1 RETURNING * INTO _new_invoice;

  -- recalc_pos_invoice_profit trigger fills cost_price from products and computes profit with the existing formula
  INSERT INTO public.invoice_items(invoice_id,product_id,product_name,quantity,unit_price,cost_price,currency,amount_original,amount_usd,profit,unit,conversion_factor,stock_warehouse_id)
  SELECT _new_invoice.id,psi.product_id,psi.product_name,psi.quantity,psi.unit_price,0,COALESCE(NULLIF(_currency,''),'USD'),psi.amount_original,psi.amount_usd,0,psi.unit,psi.conversion_factor,
    CASE WHEN _track_inventory THEN psi.source_warehouse_id ELSE NULL END
  FROM pg_temp.pos_sale_items psi;
  PERFORM public.recalc_pos_invoice_profit(_new_invoice.id);

  IF _track_inventory THEN
    PERFORM set_config('app.stock_movement_type','sale',true); PERFORM set_config('app.stock_invoice_id',_new_invoice.id::text,true);
    PERFORM set_config('app.stock_invoice_number',_new_invoice.invoice_number,true); PERFORM set_config('app.stock_actor_id',_caller::text,true);
    PERFORM set_config('app.stock_source','atomic_pos_sale',true);
    -- quantity only; cost_price (WAC) is never touched by a sale, even when stock goes negative
    UPDATE public.warehouse_stock ws SET quantity=ws.quantity-psi.quantity,last_updated=now()
    FROM pg_temp.pos_sale_items psi
    WHERE psi.source_warehouse_id IS NOT NULL AND ws.warehouse_id=psi.source_warehouse_id AND ws.product_id=psi.product_id;
    UPDATE public.products p SET quantity=COALESCE(p.quantity,0)-psi.quantity,updated_at=now()
    FROM pg_temp.pos_sale_items psi
    WHERE psi.source_warehouse_id IS NULL AND p.id=psi.product_id AND p.user_id=_owner;
  END IF;

  IF _remaining > 0 THEN
    INSERT INTO public.debts(user_id,invoice_id,customer_name,customer_phone,total_debt,total_paid,remaining_debt,due_date,status,is_cash_debt,cashier_id)
    VALUES(_owner,_new_invoice.invoice_number,COALESCE(_cname,'عميل بيع مؤجل'),NULLIF(trim(_customer_phone),''),_tot,_dp,_remaining,CURRENT_DATE+30,CASE WHEN _dp>0 THEN 'partial' ELSE 'due' END,false,_caller);
  END IF;

  IF _cust IS NOT NULL THEN
    UPDATE public.customers c SET
      total_purchases = round(COALESCE(c.total_purchases,0)+_tot,2),
      total_debt = round(COALESCE(c.total_debt,0)+_remaining,2),
      invoice_count = COALESCE(c.invoice_count,0)+1,
      last_purchase = now(), updated_at = now()
    WHERE c.id=_cust;
  END IF;

  SELECT i.* INTO _new_invoice FROM public.invoices i WHERE i.id=_new_invoice.id;
  SELECT COALESCE(SUM(ii.cost_price*ii.quantity),0) INTO _cogs FROM public.invoice_items ii WHERE ii.invoice_id=_new_invoice.id;
  RETURN QUERY SELECT true,false,_new_invoice.id,_new_invoice.invoice_number,_sub,_disc,_tax,_tot,round(_cogs,2),_new_invoice.profit,_new_invoice.debt_paid,_new_invoice.debt_remaining,_shortage;
EXCEPTION WHEN unique_violation THEN
  SELECT i.* INTO _existing FROM public.invoices i WHERE i.user_id=_owner AND i.operation_id=trim(_operation_id) LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT true,true,_existing.id,_existing.invoice_number,_existing.subtotal,_existing.discount,_existing.tax_amount,_existing.total,0::numeric,_existing.profit,_existing.debt_paid,_existing.debt_remaining,false; RETURN; END IF;
  RAISE;
END;
$function$;
REVOKE ALL ON FUNCTION public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric) TO authenticated;

-- Weighted average cost on stock receipt. Negative stock is covered by the new price first.
CREATE OR REPLACE FUNCTION public.receive_stock_wac(_product_id uuid, _quantity numeric, _unit_cost numeric, _reference text DEFAULT NULL)
 RETURNS TABLE(new_quantity numeric, new_cost numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _caller uuid := auth.uid(); _owner uuid; _q numeric; _c numeric; _pos numeric; _nc numeric;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);
  IF COALESCE(_quantity,0) <= 0 OR COALESCE(_unit_cost,-1) < 0 THEN RAISE EXCEPTION 'Invalid receipt values'; END IF;
  SELECT COALESCE(p.quantity,0), COALESCE(p.cost_price,0) INTO _q,_c FROM public.products p
   WHERE p.id=_product_id AND p.user_id=_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  _pos := GREATEST(_q,0);
  IF _unit_cost = 0 THEN _nc := _c;
  ELSE _nc := round((_pos*_c + _quantity*_unit_cost)/(_pos+_quantity),4); END IF;
  PERFORM set_config('app.stock_movement_type','purchase',true);
  PERFORM set_config('app.stock_actor_id',_caller::text,true);
  PERFORM set_config('app.stock_source',COALESCE(_reference,'purchase_receipt'),true);
  UPDATE public.products SET quantity=_q+_quantity, cost_price=round(_nc,2), updated_at=now() WHERE id=_product_id;
  RETURN QUERY SELECT _q+_quantity, round(_nc,2);
END $$;
REVOKE ALL ON FUNCTION public.receive_stock_wac(uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_stock_wac(uuid,numeric,numeric,text) TO authenticated;