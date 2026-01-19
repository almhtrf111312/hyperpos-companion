-- إنشاء bucket عام لصور المنتجات
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- سياسة رفع الصور (للمستخدمين المسجلين فقط)
CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- سياسة عرض الصور (للجميع - الصور عامة)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- سياسة حذف الصور (للمالك فقط)
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');