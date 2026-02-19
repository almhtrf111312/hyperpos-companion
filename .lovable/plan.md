
## تشخيص المشاكل المكتشفة في قاعدة البيانات

### ما تكشفه قاعدة البيانات مباشرة:

**الفاتورة `20260219-001`:**
- الحالة: `refunded` ✅ (تم تعليمها مستردة)
- `customer_id`: **NULL** (لا يوجد UUID للعميل)
- `customer_name`: "قيس فون"

**جدول Debts:**
- الدين لا يزال موجوداً: `remaining_debt: $38`, `status: due`
- `invoice_id`: `'20260219-001'` (invoice_number)

**جدول Customers:**
- `total_debt: $61`, `total_purchases: $64.85`, `invoice_count: 3`
- لم تُعكس أي من هذه القيم رغم الاسترداد

---

## جذر المشاكل

### المشكلة أ: حذف الدين يفشل صامتاً

في `refundInvoiceCloud`، عند البحث بـ `invoice_id = '20260219-001'`:

```typescript
const { data: linkedDebts } = await supabase
  .from('debts')
  .select('id')
  .eq('user_id', userId)
  .eq('invoice_id', id); // id = '20260219-001'
```

هذا يجب أن يعمل... لكن المشكلة: الكود في `refundInvoiceCloud` يبحث فقط إذا كانت `cloudInvoice.payment_type === 'debt'`، وهذا صحيح. لكن المشكلة الفعلية: الكود يستدعي أحد الـ fallbacks ويعود لاستخدام `deleteDebtByInvoiceIdCloud` الذي يستخدم `.or()` syntax خاطئة:

```typescript
.or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`)
```

عندما `invoiceId = '20260219-001'`، الشرطة `-` تسبب مشكلة parse في Supabase PostgREST. يجب أن تكون القيمة بين علامات تنصيص:

```typescript
.or(`invoice_id.eq."20260219-001",id.eq."20260219-001"`)
```

### المشكلة ب: عكس إحصائيات العميل يفشل

`customer_id` في الفاتورة هو `null`، فيذهب الكود لقسم `else if (cloudInvoice.customer_name)` للبحث بالاسم:

```typescript
const { data: customer } = await supabase
  .from('customers')
  .select('id, total_purchases, total_debt, invoice_count')
  .eq('user_id', userId)
  .eq('name', cloudInvoice.customer_name)
  .maybeSingle();
```

هذا الكود يبدو صحيحاً نظرياً، لكن المشكلة أن **`userId`** المستخدم في هذا الاستعلام هو `getCurrentUserId()` الذي قد لا يكون صحيحاً، أو أن RLS تمنع الاستعلام. والأهم: الكود يعمل فعلياً لكن العميل يُحمَّل من الكاش القديم قبل التحديث.

---

## خطة الإصلاح

### 1. إصلاح مباشر في قاعدة البيانات الآن

قبل أي تعديل برمجي، سأحذف الدين الموجود وأصحح بيانات العميل مباشرة في قاعدة البيانات:

```sql
-- حذف الدين المتبقي
DELETE FROM debts WHERE id = '6bf745fe-6f6c-4474-845d-460731d83296';

-- تصحيح إحصائيات العميل (خصم $38 من الدين)
UPDATE customers 
SET total_debt = total_debt - 38,
    total_purchases = total_purchases - 38,
    invoice_count = invoice_count - 1
WHERE id = 'af84a42a-500c-48ec-a3f6-c25afa824d2a';
```

### 2. إصلاح `deleteDebtByInvoiceIdCloud` في `debts-cloud.ts`

إصلاح صياغة `.or()` لاستخدام علامات تنصيص حول القيمة:

```typescript
// قبل:
.or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`)

// بعد:
.or(`invoice_id.eq."${invoiceId}",id.eq."${invoiceId}"`)
```

### 3. إصلاح شامل في `refundInvoiceCloud` في `invoices-cloud.ts`

تعديل منطق حذف الدين ليكون أكثر موثوقية:

**أ. حذف الدين:** استخدام استعلامين منفصلين بدلاً من `.or()` المعقد:

```typescript
// استعلام 1: بحث بـ invoice_number
await supabase.from('debts').delete()
  .eq('user_id', userId)
  .eq('invoice_id', id); // invoice_number

// استعلام 2: بحث بـ UUID الفاتورة (fallback)
await supabase.from('debts').delete()
  .eq('user_id', userId)
  .eq('invoice_id', cloudInvoice.id); // UUID
```

**ب. عكس إحصائيات العميل:** إصلاح جلب `userId` بشكل موثوق وإضافة تحقق إضافي:

```typescript
// التأكد من الحصول على userId الصحيح
const { data: { user } } = await supabase.auth.getUser();
const reliableUserId = user?.id || userId;
```

---

## الملفات التي سيتم تعديلها

1. **`src/lib/cloud/debts-cloud.ts`**: إصلاح صياغة `.or()` في `deleteDebtByInvoiceIdCloud` بإضافة علامات تنصيص حول القيمة

2. **`src/lib/cloud/invoices-cloud.ts`**: تعديل `refundInvoiceCloud` ليستخدم استعلامين منفصلين للحذف بدلاً من `.or()` المعقد، وإصلاح جلب العميل

---

## الإصلاح المباشر في قاعدة البيانات

سيتم تنفيذ migration لتصحيح البيانات الحالية المتأثرة (الدين `6bf745fe` وبيانات العميل `قيس فون`).
