-- =========================================================================
-- Migration: 20261030040000_financial_core_precision_and_refunds_patch.sql
-- Description: Unifies Financial Core, 8-decimal precision, Carton COGS, 
--              Inclusive Tax isolation, and safe profit recalculation.
-- =========================================================================

-- 1) ترقية دالة إعادة احتساب أرباح الفاتورة لدعم 8 منازل وتكلفة الكرتون
CREATE OR REPLACE FUNCTION public.recalc_pos_invoice_profit(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE 
  _inv public.invoices%ROWTYPE; 
  _cogs numeric; 
  _sub numeric;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- احتساب سعر التكلفة بدقة استناداً لمعامل التحويل (كرتون أو قطعة)
  UPDATE public.invoice_items ii
     SET cost_price = round(COALESCE(p.cost_price, 0) * GREATEST(COALESCE(ii.conversion_factor, 1), 1), 6),
         warranty_until = CASE 
           WHEN p.warranty_months IS NOT NULL THEN (_inv.date + make_interval(months => p.warranty_months))::date 
           ELSE NULL 
         END
    FROM public.products p
   WHERE ii.invoice_id = _invoice_id 
     AND p.id = ii.product_id 
     AND p.user_id = _inv.user_id;

  -- جمع التكلفة والمجموع الفرعي
  SELECT COALESCE(SUM(COALESCE(cost_price, 0) * COALESCE(quantity, 0)), 0),
         COALESCE(SUM(COALESCE(unit_price, 0) * COALESCE(quantity, 0)), 0)
    INTO _cogs, _sub 
    FROM public.invoice_items 
   WHERE invoice_id = _invoice_id;

  -- توزيع الخصم على بنود الفاتورة واحتساب ربح كل صنف (8 منازل عشرية)
  UPDATE public.invoice_items
     SET profit = round(
           (COALESCE(unit_price, 0) - COALESCE(cost_price, 0)) * COALESCE(quantity, 0)
           - CASE WHEN _sub > 0 THEN COALESCE(_inv.discount, 0) * (COALESCE(unit_price, 0) * COALESCE(quantity, 0)) / _sub ELSE 0 END, 
           8
         )
   WHERE invoice_id = _invoice_id;

  -- تحديث مجمل ربح الفاتورة الأساسية
  UPDATE public.invoices
     SET profit = round(COALESCE(subtotal, _sub) - COALESCE(discount, 0) - _cogs, 8)
   WHERE id = _invoice_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.recalc_pos_invoice_profit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_pos_invoice_profit(uuid) TO authenticated;

-- 2) ترقية دالة معالجة البيع الذرية (process_pos_sale_atomic)
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS tax_mode text DEFAULT 'exclusive';

DROP FUNCTION IF EXISTS public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric,numeric);
DROP FUNCTION IF EXISTS public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric,numeric,text);

CREATE OR REPLACE FUNCTION public.process_pos_sale_atomic(
  _operation_id text,
  _payment_type text,
  _customer_name text,
  _customer_phone text,
  _subtotal numeric,
  _discount numeric,
  _discount_percentage numeric,
  _tax_rate numeric,
  _tax_amount numeric,
  _total numeric,
  _profit numeric,
  _currency text,
  _warehouse_id uuid,
  _items jsonb,
  _down_payment numeric DEFAULT 0,
  _exchange_rate numeric DEFAULT 1,
  _tax_mode text DEFAULT 'exclusive'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _user_id uuid := auth.uid();
  _inv_id uuid;
  _inv_number text;
  _item record;
  _current_stock numeric;
  _new_stock numeric;
  _has_shortage boolean := false;
  _is_cash boolean := (_payment_type = 'cash');
  _effective_rate numeric := GREATEST(COALESCE(_exchange_rate, 1), 0.00000001);
  _usd_total numeric;
  _usd_subtotal numeric;
  _usd_discount numeric;
  _usd_tax numeric;
  _usd_down_payment numeric;
  _debt_amount numeric;
  _cogs_accum numeric := 0;
  _line_cogs numeric;
  _line_qty numeric;
  _line_price numeric;
  _line_profit numeric;
  _conv_factor numeric;
  _server_cost numeric;
BEGIN
  -- التحقق من العمليات المكررة (Idempotency)
  SELECT id, invoice_number INTO _inv_id, _inv_number FROM public.invoices WHERE operation_id = _operation_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'invoice_id', _inv_id, 'invoice_number', _inv_number);
  END IF;

  -- تحويل كل القيم للعملة الأساسية (USD) بدقة 8 منازل عشرية
  _usd_subtotal     := round(_subtotal / _effective_rate, 8);
  _usd_discount     := round(_discount / _effective_rate, 8);
  _usd_tax          := round(_tax_amount / _effective_rate, 8);
  _usd_total        := round(_total / _effective_rate, 8);
  _usd_down_payment := round(COALESCE(_down_payment, 0) / _effective_rate, 8);
  _debt_amount      := GREATEST(0, _usd_total - _usd_down_payment);

  -- توليد رقم الفاتورة
  _inv_number := 'INV-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS');

  -- إنشاء رأس الفاتورة
  INSERT INTO public.invoices (
    user_id, operation_id, invoice_number, payment_type, customer_name, customer_phone,
    subtotal, discount, discount_percentage, tax_rate, tax_amount, total, profit,
    currency, exchange_rate, status, date, tax_mode
  ) VALUES (
    _user_id, _operation_id, _inv_number, _payment_type, _customer_name, _customer_phone,
    _usd_subtotal, _usd_discount, _discount_percentage, _tax_rate, _usd_tax, _usd_total, 0,
    COALESCE(_currency, 'USD'), _effective_rate, 'completed', CURRENT_DATE, COALESCE(_tax_mode, 'exclusive')
  ) RETURNING id INTO _inv_id;

  -- إدراج البنود وخصم المخزون واحتساب التكلفة بدقة
  FOR _item IN SELECT * FROM jsonb_to_recordset(_items) AS x(
    product_id uuid,
    product_name text,
    quantity numeric,
    price numeric,
    unit text,
    conversion_factor numeric
  ) LOOP
    _line_qty := COALESCE(_item.quantity, 1);
    _line_price := round(COALESCE(_item.price, 0) / _effective_rate, 8);
    _conv_factor := GREATEST(COALESCE(_item.conversion_factor, 1), 1);

    -- جلب تكلفة الخادم الرسمية لمنع التلاعب
    SELECT COALESCE(cost_price, 0), COALESCE(stock_quantity, 0)
      INTO _server_cost, _current_stock
      FROM public.products
     WHERE id = _item.product_id AND user_id = _user_id
       FOR UPDATE;

    -- احتساب تكلفة البند بدقة بحسب الوحدة (قطعة / كرتون)
    _line_cogs := round(_server_cost * _conv_factor, 6);
    _cogs_accum := _cogs_accum + (_line_cogs * _line_qty);

    _line_profit := round((_line_price - _line_cogs) * _line_qty, 8);

    -- إدراج سطر الفاتورة
    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, quantity, unit_price, cost_price, profit, unit, conversion_factor
    ) VALUES (
      _inv_id, _item.product_id, _item.product_name, _line_qty, _line_price, _line_cogs, _line_profit, _item.unit, _conv_factor
    );

    -- تحديث المخزون وحفظ الحركات
    _new_stock := _current_stock - (_line_qty * (CASE WHEN _item.unit = 'bulk' THEN _conv_factor ELSE 1 END));
    IF _new_stock < 0 THEN _has_shortage := true; END IF;

    UPDATE public.products SET stock_quantity = _new_stock, updated_at = now() WHERE id = _item.product_id;

    INSERT INTO public.inventory_movements (
      user_id, product_id, movement_type, quantity, reference_id, notes
    ) VALUES (
      _user_id, _item.product_id, 'sale', -(_line_qty * (CASE WHEN _item.unit = 'bulk' THEN _conv_factor ELSE 1 END)), _inv_id::text, 'بيع عبر POS'
    );
  END LOOP;

  -- إعادة ضبط أرباح الفاتورة النهائية بعد احتساب الخصم الكلي
  UPDATE public.invoices
     SET profit = round(_usd_subtotal - _usd_discount - _cogs_accum, 8)
   WHERE id = _inv_id;

  -- تسجيل الدين إذا كان البيع آجلاً
  IF NOT _is_cash AND _debt_amount > 0 THEN
    INSERT INTO public.debts (
      user_id, customer_name, customer_phone, amount, remaining_amount, invoice_id, debt_type, status, due_date
    ) VALUES (
      _user_id, _customer_name, _customer_phone, _debt_amount, _debt_amount, _inv_id, 'customer', 'pending', CURRENT_DATE + interval '30 days'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'invoice_id', _inv_id,
    'invoice_number', _inv_number,
    'subtotal', _usd_subtotal,
    'discount', _usd_discount,
    'tax_amount', _usd_tax,
    'total', _usd_total,
    'cogs', round(_cogs_accum, 8),
    'profit', round(_usd_subtotal - _usd_discount - _cogs_accum, 8),
    'stock_shortage', _has_shortage
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_pos_sale_atomic(text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,jsonb,numeric,numeric,text) TO authenticated;
