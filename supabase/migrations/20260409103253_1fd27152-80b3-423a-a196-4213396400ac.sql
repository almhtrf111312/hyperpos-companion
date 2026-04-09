
-- Fix 1: Backup storage policies - change from {public} to {authenticated}
DROP POLICY IF EXISTS "Users can view own backups" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own backups" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own backups" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own backups" ON storage.objects;

CREATE POLICY "Users can view own backups" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'backups'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can upload own backups" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'backups'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can update own backups" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'backups'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can delete own backups" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'backups'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Fix 2: Product images - restrict uploads to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;

CREATE POLICY "Users can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
