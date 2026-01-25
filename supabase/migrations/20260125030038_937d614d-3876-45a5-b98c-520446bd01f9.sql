-- =============================================
-- المرحلة 2: نظام تعدد الوحدات (Multi-Unit System)
-- =============================================

-- إضافة حقول الوحدات المتعددة لجدول المنتجات
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS bulk_unit text DEFAULT 'كرتونة',
ADD COLUMN IF NOT EXISTS small_unit text DEFAULT 'قطعة',
ADD COLUMN IF NOT EXISTS conversion_factor integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS bulk_cost_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bulk_sale_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_by_unit text DEFAULT 'piece';

-- =============================================
-- المرحلة 3: نظام المستودعات المتعددة (Multi-Warehouse)
-- =============================================

-- جدول المستودعات
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'main', -- 'main' للمستودع الرئيسي، 'vehicle' لسيارة الموزع
  assigned_cashier_id uuid,
  address text,
  phone text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS للمستودعات
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- سياسة: المالك يدير مستودعاته، والكاشير يرى مستودعه المخصص
CREATE POLICY "Owners manage warehouses" ON public.warehouses
FOR ALL USING (
  user_id = get_owner_id(auth.uid()) 
  OR assigned_cashier_id = auth.uid()
)
WITH CHECK (user_id = get_owner_id(auth.uid()));

-- جدول مخزون المستودعات
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer DEFAULT 0,
  quantity_bulk integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

-- تفعيل RLS لمخزون المستودعات
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدم يرى مخزون مستودعاته أو مستودعه المخصص
CREATE POLICY "Users see assigned warehouse stock" ON public.warehouse_stock
FOR ALL USING (
  warehouse_id IN (
    SELECT id FROM public.warehouses 
    WHERE user_id = get_owner_id(auth.uid())
    OR assigned_cashier_id = auth.uid()
  )
)
WITH CHECK (
  warehouse_id IN (
    SELECT id FROM public.warehouses 
    WHERE user_id = get_owner_id(auth.uid())
  )
);

-- جدول تحويلات المخزون (العهدة)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  transfer_number text NOT NULL,
  status text DEFAULT 'pending', -- pending, completed, cancelled
  notes text,
  transferred_by uuid,
  transferred_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS لتحويلات المخزون
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- سياسة: المالك يدير التحويلات
CREATE POLICY "Owners manage stock transfers" ON public.stock_transfers
FOR ALL USING (user_id = get_owner_id(auth.uid()))
WITH CHECK (user_id = get_owner_id(auth.uid()));

-- جدول تفاصيل التحويلات
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL,
  unit text DEFAULT 'piece', -- 'piece' أو 'bulk'
  quantity_in_pieces integer NOT NULL -- الكمية المحولة بالقطع
);

-- تفعيل RLS لتفاصيل التحويلات
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدم يرى تفاصيل تحويلاته
CREATE POLICY "Users see transfer items" ON public.stock_transfer_items
FOR ALL USING (
  transfer_id IN (
    SELECT id FROM public.stock_transfers 
    WHERE user_id = get_owner_id(auth.uid())
  )
)
WITH CHECK (
  transfer_id IN (
    SELECT id FROM public.stock_transfers 
    WHERE user_id = get_owner_id(auth.uid())
  )
);

-- إضافة حقل warehouse_id لجدول الفواتير لتتبع مصدر البيع
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION public.update_warehouse_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_warehouses_timestamp ON public.warehouses;
CREATE TRIGGER update_warehouses_timestamp
BEFORE UPDATE ON public.warehouses
FOR EACH ROW EXECUTE FUNCTION public.update_warehouse_timestamp();

DROP TRIGGER IF EXISTS update_stock_transfers_timestamp ON public.stock_transfers;
CREATE TRIGGER update_stock_transfers_timestamp
BEFORE UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_warehouse_timestamp();