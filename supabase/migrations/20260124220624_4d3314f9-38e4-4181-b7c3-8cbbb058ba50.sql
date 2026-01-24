-- Add device_id column to app_licenses table for device binding
ALTER TABLE public.app_licenses ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create index for faster device lookups
CREATE INDEX IF NOT EXISTS idx_app_licenses_device_id ON public.app_licenses(device_id);

-- Create a function to reset device for a user (Boss only)
CREATE OR REPLACE FUNCTION public.reset_user_device(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is boss
  IF NOT public.is_boss(auth.uid()) THEN
    RAISE EXCEPTION 'Only boss can reset device';
  END IF;
  
  -- Reset device_id for the target user's license
  UPDATE public.app_licenses
  SET device_id = NULL
  WHERE user_id = _target_user_id;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.reset_user_device(uuid) TO authenticated;