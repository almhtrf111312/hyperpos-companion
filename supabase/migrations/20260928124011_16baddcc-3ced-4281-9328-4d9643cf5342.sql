CREATE OR REPLACE FUNCTION public.add_expense_atomic(
  _operation_id uuid, _expense_type text, _amount numeric, _description text, _date date, _notes text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _amt numeric := round(coalesce(_amount,0), 2);
  _total_share numeric;
  _dist jsonb := '[]'::jsonb;
  p record;
  _ratio numeric;
  _part numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amt <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  _owner := public.get_owner_id(_uid);
  IF EXISTS (SELECT 1 FROM expenses WHERE id = _operation_id) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'id', _operation_id);
  END IF;
  SELECT coalesce(sum(coalesce(expense_share_percentage, share_percentage, 0)),0) INTO _total_share
    FROM partners WHERE user_id = _owner;
  IF _total_share > 0 THEN
    FOR p IN SELECT * FROM partners WHERE user_id = _owner FOR UPDATE LOOP
      _ratio := coalesce(p.expense_share_percentage, p.share_percentage, 0) / _total_share;
      _part := round(_amt * _ratio, 2);
      IF _part > 0 THEN
        _dist := _dist || jsonb_build_object('partnerId', p.id, 'partnerName', p.name, 'amount', _part, 'percentage', round(_ratio*100, 4));
        UPDATE partners SET
          current_balance = round(coalesce(current_balance,0) - _part, 2),
          expense_history = coalesce(expense_history,'[]'::jsonb) || jsonb_build_object(
            'expenseId', _operation_id::text, 'type', _expense_type, 'amount', _part,
            'date', _date, 'notes', _notes, 'createdAt', now()),
          updated_at = now()
        WHERE id = p.id;
      END IF;
    END LOOP;
  END IF;
  INSERT INTO expenses(id, user_id, expense_type, amount, description, date, notes, distributions, cashier_id)
  VALUES (_operation_id, _owner, _expense_type, _amt, _description, coalesce(_date, current_date), _notes, _dist, _uid);
  RETURN jsonb_build_object('success', true, 'already_processed', false, 'id', _operation_id, 'distributions', _dist);
END; $$;
REVOKE ALL ON FUNCTION public.add_expense_atomic(uuid,text,numeric,text,date,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_expense_atomic(uuid,text,numeric,text,date,text) TO authenticated;