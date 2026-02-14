

# خطة: دعم الباركود المتعدد في التقارير + نظام المتغيرات (Variants)

## تحليل الوضع الحالي

بعد فحص الكود، وجدت التالي:
- قاعدة البيانات تدعم بالفعل `barcode2` و `barcode3` كأعمدة في جدول `products`
- نموذج إضافة المنتج يدعم إضافة 3 باركودات
- البحث السحابي (`getProductByBarcodeCloud`) يبحث في الباركودات الثلاثة
- **مشكلة 1**: البحث المحلي في POS يبحث فقط في `barcode` الأول (السطر 389 في POS.tsx)
- **مشكلة 2**: تقرير Excel لا يتضمن barcode2 و barcode3
- **مشكلة 3**: لا يوجد نظام متغيرات (variant_label) للتمييز بين منتجات بنفس الباركود

## بخصوص اقتراح جدول باركود منفصل

اقتراحك باستخدام جدول منفصل للباركود هو اقتراح ممتاز من الناحية النظرية ويتيح عدد غير محدود من الباركودات. لكن في حالتنا:
- النظام مبني بالكامل على 3 باركودات (barcode, barcode2, barcode3) وهذا يكفي لمعظم الاستخدامات التجارية
- تغيير البنية لجدول منفصل يتطلب إعادة كتابة كبيرة في: المزامنة السحابية، النسخ الاحتياطي، البحث، التقارير، نقطة البيع
- 3 باركودات تغطي 99% من الحالات العملية

**لذلك سنحافظ على البنية الحالية ونضيف ما ينقص:**

---

## التعديلات المطلوبة

### 1. إصلاح البحث المحلي في POS (مشكلة حرجة)
**ملف: `src/pages/POS.tsx`** - السطر 389

حاليا البحث المحلي يبحث فقط في الباركود الأول:
```
const localProduct = products.find(p => p.barcode === barcode);
```

التعديل: البحث في كل الباركودات + عرض نافذة اختيار إذا وُجد أكثر من منتج:
```
const matches = products.filter(p => 
  p.barcode === barcode || p.barcode2 === barcode || p.barcode3 === barcode
);
if (matches.length > 1) -> عرض VariantPickerDialog
if (matches.length === 1) -> إضافة مباشرة
```

### 2. إضافة barcode2/barcode3 في واجهة POS
**ملف: `src/pages/POS.tsx`** - POSProduct interface

إضافة `barcode2` و `barcode3` في POSProduct interface وتمريرهما عند تحويل المنتجات.

### 3. إضافة عمود variant_label في قاعدة البيانات
**Migration SQL:**
```sql
ALTER TABLE products ADD COLUMN variant_label text DEFAULT NULL;
```

### 4. تحديث المزامنة السحابية
**ملف: `src/lib/cloud/products-cloud.ts`**
- إضافة `variant_label` في CloudProduct interface
- إضافته في دوال التحويل `toProduct` و `toCloudProduct`
- إضافته في `updateProductCloud`

### 5. إضافة حقل "المتغير" في نموذج المنتج
**ملف: `src/pages/Products.tsx`**
- إضافة حقل `variantLabel` في formData
- عرض حقل إدخال "المتغير / الوصف" تحت اسم المنتج
- أمثلة للمستخدم: "فقط شاحن"، "مع وصلة Type-C"، "مع وصلة iPhone"

### 6. إنشاء نافذة اختيار المتغير
**ملف جديد: `src/components/pos/VariantPickerDialog.tsx`**
- نافذة بسيطة تعرض المنتجات المطابقة للباركود
- كل منتج يعرض: الاسم + المتغير + السعر + الكمية
- الضغط على منتج يضيفه للسلة

### 7. تحديث تقرير Excel
**ملف: `src/lib/excel-export.ts`**
- إضافة أعمدة: "باركود 2"، "باركود 3"، "المتغير" في `exportProductsToExcel`

**ملف: `src/pages/Reports.tsx`**
- تمرير barcode2، barcode3، variantLabel عند استدعاء التقرير

---

## ترتيب التنفيذ

1. Migration: إضافة عمود `variant_label`
2. تحديث `products-cloud.ts`: دعم variant_label
3. تحديث `Products.tsx`: حقل المتغير في النموذج
4. تحديث `POS.tsx`: إصلاح البحث + دعم barcode2/3 + منطق المتغيرات
5. إنشاء `VariantPickerDialog.tsx`
6. تحديث `excel-export.ts` و `Reports.tsx`: أعمدة التقارير الجديدة

## الملفات المتأثرة
- `src/lib/cloud/products-cloud.ts` - دعم variant_label
- `src/pages/Products.tsx` - حقل المتغير
- `src/pages/POS.tsx` - إصلاح البحث + منطق المتغيرات
- `src/components/pos/VariantPickerDialog.tsx` - ملف جديد
- `src/lib/excel-export.ts` - أعمدة التقارير
- `src/pages/Reports.tsx` - تمرير البيانات الجديدة
- Migration SQL - عمود variant_label

