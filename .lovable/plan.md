

## خطة إصلاح: الشروط والخصوصية + صور المنتجات

### المشكلة الأولى: نافذة الشروط والخصوصية لا تظهر

**السبب:** مكون `PrivacyPolicyScreen` يستخدم Radix Dialog الذي يفتح كـ portal فوق كل شيء. المكون نفسه معروض داخل `div` بـ `z-[100]`، لكن Dialog content قد يكون محجوباً أو يُغلق فوراً بسبب تفاعل مع الخلفية الثابتة (`fixed inset-0`). يحتاج تعديل بسيط لضمان ظهور النافذة بشكل صحيح.

**الحل:**
- إضافة `z-[200]` على `DialogContent` لضمان ظهورها فوق الخلفية
- إضافة `onPointerDownOutside` لمنع الإغلاق عند النقر خارج النافذة عن طريق الخطأ

### المشكلة الثانية: صور المنتجات لا تظهر على الهاتف

**السبب الجذري:** عند رفع صورة منتج، يتم تخزين **Signed URL** كاملاً في قاعدة البيانات (`image_url`). هذا الرابط يحتوي على توكن أمان مؤقت (صالح لسنة). المشكلة أن هذا الرابط يحتوي على نطاق Supabase الثابت، وقد لا يعمل بشكل صحيح على الهاتف بسبب:
1. الرابط المخزن هو signed URL كامل وليس مسار تخزين فقط
2. عند انتهاء صلاحية التوكن، الصورة تختفي
3. على الهاتف (APK)، قد يكون هناك مشكلة CORS أو SSL مع روابط Supabase Storage

**الحل:** تغيير النظام ليخزن **مسار الملف فقط** (مثل `products/123.jpg`) في قاعدة البيانات، ثم يولّد signed URL عند العرض فقط.

### الملفات المطلوب تعديلها

| الملف | التعديل |
|-------|---------|
| `src/components/PrivacyPolicyScreen.tsx` | إصلاح z-index ومنع الإغلاق العرضي للـ Dialog |
| `src/lib/image-upload.ts` | تغيير `uploadProductImage` ليعيد مسار الملف بدل signed URL |
| `src/lib/cloud/products-cloud.ts` | إضافة دالة `resolveProductImageUrl` لتوليد signed URL عند العرض |
| `src/pages/Products.tsx` | استخدام `resolveProductImageUrl` عند عرض صور المنتجات |
| `src/components/pos/ProductGrid.tsx` | استخدام `resolveProductImageUrl` عند عرض صور المنتجات في نقطة البيع |

### التفاصيل التقنية

#### 1. إصلاح PrivacyPolicyScreen.tsx
- إضافة className على DialogContent لضمان z-index عالي
- إضافة `onPointerDownOutside={(e) => e.preventDefault()}` لمنع الإغلاق غير المقصود عند لمس الشاشة
- التأكد من أن الـ Dialog portal يظهر فوق الطبقة الثابتة (z-100)

#### 2. تعديل image-upload.ts
- تغيير `uploadProductImage` بحيث يعيد **مسار الملف فقط** (مثل `products/filename.jpg`) بدلاً من signed URL
- إضافة دالة جديدة `getSignedImageUrl(storagePath)` لتوليد signed URL عند الحاجة (صالح لساعة واحدة)

#### 3. تعديل products-cloud.ts
- في دالة `toProduct`: بدلاً من تمرير `image_url` مباشرة، تمريرها كمسار تخزين
- إضافة دالة `resolveProductImageUrl` تفحص إذا كان الرابط signed URL قديم أم مسار تخزين، وتولّد signed URL جديد

#### 4. تعديل Products.tsx و ProductGrid.tsx
- استخدام `useEffect` أو `useState` لتحميل signed URLs للصور عند عرضها
- إضافة مكون `ProductImage` مشترك يتولى تحميل الصورة وعرض placeholder أثناء التحميل

### ملاحظة هامة
الصور المرفوعة سابقاً مخزنة كـ signed URL كامل. الكود الجديد سيتعامل مع كلا الحالتين:
- إذا كانت القيمة مسار ملف قصير (مثل `products/xxx.jpg`) -> يولّد signed URL
- إذا كانت القيمة signed URL كاملاً -> يستخدمها مباشرة (مع محاولة إعادة توليدها إذا فشلت)

