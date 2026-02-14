
-- Add allowed_pages column to profiles table
ALTER TABLE public.profiles ADD COLUMN allowed_pages jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.allowed_pages IS 'JSON array of page keys the sub-account can access. NULL means default permissions based on role.';
