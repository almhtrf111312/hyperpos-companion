
-- Fix mutable search_path on update_purchase_invoice_updated_at
CREATE OR REPLACE FUNCTION public.update_purchase_invoice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix anonymous access on storage: restrict "Anyone can view product images" to authenticated
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Authenticated users can view product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'product-images');

-- Fix "Users can delete own images" to ensure it's authenticated-only with ownership check
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
