-- =========================================================================
-- FlowPOS Pro: Unified Server Migration Patch
-- 1. حل تضارب دالة البيع الذري بحذف التوقيع القديم
-- 2. دعم العملات الأصلية للمصروفات والورديات
-- 3. دالة تعديل المشتريات الذرية وحفظ التكلفة السابقة
-- =========================================================================

-- 1. حذف التوقيع القديم المكرر لدالة البيع الذري لمنع خطأ Ambiguous Overload
DROP FUNCTION IF EXISTS public.process_pos_sale_atomic(
  text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, jsonb, numeric, numeric
);

-- 2. إضافة أعمدة العملات المتعددة للمصروفات وحركات الصندوق
ALTER TABLE IF EXISTS public.expenses 
  ADD COLUMN IF NOT EXISTS original_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

ALTER TABLE IF EXISTS public.recurring_expenses
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS original_amount numeric;

ALTER TABLE IF EXISTS public.shift_transactions
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS currency_amount numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_shift_transactions_shift_id ON public.shift_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_expenses_orig_currency ON public.expenses(original_currency);

-- 3. إضافة عمود التكلفة السابقة في بنود فواتير الشراء إن لم يكن موجوداً
ALTER TABLE IF EXISTS public.purchase_invoice_items
  ADD COLUMN IF NOT EXISTS cost_price_before NUMERIC;

-- 4. ترقية دالة تعديل فاتورة الشراء مع عكس WAC الدقيق
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
  _net_total NUMERIC := 0;
  _calc_subtotal NUMERIC := 0;
  _total_items_count INT := 0;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO _owner FROM public.profiles WHERE id = _caller;
  IF _owner IS NULL THEN _owner := _caller; END IF;

  SELECT * INTO _orig_inv FROM public.purchase_invoices
   WHERE id = _invoice_id AND user_id = _owner;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase invoice not found or not owned';
  END IF;

  IF _orig_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot edit a cancelled purchase invoice';
  END IF;

  -- عكس المخزون والتكلفة لبنود الفاتورة القديمة
  FOR _old_item IN
    SELECT pii.*, p.stock_quantity AS cur_stock, p.cost_price AS cur_cost
      FROM public.purchase_invoice_items pii
      JOIN public.products p ON p.id = pii.product_id
     WHERE pii.invoice_id = _invoice_id
       FOR UPDATE OF p
  LOOP
    _new_stock := GREATEST(0, COALESCE(_old_item.cur_stock, 0) - COALESCE(_old_item.quantity, 0));
    
    IF _old_item.cost_price_before IS NOT NULL THEN
      _new_cost := _old_item.cost_price_before;
    ELSIF _new_stock > 0 AND (COALESCE(_old_item.cur_stock, 0) * COALESCE(_old_item.cur_cost, 0) - COALESCE(_old_item.quantity, 0) * COALESCE(_old_item.cost_price, 0)) > 0 THEN
      _new_cost := round(
        (COALESCE(_old_item.cur_stock, 0) * COALESCE(_old_item.cur_cost, 0) - COALESCE(_old_item.quantity, 0) * COALESCE(_old_item.cost_price, 0)) / _new_stock,
        8
      );
    ELSE
      _new_cost := COALESCE(_old_item.cur_cost, 0);
    END IF;

    UPDATE public.products
       SET stock_quantity = _new_stock,
           cost_price = _new_cost,
           updated_at = now()
     WHERE id = _old_item.product_id;

    INSERT INTO public.stock_movements (
      user_id, product_id, movement_type, quantity, reference_id, notes, created_at
    ) VALUES (
      _owner, _old_item.product_id, 'purchase_reversal', -COALESCE(_old_item.quantity, 0),
      _invoice_id, 'عكس مخزون لتعديل فاتورة شراء', now()
    );
  END LOOP;

  -- تحديث حالة الفاتورة القديمة إلى ملغاة للتعديل
  UPDATE public.purchase_invoices
     SET status = 'cancelled',
         notes = COALESCE(notes, '') || ' [تم التعديل واستبدالها بالفاتورة المعدلة]',
         updated_at = now()
   WHERE id = _invoice_id;

  -- إنشاء الفاتورة الجديدة بالبنود المحدثة
  INSERT INTO public.purchase_invoices (
    user_id, invoice_number, supplier_name, supplier_phone, invoice_date,
    payment_status, total_amount, paid_amount, remaining_amount, notes, status, created_at, updated_at
  ) VALUES (
    _owner,
    _orig_inv.invoice_number || '-REV',
    _orig_inv.supplier_name,
    _orig_inv.supplier_phone,
    _orig_inv.invoice_date,
    _orig_inv.payment_status,
    0,
    COALESCE(_orig_inv.paid_amount, 0),
    0,
    COALESCE(_reason, 'تعديل فاتورة شراء'),
    'completed',
    now(),
    now()
  ) RETURNING id INTO _new_invoice_id;

  -- معالجة البنود الجديدة وتطبيق WAC الدقيق
  FOR _line IN SELECT * FROM jsonb_array_elements(_new_lines)
  LOOP
    _prod_id := (_line->>'product_id')::UUID;
    _prod_qty := GREATEST(0, COALESCE((_line->>'quantity')::NUMERIC, 0));
    _prod_cost := GREATEST(0, COALESCE((_line->>'cost_price')::NUMERIC, 0));
    _prod_name := COALESCE(_line->>'product_name', 'صنف');
    _prod_barcode := _line->>'barcode';
    _prod_cat := _line->>'category';

    IF _prod_qty > 0 THEN
      SELECT stock_quantity, cost_price INTO _cur_stock, _cur_cost
        FROM public.products WHERE id = _prod_id FOR UPDATE;

      _new_stock := COALESCE(_cur_stock, 0) + _prod_qty;
      IF _new_stock > 0 THEN
        _new_cost := round(
          ((COALESCE(_cur_stock, 0) * COALESCE(_cur_cost, 0)) + (_prod_qty * _prod_cost)) / _new_stock,
          8
        );
      ELSE
        _new_cost := _prod_cost;
      END IF;

      UPDATE public.products
         SET stock_quantity = _new_stock,
             cost_price = _new_cost,
             updated_at = now()
       WHERE id = _prod_id;

      INSERT INTO public.purchase_invoice_items (
        invoice_id, product_id, product_name, barcode, category,
        quantity, cost_price, total_cost, cost_price_before, created_at
      ) VALUES (
        _new_invoice_id, _prod_id, _prod_name, _prod_barcode, _prod_cat,
        _prod_qty, _prod_cost, round(_prod_qty * _prod_cost, 8), _cur_cost, now()
      );

      INSERT INTO public.stock_movements (
        user_id, product_id, movement_type, quantity, reference_id, notes, created_at
      ) VALUES (
        _owner, _prod_id, 'purchase', _prod_qty, _new_invoice_id, 'إدخال مخزون فاتورة شراء معدلة', now()
      );

      _calc_subtotal := _calc_subtotal + (_prod_qty * _prod_cost);
      _total_items_count := _total_items_count + 1;
    END IF;
  END LOOP;

  UPDATE public.purchase_invoices
     SET total_amount = round(_calc_subtotal, 8),
         remaining_amount = GREATEST(0, round(_calc_subtotal - COALESCE(_orig_inv.paid_amount, 0), 8)),
         updated_at = now()
   WHERE id = _new_invoice_id;

  RETURN _new_invoice_id;
END;
$$;
