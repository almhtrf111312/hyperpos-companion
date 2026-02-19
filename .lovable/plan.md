## تشخيص المشاكل الثلاث وخطة الإصلاح

---

### المشكلة 1: فشل حفظ المنتج بدون إنترنت في تطبيق الـ APK

**السبب الجذري:**

في `src/pages/Products.tsx`، دوال `handleAddProduct` و`handleEditProduct` تستدعي مباشرة:

```typescript
const newProduct = await addProductCloud(productData);  // تتوقع إنترنت
const success = await updateProductCloud(selectedProduct.id, productData);  // تتوقع إنترنت
```

`addProductCloud` و`updateProductCloud` في `src/lib/cloud/products-cloud.ts` تستدعيان `insertToSupabase` و`updateInSupabase` مباشرة دون أي آلية للعمل أوفلاين. لا توجد أي قيمة `if (!navigator.onLine)` ولا أي إضافة لطابور المزامنة.

بالمقارنة، عمليات الفواتير والديون تحتوي على آلية offline-first كاملة (مثل `processDebtSaleWithOfflineSupport` في `debt-sale-handler.ts`).

**الحل:**

تعديل `addProductCloud` و`updateProductCloud` في `src/lib/cloud/products-cloud.ts` لإضافة دعم الـ offline:

1. عند `addProductCloud`: إذا كان `!navigator.onLine`، يتم حفظ المنتج في الـ IndexedDB/localStorage الكاش الخاص بالمنتجات مباشرة (مع ID مؤقت)، ثم إضافة عملية `product_add` لطابور المزامنة لرفعها لاحقاً عند عودة الإنترنت. يُرجع `newProduct` محلياً دون انتظار الاستجابة من السيرفر.
2. عند `updateProductCloud`: إذا `!navigator.onLine`، يتم تحديث المنتج في الكاش المحلي مباشرة، وإضافة عملية `product_update` لطابور المزامنة.

بهذا يُعرض المنتج المحدث/الجديد فوراً في الواجهة حتى بدون إنترنت، ويُرفع السحابة عند العودة.

---

### المشكلة 2: الدين والعميل يبقيان بعد استرداد الفاتورة

**السبب الجذري:**

في `src/lib/cloud/invoices-cloud.ts`، دالة `refundInvoiceCloud` تقوم بخطوتين بشكل صحيح:

1. تحذف الدين المرتبط بالفاتورة: `deleteDebtByInvoiceIdCloud(id)` ✅
2. تُعيد المخزون: `restoreStockBatchCloud(...)` ✅

لكن المشكلة: **لا يتم تعديل إحصائيات العميل (`customers` table)**. يبقى `total_debt` و`total_purchases` و`invoice_count` في سجل العميل كما هو دون خصم قيمة الفاتورة المستردة.

وعلى صعيد قسم الديون: يتم حذف الدين بـ `deleteDebtByInvoiceIdCloud(id)` لكن هذه الدالة تبحث بـ `invoice_id` الذي قد يكون `invoice_number` (مثل `20260219-001`) وليس UUID. الدالة `deleteDebtByInvoiceIdCloud` تستخدم `.or('invoice_id.eq.${invoiceId},id.eq.${invoiceId}')` للبحث وهذا يجب أن يعمل، إلا أن المشكلة قد تكون في صياغة الـ `.or()` في Supabase مع قيم تحتوي شرطة `-`.

**الحل:**

تعديل `refundInvoiceCloud` في `src/lib/cloud/invoices-cloud.ts` لإضافة خطوتين:

1. **عكس إحصائيات العميل:** إذا كانت الفاتورة مرتبطة بعميل (`customer_id` أو `customer_name`)، يتم استدعاء `updateCustomerStatsCloud` لخصم قيمة الفاتورة من `total_purchases` وخصم `total_debt` (في حالة الدين)، وتقليل `invoice_count`.
2. **إصلاح حذف الدين:** استبدال استخدام `.or()` المعقد بقراءة الدين المرتبط أولاً ثم حذفه مباشرة بـ UUID الصحيح:

```typescript
const { data: debts } = await supabase
  .from('debts')
  .select('id')
  .eq('user_id', userId)
  .or(`invoice_id.eq."${id}"`);
// ثم حذف كل دين بـ id الخاص به
```

أو استخدام `.eq('invoice_id', id)` مباشرة بعد تأكيد أن `invoice_id` يُحفظ كـ `invoice_number`.

---

### المشكلة 3: زر "نسيت كلمة المرور" يعرض بيانات التواصل الصحيحة

**ما يطلبه المستخدم:**

المستخدم يريد أنه عند الضغط على "نسيت كلمة المرور" يظهر **أرقام التواصل الخاصة بالبوس** (واتساب، تيليجرام) التي يكتبها في لوحة التحكم في الإعدادات، وليس فقط إرسال رابط إعادة تعيين البريد. هذا منطقي لأن المستخدمين النهائيين (الكاشير) لا يملكون بريد إلكتروني خاص بهم وليس لديهم طريقة لإعادة تعيين كلمة المرور بأنفسهم، بل يحتاجون للتواصل مع البوس الذي يمتلك الحساب.

**الحل:**

تعديل `src/pages/Login.tsx` لتوسيع نافذة "نسيت كلمة المرور":

1. عند فتح النافذة، يتم جلب بيانات التواصل من `app_settings` (مفتاح `contact_links` أو `developer_phone`) من قاعدة البيانات — نفس الطريقة التي تستخدمها `ContactLinksSection.tsx`.
2. إذا كانت هناك بيانات تواصل محفوظة: تعرض النافذة أزرار التواصل (واتساب، تيليجرام، الخ) مع رسالة "تواصل مع المطور لإعادة تعيين كلمة المرور".
3. إذا لم تكن هناك بيانات تواصل: تعرض النافذة فقط حقل البريد الإلكتروني لإرسال رابط إعادة التعيين (كما هو الحال الآن).

هذا يحل المشكلة لكلا النوعين من المستخدمين: الكاشير الذي يحتاج للتواصل مع البوس، والمالك (admin) الذي يمكنه إعادة تعيين كلمة مروره بنفسه بالبريد.

---

## الملفات التي سيتم تعديلها

1. `**src/lib/cloud/products-cloud.ts**`: تعديل `addProductCloud` و`updateProductCloud` لإضافة دعم الـ offline عبر تحديث الكاش المحلي (IDB + localStorage) مباشرة وإضافة العملية لطابور المزامنة عند انقطاع الاتصال.
2. `**src/lib/cloud/invoices-cloud.ts**`: تعديل `refundInvoiceCloud` لإضافة:
  - جلب بيانات الفاتورة الكاملة (العميل، المبلغ، نوع الدفع)
  - عكس إحصائيات العميل (خصم المشتريات والدين)
  - إصلاح آلية حذف الدين بحيث تعمل بشكل موثوق
3. `**src/pages/Login.tsx**`: توسيع نافذة "نسيت كلمة المرور" لجلب وعرض بيانات التواصل المحفوظة في الإعدادات، مع الاحتفاظ بخيار إرسال رابط البريد الإلكتروني كخيار إضافي.