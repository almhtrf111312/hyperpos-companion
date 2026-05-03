
-- 1) profit_records
CREATE TABLE IF NOT EXISTS public.profit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id text NOT NULL,
  gross_profit numeric NOT NULL DEFAULT 0,
  cogs numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  is_reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profit_records_user ON public.profit_records(user_id);
CREATE INDEX IF NOT EXISTS idx_profit_records_invoice ON public.profit_records(invoice_id);
ALTER TABLE public.profit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profit records"
  ON public.profit_records FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- 2) cash_shifts
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cashier_id uuid,
  cashier_name text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_balance numeric NOT NULL DEFAULT 0,
  expected_balance numeric NOT NULL DEFAULT 0,
  actual_balance numeric,
  variance numeric DEFAULT 0,
  variance_reason text,
  reconciliation_status text NOT NULL DEFAULT 'open' CHECK (reconciliation_status IN ('open','matched','unmatched','pending')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_user ON public.cash_shifts(user_id);
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cash shifts"
  ON public.cash_shifts FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));
CREATE TRIGGER trg_cash_shifts_updated_at
  BEFORE UPDATE ON public.cash_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) shift_transactions
CREATE TABLE IF NOT EXISTS public.shift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('sale','deposit_capital','deposit_revenue','deposit_purchase_cover','debt_payment','expense','refund','writeoff','withdrawal')),
  amount numeric NOT NULL DEFAULT 0,
  reference_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_tx_shift ON public.shift_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_tx_user ON public.shift_transactions(user_id);
ALTER TABLE public.shift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shift transactions"
  ON public.shift_transactions FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- 4) debt_writeoffs
CREATE TABLE IF NOT EXISTS public.debt_writeoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  debt_id uuid NOT NULL,
  customer_name text,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  capital_impact numeric DEFAULT 0,
  partner_impact jsonb DEFAULT '[]'::jsonb,
  written_off_at timestamptz NOT NULL DEFAULT now(),
  written_off_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debt_writeoffs_user ON public.debt_writeoffs(user_id);
ALTER TABLE public.debt_writeoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own debt writeoffs"
  ON public.debt_writeoffs FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- 5) invoice_sequences
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  user_id uuid PRIMARY KEY,
  last_number bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sequence"
  ON public.invoice_sequences FOR SELECT TO authenticated
  USING (user_id = get_owner_id(auth.uid()));

-- 6) invoice_sequence column on invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_sequence bigint;

-- 7) RPC: get_next_invoice_number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(_user_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _next bigint;
BEGIN
  _owner := COALESCE(_user_id, get_owner_id(auth.uid()));
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'No owner context';
  END IF;

  INSERT INTO public.invoice_sequences (user_id, last_number)
  VALUES (_owner, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET last_number = public.invoice_sequences.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO _next;

  RETURN _next;
END;
$$;
