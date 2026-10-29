-- =========================================================================
-- Migration: Native Multi-Currency in Expenses, Recurring Expenses & Shift Transactions
-- =========================================================================

-- 1. Support native multi-currency in expenses
ALTER TABLE IF EXISTS public.expenses 
  ADD COLUMN IF NOT EXISTS original_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

-- 2. Support dynamic currency in recurring expenses
ALTER TABLE IF EXISTS public.recurring_expenses
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS original_amount numeric;

-- 3. Support multi-currency tracking in shift transactions
ALTER TABLE IF EXISTS public.shift_transactions
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS currency_amount numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_shift_transactions_shift_id ON public.shift_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_transactions_type ON public.shift_transactions(type);
CREATE INDEX IF NOT EXISTS idx_expenses_orig_currency ON public.expenses(original_currency);
