

## خطة التنفيذ: تحسينات وضع المطاعم (Restaurant Mode)

### ملخص التغييرات

ثلاثة محاور رئيسية: (1) تحديث إعدادات حقول المنتج للمطعم، (2) إخفاء زر الباركود في وضع المطعم، (3) فلترة التقارير حسب نوع المحل.

---

### 1. تحديث إعدادات حقول المنتج (`src/lib/product-fields-config.ts`)

**الوضع الحالي:** المطعم يفعّل `expiryDate`, `tableNumber`, `orderNotes`, `minStockLevel`

**التعديل:**
- تعطيل `expiryDate` (الأطباق لا تحتاج تاريخ صلاحية)
- إبقاء `tableNumber` و `orderNotes` مفعّلة
- تعطيل `wholesalePrice` (ليس ضرورياً للمطاعم)
- إبقاء `minStockLevel` مفعّل لتتبع المكونات

---

### 2. إخفاء زر الباركود في وضع المطعم

**الملف:** `src/components/pos/ProductGrid.tsx`

**التعديل:**
- تمرير prop جديد `hideBarcode` أو قراءة `storeType` داخلياً
- إخفاء زر الباركود ومكون `BarcodeScanner` عندما يكون نوع المحل "restaurant"
- تحديث حقل البحث ليعرض "بحث عن طبق..." بدون ذكر الباركود

**الملف:** `src/pages/Products.tsx`
- إخفاء حقل الباركود في نموذج إضافة/تعديل المنتج عندما يكون المحل مطعماً

---

### 3. فلترة التقارير حسب نوع المحل (`src/pages/Reports.tsx`)

**الوضع الحالي:** التقارير تخفي جرد المخزون للمخابز وتقارير العهدة لغير محلات الهواتف/الصيانة.

**التعديل للمطعم:**
- إخفاء تقرير "جرد الموزعين" و "قيمة العهدة" (موجود أصلاً - المطعم ليس distributor store)
- إخفاء تقرير "الصيانة" (موجود أصلاً - maintenance=false)
- إبقاء: المبيعات، الأرباح، المنتجات، المخزون، العملاء، الشركاء، المصاريف، فواتير المشتريات، الديون، أداء الكاشير، الإغلاق اليومي

**ملاحظة:** النظام الحالي يعالج هذا بالفعل بشكل صحيح بفضل شروط `isDistributorStore` و `visibleSections.maintenance`. لكن سنتأكد من عدم وجود تقارير إضافية غير مناسبة.

---

### 4. تحديث `VisibleSections` في `store-type-config.ts`

**الوضع الحالي:** المطعم يفعّل `expiry: true`

**التعديل:** تعطيل `expiry` للمطاعم (الأطباق لا تحتاج تتبع صلاحية)

---

### التفاصيل التقنية

**الملفات المعدلة:**

1. **`src/lib/product-fields-config.ts`**
   - تحديث إعدادات restaurant: `expiryDate: false`, `wholesalePrice: false`, `tableNumber: true`, `orderNotes: true`

2. **`src/lib/store-type-config.ts`**
   - تحديث `getVisibleSections` للمطعم: `expiry: false`
   - التأكد من أن search placeholder للمطعم لا يذكر "باركود"

3. **`src/components/pos/ProductGrid.tsx`**
   - إضافة قراءة `getCurrentStoreType()` لتحديد ما إذا كان المحل مطعماً
   - إخفاء زر الباركود (`<Button>` مع أيقونة `Barcode`) ومكون `<BarcodeScanner>` عندما يكون `storeType === 'restaurant'`

4. **`src/pages/Products.tsx`**
   - إخفاء حقل الباركود في نموذج الإضافة/التعديل عندما يكون المحل مطعماً

5. **`src/pages/Reports.tsx`**
   - لا تغييرات إضافية مطلوبة (الفلترة الحالية تعمل بشكل صحيح للمطاعم)

**لا توجد تغييرات في قاعدة البيانات.**

