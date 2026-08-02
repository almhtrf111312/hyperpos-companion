ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS operation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_operation_id_unique
ON public.invoices (user_id, operation_id)
WHERE operation_id IS NOT NULL;

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
  _items jsonb
)
RETURNS TABLE(
  success boolean,
  already_processed boolean,
  invoice_id uuid,
  invoice_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _existing public.invoices%ROWTYPE;
  _new_invoice public.invoices%ROWTYPE;
  _next bigint;
  _number text;
  _item jsonb;
  _product_id uuid;
  _quantity integer;
  _available integer;
  _product_name text;
  _unit text;
  _conversion_factor numeric;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  _owner := public.get_owner_id(_caller);
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Owner context is required';
  END IF;

  IF _operation_id IS NULL OR length(trim(_operation_id)) < 8 OR length(_operation_id) > 128 THEN
    RAISE EXCEPTION 'Invalid operation id';
  END IF;

  IF _payment_type NOT IN ('cash', 'debt') THEN
    RAISE EXCEPTION 'Invalid payment type';
  END IF;

  IF _total < 0 OR _subtotal < 0 OR _discount < 0 OR _tax_amount < 0 THEN
    RAISE EXCEPTION 'Invalid financial values';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Sale items are required';
  END IF;

  SELECT i.* INTO _existing
  FROM public.invoices i
  WHERE i.user_id = _owner AND i.operation_id = _operation_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT true, true, _existing.id, _existing.invoice_number;
    RETURN;
  END IF;

  IF _warehouse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.warehouses w
    WHERE w.id = _warehouse_id AND w.user_id = _owner AND COALESCE(w.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Warehouse not found';
  END IF;

  FOR _item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    BEGIN
      _product_id := (_item->>'product_id')::uuid;
      _quantity := (_item->>'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid sale item';
    END;

    IF _product_id IS NULL OR _quantity IS NULL OR _quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT p.name INTO _product_name
    FROM public.products p
    WHERE p.id = _product_id AND p.user_id = _owner AND COALESCE(p.archived, false) = false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF _warehouse_id IS NULL THEN
      SELECT p.quantity INTO _available
      FROM public.products p
      WHERE p.id = _product_id AND p.user_id = _owner
      FOR UPDATE;
    ELSE
      SELECT ws.quantity INTO _available
      FROM public.warehouse_stock ws
      JOIN public.warehouses w ON w.id = ws.warehouse_id
      WHERE ws.warehouse_id = _warehouse_id
        AND ws.product_id = _product_id
        AND w.user_id = _owner
      FOR UPDATE OF ws;
    END IF;

    IF COALESCE(_available, 0) < _quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %: available %, requested %', _product_name, COALESCE(_available, 0), _quantity;
    END IF;
  END LOOP;

  _next := public.get_next_invoice_number(_owner);
  _number := to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(_next::text, 5, '0');

  INSERT INTO public.invoices (
    user_id, invoice_number, invoice_sequence, operation_id, invoice_type,
    date, time, cashier_id, cashier_name, customer_name, customer_phone,
    subtotal, discount, discount_percentage, tax_rate, tax_amount, total,
    profit, currency, exchange_rate, payment_type, status, debt_paid,
    debt_remaining, warehouse_id
  )
  SELECT
    _owner, _number, _next, _operation_id, 'sale', CURRENT_DATE, CURRENT_TIME,
    _caller::text, p.full_name, NULLIF(trim(_customer_name), ''), NULLIF(trim(_customer_phone), ''),
    round(COALESCE(_subtotal, 0), 2), round(COALESCE(_discount, 0), 2),
    COALESCE(_discount_percentage, 0), COALESCE(_tax_rate, 0),
    round(COALESCE(_tax_amount, 0), 2), round(COALESCE(_total, 0), 2),
    round(COALESCE(_profit, 0), 2), COALESCE(NULLIF(_currency, ''), 'USD'), 1,
    _payment_type, CASE WHEN _payment_type = 'debt' THEN 'pending' ELSE 'paid' END,
    0, CASE WHEN _payment_type = 'debt' THEN round(COALESCE(_total, 0), 2) ELSE 0 END,
    _warehouse_id
  FROM (SELECT 1) seed
  LEFT JOIN public.profiles p ON p.user_id = _caller
  LIMIT 1
  RETURNING * INTO _new_invoice;

  PERFORM set_config('app.stock_movement_type', 'sale', true);
  PERFORM set_config('app.stock_invoice_id', _new_invoice.id::text, true);
  PERFORM set_config('app.stock_invoice_number', _new_invoice.invoice_number, true);
  PERFORM set_config('app.stock_actor_id', _caller::text, true);
  PERFORM set_config('app.stock_source', 'atomic_pos_sale', true);

  FOR _item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    _product_id := (_item->>'product_id')::uuid;
    _quantity := (_item->>'quantity')::integer;
    _unit := COALESCE(NULLIF(_item->>'unit', ''), 'piece');
    _conversion_factor := GREATEST(COALESCE(NULLIF(_item->>'conversion_factor', '')::numeric, 1), 1);

    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, variant_id, variant_name, quantity,
      unit_price, cost_price, currency, amount_original, amount_usd, profit,
      unit, conversion_factor
    ) VALUES (
      _new_invoice.id, _product_id, COALESCE(NULLIF(_item->>'product_name', ''), 'Product'),
      NULLIF(_item->>'variant_id', ''), NULLIF(_item->>'variant_name', ''), _quantity,
      round(COALESCE(NULLIF(_item->>'unit_price', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(_item->>'cost_price', '')::numeric, 0), 2),
      COALESCE(NULLIF(_currency, ''), 'USD'),
      round(COALESCE(NULLIF(_item->>'amount_original', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(_item->>'amount_usd', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(_item->>'profit', '')::numeric, 0), 2),
      _unit, _conversion_factor
    );

    IF _warehouse_id IS NULL THEN
      UPDATE public.products
      SET quantity = quantity - _quantity, updated_at = now()
      WHERE id = _product_id AND user_id = _owner;
    ELSE
      UPDATE public.warehouse_stock
      SET quantity = quantity - _quantity, last_updated = now()
      WHERE warehouse_id = _warehouse_id AND product_id = _product_id;
    END IF;
  END LOOP;

  IF _payment_type = 'debt' THEN
    INSERT INTO public.debts (
      user_id, invoice_id, customer_name, customer_phone, total_debt,
      total_paid, remaining_debt, due_date, status, is_cash_debt, cashier_id
    ) VALUES (
      _owner, _new_invoice.invoice_number,
      COALESCE(NULLIF(trim(_customer_name), ''), 'عميل دين'), NULLIF(trim(_customer_phone), ''),
      round(COALESCE(_total, 0), 2), 0, round(COALESCE(_total, 0), 2),
      CURRENT_DATE + 30, 'due', false, _caller
    );
  END IF;

  RETURN QUERY SELECT true, false, _new_invoice.id, _new_invoice.invoice_number;
EXCEPTION
  WHEN unique_violation THEN
    SELECT i.* INTO _existing
    FROM public.invoices i
    WHERE i.user_id = _owner AND i.operation_id = _operation_id
    LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT true, true, _existing.id, _existing.invoice_number;
      RETURN;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_pos_sale_atomic(text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_pos_sale_atomic(text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_pos_sale_atomic(text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, jsonb) TO service_role;