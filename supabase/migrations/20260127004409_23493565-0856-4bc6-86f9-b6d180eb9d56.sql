-- Add cashier_id column to customers table for attribution
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS cashier_id uuid REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_cashier_id ON public.customers(cashier_id);