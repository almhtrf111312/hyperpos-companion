CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid,
  invoice_number text,
  product_id uuid NOT NULL,
  product_name text,
  warehouse_id uuid,
  warehouse_name text,
  movement_type text NOT NULL,
  quantity_delta integer NOT NULL,
  quantity_before integer NOT NULL,
  quantity_after integer NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_by uuid,
  source text NOT NULL DEFAULT 'database',
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view owner stock movements"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (user_id = public.get_owner_id(auth.uid()));

CREATE INDEX idx_stock_movements_owner_date
  ON public.stock_movements(user_id, created_at DESC);
CREATE INDEX idx_stock_movements_product_location
  ON public.stock_movements(user_id, product_id, warehouse_id, created_at DESC);
CREATE INDEX idx_stock_movements_invoice
  ON public.stock_movements(user_id, invoice_id, movement_type);

INSERT INTO public.stock_movements (
  user_id, product_id, product_name, warehouse_id, warehouse_name,
  movement_type, quantity_delta, quantity_before, quantity_after,
  unit_cost, source, idempotency_key, metadata
)
SELECT
  p.user_id, p.id, p.name, NULL, 'المخزون الرئيسي',
  'opening_balance', COALESCE(p.quantity, 0), 0, COALESCE(p.quantity, 0),
  COALESCE(p.cost_price, 0), 'migration', 'opening:main:' || p.id::text,
  jsonb_build_object('baseline_at', now())
FROM public.products p;

INSERT INTO public.stock_movements (
  user_id, product_id, product_name, warehouse_id, warehouse_name,
  movement_type, quantity_delta, quantity_before, quantity_after,
  unit_cost, source, idempotency_key, metadata
)
SELECT
  w.user_id, ws.product_id, p.name, w.id, w.name,
  'opening_balance', COALESCE(ws.quantity, 0), 0, COALESCE(ws.quantity, 0),
  COALESCE(p.cost_price, 0), 'migration', 'opening:warehouse:' || w.id::text || ':' || ws.product_id::text,
  jsonb_build_object('baseline_at', now())
FROM public.warehouse_stock ws
JOIN public.warehouses w ON w.id = ws.warehouse_id
LEFT JOIN public.products p ON p.id = ws.product_id;

CREATE OR REPLACE FUNCTION public.record_main_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before integer;
  _after integer;
  _movement_type text;
  _invoice_id uuid;
  _invoice_number text;
  _actor uuid;
  _source text;
  _key text;
BEGIN
  _before := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.quantity, 0) END;
  _after := COALESCE(NEW.quantity, 0);
  IF _before = _after THEN RETURN NEW; END IF;

  _movement_type := COALESCE(NULLIF(current_setting('app.stock_movement_type', true), ''),
    CASE WHEN TG_OP = 'INSERT' THEN 'opening_balance' WHEN _after > _before THEN 'adjustment_in' ELSE 'adjustment_out' END);
  _invoice_id := NULLIF(current_setting('app.stock_invoice_id', true), '')::uuid;
  _invoice_number := NULLIF(current_setting('app.stock_invoice_number', true), '');
  _actor := COALESCE(NULLIF(current_setting('app.stock_actor_id', true), '')::uuid, auth.uid());
  _source := COALESCE(NULLIF(current_setting('app.stock_source', true), ''), 'database_trigger');
  _key := CASE
    WHEN _movement_type = 'refund' AND _invoice_id IS NOT NULL
      THEN 'refund:' || _invoice_id::text || ':' || NEW.id::text || ':main'
    ELSE 'movement:' || gen_random_uuid()::text
  END;

  INSERT INTO public.stock_movements (
    user_id, invoice_id, invoice_number, product_id, product_name,
    warehouse_id, warehouse_name, movement_type, quantity_delta,
    quantity_before, quantity_after, unit_cost, created_by, source,
    idempotency_key, metadata
  ) VALUES (
    NEW.user_id, _invoice_id, _invoice_number, NEW.id, NEW.name,
    NULL, 'المخزون الرئيسي', _movement_type, _after - _before,
    _before, _after, COALESCE(NEW.cost_price, 0), _actor, _source,
    _key, '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_main_stock_movement_trigger
AFTER INSERT OR UPDATE OF quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.record_main_stock_movement();

CREATE OR REPLACE FUNCTION public.record_warehouse_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before integer;
  _after integer;
  _owner uuid;
  _product_name text;
  _warehouse_name text;
  _unit_cost numeric;
  _movement_type text;
  _invoice_id uuid;
  _invoice_number text;
  _actor uuid;
  _source text;
  _key text;
BEGIN
  _before := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.quantity, 0) END;
  _after := COALESCE(NEW.quantity, 0);
  IF _before = _after THEN RETURN NEW; END IF;

  SELECT w.user_id, w.name INTO _owner, _warehouse_name
  FROM public.warehouses w WHERE w.id = NEW.warehouse_id;
  SELECT p.name, COALESCE(p.cost_price, 0) INTO _product_name, _unit_cost
  FROM public.products p WHERE p.id = NEW.product_id;

  IF _owner IS NULL THEN RAISE EXCEPTION 'Warehouse owner not found'; END IF;

  _movement_type := COALESCE(NULLIF(current_setting('app.stock_movement_type', true), ''),
    CASE WHEN TG_OP = 'INSERT' THEN 'opening_balance' WHEN _after > _before THEN 'adjustment_in' ELSE 'adjustment_out' END);
  _invoice_id := NULLIF(current_setting('app.stock_invoice_id', true), '')::uuid;
  _invoice_number := NULLIF(current_setting('app.stock_invoice_number', true), '');
  _actor := COALESCE(NULLIF(current_setting('app.stock_actor_id', true), '')::uuid, auth.uid());
  _source := COALESCE(NULLIF(current_setting('app.stock_source', true), ''), 'database_trigger');
  _key := CASE
    WHEN _movement_type = 'refund' AND _invoice_id IS NOT NULL
      THEN 'refund:' || _invoice_id::text || ':' || NEW.product_id::text || ':' || NEW.warehouse_id::text
    ELSE 'movement:' || gen_random_uuid()::text
  END;

  INSERT INTO public.stock_movements (
    user_id, invoice_id, invoice_number, product_id, product_name,
    warehouse_id, warehouse_name, movement_type, quantity_delta,
    quantity_before, quantity_after, unit_cost, created_by, source,
    idempotency_key, metadata
  ) VALUES (
    _owner, _invoice_id, _invoice_number, NEW.product_id, _product_name,
    NEW.warehouse_id, _warehouse_name, _movement_type, _after - _before,
    _before, _after, COALESCE(_unit_cost, 0), _actor, _source,
    _key, '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_warehouse_stock_movement_trigger
AFTER INSERT OR UPDATE OF quantity ON public.warehouse_stock
FOR EACH ROW EXECUTE FUNCTION public.record_warehouse_stock_movement();

CREATE OR REPLACE FUNCTION public.guard_refunded_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (NEW.status = 'refunded' OR OLD.status = 'refunded')
     AND COALESCE(current_setting('app.refund_context', true), '') <> 'allowed'
  THEN
    RAISE EXCEPTION 'Refund status can only be changed by the protected refund operation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_refunded_invoice_status_trigger
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_refunded_invoice_status();

CREATE OR REPLACE FUNCTION public.refund_invoice_atomic(_invoice_number text, _source text DEFAULT 'online')
RETURNS TABLE (
  success boolean,
  already_refunded boolean,
  invoice_id uuid,
  invoice_number text,
  invoice_total numeric,
  invoice_currency text,
  restored_item_count integer,
  restored_unit_count numeric,
  deleted_debt_amount numeric,
  customer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _invoice public.invoices%ROWTYPE;
  _warehouse_id uuid;
  _restored_items integer := 0;
  _restored_units numeric := 0;
  _deleted_debt numeric := 0;
  _has_refund_movement boolean := false;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  _owner := public.get_owner_id(_caller);

  SELECT i.* INTO _invoice
  FROM public.invoices i
  WHERE i.invoice_number = _invoice_number AND i.user_id = _owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, _invoice_number, 0::numeric,
      NULL::text, 0, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.user_id = _owner AND sm.invoice_id = _invoice.id AND sm.movement_type = 'refund'
  ) INTO _has_refund_movement;

  IF _invoice.status = 'refunded' OR _has_refund_movement THEN
    RETURN QUERY SELECT false, true, _invoice.id, _invoice.invoice_number,
      COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text, 0, 0::numeric,
      0::numeric, _invoice.customer_name::text;
    RETURN;
  END IF;

  IF _invoice.warehouse_id IS NOT NULL THEN
    SELECT w.id INTO _warehouse_id FROM public.warehouses w
    WHERE w.id = _invoice.warehouse_id AND w.user_id = _owner LIMIT 1;
  ELSIF _invoice.cashier_id IS NOT NULL THEN
    SELECT w.id INTO _warehouse_id FROM public.warehouses w
    WHERE w.assigned_cashier_id::text = _invoice.cashier_id AND w.user_id = _owner LIMIT 1;
  END IF;

  PERFORM set_config('app.stock_movement_type', 'refund', true);
  PERFORM set_config('app.stock_invoice_id', _invoice.id::text, true);
  PERFORM set_config('app.stock_invoice_number', _invoice.invoice_number, true);
  PERFORM set_config('app.stock_actor_id', _caller::text, true);
  PERFORM set_config('app.stock_source', CASE WHEN _source = 'offline-sync' THEN 'offline-sync' ELSE 'online' END, true);
  PERFORM set_config('app.refund_context', 'allowed', true);

  IF _warehouse_id IS NOT NULL THEN
    INSERT INTO public.warehouse_stock (warehouse_id, product_id, quantity)
    SELECT _warehouse_id, ii.product_id, SUM(COALESCE(ii.quantity, 0))::integer
    FROM public.invoice_items ii
    WHERE ii.invoice_id = _invoice.id AND ii.product_id IS NOT NULL AND COALESCE(ii.quantity, 0) > 0
    GROUP BY ii.product_id
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = COALESCE(public.warehouse_stock.quantity, 0) + EXCLUDED.quantity;
  ELSE
    UPDATE public.products p
    SET quantity = COALESCE(p.quantity, 0) + restored.quantity
    FROM (
      SELECT ii.product_id, SUM(COALESCE(ii.quantity, 0))::integer AS quantity
      FROM public.invoice_items ii
      WHERE ii.invoice_id = _invoice.id AND ii.product_id IS NOT NULL AND COALESCE(ii.quantity, 0) > 0
      GROUP BY ii.product_id
    ) restored
    WHERE p.id = restored.product_id AND p.user_id = _owner;
  END IF;

  SELECT COUNT(DISTINCT ii.product_id)::integer, COALESCE(SUM(ii.quantity), 0)::numeric
  INTO _restored_items, _restored_units
  FROM public.invoice_items ii
  WHERE ii.invoice_id = _invoice.id AND ii.product_id IS NOT NULL AND COALESCE(ii.quantity, 0) > 0;

  SELECT COALESCE(SUM(d.remaining_debt), 0)::numeric INTO _deleted_debt
  FROM public.debts d
  WHERE d.user_id = _owner AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);

  DELETE FROM public.debts d
  WHERE d.user_id = _owner AND (d.invoice_id = _invoice.invoice_number OR d.invoice_id = _invoice.id::text);

  IF _invoice.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET total_purchases = stats.total_purchases,
        total_debt = stats.total_debt,
        invoice_count = stats.invoice_count
    FROM (
      SELECT COALESCE(SUM(i.total) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded'), 0)::numeric AS total_purchases,
             COALESCE(SUM(i.total) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded' AND i.payment_type = 'debt' AND i.status <> 'paid'), 0)::numeric AS total_debt,
             COUNT(*) FILTER (WHERE i.id <> _invoice.id AND i.status <> 'refunded')::integer AS invoice_count
      FROM public.invoices i WHERE i.user_id = _owner AND i.customer_id = _invoice.customer_id
    ) stats
    WHERE c.id = _invoice.customer_id AND c.user_id = _owner;
  END IF;

  UPDATE public.invoices
  SET status = 'refunded',
      notes = concat_ws(E'\n', NULLIF(_invoice.notes, ''), 'Refunded at ' || now()::text),
      updated_at = now()
  WHERE id = _invoice.id;

  INSERT INTO public.activity_log (
    user_id, actor_id, actor_name, actor_role, action_type,
    entity_type, entity_id, entity_name, description, metadata
  )
  SELECT
    _owner, _caller, COALESCE(p.full_name, _invoice.cashier_name, 'مستخدم'), ur.role::text,
    'invoice_refunded', 'invoice', _invoice.id::text, _invoice.invoice_number,
    'تم استرداد الفاتورة ' || _invoice.invoice_number,
    jsonb_build_object(
      'invoice_number', _invoice.invoice_number,
      'invoice_total', COALESCE(_invoice.total, 0),
      'invoice_currency', _invoice.currency,
      'restored_items', _restored_items,
      'restored_units', _restored_units,
      'deleted_debt_amount', _deleted_debt,
      'warehouse_id', _warehouse_id,
      'source', CASE WHEN _source = 'offline-sync' THEN 'offline-sync' ELSE 'online' END
    )
  FROM (SELECT 1) seed
  LEFT JOIN public.profiles p ON p.user_id = _caller
  LEFT JOIN public.user_roles ur ON ur.user_id = _caller
  LIMIT 1;

  RETURN QUERY SELECT true, false, _invoice.id, _invoice.invoice_number,
    COALESCE(_invoice.total, 0)::numeric, _invoice.currency::text,
    _restored_items, _restored_units, _deleted_debt, _invoice.customer_name::text;
END;
$$;

DROP FUNCTION IF EXISTS public.refund_invoice_atomic(text);
REVOKE ALL ON FUNCTION public.refund_invoice_atomic(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_invoice_atomic(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_stock_discrepancies()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  warehouse_id uuid,
  warehouse_name text,
  actual_quantity integer,
  expected_quantity bigint,
  variance bigint,
  unit_cost numeric,
  variance_value numeric,
  last_movement_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH actual AS (
    SELECT p.user_id, p.id AS product_id, p.name AS product_name,
           NULL::uuid AS warehouse_id, 'المخزون الرئيسي'::text AS warehouse_name,
           COALESCE(p.quantity, 0)::integer AS actual_quantity, COALESCE(p.cost_price, 0)::numeric AS unit_cost
    FROM public.products p
    WHERE p.user_id = public.get_owner_id(auth.uid()) AND COALESCE(p.archived, false) = false
    UNION ALL
    SELECT w.user_id, ws.product_id, p.name, w.id, w.name,
           COALESCE(ws.quantity, 0)::integer, COALESCE(p.cost_price, 0)::numeric
    FROM public.warehouse_stock ws
    JOIN public.warehouses w ON w.id = ws.warehouse_id
    JOIN public.products p ON p.id = ws.product_id
    WHERE w.user_id = public.get_owner_id(auth.uid()) AND COALESCE(w.is_active, true) = true
  ), ledger AS (
    SELECT sm.user_id, sm.product_id, sm.warehouse_id,
           SUM(sm.quantity_delta)::bigint AS expected_quantity,
           MAX(sm.created_at) AS last_movement_at
    FROM public.stock_movements sm
    WHERE sm.user_id = public.get_owner_id(auth.uid())
    GROUP BY sm.user_id, sm.product_id, sm.warehouse_id
  )
  SELECT a.product_id, a.product_name, a.warehouse_id, a.warehouse_name,
         a.actual_quantity, COALESCE(l.expected_quantity, 0),
         a.actual_quantity::bigint - COALESCE(l.expected_quantity, 0),
         a.unit_cost,
         (a.actual_quantity::numeric - COALESCE(l.expected_quantity, 0)::numeric) * a.unit_cost,
         l.last_movement_at
  FROM actual a
  LEFT JOIN ledger l ON l.user_id = a.user_id AND l.product_id = a.product_id
    AND l.warehouse_id IS NOT DISTINCT FROM a.warehouse_id
  ORDER BY ABS(a.actual_quantity::bigint - COALESCE(l.expected_quantity, 0)) DESC, a.product_name;
$$;

REVOKE ALL ON FUNCTION public.get_stock_discrepancies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_stock_discrepancies() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_stock_discrepancies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_discrepancies() TO service_role;