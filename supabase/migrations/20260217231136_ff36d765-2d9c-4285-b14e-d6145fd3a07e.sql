
-- Prevent duplicate default main warehouses per user
CREATE UNIQUE INDEX idx_unique_default_main_warehouse 
ON public.warehouses (user_id) 
WHERE type = 'main' AND is_default = true;
