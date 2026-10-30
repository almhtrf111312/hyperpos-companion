-- =========================================================================
-- Migration: 20261030140000_wac_reversal_edit_purchase.sql
-- Description:
-- 1) Add cost_price_before column to purchase_invoice_items
-- 2) Atomic function edit_purchase_invoice_atomic with safe WAC reversal
-- 3) Add target_version_code to app_broadcasts
-- 4) Prevent indebted customer deletion trigger
-- =========================================================================

-- 1. التأكد من وجود عمود تكلفة ما قبل الشراء لتتبع التكلفة السابقة بدقة
ALTER TABLE IF EXISTS public.purchase_invoice_items
  ADD COLUMN IF NOT EXISTS cost_price_before NUMERIC;

-- 2. إضافة عمود رقم الإصدار المستهدف في جدول البث (اختياري ودقيق)
ALTER TABLE IF EXISTS public.app_broadcasts 
  ADD COLUMN IF NOT EXISTS target_version_code INTEGER;

-- 3. إنشاء الدالة الذرية لتعديل فاتورة الشراء وعكس التكلفة والمخزون بأمان
CREATE OR REPLACE FUNCTION public.edit_purchase_invoice_atomic(
  _invoice_id UUID,
  _new_lines JSONB,
  _op_id TEXT,
  _reason TEXT DEFAULT 'Purchase invoice edit'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller UUID := auth.uid();
  _owner UUID;
  _orig_inv RECORD;
  _existing_id UUID;
  _new_invoice_id UUID;
  _old_item RECORD;
  _line JSONB;
  _prod_id UUID;
  _prod_qty NUMERIC;
  _prod_cost NUMERIC;
  _prod_name TEXT;
  _prod_barcode TEXT;
  _prod_cat TEXT;
  _cur_stock NUMERIC;
  _cur_cost NUMERIC;
  _new_stock NUMERIC;
  _new_cost NUMERIC;
  _items_count INT := 0;
  _total_qty NUMERIC := 0;
  _grand_total NUMERIC := 0;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);

  -- منع التكرار (Idempotency)
  SELECT id INTO _existing_id FROM public.purchase_invoices WHERE operation_id = _op_id;
  IF _existing_id IS NOT NULL THEN
    RETURN _existing_id;
  END IF;

  SELECT * INTO _orig_inv FROM public.purchase_invoices WHERE id = _invoice_id AND user_id = _owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original invoice not found'; END IF;

  -- 1) عكس أثر الكميات والتكلفة القديمة
  FOR _old_item IN SELECT * FROM public.purchase_invoice_items WHERE invoice_id = _invoice_id LOOP
    SELECT quantity, cost_price INTO _cur_stock, _cur_cost FROM public.products WHERE id = _old_item.product_id AND user_id = _owner FOR UPDATE;
    IF FOUND THEN
      _new_stock := GREATEST(0, COALESCE(_cur_stock, 0) - COALESCE(_old_item.quantity, 0));
      IF _old_item.cost_price_before IS NOT NULL THEN
        _new_cost := _old_item.cost_price_before;
      ELSIF _new_stock > 0 THEN
        _new_cost := GREATEST(0, ((COALESCE(_cur_stock, 0) * COALESCE(_cur_cost, 0)) - (COALESCE(_old_item.quantity, 0) * COALESCE(_old_item.cost_price, 0))) / _new_stock);
      ELSE
        _new_cost := COALESCE(_cur_cost, 0);
      END IF;

      UPDATE public.products SET quantity = _new_stock, cost_price = _new_cost, updated_at = NOW() WHERE id = _old_item.product_id;
    END IF;
  END LOOP;

  -- 2) إنشاء الفاتورة الجديدة المعدلة
  INSERT INTO public.purchase_invoices (
    user_id, invoice_number, supplier_name, invoice_date, total_amount, notes,
    payment_status, payment_method, original_currency, exchange_rate, operation_id
  ) VALUES (
    _owner, _orig_inv.invoice_number || '-E', _orig_inv.supplier_name, NOW(), 0,
    COALESCE(_reason, 'تعديل الفاتورة ' || _orig_inv.invoice_number),
    _orig_inv.payment_status, _orig_inv.payment_method, _orig_inv.original_currency, _orig_inv.exchange_rate, _op_id
  ) RETURNING id INTO _new_invoice_id;

  -- 3) إدراج البنود الجديدة وتطبيق WAC الجديد
  FOR _line IN SELECT * FROM jsonb_array_elements(_new_lines) LOOP
    _prod_id := (_line->>'product_id')::UUID;
    _prod_qty := GREATEST(0, (_line->>'quantity')::NUMERIC);
    _prod_cost := GREATEST(0, (_line->>'cost_price')::NUMERIC);
    _prod_name := COALESCE(_line->>'product_name', 'صنف');
    _prod_barcode := _line->>'barcode';
    _prod_cat := _line->>'category';

    SELECT quantity, cost_price INTO _cur_stock, _cur_cost FROM public.products WHERE id = _prod_id AND user_id = _owner FOR UPDATE;
    IF FOUND THEN
      _new_stock := COALESCE(_cur_stock, 0) + _prod_qty;
      IF _new_stock > 0 THEN
        _new_cost := ((COALESCE(_cur_stock, 0) * COALESCE(_cur_cost, 0)) + (_prod_qty * _prod_cost)) / _new_stock;
      ELSE
        _new_cost := _prod_cost;
      END IF;

      UPDATE public.products SET quantity = _new_stock, cost_price = _new_cost, updated_at = NOW() WHERE id = _prod_id;

      INSERT INTO public.purchase_invoice_items (
        invoice_id, product_id, product_name, barcode, category,
        quantity, cost_price, cost_price_before, sale_price, total_cost
      ) VALUES (
        _new_invoice_id, _prod_id, _prod_name, _prod_barcode, _prod_cat,
        _prod_qty, _prod_cost, _cur_cost, (_line->>'sale_price')::NUMERIC, (_prod_qty * _prod_cost)
      );

      _items_count := _items_count + 1;
      _total_qty := _total_qty + _prod_qty;
      _grand_total := _grand_total + (_prod_qty * _prod_cost);
    END IF;
  END LOOP;

  -- تحديث إجمالي الفاتورة الجديدة
  UPDATE public.purchase_invoices SET total_amount = _grand_total, total_items = _items_count, total_quantity = _total_qty WHERE id = _new_invoice_id;

  -- أرشفة الفاتورة القديمة وإلغاؤها
  UPDATE public.purchase_invoices SET payment_status = 'cancelled', notes = COALESCE(notes, '') || ' [تم استبدالها بـ ' || _orig_inv.invoice_number || '-E]' WHERE id = _invoice_id;

  RETURN _new_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_purchase_invoice_atomic(UUID, JSONB, TEXT, TEXT) TO authenticated;

-- 4. صمام أمان سيرفر: منع حذف أي عميل لديه ديون معلقة أو فواتير مسجلة
CREATE OR REPLACE FUNCTION public.prevent_customer_deletion_with_dues()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.debts WHERE customer_name = OLD.name AND remaining_debt > 0.001) THEN
    RAISE EXCEPTION 'لا يمكن حذف العميل: توجد ديون وذمم مالية قائمة ومستحقة';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE customer_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف العميل: توجد فواتير مبيعات سابقة مسجلة باسمه';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_customer_deletion ON public.customers;
CREATE TRIGGER trg_prevent_customer_deletion
BEFORE DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_deletion_with_dues();
