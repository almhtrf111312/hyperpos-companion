-- Add cashier_id to expenses and debts tables for data isolation
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS cashier_id uuid;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS cashier_id uuid;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_expenses_cashier_id ON public.expenses(cashier_id);
CREATE INDEX IF NOT EXISTS idx_debts_cashier_id ON public.debts(cashier_id);