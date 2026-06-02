
-- 1. Secure boss_owners_view: revoke direct access; expose via SECURITY DEFINER RPC
REVOKE SELECT ON public.boss_owners_view FROM authenticated, anon, PUBLIC;

CREATE OR REPLACE FUNCTION public.get_boss_owners()
RETURNS SETOF public.boss_owners_view
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: boss role required';
  END IF;
  RETURN QUERY SELECT * FROM public.boss_owners_view;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_boss_owners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_boss_owners() TO authenticated;

-- 2. Fix app_licenses self-upgrade: restrict UPDATE to device_id only
DROP POLICY IF EXISTS "Users can update own license" ON public.app_licenses;

CREATE POLICY "Boss can update any license"
ON public.app_licenses FOR UPDATE TO authenticated
USING (public.is_boss(auth.uid()))
WITH CHECK (public.is_boss(auth.uid()));

-- Users may only update device_id (enforced via trigger that rejects changes to other fields)
CREATE OR REPLACE FUNCTION public.prevent_license_self_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Boss bypass
  IF public.is_boss(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block changes to privileged fields by non-boss
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_license_self_upgrade ON public.app_licenses;
CREATE TRIGGER trg_prevent_license_self_upgrade
BEFORE UPDATE ON public.app_licenses
FOR EACH ROW EXECUTE FUNCTION public.prevent_license_self_upgrade();

CREATE POLICY "Users can update own license device_id"
ON public.app_licenses FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Remove first-user bootstrap privilege escalation
DROP POLICY IF EXISTS "Allow first user to create admin role" ON public.user_roles;

-- 4. Fix storage product-images: scope view to owner-group folder
DROP POLICY IF EXISTS "Authenticated users can view product images" ON storage.objects;

CREATE POLICY "Owner-group can view product images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    -- Folder is the viewer themselves
    (storage.foldername(name))[1] = (auth.uid())::text
    -- Or folder belongs to a member of the same owner-group
    OR (storage.foldername(name))[1] IN (
      SELECT ur.user_id::text FROM public.user_roles ur
      WHERE public.get_owner_id(ur.user_id) = public.get_owner_id(auth.uid())
    )
  )
);

-- 5. Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon for sensitive ones
REVOKE EXECUTE ON FUNCTION public.delete_owner_cascade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_license(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reset_user_device(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_first_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_warehouse_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_purchase_invoice_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_license_self_upgrade() FROM PUBLIC, anon, authenticated;
