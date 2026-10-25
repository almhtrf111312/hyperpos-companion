-- =========================================================================
-- Migration: Upgrade receive_stock_wac to High Precision (6 decimals)
-- Preserves fractional USD costs (e.g. 0.1375 USD = 0.50 QAR)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.receive_stock_wac(
  _product_id uuid,
  _quantity numeric,
  _unit_cost numeric,
  _reference text DEFAULT NULL
)
RETURNS TABLE(new_quantity numeric, new_cost numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _q numeric;
  _c numeric;
  _pos numeric;
  _nc numeric;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  _owner := public.get_owner_id(_caller);

  IF COALESCE(_quantity, 0) <= 0 OR COALESCE(_unit_cost, -1) < 0 THEN
    RAISE EXCEPTION 'Invalid receipt values';
  END IF;

  SELECT COALESCE(p.quantity, 0), COALESCE(p.cost_price, 0)
    INTO _q, _c
    FROM public.products p
   WHERE p.id = _product_id AND p.user_id = _owner
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  _pos := GREATEST(_q, 0);

  IF _unit_cost = 0 THEN
    _nc := _c;
  ELSE
    _nc := round((_pos * _c + _quantity * _unit_cost) / (_pos + _quantity), 6);
  END IF;

  PERFORM set_config('app.stock_movement_type', 'purchase', true);
  PERFORM set_config('app.stock_actor_id', _caller::text, true);
  PERFORM set_config('app.stock_source', COALESCE(_reference, 'purchase_receipt'), true);

  UPDATE public.products
     SET quantity = _q + _quantity,
         cost_price = _nc,
         updated_at = now()
   WHERE id = _product_id;

  RETURN QUERY SELECT _q + _quantity, _nc;
END $$;

REVOKE ALL ON FUNCTION public.receive_stock_wac(uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_stock_wac(uuid, numeric, numeric, text) TO authenticated;
