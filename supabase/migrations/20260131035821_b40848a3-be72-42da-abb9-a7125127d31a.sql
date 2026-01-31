-- Remove the INSERT policy that allows users to create their own licenses
-- This is a security fix: licenses should only be created via Edge Functions
DROP POLICY IF EXISTS "Users can insert own license" ON public.app_licenses;

-- Create a more restrictive insert policy that only allows service role
-- (Edge Functions use service role, so they can still insert)
CREATE POLICY "Only service role can insert licenses"
ON public.app_licenses
FOR INSERT
TO authenticated
WITH CHECK (false);  -- No authenticated user can directly insert

-- Note: Edge Functions bypass RLS when using service role key