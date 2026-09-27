CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  debt_id uuid NOT NULL,
  operation_id text NOT NULL,
  amount numeric NOT NULL,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);
GRANT SELECT ON public.debt_payments TO authenticated;
GRANT ALL ON public.debt_payments TO service_role;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads debt payments" ON public.debt_payments FOR SELECT TO authenticated
  USING (user_id = public.get_owner_id(auth.uid()));

-- Keep every debt row internally consistent
CREATE OR REPLACE FUNCTION public.normalize_debt_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.total_debt := round(coalesce(NEW.total_debt,0)::numeric, 2);
  NEW.total_paid := round(greatest(coalesce(NEW.total_paid,0),0)::numeric, 2);
  IF TG_OP = 'UPDATE'
     AND NEW.total_paid = round(coalesce(OLD.total_paid,0)::numeric,2)
     AND NEW.total_debt = round(coalesce(OLD.total_debt,0)::numeric,2)
     AND round(coalesce(NEW.remaining_debt,0)::numeric,2) <> round(coalesce(OLD.remaining_debt,0)::numeric,2)
     AND round(coalesce(NEW.remaining_debt,0)::numeric,2) < round(coalesce(OLD.remaining_debt,0)::numeric,2) THEN
    -- refund-style reduction of remaining without payment: shrink the debt itself
    NEW.total_debt := round(NEW.total_paid + greatest(coalesce(NEW.remaining_debt,0),0)::numeric, 2);
  END IF;
  NEW.remaining_debt := round(greatest(NEW.total_debt - NEW.total_paid, 0)::numeric, 2);
  IF NEW.remaining_debt <= 0 THEN
    NEW.status := 'fully_paid';
  ELSIF NEW.total_paid > 0 THEN
    NEW.status := 'partially_paid';
  ELSIF NEW.status IS NULL OR NEW.status IN ('fully_paid','partially_paid') THEN
    NEW.status := 'due';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_debt_row ON public.debts;
CREATE TRIGGER trg_normalize_debt_row BEFORE INSERT OR UPDATE ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.normalize_debt_row();

-- Mirror debt figures onto the linked invoice
CREATE OR REPLACE FUNCTION public.sync_invoice_from_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.is_cash_debt,false) OR NEW.invoice_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.invoices i
     SET debt_paid = NEW.total_paid,
         debt_remaining = NEW.remaining_debt,
         status = CASE WHEN i.status IN ('refunded','cancelled') THEN i.status
                       WHEN NEW.remaining_debt <= 0 THEN 'paid' ELSE 'pending' END,
         updated_at = now()
   WHERE i.user_id = NEW.user_id
     AND i.invoice_number = NEW.invoice_id
     AND (i.debt_paid IS DISTINCT FROM NEW.total_paid
          OR i.debt_remaining IS DISTINCT FROM NEW.remaining_debt
          OR (i.status NOT IN ('refunded','cancelled')
              AND i.status IS DISTINCT FROM CASE WHEN NEW.remaining_debt <= 0 THEN 'paid' ELSE 'pending' END));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_invoice_from_debt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_invoice_from_debt ON public.debts;
CREATE TRIGGER trg_sync_invoice_from_debt AFTER INSERT OR UPDATE ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_from_debt();

-- Atomic, idempotent payment
CREATE OR REPLACE FUNCTION public.record_debt_payment_atomic(_debt_id uuid, _amount numeric, _operation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid := public.get_owner_id(auth.uid());
  v_debt public.debts%ROWTYPE;
  v_amount numeric := round(coalesce(_amount,0)::numeric, 2);
BEGIN
  IF auth.uid() IS NULL OR v_owner IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF _operation_id IS NULL OR length(_operation_id) < 8 THEN RAISE EXCEPTION 'رقم العملية غير صالح'; END IF;

  SELECT * INTO v_debt FROM public.debts WHERE id = _debt_id FOR UPDATE;
  IF NOT FOUND OR v_debt.user_id <> v_owner THEN RAISE EXCEPTION 'الدين غير موجود'; END IF;

  IF EXISTS (SELECT 1 FROM public.debt_payments WHERE user_id = v_owner AND operation_id = _operation_id) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true,
      'total_debt', v_debt.total_debt, 'total_paid', v_debt.total_paid,
      'remaining_debt', v_debt.remaining_debt, 'status', v_debt.status, 'amount', 0);
  END IF;

  IF v_amount <= 0 THEN RAISE EXCEPTION 'أدخل مبلغًا صحيحًا'; END IF;
  IF v_amount > round(v_debt.remaining_debt::numeric,2) THEN
    RAISE EXCEPTION 'المبلغ أكبر من المتبقي (%)', round(v_debt.remaining_debt::numeric,2);
  END IF;

  UPDATE public.debts SET total_paid = coalesce(total_paid,0) + v_amount, updated_at = now()
   WHERE id = _debt_id RETURNING * INTO v_debt;

  INSERT INTO public.debt_payments(user_id, debt_id, operation_id, amount, paid_by)
  VALUES (v_owner, _debt_id, _operation_id, v_amount, auth.uid());

  RETURN jsonb_build_object('success', true, 'already_processed', false,
    'total_debt', v_debt.total_debt, 'total_paid', v_debt.total_paid,
    'remaining_debt', v_debt.remaining_debt, 'status', v_debt.status, 'amount', v_amount);
END $$;
REVOKE ALL ON FUNCTION public.record_debt_payment_atomic(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_debt_payment_atomic(uuid, numeric, text) TO authenticated;