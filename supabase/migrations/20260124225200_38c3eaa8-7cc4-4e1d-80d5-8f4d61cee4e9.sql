-- Add allow_multi_device column to app_licenses table
ALTER TABLE public.app_licenses 
ADD COLUMN IF NOT EXISTS allow_multi_device boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.app_licenses.allow_multi_device IS 'When true, allows the user to login from multiple devices without device binding restrictions';