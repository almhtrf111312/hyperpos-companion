
-- Fix 1: Restrict app_settings to authenticated users only
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix 2: Make product-images bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'product-images';
