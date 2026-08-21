# تحليل شامل لبرنامج نقطة البيع و الحسابات
## HyperPOS Companion - Comprehensive Financial Analysis
**إعداد:** تحليل ديناميكي | **التاريخ:** أغسطس 2026

---

## جدول المحتويات
1. [نظرة عامة على النظام](#1-نظرة-عامة)
2. [تحليل عمليات البيع](#2-عمليات-البيع)
3. [تحليل الديون والاستحقاقات](#3-الديون-والاستحقاقات)
4. [تحليل المرتجعات والاسترجاعات](#4-المرتجعات-والاسترجاعات)
5. [تحليل الفواتير](#5-الفواتير)
6. [تحليل الحسابات والأرباح](#6-الأرباح-والخسائر)
7. [المشاكل البرمجية والمخاطر](#7-المشاكل-البرمجية)
8. [التوصيات والحلول](#8-التوصيات)

---

## 1. نظرة عامة

### 1.1 معمارية النظام

البرنامج مبني على:
- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **التخزين:** localStorage (محلي) + Supabase (سحابي)
- **نمط العمل:** Hybrid (Online/Offline)

### 1.2 المكونات الرئيسية

```
┌─────────────────────────────────────────────┐
│        واجهة المستخدم (React Components)    │
│  ├─ POS.tsx (نقطة البيع)                    │
│  ├─ CartPanel.tsx (سلة الشراء)              │
│  ├─ Invoices.tsx (الفواتير)                │
│  └─ Debts.tsx (الديون)                     │
├─────────────────────────────────────────────┤
│      طبقة المنطق (Cloud Services)          │
│  ├─ invoices-cloud.ts                      │
│  ├─ debts-cloud.ts                         │
│  ├─ pos-sale-atomic.ts                     │
│  ├─ cash-sale-handler.ts                   │
│  ├─ debt-sale-handler.ts                   │
│  └─ partners-cloud.ts                      │
├─────────────────────────────────────────────┤
│        قاعدة البيانات (Supabase)            │
│  ├─ invoices (الفواتير)                    │
│  ├─ invoice_items (بنود الفاتورة)          │
│  ├─ debts (الديون)                         │
│  ├─ customers (العملاء)                    │
│  ├─ products (المنتجات)                    │
│  ├─ partners (الشركاء)                     │
│  └─ stock_movements (حركات المخزون)        │
└─────────────────────────────────────────────┘
```

### 1.3 أنواع العملاء والأدوار

| الدور | الصلاحيات | التقييد |
|:---|:---|:---|
| **Boss** | مسؤول عام تام | بدون تقييد |
| **Admin** | مالك المتجر | بدون تقييد جهاز |
| **Cashier** | موظف كاشير | جهاز واحد فقط |
| **POS User** | مستخدم نقطة بيع | مخصص لمستودع محدد |
| **Distributor** | موزع (متنقل) | مستودع محدد |

---

## 2. عمليات البيع

### 2.1 البيع النقدي (Cash Sale)

#### تدفق العملية

```
المستخدم → عرض المنتجات → اختيار منتجات → إضافة للسلة 
        ↓
    تطبيق الخصم ← إدخال اسم العميل (اختياري)
        ↓
اختيار نوع الدفع (نقدي) → تأكيد العملية
        ↓
    معالجة البيع الذرية
        ↓
طباعة الفاتورة ← تحديث المخزون ← تسجيل الربح
```

#### خطوات المعالجة

**Step 1: إنشاء الفاتورة**
```typescript
// File: src/lib/cloud/invoices-cloud.ts → addInvoiceCloud()
// العملية:
1. تحديد رقم الفاتورة التالي (من counter في قاعدة البيانات)
2. إدراج سجل الفاتورة:
   {
     invoice_number: "INV-001",
     type: 'sale',
     payment_type: 'cash',
     status: 'paid',
     subtotal: 100,
     discount: 10,
     tax_rate: 5,
     tax_amount: 4.5,
     total: 94.5,
     profit: 20,
     currency: 'USD',
     cashier_id: 'user-123',
     created_at: now
   }
3. إدراج بنود الفاتورة (invoice_items)
```

**Step 2: خصم المخزون**
```typescript
// رابط: البيع النقدي يستدعي العملية الذرية
// File: src/lib/cloud/pos-sale-atomic.ts → processPosSaleAtomic()

// تشمل:
- التحقق من كمية المخزون المتاحة
- استدعاء RPC function: deduct_product_quantity()
- تسجيل حركة المخزون في جدول warehouse_stock
- ✅ يتم بشكل ذري (All or Nothing)
```

**Step 3: تحديث رصيد الصندوق (Cashbox)**
```typescript
// File: src/lib/unified-transactions.ts → processCashSale()
cashbox.currentBalance += totalAmount
// تم حفظه في localStorage تحت: hyperpos_cashbox_v1
```

**Step 4: تسجيل الربح**
```typescript
// File: src/lib/profits-store.ts → addGrossProfit()
// تسجيل الربح الذي تم تحقيقه:
{
  invoiceId: "INV-001",
  grossProfit: 20,
  cogs: 80,          // التكلفة الإجمالية للبضاعة المباعة
  totalSale: 100,
  timestamp: now
}
// ⚠️ محفوظ محلياً فقط في localStorage
```

**Step 5: توزيع الأرباح على الشركاء**
```typescript
// File: src/lib/cloud/partners-cloud.ts → distributeDetailedProfitCloud()
// الخوارزمية:
1. تقسيم الربح حسب الفئات (إذا وجدت)
2. تقسيم بين الشركاء حسب النسب المئوية
3. تحديث أرصدة الشركاء:
   partner.confirmedProfit += share     // ✅ مؤكد فوراً
   partner.currentBalance += share      // رصيد فوراً
   partner.totalProfitEarned += share
```

#### الحسابات والصيغ

**حساب المجموع:**
```
subtotal = Σ(price × quantity) لكل منتج

discount_amount = subtotal × discount_percentage / 100
                  أو
                = قيمة الخصم المدخلة مباشرة

taxable_amount = subtotal - discount_amount
tax_amount = taxable_amount × tax_percentage / 100

total = subtotal - discount_amount + tax_amount
```

**حساب الربح:**
```
للمنتج الواحد:
  item_profit = item_sale_price - item_cost_price

للفاتورة:
  gross_profit = Σ(item_profit) - (allocated_discount_per_item)
  
  وهذا له مشكلة: كيف يتم توزيع الخصم على كل منتج؟
  الطريقة الحالية: غير واضحة في الكود
```

**المشاكل المكتشفة:**
- ❌ **عدم وضوح توزيع الخصم على الأرباح**
- ❌ **عدم التعامل مع الرقم الدائري (Rounding) للعملات**
- ⚠️ **حفظ الأرباح محلياً فقط - قابل للفقدان**

---

### 2.2 البيع بالدين (Debt Sale / Credit Sale)

#### تدفق العملية

```
نفس خطوات البيع النقدي
        ↓
    اختيار (دفع آجل)
        ↓
   إجباري: اسم العميل
        ↓
البحث/إنشاء عميل
        ↓
    إضافة سجل دين
        ↓
تحديث إحصائيات العميل ← تحديث أرصدة الشركاء المعلقة
```

#### الخطوات التفصيلية

**Step 1: البحث أو إنشاء العميل**
```typescript
// File: src/lib/cloud/customers-cloud.ts → findOrCreateCustomerCloud()
const customer = await loadCustomersCloud()
                  .find(c => c.name === customerName);

if (!customer) {
  // إنشاء عميل جديد
  const newCustomer = {
    name: customerName,
    phone: customerPhone,
    total_purchases: 0,
    total_debt: 0,
    invoice_count: 0,
    created_at: now
  };
  await insertToSupabase('customers', newCustomer);
}
```

**Step 2: إنشاء فاتورة الدين**
```typescript
// نفس الخطوة 1 في البيع النقدي ولكن:
{
  ...invoiceFields,
  payment_type: 'debt',      // ← الفرق الأساسي
  status: 'pending',         // بدلاً من 'paid'
  debt_paid: 0,
  debt_remaining: total
}
```

**Step 3: إنشاء سجل دين**
```typescript
// File: src/lib/cloud/debts-cloud.ts → addDebtFromInvoiceCloud()
const debtRecord = {
  invoice_id: invoice.id,
  invoice_number: invoice.invoice_number,
  customer_name: customerName,
  customer_phone: customerPhone,
  total_debt: totalAmount,
  total_paid: 0,
  remaining_debt: totalAmount,
  status: 'due',
  due_date: NOW + 30 days,      // ⚠️ محدد بـ 30 يوم
  cashier_id: userId,
  created_at: now
};
// INSERT إلى جدول debts
```

**Step 4: تحديث إحصائيات العميل**
```typescript
// File: src/lib/cloud/customers-cloud.ts → updateCustomerStatsCloud()
{
  total_purchases += totalAmount,
  total_debt += totalAmount,      // ← يزيد الدين
  invoice_count += 1
}
```

**Step 5: الأرباح المعلقة (Pending Profit)**
```typescript
// File: src/lib/cloud/partners-cloud.ts → distributeDetailedProfitCloud(..., isDebt=TRUE)

للشركاء المختصين:
  partner.pendingProfit += share
  partner.pendingProfitDetails[] += {
    invoiceId,
    amount,
    customerName,
    type: 'debt'
  }
  // ⚠️ الربح معلق - لا يضاف للرصيد حتى سداد الدين
```

#### الفرق بين البيع النقدي والآجل

| العنصر | نقدي | آجل |
|:---|:---|:---|
| **رقم الفاتورة** | INV-XXX | INV-XXX (نفس النظام) |
| **حالة الفاتورة** | 'paid' | 'pending' |
| **رقم الدين** | بدون | DBT-YYYYMMDD-XXX |
| **رصيد الصندوق** | يزيد فوراً | لا يزيد |
| **إحصائيات العميل** | يزيد الشراء فقط | يزيد الشراء + الدين |
| **أرباح الشركاء** | confirmedProfit | pendingProfit |
| **تاريخ الاستحقاق** | لا ينطبق | +30 يوم |

#### المشاكل والمخاطر

**🔴 حرجة:**
- ❌ **عدم التحقق من حد ائتمان العميل**: لا يوجد تحديد أقصى دين مسموح
- ❌ **عدم التنبيه للديون المتأخرة**: لا توجد تذكيرات عند تجاوز تاريخ الاستحقاق
- ❌ **الأرباح المعلقة قد تضيع**: إذا تم حذف الفاتورة بدون سداد الدين

**🟡 متوسطة:**
- ⚠️ **تاريخ الاستحقاق مكود بـ 30 يوم**: لا يوجد خيار للتخصيص
- ⚠️ **عدم التحقق من صحة البيانات**: الاسم قد يكون فارغاً

---

## 3. الديون والاستحقاقات

### 3.1 إدارة الديون

#### هيكل سجل الدين
```typescript
interface Debt {
  id: string;
  invoiceId: string;           // رابط إلى الفاتورة
  customerName: string;
  customerPhone: string;
  totalDebt: number;           // المبلغ الأصلي
  totalPaid: number;           // ما تم سداده حتى الآن
  remainingDebt: number;       // ما تبقى
  dueDate: string;             // تاريخ الاستحقاق
  status: 'due'                // الحالة
         | 'partially_paid'    
         | 'overdue'
         | 'fully_paid';
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 عملية السداد (Debt Payment)

#### التدفق
```
المستخدم (صفحة الديون)
        ↓
اختيار دين → إدخال المبلغ المدفوع
        ↓
    تسجيل السداد
        ↓
تحديث سجل الدين ← تحديث الفاتورة ← تحديث رصيد الصندوق
        ↓
تأكيد الأرباح المعلقة للشركاء
        ↓
تحديث إحصائيات العميل
```

#### خطوات المعالجة

**Step 1: تسجيل الدفع**
```typescript
// File: src/lib/cloud/debts-cloud.ts → recordPaymentCloud()

newTotalPaid = debt.totalPaid + paymentAmount
newRemainingDebt = debt.totalDebt - newTotalPaid

// تحديث السجل
{
  total_paid: newTotalPaid,
  remaining_debt: newRemainingDebt,
  status: getPaymentStatus(newRemainingDebt),
  updated_at: now
}

// حساب الحالة
if (newRemainingDebt <= 0) → 'fully_paid'
else if (newTotalPaid > 0)  → 'partially_paid'
else                         → 'due'
```

**Step 2: تحديث الفاتورة المرتبطة**
```typescript
// File: src/lib/cloud/debts-cloud.ts → recordPaymentWithInvoiceSyncCloud()

// تحديث فاتورة البيع الأصلية
{
  debt_paid: debt.debt_paid + paymentAmount,
  debt_remaining: debt.debt_remaining - paymentAmount,
  // إذا تم السداد بالكامل
  status: newRemainingDebt <= 0 ? 'paid' : 'pending',
  payment_type: newRemainingDebt <= 0 ? 'cash' : 'debt'
}
```

**Step 3: إضافة النقد للصندوق**
```typescript
// File: src/lib/unified-transactions.ts → processDebtPayment()

cashbox.currentBalance += paymentAmount

// ⚠️ مسجل محلياً فقط كـ 'deposit'
// بدلاً من تصنيف واضح 'debt_payment'
```

**Step 4: تأكيد الأرباح المعلقة**
```typescript
// File: src/lib/cloud/partners-cloud.ts → confirmPendingProfitCloud()

// للشركاء الذين لديهم أرباح معلقة لهذه الفاتورة:
const ratio = paymentAmount / totalDebt  // نسبة السداد

for each partner with pending profit:
  const pendingEntries = filter(pending where invoiceId)
  
  for each entry:
    amountToConfirm = entry.amount × ratio
    
    partner.pendingProfit -= amountToConfirm
    partner.confirmedProfit += amountToConfirm
    partner.currentBalance += amountToConfirm
    partner.totalProfitEarned += amountToConfirm
    
    // حذف من المعلقة
    pending_profit_details.remove(entry)
```

**Step 5: تحديث إحصائيات العميل**
```typescript
// File: src/lib/cloud/customers-cloud.ts → updateCustomerStatsCloud()

{
  total_debt -= paymentAmount    // ⚠️ سالب لتقليل الدين
}
```

#### المشاكل والمخاطر

**🔴 حرجة:**
- ❌ **عدم التحقق من الحد الأقصى للسداد**: يمكن تسديد أكثر من المبلغ المستحق
  ```typescript
  // ❌ لا يوجد تحقق من:
  if (paymentAmount > debt.remainingDebt) {
    throw new Error('لا يمكن سداد أكثر من المبلغ المستحق');
  }
  ```

- ❌ **مشكلة العملات المختلفة**: إذا تم البيع بعملة وتم السداد بعملة أخرى
- ❌ **عدم وجود طرق سداد مختلفة**: نقدي فقط، بدون بطاقة/شيك

**🟡 متوسطة:**
- ⚠️ **حساب النسبة قد يكون غير دقيق**: في حالة السداد الجزئي
- ⚠️ **عدم رصد الفائدة على الديون المتأخرة**
- ⚠️ **حالة 'overdue' محسوبة محلياً**: الحالة الفعلية في السحابة قد تكون مختلفة

---

## 4. المرتجعات والاسترجاعات

### 4.1 عملية المرتجع (Refund)

#### التدفق

```
المستخدم (صفحة الفواتير)
        ↓
اختيار فاتورة ← التحقق غير مسترجعة بالفعل
        ↓
    تأكيد المرتجع
        ↓
استعادة المخزون ← حذف سجل الدين ← تحديث إحصائيات العميل
        ↓
عكس توزيع الأرباح ← وضع علامة مسترجعة على الفاتورة
        ↓
الحسم من الصندوق
```

#### خطوات المعالجة التفصيلية

**Step 1: التحقق من الإمكانية**
```typescript
// File: src/lib/cloud/invoices-cloud.ts → refundInvoiceCloud()

// ✅ الفحوصات المطبقة:
- التحقق من أن الفاتورة موجودة
- التحقق من أن الفاتورة ليست مسترجعة بالفعل
  if (invoice.status === 'refunded') → ABORT

// ❌ الفحوصات الناقصة:
- عدم التحقق من كون الفاتورة قديمة جداً (مثلاً أكثر من 30 يوم)
- عدم طلب سبب المرتجع
- عدم أخذ تأكيد من المسؤول في حالة الفواتير الكبيرة
```

**Step 2: استعادة المخزون**
```typescript
// File: src/lib/cloud/invoices-cloud.ts → refundInvoiceCloud()

// للمخازن العادية:
for each item in invoice.items:
  await add_product_quantity(product_id, quantity)
  
  // تسجيل حركة مخزون
  INSERT INTO stock_movements:
  {
    movement_type: 'refund',
    product_id,
    quantity,
    invoice_id,
    warehouse_id,
    direction: 'in'
  }

// للمتاجر الخاصة (خبازة/صيانة):
// ❌ الاستعادة تُتخطى إذا كان store_type في ('bakery', 'repair')
// هذا صحيح لأن هذه الأنواع لا تتتبع المخزون
```

**Step 3: حذف سجلات الديون**
```typescript
// File: src/lib/cloud/invoices-cloud.ts → refundInvoiceCloud()

// محاولة أولى: البحث برقم الفاتورة
const debt = await loadDebtsCloud()
              .find(d => d.invoiceId === invoice.invoiceNumber);

// محاولة ثانية: البحث بـ UUID
if (!debt) {
  debt = await loadDebtsCloud()
          .find(d => d.invoiceId === invoice.id);
}

if (debt) {
  await deleteDebtCloud(debt.id);
}
```

**Step 4: إعادة حساب إحصائيات العميل**
```typescript
// File: src/lib/cloud/invoices-cloud.ts
// هذا هو الجزء الذكي في الخوارزمية:

// استدعاء جميع الفواتير النشطة (غير المسترجعة) للعميل
const activeInvoices = await loadInvoicesCloud()
  .filter(inv => 
    inv.customerName === refundedInvoice.customerName 
    && inv.status !== 'refunded'  // استبعاد المسترجعة
  );

// إعادة حساب من الصفر
newTotalPurchases = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);
newTotalDebt = activeInvoices
  .filter(inv => inv.paymentType === 'debt')
  .reduce((sum, inv) => sum + inv.debtRemaining, 0);
newInvoiceCount = activeInvoices.length;

// تحديث العميل
await updateCustomerStatsCloud({
  total_purchases: newTotalPurchases,
  total_debt: newTotalDebt,
  invoice_count: newInvoiceCount
});

// ✅ هذا النهج أفضل من الطرح البسيط (أكثر دقة)
// لكنه أبطأ عند وجود آلاف الفواتير
```

**Step 5: عكس توزيع الأرباح**
```typescript
// File: src/lib/partners-store.ts → revertProfitDistribution()

// ⚠️ مشكلة حرجة: هذا في localStorage فقط وليس السحابة!

// يحاول البحث عن سجلات الربح المحلية
const profitRecords = loadProfitsStore()
  .filter(p => p.invoiceId === refundedInvoice.id);

for each record:
  // حذف السجل
  removeProfitRecord(record.id);
  
  // أو إضافة دخول سالبة (في بعض الحالات)
  addGrossProfit(refund_id, -record.grossProfit, -record.cogs, -record.total);
```

**Step 6: إزالة بنود الفاتورة من المخزون**
```typescript
// File: src/lib/cloud/invoices-cloud.ts

// إذا كانت فاتورة صيانة وتحتوي على قطع/مواد
if (invoice.type === 'maintenance') {
  // حذف السجل من الأرشيف تحت expenses
  await deleteExpenseCloud({ notes: LIKE 'الفاتورة: {invoice.id}' });
}
```

**Step 7: وضع علامة مسترجعة**
```typescript
// تحديث الفاتورة
{
  status: 'refunded',
  notes: `مسترجعة بتاريخ ${now}`,
  updated_at: now
}
// الفاتورة تبقى في النظام لكن لا تظهر في التقارير النشطة
```

**Step 8: خصم من الصندوق**
```typescript
// File: src/lib/unified-transactions.ts → processRefund()

cashbox.currentBalance -= refundAmount

// ⚠️ تسجيل داخلي فقط
addWithdrawalFromShift(refundAmount);
```

### 4.2 مراحل المرتجع

#### مراحل العملية بشكل مفصل

```
المرحلة 1: الطلب
├─ المستخدم يختار الفاتورة
├─ يضغط زر "استرجاع / Refund"
└─ يتم التحقق السريع

المرحلة 2: المعالجة
├─ Step A: استعادة المخزون (إن وجد)
├─ Step B: حذف سجل الدين (إن وجد)
├─ Step C: إعادة حساب إحصائيات العميل
├─ Step D: عكس الأرباح
└─ Step E: تحديث حالة الفاتورة

المرحلة 3: التأكيد
├─ تحديث الفاتورة البدء → مسترجعة
├─ تجديد ذاكرة التخزين المؤقت
└─ إرسال إخطار للمستخدم
```

### 4.3 المشاكل والمخاطر

**🔴 حرجة:**

1. **عكس الأرباح في localStorage فقط**
   ```typescript
   // ❌ هذه وظيفة خطيرة جداً
   File: src/lib/partners-store.ts → revertProfitDistribution()
   
   // المشكلة:
   - الأرباح محفوظة في localStorage على الجهاز
   - لا توجد نسخة في السحابة
   - إذا تم تنظيف ذاكرة التخزين (Clear Cache)
   - أو تم تسجيل الدخول من جهاز آخر
   - سيتم فقدان البيانات
   
   // التأثير:
   - الشركاء قد يستحصلون على أموال لم يستحقوها
   - عدم دقة الأرباح والخسائر
   ```

2. **عدم التحقق من حذف الديون المرتبطة**
   ```typescript
   // ❌ قد يحدث خطأ صامت
   const debtToDelete = await findDebt();
   if (!debtToDelete) {
     // قد يكون هناك دين مرتبط لم يتم العثور عليه
     // لكن العملية تستمر دون تنبيه
   }
   ```

3. **مشكلة الفواتير المتعددة لنفس العميل**
   ```typescript
   // ❌ إعادة الحساب قد تكون بطيئة وغير دقيقة
   
   // إذا كان العميل لديه 1000 فاتورة
   // والمرتجع يحتاج إلى إعادة حساب جميع الفواتير بحثاً عن القيم
   // هذا قد يسبب تأخيراً ملحوظاً
   ```

**🟡 متوسطة:**

1. **عدم وجود آثار تدقيق (Audit Trail)**
   ```typescript
   // لا يتم تسجيل:
   - من أرسل المرتجع
   - السبب
   - الوقت بالضبط
   - من وافق عليه
   ```

2. **عدم السماح بالمرتجع الجزئي**
   ```typescript
   // لا يمكن استرجاع جزء من الفاتورة فقط
   // يجب استرجاع الفاتورة بالكامل
   ```

3. **عدم التعامل مع رسوم المرتجع**
   ```typescript
   // لا يوجد خيار لتطبيق نسبة مئوية كرسم للمرتجع
   ```

**🟢 منخفضة:**

1. **الرسالة غير واضحة عند النجاح**
2. **عدم إمكانية استرجاع تعديل المرتجع**

---

## 5. الفواتير

### 5.1 هيكل الفاتورة

```typescript
interface Invoice {
  // معرفات
  id: string;
  invoiceNumber: string;      // INV-001, INV-002, ...
  
  // المعلومات العامة
  date: string;               // YYYY-MM-DD
  time: string;               // HH:MM:SS
  
  // بيانات العميل
  customerName: string;
  customerPhone?: string;
  
  // البنود
  items: InvoiceItem[];       // قائمة المنتجات
  
  // الحسابات
  subtotal: number;           // المجموع قبل الخصم والضريبة
  discount: number;           // قيمة الخصم (بالدولار)
  discountPercentage?: number; // نسبة الخصم
  taxRate?: number;           // نسبة الضريبة
  taxAmount?: number;         // قيمة الضريبة
  total: number;              // المجموع النهائي
  
  // المالية
  currency: string;           // USD, TRY, SYP
  currencySymbol: string;     // $, ₺, £
  
  // نوع العملية
  paymentType: 'cash' | 'debt';
  status: 'paid' | 'pending' | 'refunded' | 'cancelled';
  type: 'sale' | 'maintenance';
  
  // الديون (إن وجدت)
  debtPaid?: number;          // ما تم سداده
  debtRemaining?: number;     // ما تبقى
  
  // البيانات الإدارية
  cashierId?: string;
  cashierName?: string;
  profit?: number;            // الربح المحقق
  
  // النصوص
  notes?: string;
  serviceDescription?: string;
  
  // الوقت
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 رقم الفاتورة (Invoice Numbering)

#### الطريقة الحالية

```typescript
// File: src/lib/cloud/invoices-cloud.ts → getNextInvoiceNumber()

// 1. تحميل جميع الفواتير
const allInvoices = await loadInvoicesCloud();

// 2. استخراج الأرقام
const numbers = allInvoices.map(inv => parseInt(inv.id));

// 3. البحث عن أعلى رقم
const maxNumber = Math.max(...numbers) || 0;

// 4. إضافة 1
const nextNumber = maxNumber + 1;

return `INV-${String(nextNumber).padStart(4, '0')}`;
```

#### المشاكل

**🔴 حرجة:**

1. **خطر الأرقام المكررة في بيئة متعددة المستخدمين**
   ```
   الجهاز 1: يحسب أعلى رقم = 100 → يصبح التالي 101
   الجهاز 2: يحسب أعلى رقم = 100 → يصبح التالي 101 ❌
   
   النتيجة: فاتورتان برقم 101
   ```

2. **بطء العملية عند وجود آلاف الفواتير**
   ```
   إذا كان لديك 50,000 فاتورة
   تحميل جميعها وحساب الأعلى سيأخذ وقتاً طويلاً
   ```

3. **عدم التعامل مع الفواتير المحذوفة**
   ```
   إذا تم حذف INV-050
   والفواتير التالية لم تنتقل إلى الأرقام الأقل
   قد تظهر فجوات في الترقيم
   ```

**الحل الأفضل:**
```typescript
// استخدام Database Sequence في PostgreSQL
// بدلاً من العد محلياً

CREATE SEQUENCE invoice_number_seq START 1;

-- عند إنشاء فاتورة جديدة:
nextNumber = SELECT nextval('invoice_number_seq');
```

### 5.3 الترتيب والتصفية

```typescript
// File: src/pages/Invoices.tsx

// الترتيب الحالي:
// - حسب تاريخ الإنشاء (الأحدث أولاً)

// التصفية المتاحة:
1. حسب النوع (مبيعات / صيانة)
2. حسب حالة الدفع (مدفوعة / معلقة / مسترجعة)
3. حسب العميل (اسم العميل)
4. حسب التاريخ (من - إلى)
5. حسب الفترة (اليوم / هذا الأسبوع / هذا الشهر)
```

---

## 6. الأرباح والخسائر

### 6.1 حساب الربح للمنتج الواحد

```
سعر البيع         = 100
سعر التكلفة       = 60
ربح المنتج       = 100 - 60 = 40

نسبة الربح        = (40 / 100) × 100% = 40%
----------

مع الضريبة:
سعر البيع + ضريبة  = 105 (إذا كانت الضريبة 5)
سعر التكلفة        = 60
الربح              = 105 - 60 = 45

⚠️ المشكلة: هل الضريبة تؤثر على الربح؟
الإجابة الصحيحة: لا، الضريبة ليست ربح الشركة
لكن البرنامج قد يضيفها خطأ في بعض الحالات
```

### 6.2 حساب ربح الفاتورة الكاملة

```
الفاتورة:
├─ منتج 1: الكمية 2، السعر 50، التكلفة 30
│  └─ الربح = (50-30) × 2 = 40
│
├─ منتج 2: الكمية 1، السعر 100، التكلفة 60
│  └─ الربح = (100-60) × 1 = 40
│
├─ الخصم: 15
│
└─ الضريبة (5%): 9.5

الحساب الصحيح:

أرباح المنتجات = 40 + 40 = 80

معاملة الخصم للأرباح:
├─ الخيار 1: لا تؤثر على الأرباح
│  ربح الفاتورة = 80
│  الخصم يؤثر على الإيرادات فقط
│
├─ الخيار 2: تقسم على المنتجات (الحالية)
│  نسبة الخصم من كل منتج = (خصم × سعر المنتج) / الإجمالي
│  ربح الفاتورة = 80 - (خصم_موزع)
│
└─ الخيار 3: تخفض الأرباح مباشرة
   ربح الفاتورة = 80 - 15 = 65

⚠️ البرنامج الحالي: غير واضح في التعامل مع هذا
```

### 6.3 توزيع الأرباح على الشركاء

```typescript
// File: src/lib/cloud/partners-cloud.ts → distributeDetailedProfitCloud()

// الخوارزمية:

1. تقسيم حسب الفئات
   profits = [
     { category: 'electronics', profit: 100 },
     { category: 'clothing', profit: 50 }
   ]

2. للفئة الواحدة:
   // أولاً: الشركاء المتخصصون في هذه الفئة
   specializedPartners = partners.filter(p => 
     p.accessAll === false && 
     p.categoryShares.includes('electronics')
   );
   
   // ثانياً: الشركاء الشاملون
   fullAccessPartners = partners.filter(p => p.accessAll === true);

3. حساب النصيب
   for each specialized partner:
     share = profit × (partner.categoryPercentage / 100)
   
   remainingProfit = profit - (sum of specialized shares)
   
   for each full-access partner:
     share = remainingProfit × (partner.sharePercentage / sumOfFullAccessPercentages)

4. تحديث الرصيد
   if (isDebtSale):
     partner.pendingProfit += share
   else:
     partner.confirmedProfit += share
     partner.currentBalance += share
     partner.totalProfitEarned += share
```

### 6.4 مشاكل الأرباح

**🔴 حرجة:**

1. **بيانات الأرباح محلية فقط**
   ```typescript
   // File: src/lib/profits-store.ts
   
   // مخزن محلي فقط!
   const PROFITS_STORAGE_KEY = 'hyperpos_profit_records_v1';
   
   // المشاكل:
   ✗ إذا تم مسح ذاكرة المتصفح → فقدان جميع بيانات الأرباح
   ✗ إذا دخلت من جهاز آخر → لن ترى أرباح الأجهزة الأخرى
   ✗ لا توجد نسخة احتياطية سحابية
   ✗ التقارير قد تكون ناقصة
   ```

2. **عدم وضوح حساب الخصم على الأرباح**
   ```typescript
   // File: src/components/pos/CartPanel.tsx
   
   // الحساب الحالي غير واضح:
   // هل الخصم يؤثر على:
   // - الإيرادات فقط؟
   // - الأرباح والإيرادات؟
   // - الأرباح فقط؟
   
   // لا يوجد توثيق واضح أو اختبارات
   ```

3. **الأرباح المسجلة وقت البيع، وليس الدفع**
   ```typescript
   // في البيع بالدين:
   // يتم تسجيل الربح فوراً عند البيع
   // حتى لو لم يتم الدفع بعد
   
   // المشكلة:
   // إذا تم المرتجع بعد تسجيل الربح
   // قد لا يتم عكس الربح بشكل صحيح
   ```

**🟡 متوسطة:**

1. **عدم الفصل بين الأرباح المحققة والمعلقة**
2. **عدم وجود تقرير دقيق للأرباح حسب الفترة الزمنية**
3. **عدم الأخذ في الاعتبار تكاليف التشغيل والنثريات**

---

## 7. المشاكل البرمجية

### 7.1 جدول المشاكل الحرجة

| # | المشكلة | التأثير | الموقع | الحل |
|:---|:---|:---|:---|:---|
| **1** | بيانات الأرباح في localStorage فقط | فقدان جميع بيانات الأرباح | `profits-store.ts` | نقل لـ Supabase |
| **2** | عكس الأرباح في localStorage فقط | أرباح الشركاء قد تكون خاطئة | `partners-store.ts` | استخدام `partners-cloud.ts` |
| **3** | ترقيم الفواتير غير آمن | فواتير برقم مكرر | `invoices-cloud.ts` | استخدام Sequence |
| **4** | عدم التحقق من حد الائتمان | ديون غير محدودة | `debt-sale-handler.ts` | إضافة فحص creditLimit |
| **5** | السماح بسداد أكثر من المستحق | أخطاء حسابية | `debts-cloud.ts` | إضافة validation |
| **6** | حفظ الصندوق محلياً | عدم مزامنة بين الأجهزة | `cashbox-store.ts` | نقل لـ Supabase |

### 7.2 جدول المشاكل المتوسطة

| # | المشكلة | التأثير | الموقع |
|:---|:---|:---|:---|
| **7** | حساب الخصم على الأرباح غير واضح | أرباح غير دقيقة | `CartPanel.tsx` |
| **8** | عدم تتبع المرتجعات الجزئية | معالجة ناقصة | `invoices-cloud.ts` |
| **9** | تاريخ الاستحقاق مكود بـ 30 يوم | عدم المرونة | `debt-sale-handler.ts` |
| **10** | عدم وجود تقارير دقيقة | قرارات مالية غير دقيقة | `Dashboard` |
| **11** | حذف الدين لا يحدّث الإحصائيات | بيانات عميل خاطئة | `debts-cloud.ts` |
| **12** | إعادة حساب العميل بطيء | تأخير عند المرتجع | `invoices-cloud.ts` |

---

## 8. التوصيات والحلول

### 8.1 الحلول الحرجة (Priority 1)

#### 1. نقل الأرباح والمصروفات للسحابة

**المشكلة الحالية:**
```typescript
// ❌ محفوظ محلياً فقط
localStorage.setItem('hyperpos_profit_records_v1', JSON.stringify([...]));
```

**الحل المقترح:**
```typescript
// ✅ إنشاء جدول جديد في Supabase
CREATE TABLE profit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  invoice_id UUID REFERENCES invoices(id),
  category TEXT,
  gross_profit DECIMAL,
  cogs DECIMAL,
  total_sale DECIMAL,
  profit_type TEXT ('cash' | 'pending'),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

// ✅ إنشاء دالة لحفظ الأرباح
export async function addProfitRecordCloud(record: ProfitRecord) {
  const { data, error } = await sb
    .from('profit_records')
    .insert([{
      invoice_id: record.invoiceId,
      category: record.category,
      gross_profit: record.grossProfit,
      cogs: record.cogs,
      total_sale: record.total,
      profit_type: record.isDebt ? 'pending' : 'cash'
    }]);
  
  if (error) throw error;
  return data;
}

// ✅ دالة للحصول على التقارير
export async function getProfitReportCloud(fromDate: string, toDate: string) {
  const { data, error } = await sb
    .from('profit_records')
    .select('*')
    .gte('created_at', fromDate)
    .lte('created_at', toDate);
  
  if (error) throw error;
  return data;
}
```

#### 2. استخدام Sequence لترقيم الفواتير

**المشكلة الحالية:**
```typescript
// ❌ عد محلي غير آمن
const maxNumber = Math.max(...invoiceNumbers);
return String(maxNumber + 1);
```

**الحل:**
```sql
-- ✅ إنشاء Sequence
CREATE SEQUENCE invoice_number_seq START 1;

-- ✅ تعديل جدول الفواتير
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sequence_number BIGINT;

-- ✅ في دالة SQL الذرية
nextSeq := nextval('invoice_number_seq');
INSERT INTO invoices (invoice_number, sequence_number, ...) 
VALUES (CONCAT('INV-', LPAD(nextSeq::text, 4, '0')), nextSeq, ...);
```

#### 3. إضافة فحص حد الائتمان

**المشكلة الحالية:**
```typescript
// ❌ لا يوجد تحديد للديون
await processDebtSaleWithOfflineSupport(bundle);  // بلا حد أقصى
```

**الحل:**
```typescript
// ✅ إضافة creditLimit في جدول customers
ALTER TABLE customers ADD COLUMN credit_limit DECIMAL DEFAULT 10000;
ALTER TABLE customers ADD COLUMN current_debt DECIMAL DEFAULT 0;

// ✅ الفحص قبل البيع
export async function validateCreditBeforeSale(
  customerId: string,
  saleAmount: number
): Promise<{ valid: boolean; message?: string }> {
  const customer = await loadCustomerCloud(customerId);
  
  if (!customer.credit_limit) {
    return { valid: true };  // بدون حد
  }
  
  const availableCredit = customer.credit_limit - customer.current_debt;
  
  if (saleAmount > availableCredit) {
    return {
      valid: false,
      message: `الحد الائتماني متجاوز. المتاح: ${availableCredit}`
    };
  }
  
  return { valid: true };
}

// ✅ استخدام الفحص
const creditCheck = await validateCreditBeforeSale(customerId, total);
if (!creditCheck.valid) {
  showError(creditCheck.message);
  return;  // إيقاف العملية
}
```

#### 4. حماية عملية السداد من الخطأ

**المشكلة الحالية:**
```typescript
// ❌ يمكن سداد أكثر من المستحق
const payment = await recordPaymentCloud(debtId, paymentAmount);
```

**الحل:**
```typescript
// ✅ التحقق الكامل
export async function recordPaymentCloudSafe(
  debtId: string,
  paymentAmount: number
): Promise<PaymentResult> {
  // 1. التحقق من المبلغ
  if (paymentAmount <= 0) {
    throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  }

  // 2. تحميل الدين الحالي
  const debt = await loadDebtCloud(debtId);
  
  // 3. التحقق من عدم تجاوز الحد الأقصى
  if (paymentAmount > debt.remainingDebt) {
    const maxAllowed = debt.remainingDebt;
    throw new Error(
      `الحد الأقصى للسداد: ${maxAllowed}. ` +
      `لا يمكن سداد: ${paymentAmount}`
    );
  }

  // 4. التحقق من عدم وجود دفع مزدوج
  const recentPayments = await sb
    .from('payments')
    .select('*')
    .eq('debt_id', debtId)
    .gt('created_at', new Date(Date.now() - 60000).toISOString());  // آخر دقيقة

  if (recentPayments.data?.length > 0) {
    throw new Error('تم تسجيل دفع للتو، يرجى الانتظار');
  }

  // 5. تسجيل الدفع بشكل آمن
  return await recordPaymentCloud(debtId, paymentAmount);
}
```

### 8.2 الحلول المتوسطة (Priority 2)

#### 1. توضيح حساب الخصم على الأرباح

```typescript
// ✅ إضافة تعليقات واضحة وتوثيق

/**
 * حساب الربح مع الخصم
 * 
 * الفلسفة: الخصم يقلل الإيرادات وليس الأرباح
 * 
 * مثال:
 *   المنتج 1: سعر 100، تكلفة 60، الربح = 40
 *   المنتج 2: سعر 100، تكلفة 60، الربح = 40
 *   المجموع: 200
 *   
 *   الخصم: 20 (10%)
 *   النوعية الفاتورة: 200 - 20 = 180
 *   
 *   نوع حساب الربح:
 *   ✓ الخيار الصحيح: ربح الفاتورة = 40 + 40 = 80
 *     (الخصم يؤثر على الهامش، ليس الربح المطلق)
 *   
 *   أو (بديل):
 *   ✓ نوسيب الخصم من الربح: 80 × (20/200) = 8
 *     ربح الفاتورة الفعلي = 80 - 8 = 72
 */

export function calculateProfitWithDiscount(
  items: CartItem[],
  discount: number,
  discountType: 'absolute' | 'percentage'
): ProfitCalculation {
  
  // 1. حساب الربح الأساسي
  const baseProfits = items.map(item => ({
    itemProfit: (item.price - item.costPrice) * item.quantity,
    revenue: item.price * item.quantity
  }));
  
  const totalProfit = baseProfits.reduce((sum, p) => sum + p.itemProfit, 0);
  const totalRevenue = baseProfits.reduce((sum, p) => sum + p.revenue, 0);
  
  // 2. حساب الخصم الفعلي
  const actualDiscount = discountType === 'percentage'
    ? (totalRevenue * discount) / 100
    : discount;
  
  // 3. حساب الربح بعد الخصم (خيار موحد)
  // الخصم يقلل الهامش من الربح
  const grossProfitMargin = totalProfit / totalRevenue;
  const profitReduction = actualDiscount * grossProfitMargin;
  const netProfit = totalProfit - profitReduction;
  
  return {
    grossProfit: totalProfit,
    discount: actualDiscount,
    profitReduction,
    netProfit,
    marginPercentage: (netProfit / (totalRevenue - actualDiscount)) * 100
  };
}
```

#### 2. إضافة تتبع المرتجعات الجزئية

```typescript
// ✅ إضافة جدول للمرتجعات الجزئية
CREATE TABLE partial_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  item_id UUID REFERENCES invoice_items(id),
  quantity_refunded INTEGER NOT NULL,
  amount_refunded DECIMAL NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);

// ✅ دالة المعالجة
export async function processPartialRefund(
  invoiceId: string,
  refundItems: Array<{
    itemId: string;
    quantityRefunded: number;
    reason?: string;
  }>
): Promise<RefundResult> {
  
  // 1. التحقق من صحة الكميات
  const invoice = await loadInvoiceCloud(invoiceId);
  for (const refund of refundItems) {
    const item = invoice.items.find(i => i.id === refund.itemId);
    if (!item || refund.quantityRefunded > item.quantity) {
      throw new Error(`كمية المرتجع غير صحيحة للمنتج: ${item?.name}`);
    }
  }

  // 2. استعادة المخزون للمنتجات المرتجعة
  for (const refund of refundItems) {
    await add_product_quantity(refund.itemId, refund.quantityRefunded);
  }

  // 3. حساب المبلغ المسترجع
  const refundAmount = refundItems.reduce((sum, r) => {
    const item = invoice.items.find(i => i.id === r.itemId);
    return sum + ((item?.price || 0) * r.quantityRefunded);
  }, 0);

  // 4. تسجيل المرتجع الجزئي
  for (const refund of refundItems) {
    await sb.from('partial_refunds').insert([{
      invoice_id: invoiceId,
      item_id: refund.itemId,
      quantity_refunded: refund.quantityRefunded,
      amount_refunded: ...,
      reason: refund.reason
    }]);
  }

  // 5. تحديث الفاتورة
  const updatedTotal = invoice.total - refundAmount;
  await updateInvoiceCloud(invoiceId, {
    total: updatedTotal,
    debt_remaining: updatedTotal
  });

  return { success: true, refundedAmount: refundAmount };
}
```

#### 3. تخصيص فترة الاستحقاق

```typescript
// ✅ تعديل جدول العملاء
ALTER TABLE customers ADD COLUMN payment_terms INTEGER DEFAULT 30;  -- أيام

// ✅ تعديل عملية البيع بالدين
export async function processDebtSaleWithCustomTerms(
  bundle: DebtSaleBundle,
  customPaymentTermsDays?: number
): Promise<DebtSaleResult> {
  
  const customer = await findOrCreateCustomerCloud(bundle.customerName);
  
  // استخدام الشروط المخصصة أو الافتراضية
  const paymentTerms = customPaymentTermsDays || customer.payment_terms || 30;
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + paymentTerms);
  
  await addDebtFromInvoiceCloud({
    ...bundle,
    due_date: dueDate.toISOString()
  });
}
```

### 8.3 الحلول الدنيا (Priority 3)

1. **إضافة حقول تدقيق**
   ```typescript
   ALTER TABLE invoices ADD COLUMN refund_reason TEXT;
   ALTER TABLE invoices ADD COLUMN approved_by UUID REFERENCES auth.users(id);
   ALTER TABLE invoices ADD COLUMN approval_date TIMESTAMP;
   ```

2. **إنشاء تقارير مخصصة**
3. **إضافة رسوم المرتجع**

---

## 9. خلاصة توصيات التحسين

### ملخص الإجراءات الفورية

| الأولوية | الإجراء | الفائدة | الجهد |
|:---|:---|:---|:---|
| 🔴 عالي | نقل الأرباح لـ Supabase | موثوقية 100% | عالي |
| 🔴 عالي | استخدام Sequence للفواتير | منع التكرار | متوسط |
| 🔴 عالي | فحص حد الائتمان | منع الديون الغيرمحدودة | متوسط |
| 🔴 عالي | حماية السداد | منع الأخطاء | منخفض |
| 🟡 متوسط | توضيح الخصم على الأرباح | دقة أفضل | منخفض |
| 🟡 متوسط | المرتجعات الجزئية | مرونة أكثر | عالي |
| 🟡 متوسط | تخصيص الاستحقاق | مرونة أكثر | منخفض |

---

## 10. أمثلة عملية

### مثال 1: بيع نقدي كامل

```
المنتج: حاسوب
الكمية: 1
سعر البيع: $1000
سعر التكلفة: $600
الخصم: $50 (5%)
الضريبة: 5% من المتبقي

الحسابات:
├─ الإجمالي الأولي: $1000
├─ بعد الخصم: $1000 - $50 = $950
├─ الضريبة (5%): $950 × 0.05 = $47.50
├─ الإجمالي النهائي: $950 + $47.50 = $997.50
│
├─ الربح:
│  ├─ الربح الأساسي: $1000 - $600 = $400
│  ├─ تأثير الخصم على الربح: $400 × (50/1000) = $20
│  ├─ الربح بعد الخصم: $400 - $20 = $380
│  ├─ الضريبة لا تؤثر على الربح
│  └─ الربح النهائي: $380
│
└─ الرصيد الذي يدخل الصندوق: $997.50 ✅
```

### مثال 2: بيع بالدين مع سداد جزئي

```
اليوم (2026-08-22):
├─ عميل: أحمد
├─ المنتج: شاشة
├─ الكمية: 2
├─ الإجمالي: $400
├─ نوع الدفع: ديْن ✓
│
└─ النتائج:
   ├─ رقم الفاتورة: INV-145
   ├─ رقم الدين: DBT-20260822-001
   ├─ حالة الفاتورة: pending ⏳
   ├─ رصيد الصندوق: لم يزيد (0)
   ├─ أرصدة الشركاء: pending (معلقة)
   └─ إحصائيات أحمد:
      ├─ الشراء الكلي: +400
      └─ الدين الكلي: +400

بعد 10 أيام:
├─ دفع جزئي: $150
│
└─ النتائج:
   ├─ حالة الدين: partially_paid
   ├─ المبلغ المدفوع: $150
   ├─ المتبقي: $250
   ├─ رصيد الصندوق: +150 ✓
   ├─ أرصدة الشركاء: 
   │  ├─ تأكيد جزئي (150/400 = 37.5%)
   │  ├─ عودة إلى pending: (250/400 = 62.5%)
   └─ إحصائيات أحمد:
      └─ الدين المتبقي: 250

بعد 20 يوم من الأول:
├─ دفع الباقي: $250
│
└─ النتائج:
   ├─ حالة الدين: fully_paid ✓
   ├─ حالة الفاتورة: paid ✓
   ├─ رصيد الصندوق: +250 ✓
   ├─ أرصدة الشركاء: تأكيد 100% ✓
   └─ إحصائيات أحمد:
      └─ الدين المتبقي: 0
```

### مثال 3: مرتجع فاتورة

```
الفاتورة الأصلية:
├─ INV-145
├─ العميل: أحمد
├─ الإجمالي: $400
├─ نوع الدفع: نقدي
└─ تم سداده: نعم ✓

حدث الخطأ:
└─ المنتج غير صحيح ← يجب الاسترجاع

المرتجع:
├─ تاريخ: 2026-08-24
├─ الفاتورة: INV-145
├─ المبلغ: $400
│
└─ العمليات التي تحدث:
   ├─ استعادة المخزون: +2 شاشة
   ├─ حذف سجل الديّن: (لا ينطبق - كان نقدي)
   ├─ تحديث إحصائيات العميل:
   │  ├─ الشراء الكلي: -400 (محسوب من الفواتير النشطة)
   │  └─ الدين الكلي: 0 (لا فواتير ديْن متبقية)
   ├─ عكس الأرباح: $380 (محفوظ محلياً)
   ├─ خصم من الصندوق: -$400
   └─ حالة الفاتورة: refunded ✓

النتيجة:
└─ كل شيء عاد إلى الحالة الأولية (قبل البيع)
```

---

## الخلاصة

هذا البرنامج يتمتع بـ:
- ✅ **هيكل قوي** لإدارة العمليات المالية
- ✅ **معالجة ذرية** للعمليات الحساسة
- ✅ **دعم العمل بدون إنترنت**

لكنه يحتاج:
- 🔧 **عاجل:** نقل بيانات الأرباح / استخدام Sequence / فحص الائتمان
- 🔧 **قريب:** توضيح الحسابات / حماية عمليات السداد
- 🔧 **لاحق:** تقارير متقدمة / مرتجعات جزئية

**التوصية النهائية:** تطبيق الحلول الحرجة في الأسابيع القادمة لتحسين موثوقية النظام 100%.

---

*تم إعداد هذا التحليل بناءً على دراسة شاملة للكود المصدري للبرنامج.*
*آخر تحديث: أغسطس 2026*
