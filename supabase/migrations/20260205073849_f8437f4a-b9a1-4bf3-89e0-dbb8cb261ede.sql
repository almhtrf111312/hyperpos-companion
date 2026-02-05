-- ======================================
-- جدول فواتير الشراء (Purchase Invoices)
-- ======================================
CREATE TABLE public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_company TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_items_count INTEGER NOT NULL DEFAULT 0,
  expected_total_quantity INTEGER NOT NULL DEFAULT 0,
  expected_grand_total NUMERIC NOT NULL DEFAULT 0,
  actual_items_count INTEGER DEFAULT 0,
  actual_total_quantity INTEGER DEFAULT 0,
  actual_grand_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, reconciled, finalized
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users manage own purchase invoices" 
ON public.purchase_invoices 
FOR ALL 
USING (user_id = get_owner_id(auth.uid()))
WITH CHECK (user_id = get_owner_id(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_purchase_invoices_user_id ON public.purchase_invoices(user_id);
CREATE INDEX idx_purchase_invoices_status ON public.purchase_invoices(status);

-- ======================================
-- جدول عناصر فواتير الشراء (Purchase Invoice Items)
-- ======================================
CREATE TABLE public.purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  barcode TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy (based on parent invoice)
CREATE POLICY "Users manage own purchase invoice items" 
ON public.purchase_invoice_items 
FOR ALL 
USING (
  invoice_id IN (
    SELECT id FROM public.purchase_invoices 
    WHERE user_id = get_owner_id(auth.uid())
  )
)
WITH CHECK (
  invoice_id IN (
    SELECT id FROM public.purchase_invoices 
    WHERE user_id = get_owner_id(auth.uid())
  )
);

-- Index for faster queries
CREATE INDEX idx_purchase_invoice_items_invoice_id ON public.purchase_invoice_items(invoice_id);

-- ======================================
-- إضافة عمود سجل الشراء للمنتجات
-- ======================================
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS purchase_history JSONB DEFAULT '[]'::jsonb;

-- ======================================
-- Trigger لتحديث updated_at
-- ======================================
CREATE OR REPLACE FUNCTION update_purchase_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_invoices_updated_at
BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION update_purchase_invoice_updated_at();