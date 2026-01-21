-- Create stores table for user settings and store info
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'متجري',
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  store_type TEXT DEFAULT 'phones',
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'ar',
  currency_symbol TEXT DEFAULT '$',
  exchange_rates JSONB DEFAULT '{"USD": 1, "TRY": 1, "SYP": 1}',
  tax_enabled BOOLEAN DEFAULT false,
  tax_rate DECIMAL DEFAULT 0,
  print_settings JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  sync_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  category TEXT,
  description TEXT,
  image_url TEXT,
  cost_price DECIMAL DEFAULT 0,
  sale_price DECIMAL DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  unit TEXT DEFAULT 'piece',
  expiry_date DATE,
  supplier TEXT,
  location TEXT,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  total_purchases DECIMAL DEFAULT 0,
  total_debt DECIMAL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  last_purchase TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_type TEXT DEFAULT 'sale',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  cashier_id TEXT,
  cashier_name TEXT,
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal DECIMAL DEFAULT 0,
  discount DECIMAL DEFAULT 0,
  discount_percentage DECIMAL DEFAULT 0,
  tax_rate DECIMAL DEFAULT 0,
  tax_amount DECIMAL DEFAULT 0,
  total DECIMAL DEFAULT 0,
  profit DECIMAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  exchange_rate DECIMAL DEFAULT 1,
  payment_type TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'completed',
  debt_paid DECIMAL DEFAULT 0,
  debt_remaining DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  variant_id TEXT,
  variant_name TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL DEFAULT 0,
  cost_price DECIMAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  exchange_rate DECIMAL DEFAULT 1,
  amount_original DECIMAL DEFAULT 0,
  amount_usd DECIMAL DEFAULT 0,
  profit DECIMAL DEFAULT 0
);

-- Create debts table
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  total_debt DECIMAL DEFAULT 0,
  total_paid DECIMAL DEFAULT 0,
  remaining_debt DECIMAL DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'due',
  notes TEXT,
  is_cash_debt BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expense_type TEXT NOT NULL,
  amount DECIMAL DEFAULT 0,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  distributions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create recurring_expenses table
CREATE TABLE public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expense_type TEXT NOT NULL,
  amount DECIMAL DEFAULT 0,
  description TEXT,
  interval TEXT DEFAULT 'monthly',
  next_due_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create partners table
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  initial_capital DECIMAL DEFAULT 0,
  current_capital DECIMAL DEFAULT 0,
  share_percentage DECIMAL DEFAULT 0,
  expense_share_percentage DECIMAL DEFAULT 0,
  access_all BOOLEAN DEFAULT true,
  category_shares JSONB DEFAULT '[]',
  total_profit_earned DECIMAL DEFAULT 0,
  total_withdrawn DECIMAL DEFAULT 0,
  current_balance DECIMAL DEFAULT 0,
  pending_profit DECIMAL DEFAULT 0,
  confirmed_profit DECIMAL DEFAULT 0,
  pending_profit_details JSONB DEFAULT '[]',
  profit_history JSONB DEFAULT '[]',
  expense_history JSONB DEFAULT '[]',
  capital_history JSONB DEFAULT '[]',
  withdrawal_history JSONB DEFAULT '[]',
  joined_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create maintenance_services table
CREATE TABLE public.maintenance_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  description TEXT,
  service_price DECIMAL DEFAULT 0,
  parts_cost DECIMAL DEFAULT 0,
  profit DECIMAL DEFAULT 0,
  payment_type TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores
CREATE POLICY "Users manage own store" ON public.stores FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for categories
CREATE POLICY "Users manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for products
CREATE POLICY "Users manage own products" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for customers
CREATE POLICY "Users manage own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for invoices
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for invoice_items (based on invoice ownership)
CREATE POLICY "Users manage own invoice items" ON public.invoice_items FOR ALL 
USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()))
WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

-- RLS Policies for debts
CREATE POLICY "Users manage own debts" ON public.debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for expenses
CREATE POLICY "Users manage own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for recurring_expenses
CREATE POLICY "Users manage own recurring expenses" ON public.recurring_expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for partners
CREATE POLICY "Users manage own partners" ON public.partners FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for maintenance_services
CREATE POLICY "Users manage own maintenance" ON public.maintenance_services FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_date ON public.invoices(date);
CREATE INDEX idx_debts_user_id ON public.debts(user_id);
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_partners_user_id ON public.partners(user_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER set_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_debts_updated_at BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();