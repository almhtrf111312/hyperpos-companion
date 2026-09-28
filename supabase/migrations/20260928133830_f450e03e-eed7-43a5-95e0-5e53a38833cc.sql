DROP POLICY IF EXISTS "Owner-group can view product images" ON storage.objects;
CREATE POLICY "Owner-group can view product images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images' AND (
    (storage.foldername(name))[1] = (select auth.uid())::text
    OR (storage.foldername(name))[1] IN (
      SELECT ur.user_id::text FROM public.user_roles ur
      WHERE public.get_owner_id(ur.user_id) = public.get_owner_id((select auth.uid()))
    )
    OR (
      (storage.foldername(name))[1] = 'products'
      AND owner_id IN (
        SELECT ur.user_id::text FROM public.user_roles ur
        WHERE public.get_owner_id(ur.user_id) = public.get_owner_id((select auth.uid()))
      )
    )
  )
);