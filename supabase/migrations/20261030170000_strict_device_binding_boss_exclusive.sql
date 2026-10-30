-- ============================================================================
-- 1. فرض التحديث الإجباري وإلغاء صلاحية النسخ القديمة من السحابة
-- ============================================================================

INSERT INTO public.app_settings (key, value, updated_at)
VALUES (
  'release_config',
  jsonb_build_object(
    'min_version_code', 371,
    'latest_version_code', 371,
    'latest_version_name', '1.5.2',
    'grace_days', 0,
    'forced_since', now(),
    'message', 'هذا الإصدار قديم وغير متوافق أمنياً. يرجى التحديث للإصدار الأخير للمتابعة.'
  )::text,
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ============================================================================
-- 2. إقفال ميزة تعدد الأجهزة لجميع الحسابات وتثبيتها بجهاز واحد (باستثناء Boss)
-- ============================================================================

UPDATE public.app_licenses
SET allow_multi_device = false
WHERE user_id NOT IN (
  SELECT user_id FROM public.user_roles WHERE role = 'boss'
);

-- ============================================================================
-- 3. دالة فحص وربط الجهاز الصارمة (Strict Device Binding RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_and_bind_device(p_device_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_owner_id UUID;
  v_license RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'blocked', true, 'error', 'غير مسجل');
  END IF;

  -- استثناء الـ Boss استثناءً مطلقاً من أي قيود
  SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;
  IF v_user_role = 'boss' THEN
    RETURN jsonb_build_object('success', true, 'blocked', false, 'is_boss', true, 'allow_multi_device', true);
  END IF;

  v_owner_id := public.get_owner_id(v_user_id);
  IF v_owner_id IS NULL THEN v_owner_id := v_user_id; END IF;

  SELECT id, device_id, allow_multi_device INTO v_license
  FROM public.app_licenses
  WHERE user_id = v_owner_id AND is_revoked = false
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'blocked', false, 'no_license', true);
  END IF;

  -- مسموح بتعدد الأجهزة
  IF v_license.allow_multi_device = true THEN
    RETURN jsonb_build_object('success', true, 'blocked', false, 'allow_multi_device', true);
  END IF;

  -- إذا لم يكن هناك جهاز مرتبط: نقوم بربط هذا الجهاز فوراً
  IF v_license.device_id IS NULL OR trim(v_license.device_id) = '' THEN
    UPDATE public.app_licenses SET device_id = p_device_id WHERE id = v_license.id;
    RETURN jsonb_build_object('success', true, 'blocked', false, 'bound_now', true, 'device_id', p_device_id);
  END IF;

  -- فحص التطابق
  IF v_license.device_id = p_device_id THEN
    RETURN jsonb_build_object('success', true, 'blocked', false, 'matched', true);
  ELSE
    RETURN jsonb_build_object('success', true, 'blocked', true, 'registered_device_id', v_license.device_id, 'current_device_id', p_device_id);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_bind_device(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_bind_device(TEXT) TO authenticated;
