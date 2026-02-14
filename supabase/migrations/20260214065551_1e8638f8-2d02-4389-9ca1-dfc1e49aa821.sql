
-- Atomic function to deduct product quantity safely
CREATE OR REPLACE FUNCTION public.deduct_product_quantity(_product_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_qty integer;
  _new_qty integer;
BEGIN
  -- Lock the row and get current quantity
  SELECT quantity INTO _current_qty
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF _current_qty IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  _new_qty := GREATEST(0, _current_qty - _amount);

  UPDATE public.products
  SET quantity = _new_qty
  WHERE id = _product_id;

  RETURN _new_qty;
END;
$$;

-- Atomic function to add product quantity safely
CREATE OR REPLACE FUNCTION public.add_product_quantity(_product_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_qty integer;
BEGIN
  UPDATE public.products
  SET quantity = COALESCE(quantity, 0) + _amount
  WHERE id = _product_id
  RETURNING quantity INTO _new_qty;

  IF _new_qty IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  RETURN _new_qty;
END;
$$;
