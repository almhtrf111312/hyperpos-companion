DO $$
DECLARE _def text;
BEGIN
  _def := pg_get_functiondef('public.refund_invoice_partial_atomic(text,jsonb,text)'::regprocedure);
  _def := replace(_def,
    'SELECT * INTO _inv FROM public.invoices WHERE invoice_number = _invoice_number FOR UPDATE;',
    'IF auth.uid() IS NULL THEN RAISE EXCEPTION ''Authentication required''; END IF;
  SELECT * INTO _inv FROM public.invoices WHERE invoice_number = _invoice_number AND user_id = public.get_owner_id(auth.uid()) FOR UPDATE;');
  IF position('get_owner_id(auth.uid()) FOR UPDATE' in _def) = 0 THEN
    RAISE EXCEPTION 'patch failed';
  END IF;
  EXECUTE _def;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_boss(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_boss(uuid) TO authenticated, service_role;