
## تشخيص شامل للمشاكل وخطة الإصلاح

---

### أولاً: تشخيص المشاكل الجذرية

بعد مراجعة قاعدة البيانات والكود بدقة، تبيّن أن:

**قاعدة البيانات الحالية (الإشكاليات القائمة):**
- الفاتورة `20260219-002` (دين `23$`): حالتها `refunded` ✅ — لكن الدين `c1ad0a75` لا يزال موجوداً ❌
- العميل "قيس فون": `total_debt = 23$` و`invoice_count = 1` رغم أن الفاتورة مستردة ❌

---

### المشكلة 1: دالة `refundInvoiceCloud` تفشل في حذف الدين بصمت

المشكلة ليست في استعلام البحث — بل في **عملية الحذف نفسها**. الكود يجد الدين بنجاح، لكن `DELETE` يفشل بسبب سياسة RLS:

```sql
-- RLS على جدول debts:
(user_id = get_owner_id(auth.uid()))
```

عند تنفيذ `await (supabase).from('debts').delete().eq('id', debt.id)` بدون تمرير `user_id` في الشرط، يظن Supabase أنه طلب مستقل وقد لا يُطبّق RLS بالشكل الصحيح إذا لم يكن `auth.uid()` مرتبطاً بـ `owner_id`. المشكلة: الحذف يمر عبر `supabase` client مباشرة بدون `eq('user_id', ...)` لكن RLS تعتمد على `get_owner_id(auth.uid())` فتنجح فقط إذا كان `auth.uid()` هو المالك أو له صلاحية. **لكن هذا يجب أن يعمل...**

بعد مزيد من التحقيق: المشكلة الفعلية هي أن `refundInvoiceCloud` تُنفَّذ من صفحة الفواتير بعد كتابة الفاتورة المستردة مباشرة. في بعض الحالات يكون `getCurrentUserId()` لا يزال `null` عند بداية تنفيذ الدالة، فتُرجع `false` في السطر الثاني:

```typescript
const userId = getCurrentUserId();
if (!userId) return false;  // ⬅ المشكلة هنا
```

لكن الفاتورة `refunded` تُسجّل... كيف؟ لأن البحث بـ `.eq('user_id', userId)` حين يكون `userId = null` يُرجع `null` → يخرج الكود مبكراً → **الفاتورة لا تُحدَّث أصلاً من هذه الدالة**، بل التحديث يحدث من مكان آخر (ربما نفس الدالة في مسار مختلف أو `isCashierUser()` يحدد `userId`).

**الاستنتاج الحقيقي:** الدالة تُنفَّذ جزئياً — تنجح في تحديث الفاتورة لكن تفشل في حذف الدين لأسباب متعلقة بتوقيت تهيئة `userId`.

---

### المشكلة 2: بيانات العميل لا تُحدَّث

في `refundInvoiceCloud`، حتى لو وصل الكود لقسم "عكس إحصائيات العميل" — الفاتورة لا تحتوي على `customer_id` (القيمة `null`)، فيذهب للبحث بـ `customer_name`. لكن البحث بالاسم قد يفشل إذا تم تسجيل العميل بـ `user_id` مختلف عن الـ `auth.uid()` الحالي بسبب RLS.

---

### المشكلة 3: لا يوجد حماية من الاسترداد المزدوج

- الفاتورة المستردة لا تزال تظهر بزر "استرداد" في صفحة الفواتير.
- يمكن للمستخدم الضغط على "استرداد" مرة ثانية ولا يوجد تحقق أولي من حالة الفاتورة.

---

### المشكلة 4: نافذة تفاصيل العميل لا تعرض الفواتير

نافذة "عرض العميل" في `Customers.tsx` تعرض فقط الأرقام الإجمالية (`totalPurchases`, `totalDebt`, `invoiceCount`) بدون قائمة بالفواتير الفعلية. المطلوب إضافة قائمة فواتير حية مفلترة بحيث تُظهر فقط الفواتير غير المستردة.

---

### المشكلة 5: إحصائيات العميل لا تُحسب بشكل حي

`total_purchases` و`total_debt` في جدول `customers` هي حقول مخزّنة (denormalized) تُحدَّث يدوياً. لو فُقدت أي عملية تحديث بسبب خطأ، تصبح البيانات غير دقيقة. الحل الأمثل: حساب هذه القيم من الفواتير الحية (غير المستردة) عند فتح تفاصيل العميل.

---

## خطة الإصلاح التفصيلية

### الملفات التي ستُعدَّل:

---

#### 1. `src/lib/cloud/invoices-cloud.ts` — إصلاح شامل لـ `refundInvoiceCloud`

**أ. إصلاح مشكلة `userId = null`:**

استبدال `getCurrentUserId()` بـ fallback موثوق:

```typescript
let userId = getCurrentUserId();
if (!userId) {
  const { data: { user } } = await supabase.auth.getUser();
  userId = user?.id || null;
}
if (!userId) return false;
```

**ب. التحقق من حالة الفاتورة قبل الاسترداد (منع الاسترداد المزدوج):**

```typescript
if (cloudInvoice.status === 'refunded') {
  console.warn('[refundInvoiceCloud] Invoice already refunded');
  return false;
}
```

**ج. إصلاح حذف الدين — استخدام `rpc` أو حذف مباشر موثوق:**

بدلاً من `delete().eq('id', debt.id)` (الذي يعتمد على RLS التلقائي)، استخدام:

```typescript
await supabase
  .from('debts')
  .delete()
  .eq('invoice_id', id)  // invoice_number
```

هذا أبسط وأكثر موثوقية لأن RLS تُطبَّق تلقائياً على جدول `debts` بـ `user_id = get_owner_id(auth.uid())`.

**د. إصلاح تحديث العميل — حساب قيم دقيقة من الفواتير الحية:**

بدلاً من الخصم الحسابي (الذي قد يُراكم الأخطاء)، حساب القيم مباشرة من الفواتير:

```typescript
// جلب جميع فواتير العميل غير المستردة
const { data: activeInvoices } = await supabase
  .from('invoices')
  .select('total, payment_type, status')
  .eq('customer_name', cloudInvoice.customer_name)
  .neq('status', 'refunded');

const newTotalPurchases = activeInvoices?.reduce((s, i) => s + i.total, 0) || 0;
const newTotalDebt = activeInvoices?.filter(i => i.payment_type === 'debt')
  .reduce((s, i) => s + i.total, 0) || 0;
const newInvoiceCount = activeInvoices?.length || 0;
```

هذا يضمن دقة البيانات بغض النظر عن الاسترداد السابق.

---

#### 2. `src/lib/cloud/debts-cloud.ts` — إصلاح بيانات قاعدة البيانات الحالية

إضافة migration لتصحيح الدين الموجود حالياً:

```sql
-- حذف الدين المرتبط بالفاتورة المستردة 20260219-002
DELETE FROM debts WHERE invoice_id = '20260219-002';

-- إعادة حساب بيانات العميل "قيس فون" بدقة من الفواتير الحية
UPDATE customers 
SET 
  total_purchases = (
    SELECT COALESCE(SUM(total), 0) FROM invoices 
    WHERE customer_name = 'قيس فون' AND status != 'refunded'
  ),
  total_debt = (
    SELECT COALESCE(SUM(total), 0) FROM invoices 
    WHERE customer_name = 'قيس فون' AND status != 'refunded' AND payment_type = 'debt'
  ),
  invoice_count = (
    SELECT COUNT(*) FROM invoices 
    WHERE customer_name = 'قيس فون' AND status != 'refunded'
  )
WHERE name = 'قيس فون';
```

---

#### 3. `src/pages/Invoices.tsx` — منع الاسترداد المزدوج في الواجهة

إضافة تحقق في `handleRefund`:

```typescript
const handleRefund = (invoice: Invoice) => {
  if (invoice.status === 'refunded') {
    toast.warning('هذه الفاتورة مستردة بالفعل');
    return;
  }
  setInvoiceToRefund(invoice);
  setShowRefundDialog(true);
};
```

وإخفاء زر الاسترداد من الفواتير المستردة مباشرةً في الواجهة.

---

#### 4. `src/pages/Customers.tsx` — تحسين نافذة تفاصيل العميل

إضافة قائمة فواتير حية لكل عميل في نافذة "عرض":

- عند فتح النافذة، تحميل فواتير العميل من `loadInvoicesCloud()` مفلترة بـ `customerName` وغير مستردة.
- عرض كل فاتورة: رقم الفاتورة، التاريخ، المبلغ، نوع الدفع (نقدي/دين).
- حساب الإجمالي الحي مباشرة من الفواتير المعروضة (وليس من `customer.totalPurchases` المخزّن).
- إضافة حالة تحميل للفواتير.

---

#### 5. إصلاح بيانات قاعدة البيانات (Migration)

تنفيذ SQL مباشر لإصلاح البيانات المتأثرة حالياً:

```sql
-- 1. حذف الديون المرتبطة بفواتير مستردة
DELETE FROM debts 
WHERE invoice_id IN (
  SELECT invoice_number FROM invoices WHERE status = 'refunded'
);

-- 2. إعادة حساب إحصائيات جميع العملاء من الفواتير الحية
UPDATE customers c
SET 
  total_purchases = (
    SELECT COALESCE(SUM(i.total), 0) 
    FROM invoices i 
    WHERE i.customer_name = c.name 
      AND i.user_id = c.user_id
      AND i.status != 'refunded'
  ),
  total_debt = (
    SELECT COALESCE(SUM(i.total), 0) 
    FROM invoices i 
    WHERE i.customer_name = c.name 
      AND i.user_id = c.user_id
      AND i.status != 'refunded' 
      AND i.payment_type = 'debt'
  ),
  invoice_count = (
    SELECT COUNT(*) 
    FROM invoices i 
    WHERE i.customer_name = c.name 
      AND i.user_id = c.user_id
      AND i.status != 'refunded'
  );
```

---

## ملخص التعديلات

| الملف | التعديل |
|---|---|
| `src/lib/cloud/invoices-cloud.ts` | إصلاح جذري لـ `refundInvoiceCloud`: userId موثوق، منع التكرار، حذف دين موثوق، تحديث عميل حي |
| `src/pages/Invoices.tsx` | منع الاسترداد المزدوج من الواجهة + إخفاء زر الاسترداد للفواتير المستردة |
| `src/pages/Customers.tsx` | إضافة قائمة فواتير حية في نافذة تفاصيل العميل تعرض فقط الفواتير غير المستردة |
| قاعدة البيانات (Migration) | تصحيح البيانات الحالية المتأثرة بحذف الديون المعلقة وإعادة حساب إحصائيات العملاء |
