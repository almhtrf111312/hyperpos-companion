
-- 1) stock_counts
CREATE TABLE public.stock_counts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  warehouse_id uuid,
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  counted_by uuid,
  counted_by_name text,
  total_variance_value numeric DEFAULT 0,
  items_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stock counts" ON public.stock_counts
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));
CREATE INDEX idx_stock_counts_user_date ON public.stock_counts(user_id, created_at DESC);
CREATE TRIGGER trg_stock_counts_updated BEFORE UPDATE ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) stock_count_items
CREATE TABLE public.stock_count_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text,
  expected_qty integer NOT NULL DEFAULT 0,
  actual_qty integer NOT NULL DEFAULT 0,
  variance integer NOT NULL DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  variance_value numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stock count items" ON public.stock_count_items
  FOR ALL TO authenticated
  USING (count_id IN (SELECT id FROM public.stock_counts WHERE user_id = get_owner_id(auth.uid())))
  WITH CHECK (count_id IN (SELECT id FROM public.stock_counts WHERE user_id = get_owner_id(auth.uid())));
CREATE INDEX idx_stock_count_items_count ON public.stock_count_items(count_id);
CREATE INDEX idx_stock_count_items_product ON public.stock_count_items(product_id);

-- 3) stock_damages
CREATE TABLE public.stock_damages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text,
  warehouse_id uuid,
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  cost_value numeric DEFAULT 0,
  reason text,
  notes text,
  damaged_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  recorded_by_name text,
  source text DEFAULT 'manual',
  source_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_damages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stock damages" ON public.stock_damages
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));
CREATE INDEX idx_stock_damages_user_date ON public.stock_damages(user_id, damaged_at DESC);
CREATE INDEX idx_stock_damages_product ON public.stock_damages(product_id);

-- 4) activity_log
CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_role text,
  action_type text NOT NULL,
  entity_type text,
  entity_id text,
  entity_name text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own activity log" ON public.activity_log
  FOR SELECT TO authenticated
  USING (user_id = get_owner_id(auth.uid()));
CREATE POLICY "Users insert own activity log" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_owner_id(auth.uid()));
CREATE INDEX idx_activity_log_user_date ON public.activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_action ON public.activity_log(user_id, action_type, created_at DESC);
CREATE INDEX idx_activity_log_entity ON public.activity_log(user_id, entity_type, entity_id);

-- 5) Inventory value helper
CREATE OR REPLACE FUNCTION public.get_inventory_value(_owner_id uuid)
RETURNS TABLE(total_cost numeric, total_sale numeric, total_units bigint, total_skus bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(COALESCE(quantity,0) * COALESCE(cost_price,0)), 0)::numeric,
    COALESCE(SUM(COALESCE(quantity,0) * COALESCE(sale_price,0)), 0)::numeric,
    COALESCE(SUM(COALESCE(quantity,0)), 0)::bigint,
    COUNT(*)::bigint
  FROM public.products
  WHERE user_id = _owner_id AND COALESCE(archived,false) = false;
$$;
