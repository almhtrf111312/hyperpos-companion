
-- 1) Typed product fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS wholesale_price numeric,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS fabric_type text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS table_number text,
  ADD COLUMN IF NOT EXISTS order_notes text;

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS warranty_until date;

CREATE OR REPLACE FUNCTION public.sync_product_typed_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE cf jsonb := COALESCE(NEW.custom_fields,'{}'::jsonb); _w text; _wp text;
BEGIN
  NEW.serial_number := NULLIF(left(trim(COALESCE(cf->>'serialNumber','')),64),'');
  NEW.batch_number  := NULLIF(left(trim(COALESCE(cf->>'batchNumber','')),64),'');
  NEW.weight        := NULLIF(left(trim(COALESCE(cf->>'weight','')),32),'');
  NEW.size          := NULLIF(left(trim(COALESCE(cf->>'size','')),32),'');
  NEW.color         := NULLIF(left(trim(COALESCE(cf->>'color','')),32),'');
  NEW.fabric_type   := NULLIF(left(trim(COALESCE(cf->>'fabricType','')),64),'');
  NEW.author        := NULLIF(left(trim(COALESCE(cf->>'author','')),120),'');
  NEW.publisher     := NULLIF(left(trim(COALESCE(cf->>'publisher','')),120),'');
  NEW.table_number  := NULLIF(left(trim(COALESCE(cf->>'tableNumber','')),16),'');
  NEW.order_notes   := NULLIF(left(trim(COALESCE(cf->>'orderNotes','')),500),'');
  _w := substring(COALESCE(cf->>'warranty','') from '([0-9]+)');
  NEW.warranty_months := CASE WHEN _w IS NULL THEN NULL
    WHEN COALESCE(cf->>'warranty','') ~* '(سنة|سنوات|year)' THEN LEAST(_w::int*12,600)
    ELSE LEAST(_w::int,600) END;
  _wp := COALESCE(cf->>'wholesalePrice','');
  NEW.wholesale_price := CASE WHEN _wp ~ '^[0-9]+([.][0-9]+)?$' AND _wp::numeric > 0 THEN round(_wp::numeric,2) ELSE NULL END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_product_typed_fields_trigger ON public.products;
CREATE TRIGGER sync_product_typed_fields_trigger
BEFORE INSERT OR UPDATE OF custom_fields ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_typed_fields();

UPDATE public.products SET custom_fields = custom_fields WHERE custom_fields IS NOT NULL;

-- keep existing duplicates from blocking: index only when unique now
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE serial_number IS NOT NULL
                 GROUP BY user_id, serial_number HAVING COUNT(*)>1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS products_owner_serial_unique
      ON public.products(user_id, serial_number) WHERE serial_number IS NOT NULL AND COALESCE(archived,false)=false;
  END IF;
END $$;

-- 2) Price change audit
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cost_price IS DISTINCT FROM OLD.cost_price OR NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
    INSERT INTO public.activity_log(user_id, actor_id, action_type, entity_type, entity_id, entity_name, description, metadata)
    VALUES (NEW.user_id, auth.uid(), 'product_price_changed', 'product', NEW.id::text, NEW.name,
      'تغيير سعر المنتج ' || NEW.name,
      jsonb_build_object('old_cost',OLD.cost_price,'new_cost',NEW.cost_price,'old_sale',OLD.sale_price,'new_sale',NEW.sale_price,
        'source', COALESCE(NULLIF(current_setting('app.stock_source', true),''),'direct_update')));
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_product_price_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_product_price_change_trigger ON public.products;
CREATE TRIGGER log_product_price_change_trigger
AFTER UPDATE OF cost_price, sale_price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_product_price_change();

-- 3) Server-side profit/cost for POS invoices (runs after the sale RPC inserts items)
CREATE OR REPLACE FUNCTION public.recalc_pos_invoice_profit(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _inv public.invoices%ROWTYPE; _cogs numeric; _sub numeric;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id=_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.invoice_items ii
     SET cost_price = round(COALESCE(p.cost_price,0) * GREATEST(COALESCE(ii.conversion_factor,1),1), 2),
         warranty_until = CASE WHEN p.warranty_months IS NOT NULL THEN (_inv.date + make_interval(months => p.warranty_months))::date ELSE NULL END
    FROM public.products p
   WHERE ii.invoice_id=_invoice_id AND p.id=ii.product_id AND p.user_id=_inv.user_id;
  SELECT COALESCE(SUM(COALESCE(cost_price,0)*COALESCE(quantity,0)),0),
         COALESCE(SUM(COALESCE(unit_price,0)*COALESCE(quantity,0)),0)
    INTO _cogs, _sub FROM public.invoice_items WHERE invoice_id=_invoice_id;
  UPDATE public.invoice_items
     SET profit = round((COALESCE(unit_price,0)-COALESCE(cost_price,0))*COALESCE(quantity,0)
                  - CASE WHEN _sub>0 THEN COALESCE(_inv.discount,0)*(COALESCE(unit_price,0)*COALESCE(quantity,0))/_sub ELSE 0 END, 2)
   WHERE invoice_id=_invoice_id;
  UPDATE public.invoices
     SET profit = round(COALESCE(subtotal,_sub) - COALESCE(discount,0) - _cogs, 2)
   WHERE id=_invoice_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalc_pos_invoice_profit(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_recalc_pos_invoice_profit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(current_setting('app.stock_source', true),'') = 'atomic_pos_sale'
     OR COALESCE(current_setting('app.pos_sale_ctx', true),'') = 'on' THEN
    PERFORM public.recalc_pos_invoice_profit(NEW.invoice_id);
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_pos_invoice_profit() FROM PUBLIC, anon, authenticated;
