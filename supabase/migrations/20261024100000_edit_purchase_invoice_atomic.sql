-- =========================================================================
-- Migration: Atomic purchase invoice editing with reversal and idempotency
-- =========================================================================

-- 1. Add columns to purchase_invoices for superseding and idempotency
ALTER TABLE IF EXISTS public.purchase_invoices
  ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES public.purchase_invoices(id),
  ADD COLUMN IF NOT EXISTS operation_id TEXT,
  ADD COLUMN IF NOT EXISTS edit_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_op_id ON public.purchase_invoices(operation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_replaced_by ON public.purchase_invoices(replaced_by);

-- 2. Audit log table for purchase modifications
CREATE TABLE IF NOT EXISTS public.purchase_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_invoice_id UUID NOT NULL,
  new_invoice_id UUID,
  operation_id TEXT NOT NULL,
  actor_id UUID,
  reason TEXT,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchase audit logs"
  ON public.purchase_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = public.get_owner_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_purchase_audit_logs_op_id ON public.purchase_audit_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_audit_logs_orig_inv ON public.purchase_audit_logs(original_invoice_id);

-- 3. Atomic server function
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
  _before_state JSONB;
  _after_state JSONB;
  _old_items_json JSONB;
  _hist_entry JSONB;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  _owner := public.get_owner_id(_caller);

  -- Idempotency check: if this operation_id was already processed, return existing new invoice ID
  SELECT id INTO _existing_id FROM public.purchase_invoices
  WHERE operation_id = _op_id;
  IF _existing_id IS NOT NULL THEN
    RETURN _existing_id;
  END IF;

  -- Lock original invoice FOR UPDATE
  SELECT * INTO _orig_inv FROM public.purchase_invoices
  WHERE id = _invoice_id AND user_id = _owner FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase invoice not found';
  END IF;

  IF _orig_inv.status = 'superseded' THEN
    RAISE EXCEPTION 'Invoice is already superseded';
  END IF;

  -- Gather old items for audit
  SELECT jsonb_agg(to_jsonb(items)) INTO _old_items_json
  FROM public.purchase_invoice_items items
  WHERE items.invoice_id = _invoice_id;

  _before_state := jsonb_build_object(
    'invoice', to_jsonb(_orig_inv),
    'items', COALESCE(_old_items_json, '[]'::jsonb)
  );

  -- If original invoice was finalized, reverse product stock movements
  IF _orig_inv.status = 'finalized' THEN
    FOR _old_item IN
      SELECT * FROM public.purchase_invoice_items WHERE invoice_id = _invoice_id
    LOOP
      IF _old_item.product_id IS NOT NULL THEN
        SELECT COALESCE(quantity, 0), COALESCE(cost_price, 0)
        INTO _cur_stock, _cur_cost
        FROM public.products
        WHERE id = _old_item.product_id AND user_id = _owner
        FOR UPDATE;

        IF FOUND THEN
          -- Reversal: check for negative stock
          IF (_cur_stock - _old_item.quantity) < 0 THEN
            RAISE EXCEPTION 'Cannot edit invoice: item "%" has been sold and reversing would reduce stock below zero (current: %, needed reduction: %)',
              _old_item.product_name, _cur_stock, _old_item.quantity;
          END IF;

          -- Reverse stock
          UPDATE public.products
          SET quantity = _cur_stock - _old_item.quantity,
              updated_at = now()
          WHERE id = _old_item.product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Calculate new totals from _new_lines
  _items_count := jsonb_array_length(_new_lines);
  FOR _line IN SELECT * FROM jsonb_array_elements(_new_lines)
  LOOP
    _prod_qty := COALESCE((_line->>'quantity')::numeric, 0);
    _prod_cost := COALESCE((_line->>'cost_price')::numeric, 0);
    _total_qty := _total_qty + _prod_qty;
    _grand_total := _grand_total + (_prod_qty * _prod_cost);
  END LOOP;

  -- Create replacement invoice
  INSERT INTO public.purchase_invoices (
    user_id,
    invoice_number,
    supplier_name,
    supplier_company,
    invoice_date,
    expected_items_count,
    expected_total_quantity,
    expected_grand_total,
    actual_items_count,
    actual_total_quantity,
    actual_grand_total,
    status,
    notes,
    image_url,
    operation_id,
    edit_reason
  ) VALUES (
    _owner,
    _orig_inv.invoice_number || '-REV',
    _orig_inv.supplier_name,
    _orig_inv.supplier_company,
    _orig_inv.invoice_date,
    _items_count,
    _total_qty,
    _grand_total,
    _items_count,
    _total_qty,
    _grand_total,
    _orig_inv.status,
    COALESCE(_orig_inv.notes, '') || ' [تعديل للفاتورة #' || _orig_inv.invoice_number || ']',
    _orig_inv.image_url,
    _op_id,
    _reason
  ) RETURNING id INTO _new_invoice_id;

  -- Process new lines
  FOR _line IN SELECT * FROM jsonb_array_elements(_new_lines)
  LOOP
    _prod_id := NULL;
    IF (_line ? 'product_id') AND (_line->>'product_id') IS NOT NULL AND (_line->>'product_id') <> '' THEN
      _prod_id := (_line->>'product_id')::uuid;
    END IF;
    _prod_name := COALESCE(_line->>'product_name', 'صنف');
    _prod_barcode := _line->>'barcode';
    _prod_cat := _line->>'category';
    _prod_qty := COALESCE((_line->>'quantity')::numeric, 1);
    _prod_cost := COALESCE((_line->>'cost_price')::numeric, 0);

    -- Insert invoice item
    INSERT INTO public.purchase_invoice_items (
      invoice_id,
      product_id,
      product_name,
      barcode,
      category,
      quantity,
      cost_price,
      sale_price,
      total_cost
    ) VALUES (
      _new_invoice_id,
      _prod_id,
      _prod_name,
      _prod_barcode,
      _prod_cat,
      _prod_qty,
      _prod_cost,
      COALESCE((_line->>'sale_price')::numeric, 0),
      _prod_qty * _prod_cost
    );

    -- If invoice was finalized and product exists, add stock and recalculate weighted average cost
    IF _orig_inv.status = 'finalized' AND _prod_id IS NOT NULL THEN
      SELECT COALESCE(quantity, 0), COALESCE(cost_price, 0)
      INTO _cur_stock, _cur_cost
      FROM public.products
      WHERE id = _prod_id AND user_id = _owner
      FOR UPDATE;

      IF FOUND THEN
        _new_stock := _cur_stock + _prod_qty;
        IF _prod_cost > 0 AND _new_stock > 0 THEN
          _new_cost := round((GREATEST(_cur_stock, 0) * _cur_cost + _prod_qty * _prod_cost) / (GREATEST(_cur_stock, 0) + _prod_qty), 2);
        ELSE
          _new_cost := _cur_cost;
        END IF;

        _hist_entry := jsonb_build_object(
          'invoice_id', _new_invoice_id,
          'invoice_number', _orig_inv.invoice_number || '-REV',
          'supplier_name', _orig_inv.supplier_name,
          'date', _orig_inv.invoice_date,
          'quantity', _prod_qty,
          'cost_price', _prod_cost,
          'added_at', now()
        );

        UPDATE public.products
        SET quantity = _new_stock,
            cost_price = _new_cost,
            purchase_history = COALESCE(purchase_history, '[]'::jsonb) || _hist_entry,
            updated_at = now()
        WHERE id = _prod_id;
      END IF;
    END IF;
  END LOOP;

  -- Mark original invoice as superseded
  UPDATE public.purchase_invoices
  SET status = 'superseded',
      replaced_by = _new_invoice_id,
      updated_at = now()
  WHERE id = _invoice_id;

  -- Build after state for audit
  _after_state := jsonb_build_object(
    'new_invoice_id', _new_invoice_id,
    'new_lines', _new_lines,
    'total_qty', _total_qty,
    'grand_total', _grand_total
  );

  -- Insert audit log
  INSERT INTO public.purchase_audit_logs (
    user_id,
    original_invoice_id,
    new_invoice_id,
    operation_id,
    actor_id,
    reason,
    before_state,
    after_state
  ) VALUES (
    _owner,
    _invoice_id,
    _new_invoice_id,
    _op_id,
    _caller,
    _reason,
    _before_state,
    _after_state
  );

  RETURN _new_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_purchase_invoice_atomic(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_purchase_invoice_atomic(UUID, JSONB, TEXT, TEXT) TO authenticated;
