-- Extend storage read policy for product-images to also allow legacy 'products/...' paths
-- so old uploads remain visible to the owner-group while keeping the bucket private.
DROP POLICY IF EXISTS "Owner-group can view product images" ON storage.objects;

CREATE POLICY "Owner-group can view product images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    -- New path: folder is the viewer themselves
    (storage.foldername(name))[1] = (auth.uid())::text
    -- Or folder belongs to a member of the same owner-group
    OR (storage.foldername(name))[1] IN (
      SELECT ur.user_id::text FROM public.user_roles ur
      WHERE public.get_owner_id(ur.user_id) = public.get_owner_id(auth.uid())
    )
    -- Legacy path: files uploaded under the shared 'products/' folder (pre-fix)
    OR (storage.foldername(name))[1] = 'products'
  )
);

-- Allow authenticated users to upload under their own UID folder (new path)
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR (storage.foldername(name))[1] = 'products' -- backward compatibility during rollout
  )
);