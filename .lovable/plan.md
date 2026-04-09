

# خطة إصلاح أخطاء البناء + مشكلة فقدان صور المنتجات

---

## تحليل مشكلة فقدان الصور

بعد فحص قاعدة البيانات، المنتج "شاحن سيارة C11" يحتوي على `image_url = null` — أي الصورة لم تُحفظ أبداً.

**الأسباب المحتملة:**

1. **المنتج أُضيف أوفلاين:** عند حفظ المنتج أوفلاين، الصورة تُحفظ كـ base64 مضغوطة في الـ sync queue. لكن عند المزامنة لاحقاً، `syncImageToCloud` قد لا تُستدعى لأن المنتج أصلاً في الـ queue وليس في `Products.tsx`.
2. **الصورة رُفعت بنجاح لكن `updateProductCloud` فشل:** `syncImageToCloud` ترفع الصورة ثم تستدعي `updateProductCloud` لتحديث المسار — إذا فشل التحديث، المسار يضيع.
3. **الصورة كانت base64 كبيرة جداً:** عند الحفظ في الـ offline queue، الـ base64 الكبيرة قد تُقطع أو تفشل، فيُحفظ المنتج بدون صورة.

**الحل الجذري:** عند تحميل المنتجات من السحابة (`loadProductsCloud`)، إذا كان `image_url` فارغاً لكن النسخة المحلية تحتوي صورة، يجب مزامنة الصورة تلقائياً.

---

## خطة التنفيذ

### 1. إصلاح `NodeJS.Timeout` (3 ملفات)

**ملفات:** `ExitConfirmDialog.tsx`, `BackgroundSyncIndicator.tsx`, `ProductGrid.tsx`

تغيير `NodeJS.Timeout` إلى `ReturnType<typeof setTimeout>` — هذا النوع يعمل في كل البيئات بدون الحاجة لتعريف NodeJS.

### 2. إصلاح مفاتيح الترجمة المفقودة

**ملف:** `src/components/pos/ProductDetailsDialog.tsx`

المفاتيح `products.tabGeneral`, `products.tabStock`, `products.tabPricing` غير موجودة في ملف i18n. الكود يستخدم fallback بالفعل (`|| 'عام'`), لكن TypeScript يرفضها كـ parameter type.

**الحل:** إضافة المفاتيح الثلاث لملف `i18n.ts` في قسم `products`.

### 3. تحسين حفظ الصور لمنع فقدانها

**ملف:** `src/lib/cloud/products-cloud.ts`

**التغيير:** في `addProductCloud`، إذا كانت الصورة `data:` (base64)، يجب محاولة رفعها مباشرة قبل إنشاء المنتج بدلاً من الاعتماد على `syncImageToCloud` اللاحق الذي قد يفشل صامتاً. إذا فشل الرفع، تُحفظ الـ base64 المضغوطة.

**ملف:** `src/pages/Products.tsx`

**التغيير:** إضافة آلية retry — عند تحميل المنتجات، فحص المنتجات التي `image_url = null` محلياً ولديها صورة في الكاش، ومحاولة مزامنتها.

---

## ملخص الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/components/ExitConfirmDialog.tsx` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `src/components/pos/BackgroundSyncIndicator.tsx` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `src/components/pos/ProductGrid.tsx` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `src/components/pos/ProductDetailsDialog.tsx` | استخدام نصوص مباشرة بدل مفاتيح ترجمة مفقودة |
| `src/lib/i18n.ts` | إضافة مفاتيح `tabGeneral`, `tabStock`, `tabPricing` |
| `src/lib/cloud/products-cloud.ts` | محاولة رفع الصورة مباشرة في `addProductCloud` |

