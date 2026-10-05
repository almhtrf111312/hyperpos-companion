-- Add email binding and device lock to activation_codes
ALTER TABLE public.activation_codes
ADD COLUMN IF NOT EXISTS assigned_email text,
ADD COLUMN IF NOT EXISTS locked_device_id text;

-- Add device binding and multi-device flag to app_licenses
ALTER TABLE public.app_licenses
ADD COLUMN IF NOT EXISTS device_id text,
ADD COLUMN IF NOT EXISTS allow_multi_device boolean DEFAULT false;

-- Create secure activation function
CREATE OR REPLACE FUNCTION public.activate_code_strict(
  p_code text,
  p_user_id uuid,
  p_user_email text,
  p_device_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code record;
  v_expires_at timestamptz;
BEGIN
  -- Search and Lock row for update
  SELECT * INTO v_code 
  FROM public.activation_codes 
  WHERE code = p_code AND is_active = true 
  FOR UPDATE;

  -- Fallback to case-insensitive match
  IF NOT FOUND THEN
    SELECT * INTO v_code 
    FROM public.activation_codes 
    WHERE upper(replace(code, ' ', '')) = upper(replace(p_code, ' ', '')) AND is_active = true
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'كود التفعيل غير صالح أو غير موجود');
  END IF;

  IF v_code.current_uses >= v_code.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم الوصول للحد الأقصى لاستخدام الكود');
  END IF;

  -- Code assigned to another user account id
  IF v_code.assigned_user_id IS NOT NULL AND v_code.assigned_user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا الكود مخصص لحساب آخر ولا يمكن استخدامه');
  END IF;

  -- Email binding check
  IF v_code.assigned_email IS NOT NULL AND lower(v_code.assigned_email) != lower(p_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'كود التفعيل مخصص لبريد إلكتروني آخر');
  END IF;

  -- Check if code has expired
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'كود التفعيل منتهي الصلاحية');
  END IF;

  -- Calculate expiry
  v_expires_at := now() + (v_code.duration_days || ' days')::interval;

  -- Deactivate code or increment uses and lock device
  UPDATE public.activation_codes
  SET
    current_uses = current_uses + 1,
    used_by = COALESCE(used_by, p_user_id),
    used_at = COALESCE(used_at, now()),
    locked_device_id = COALESCE(locked_device_id, p_device_id),
    is_active = false -- As requested: "ويقفل الكود فوراً (is_active = false)"
  WHERE id = v_code.id;

  -- Update or Insert License
  INSERT INTO public.app_licenses (
    user_id,
    activation_code_id,
    activated_at,
    expires_at,
    is_trial,
    is_revoked,
    max_cashiers,
    license_tier,
    device_id
  ) VALUES (
    p_user_id,
    v_code.id,
    now(),
    v_expires_at,
    false,
    false,
    COALESCE(v_code.max_cashiers, 1),
    COALESCE(v_code.license_tier, 'basic'),
    p_device_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    activation_code_id = EXCLUDED.activation_code_id,
    activated_at = EXCLUDED.activated_at,
    expires_at = EXCLUDED.expires_at,
    is_trial = EXCLUDED.is_trial,
    is_revoked = EXCLUDED.is_revoked,
    max_cashiers = EXCLUDED.max_cashiers,
    license_tier = EXCLUDED.license_tier,
    device_id = COALESCE(public.app_licenses.device_id, EXCLUDED.device_id);

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at,
    'duration_days', v_code.duration_days,
    'max_cashiers', COALESCE(v_code.max_cashiers, 1),
    'license_tier', COALESCE(v_code.license_tier, 'basic')
  );
END;
$$;
