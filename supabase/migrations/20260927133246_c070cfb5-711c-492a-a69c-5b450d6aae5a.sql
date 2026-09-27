DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (auth.uid())::text);