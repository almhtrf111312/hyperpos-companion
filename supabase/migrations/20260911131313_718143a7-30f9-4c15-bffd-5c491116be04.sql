-- 1) Tenant check for inventory value RPC
CREATE OR REPLACE FUNCTION public.get_inventory_value(_owner_id uuid)
RETURNS TABLE(total_cost numeric, total_sale numeric, total_units bigint, total_skus bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _owner_id IS DISTINCT FROM public.get_owner_id(auth.uid())
     AND NOT public.is_boss(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(COALESCE(p.quantity,0) * COALESCE(p.cost_price,0)), 0)::numeric,
    COALESCE(SUM(COALESCE(p.quantity,0) * COALESCE(p.sale_price,0)), 0)::numeric,
    COALESCE(SUM(COALESCE(p.quantity,0)), 0)::bigint,
    COUNT(*)::bigint
  FROM public.products p
  WHERE p.user_id = _owner_id AND COALESCE(p.archived,false) = false;
END;
$function$;

-- 2) Invoice sequence can only be advanced for the caller's own tenant
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(_user_id uuid DEFAULT NULL::uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _next bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _owner := public.get_owner_id(auth.uid());
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'No owner context';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> _owner THEN
    IF NOT public.is_boss(auth.uid()) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
    _owner := _user_id;
  END IF;

  INSERT INTO public.invoice_sequences (user_id, last_number)
  VALUES (_owner, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET last_number = public.invoice_sequences.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO _next;

  RETURN _next;
END;
$function$;

-- 3) app_settings: only public contact keys are readable
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;

CREATE POLICY "Public contact settings are readable"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('developer_phone', 'contact_links'));

CREATE POLICY "Boss can read all app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.is_boss(auth.uid()));

GRANT SELECT ON public.app_settings TO anon;