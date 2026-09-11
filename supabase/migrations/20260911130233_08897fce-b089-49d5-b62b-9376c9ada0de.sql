CREATE OR REPLACE FUNCTION public.prevent_license_self_upgrade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted server-side context (service role / no end-user session) is allowed
  IF auth.uid() IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Boss bypass
  IF public.is_boss(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.expires_at        IS DISTINCT FROM OLD.expires_at
  OR NEW.is_revoked        IS DISTINCT FROM OLD.is_revoked
  OR NEW.license_tier      IS DISTINCT FROM OLD.license_tier
  OR NEW.max_cashiers      IS DISTINCT FROM OLD.max_cashiers
  OR NEW.allow_multi_device IS DISTINCT FROM OLD.allow_multi_device
  OR NEW.is_trial          IS DISTINCT FROM OLD.is_trial
  OR NEW.activation_code_id IS DISTINCT FROM OLD.activation_code_id
  OR NEW.user_id           IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Permission denied: cannot modify privileged license fields';
  END IF;

  RETURN NEW;
END;
$function$;