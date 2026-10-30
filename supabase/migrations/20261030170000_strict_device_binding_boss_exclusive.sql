-- ============================================================================
-- 1. دالة ذرية وآمنة لفحص وربط الجهاز (Strict Device Binding RPC)
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
  -- 1. التحقق من وجود مستخدم مسجل دخول
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'blocked', true, 'error', 'المستخدم غير مسجل');
  END IF;

  -- 2. استخراج رتبة المستخدم
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  LIMIT 1;

  -- استثناء حصري ومطلق لحساب الـ Boss: لا يخضع لأي قيود على الأجهزة
  IF v_user_role = 'boss' THEN
    RETURN jsonb_build_object(
      'success', true,
      'blocked', false,
      'is_boss', true,
      'allow_multi_device', true
    );
  END IF;

  -- 3. تحديد صاحب الترخيص (إن كان كاشير يعود لصاحب المتجر عبر get_owner_id)
  v_owner_id := public.get_owner_id(v_user_id);
  IF v_owner_id IS NULL THEN
    v_owner_id := v_user_id;
  END IF;

  -- 4. جلب ترخيص الحساب الفعّال
  SELECT id, device_id, allow_multi_device, is_revoked, expires_at
  INTO v_license
  FROM public.app_licenses
  WHERE user_id = v_owner_id AND is_revoked = false
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  -- في حال عدم وجود ترخيص نشط
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'blocked', false,
      'no_license', true
    );
  END IF;

  -- 5. إذا كانت ميزة تعدد الأجهزة مفعلة لهذا الحساب صراحةً
  IF v_license.allow_multi_device = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'blocked', false,
      'allow_multi_device', true
    );
  END IF;

  -- 6. إذا لم يكن هناك جهاز مرتبط بعد: يتم ربط هذا الجهاز فوراً
  IF v_license.device_id IS NULL OR trim(v_license.device_id) = '' THEN
    UPDATE public.app_licenses
    SET device_id = p_device_id
    WHERE id = v_license.id;

    RETURN jsonb_build_object(
      'success', true,
      'blocked', false,
      'bound_now', true,
      'device_id', p_device_id
    );
  END IF;

  -- 7. فحص تطابق الجهاز: هل هو نفس الجهاز المسجل؟
  IF v_license.device_id = p_device_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'blocked', false,
      'matched', true
    );
  ELSE
    -- الجهاز مختلف وتعدد الأجهزة غير مفعل -> حظر فوري
    RETURN jsonb_build_object(
      'success', true,
      'blocked', true,
      'registered_device_id', v_license.device_id,
      'current_device_id', p_device_id
    );
  END IF;
END;
$$;

-- منح صلاحية الاستدعاء للمستخدمين المسجلين
REVOKE EXECUTE ON FUNCTION public.check_and_bind_device(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_bind_device(TEXT) TO authenticated;

-- ============================================================================
-- 2. تصحيح التراخيص في قاعدة البيانات (تأكيد إلغاء تعدد الأجهزة وتثبيت الأجهزة)
-- ============================================================================

-- تأكيد أن الحسابات العادية التي ليس لها استثناء صريح تكون مقيدة بجهاز واحد:
UPDATE public.app_licenses
SET allow_multi_device = false
WHERE allow_multi_device IS NULL;
