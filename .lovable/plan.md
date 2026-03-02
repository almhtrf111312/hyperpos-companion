

# خطة شاملة لإصلاح جميع المشاكل المُبلَّغ عنها

## المشاكل المحددة وأسبابها

### 1. صفحة المظهر (Appearance) — شاشة سوداء
**السبب:** صفحة `Appearance.tsx` تعمل بشكل صحيح من ناحية الكود، لكن المشكلة في `ThemeSection` أو `ThemeLivePreview` — يحتمل أن يكون هناك خطأ في التقديم (render error) يتسبب في crash صامت. يجب إضافة Error Boundary حول ThemeSection وتجربة عزل المشكلة.

**الإصلاح:** إضافة `try-catch` / Error Boundary حول `ThemeSection` في `Appearance.tsx` + التحقق من أن `ThemeLivePreview` لا يتسبب في خطأ عند بعض القيم.

### 2. التقارير — التاريخ متصل على الموبايل
**السبب:** في `Reports.tsx` سطر 876-903، حقول التاريخ (من/إلى) في `flex items-center gap-3` مع `flex-1` لكل حقل — على الشاشات الصغيرة جداً (~360px) التباعد غير كافٍ.

**الإصلاح:** تغيير التخطيط إلى `grid grid-cols-2 gap-2` بدلاً من flex لضمان فصل واضح، مع تقليل padding داخلي.

### 3. الأوفلاين — التبويبات لا تظهر كلها
**السبب:** جميع الصفحات (Reports, Invoices, Customers, Expenses...) تستخدم `loadXxxCloud()` التي تحاول الاتصال بالسحابة أولاً. عند عدم الاتصال تعود للكاش المحلي، لكن بعض الصفحات لا تخزّن كاش محلي (مثل Invoices). المشكلة ليست في إخفاء التبويبات بل في عدم تحميل البيانات.

**الإصلاح:** التأكد من أن كل `loadXxxCloud()` function تحفظ في localStorage/IndexedDB عند النجاح وتعود منها عند الفشل (نفس نمط products-cloud.ts). الصفحات الحالية التي تحتاج تحسين: `invoices-cloud.ts`, `expenses-cloud.ts`, `customers-cloud.ts`, `debts-cloud.ts`.

### 4. السلة تفرغ عند الخروج والعودة
**السبب:** `POS.tsx` سطر 157-187 — `saveCart` يعتمد على `useCallback` مع `[cart]` dependency. عند الخروج عبر `appStateChange`, `cart` قد يكون فارغاً لأن الـ listener تم إنشاؤه مع نسخة قديمة من `cart`. المشكلة في سطر 204:
```
if (cart.length > 0) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
```
لكن `cart` في closure قد لا يحتوي على أحدث القيم.

**الإصلاح:** استخدام `useRef` لحفظ آخر قيمة للسلة (`cartRef.current = cart`) ثم استخدام `cartRef.current` في listener بدلاً من `cart` مباشرة. نفس الحل لـ `cartOpen`.

### 5. نموذج إضافة المنتج يُفرغ عند الخروج والعودة
**السبب:** النظام الحالي يحفظ Form State بشكل صحيح (سطر 317-333)، لكنه يمسح الحالة عندما `showAddDialog` أو `showEditDialog` يصبح `false` (سطر 330). عند خروج التطبيق والعودة، الـ dialog يُغلق أولاً ثم يُعاد فتحه، مما يمسح البيانات.

**الإصلاح:** تعديل المنطق بحيث لا يمسح `FORM_STORAGE_KEY` فوراً عند إغلاق الـ dialog، بل فقط عند الحفظ الناجح أو الإلغاء الصريح.

### 6. شاشة التحميل عند ضعف الانترنت
**السبب:** `LicenseGuard.tsx` سطر 171-179 يعرض شاشة تحميل مع `Loader2` عندما `isFullyLoading` = true. هذا يحجب التطبيق بالكامل.

**الإصلاح:** تقليل timeout من 3000ms إلى 1500ms لعرض زر "تخطي" بشكل أسرع، أو الأفضل: إذا كان هناك كاش محلي صالح للرخصة، تخطي التحميل فوراً.

### 7. إضافة منتج مكرر بنفس الباركود
**السبب:** `addProductCloud` (سطر 355) لا يتحقق من وجود منتج بنفس الباركود. و`handleAddProduct` (سطر 668) لا يعطّل الزر بعد الضغط الأول (يعطّل فقط بعد `setIsSaving(true)` لكن النقر السريع يمر قبل التحديث).

**الإصلاح:**
1. إضافة `disabled={isSaving}` على زر الحفظ (قد يكون موجوداً لكن النقر يمر بسبب React batching)
2. إضافة guard في بداية `handleAddProduct`: إذا `isSaving` return فوراً
3. إضافة فحص تكرار الباركود قبل الإضافة

### 8. المخزون لا ينقص بعد البيع
**السبب:** يحتاج فحص `confirmCashSale` / خصم المخزون. يحتمل أن الخصم يحدث على السحابة لكن الكاش المحلي لا يُحدَّث فوراً، فعند العودة لصفحة المنتجات يعرض القيمة القديمة من الكاش.

**الإصلاح:** بعد كل عملية بيع، إرسال `invalidateProductsCache()` لضمان تحديث الكاش في المرة القادمة.

---

## خطة التنفيذ

### الخطوة 1: إصلاح شاشة المظهر السوداء
**ملف:** `src/pages/Appearance.tsx`
- إضافة Error Boundary بسيط حول `ThemeSection`
- إضافة fallback UI في حال حدوث خطأ

### الخطوة 2: إصلاح تاريخ التقارير على الموبايل
**ملف:** `src/pages/Reports.tsx` (سطر 876-903)
- تغيير `flex items-center gap-3` إلى `grid grid-cols-2 gap-2 w-full`
- تقليل padding الداخلي للحقول

### الخطوة 3: إصلاح السلة تفرغ عند الخروج
**ملف:** `src/pages/POS.tsx`
- إضافة `cartRef` = `useRef(cart)` + تحديثه مع كل تغيير
- استخدام `cartRef.current` في `appStateChange` listener بدلاً من `cart`
- حفظ السلة باستمرار (كل تغيير) وليس فقط عند الخروج

### الخطوة 4: إصلاح نموذج المنتج يفرغ
**ملف:** `src/pages/Products.tsx` (سطر 317-333)
- تعديل useEffect: لا يمسح `FORM_STORAGE_KEY` عند إغلاق dialog تلقائياً
- المسح يحدث فقط عبر `clearPersistedState()` الصريحة

### الخطوة 5: إزالة/تسريع شاشة التحميل
**ملف:** `src/components/license/LicenseGuard.tsx`
- تقليل timeout العرض من 3000ms إلى 1000ms
- عرض زر "تخطي" بعد 2000ms بدلاً من 6000ms
- إذا كان الكاش المحلي صالحاً، تخطي فوراً

### الخطوة 6: منع إضافة منتج مكرر
**ملف:** `src/pages/Products.tsx` (handleAddProduct)
- إضافة `if (isSaving) return;` في بداية الدالة
- فحص الباركود المكرر قبل الإضافة عبر مقارنة مع المنتجات المحملة

### الخطوة 7: تحديث المخزون بعد البيع
**ملف:** التحقق من `CartPanel.tsx` أو sale handler
- التأكد من نداء `invalidateProductsCache()` بعد كل عملية بيع ناجحة

### الخطوة 8: تحسين الكاش الأوفلاين للتبويبات الأخرى
**ملفات:** `invoices-cloud.ts`, `customers-cloud.ts`, `expenses-cloud.ts`, `debts-cloud.ts`
- إضافة نفس نمط `saveToLocalCache` / `loadFromLocalCache` المستخدم في `products-cloud.ts`

---

## ملخص التغييرات

| المشكلة | الملف | الإصلاح |
|---------|-------|---------|
| المظهر شاشة سوداء | Appearance.tsx | Error Boundary |
| التاريخ متصل | Reports.tsx | grid-cols-2 بدل flex |
| السلة تفرغ | POS.tsx | useRef للسلة + حفظ مستمر |
| النموذج يفرغ | Products.tsx | عدم مسح الكاش عند إغلاق تلقائي |
| شاشة التحميل | LicenseGuard.tsx | تسريع زر التخطي |
| منتج مكرر | Products.tsx | guard + فحص باركود |
| المخزون لا ينقص | CartPanel/sale handler | invalidateProductsCache بعد البيع |
| تبويبات أوفلاين | cloud stores | إضافة كاش محلي |

