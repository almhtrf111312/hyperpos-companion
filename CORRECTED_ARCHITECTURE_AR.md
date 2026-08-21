# تصميم معماري آمن: نقطة البيع المتعددة الأجهزة
## Secure Financial Architecture for Offline-First Multi-Device POS
### Version 2.0 - Production Grade

---

## المراجعة الحرجة: الأخطاء الخطيرة في التصميم السابق

### 🔴 P0: الأخطاء المحاسبية التي تؤدي لفقدان مالي

| الخطأ | الضرر | الحل الصحيح |
|:---|:---|:---|
| **السداد ليس ذرياً** | دفعتان متزامنتان بنفس المبلغ المتبقي | RPC واحدة + SELECT FOR UPDATE |
| **منع الدفع 60 ثانية** | يرفض دفعات صحيحة متعددة | حذف هذا الفحص + استخدام idempotency_key |
| **تحديثات مالية متعددة** | قد ينجح أحد التحديثات ويفشل آخر | عملية PostgreSQL واحدة شاملة |
| **حذف سجلات الأرباح** | فقدان أثر التدقيق | Ledger entries عكسية بدل الحذف |
| **تحويل sale_type من دين→نقدي** | تحريف التقارير والسجلات | فصل sale_type عن payment_status |
| **سماح البيع عند فشل التحقق** | ديون مفتوحة بلا حد | "Fail closed" - رفض الافتراضي للديون |
| **فحص الديون المتأخرة خطأ** | تقارن معرف الدين بمعرف العميل | استخدام customer_id فقط |
| **استهلاك sequence مرات** | فجوات غير لازمة في الأرقام | افحص operation_id أولاً |
| **DROP SEQUENCE في Production** | قد يحذف تبعيات أو يضر البيانات | استخدم CREATE IF NOT EXISTS فقط |

---

## A. نقاط الضعف الحرجة في التصميم الحالي

### A.1 مشكلة السداد المتزامن (Race Condition)

**السيناريو الخطر:**
```
الجهاز A and B معاً:
┌─────────────────────────────────────────┐
│ الدين الأصلي: $100                      │
├─────────────────────────────────────────┤
│ الجهاز A: قراءة المتبقي = $100          │
│ الجهاز B: قراءة المتبقي = $100          │
│ الجهاز A: سداد $100 ✓                   │
│ الجهاز B: سداد $100 ✓ ❌ (خطأ!)         │
├─────────────────────────────────────────┤
│ النتيجة: $200 دافع / الصندوق + $100!     │
│         الدين = $0 + $0 = $0             │
│         الأرباح = مؤكدة مرتين            │
└─────────────────────────────────────────┘
```

**الحل المقترح خطأ:**
```typescript
// ❌ فحص 60 ثانية لا يحل المشكلة
const recent = await sb.from('payments')
  .select('id')
  .gt('created_at', oneMinuteAgo);

if (recent.count > 0) throw new Error('انتظر...');

// لماذا خاطئ:
// 1. قد تصل طلبات من جهازين قبل ظهور أولاها في DB
// 2. السداد الثاني قد يكون صحيحاً (دين جديد)
// 3. لا يمنع race بين جهازين مختلفين
// 4. قد تفشل عملية ويعيد المستخدم المحاولة (بعد 60 ثانية)
```

**الحل الصحيح:**
```sql
-- ✅ استخدام SELECT FOR UPDATE (قفل الصف)
CREATE OR REPLACE FUNCTION process_debt_payment_atomic(
  p_debt_id uuid,
  p_amount numeric(18,4),
  p_idempotency_key uuid,
  p_device_id text
)
RETURNS TABLE (success boolean, message text, new_status text) AS $$
DECLARE
  v_debt debts%ROWTYPE;
  v_existing_payment uuid;
BEGIN
  -- 1. تحقق من idempotency أولاً (بدون قفل)
  SELECT id INTO v_existing_payment
  FROM debt_payments
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- إذا كانت العملية موجودة، أعد النتيجة نفسها
    RETURN QUERY SELECT true, 'تم السداد مسبقاً', 'duplicate'::text;
    RETURN;
  END IF;

  -- 2. قفل الدين (لا أحد آخر يعدله)
  SELECT * INTO v_debt
  FROM debts
  WHERE id = p_debt_id
  FOR UPDATE;  -- ← هنا القفل الحرج

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الدين غير موجود', NULL;
    RETURN;
  END IF;

  -- 3. التحقق من عدم تجاوز المبلغ
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 'المبلغ يجب أن يكون موجب', NULL;
    RETURN;
  END IF;

  IF p_amount > v_debt.remaining_debt THEN
    RETURN QUERY SELECT false, 
      'المبلغ أكثر من المتبقي: ' || v_debt.remaining_debt, NULL;
    RETURN;
  END IF;

  -- 4. إنشاء سجل الدفع (مع idempotency)
  INSERT INTO debt_payments (
    debt_id, amount, idempotency_key, device_id, received_at
  ) VALUES (
    p_debt_id, p_amount, p_idempotency_key, p_device_id, now()
  );

  -- 5. تحديث الديون (ما زالت مقفولة)
  UPDATE debts SET
    total_paid = total_paid + p_amount,
    remaining_debt = remaining_debt - p_amount,
    status = CASE 
      WHEN (remaining_debt - p_amount) <= 0 THEN 'fully_paid'
      ELSE 'partially_paid'
    END,
    updated_at = now()
  WHERE id = p_debt_id;

  -- 6. إضافة حركة نقدية
  INSERT INTO cash_movements (
    store_id, debt_payment_id, movement_type, amount, 
    currency_code, idempotency_key, device_id, occurred_at
  ) VALUES (
    v_debt.store_id, (SELECT id FROM debt_payments 
                      WHERE idempotency_key = p_idempotency_key),
    'debt_payment', p_amount, v_debt.currency_code, 
    p_idempotency_key, p_device_id, now()
  );

  -- 7. تأكيد الأرباح المعلقة
  PERFORM confirm_pending_profits(p_debt_id);

  -- 8. النجاح
  RETURN QUERY SELECT true, 'تم السداد بنجاح', 'paid'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### A.2 مشكلة فحص الائتمان (Default Allow)

**الخطأ:**
```typescript
if (!customerId || !customerName) {
  return { valid: true, availableCredit: Infinity };  // ❌ خطر!
}

catch (error) {
  return { valid: true };  // ❌ انقطاع الشبكة = سماح بالدين!
}
```

**المشاكل:**
- بيع دين بدون عميل معرف = لا متابعة = فقدان مالي
- فشل تحميل الائتمان (خطأ API) = سماح بالدين بلا حد
- في Offline: لا حد ائتماني على الإطلاق

**الحل:**
```typescript
// ✅ Fail Closed للديون
async function validateCreditForDebtSale(
  customerId: string | null,
  customerName: string | null,
  saleAmount: number,
  isOffline: boolean
): Promise<CreditValidationResult> {
  
  // 1. بيع دين يتطلب عميل معرف
  if (!customerId) {
    if (isOffline) {
      return {
        valid: false,
        message: 'بيع الآجل Offline يتطلب عميل محفوظ سابقاً',
      };
    }
    return {
      valid: false,
      message: 'يجب اختيار/إنشاء عميل قبل البيع بالدين',
    };
  }

  // 2. تحميل بيانات الائتمان
  let customer: Customer;
  try {
    customer = await loadCustomerCloud(customerId);
  } catch (error) {
    // Offline: استخدم آخر بيانات محلية أو رفض
    if (isOffline) {
      const cachedCustomer = getCustomerFromCache(customerId);
      if (!cachedCustomer) {
        return { valid: false, message: 'لا توجد بيانات عميل محفوظة' };
      }
      customer = cachedCustomer;
    } else {
      // Online خطأ = رفض الافتراضي
      return { valid: false, message: 'تعذر التحقق من الائتمان' };
    }
  }

  // 3. فحص الحد الائتماني (استخدم ?? وليس ||)
  const creditLimit = customer.creditLimit ?? null;
  
  if (creditLimit === null) {
    // لا حد معرف = استخدم حد افتراضي محفوظ أو رفض
    if (!isOffline) {
      return {
        valid: false,
        message: 'لم يتم تعيين حد ائتماني لهذا العميل',
      };
    }
  }

  const currentDebt = customer.totalDebt ?? 0;
  const availableCredit = (creditLimit ?? Infinity) - currentDebt;

  // 4. فحص الديون المتأخرة
  if (!isOffline) {
    const overdueAmount = await getOverdueDebtsCloud(customerId);
    if (overdueAmount > 0) {
      return {
        valid: false,
        message: `ديون متأخرة: ${overdueAmount}. السداد أولاً`,
        availableCredit: 0,
      };
    }
  }

  // 5. التقييم النهائي
  if (saleAmount > availableCredit) {
    return {
      valid: false,
      message: `تجاوز حد الائتمان. المتاح: ${availableCredit}`,
      availableCredit,
    };
  }

  return { valid: true, availableCredit };
}
```

### A.3 مشكلة الأرباح والخسائر الضائعة

**الخطأ الحالي:**
```typescript
// ❌ حذف سجلات الأرباح عند المرتجع
await sb.from('profit_records').delete().eq('invoice_id', invoiceId);

// ❌ عكس الأرباح في localStorage فقط
revertProfitDistribution();  // محلي، قد يُفقد
```

**النتيجة:**
- فقدان أثر التدقيق
- لا يمكن المراجعة المالية
- محاسب لا يرى ما حدث للأرباح
- خطأ اللوائح والقانون

**الحل: Ledger Immutable**
```sql
-- ✅ جدول دفتر الأرباح (لا حذف، فقط إضافة)
CREATE TABLE profit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- الأساسيات
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  original_entry_id uuid REFERENCES profit_ledger(id), -- للعكس
  
  -- نوع الإدخال
  entry_type text NOT NULL CHECK (
    entry_type IN ('sale', 'refund', 'adjustment')
  ),
  
  -- الحساب المالي
  net_sales numeric(18,4) NOT NULL,  -- subtotal - discount
  cogs numeric(18,4) NOT NULL,       -- تكاليف البضاعة
  gross_profit numeric(18,4) GENERATED ALWAYS AS (net_sales - cogs) STORED,
  
  -- الحالة المالية
  recognized_status text NOT NULL CHECK (
    recognized_status IN (
      'accrued',              -- محقق فور البيع
      'pending_collection',   -- معلق حتى السداد
      'confirmed'             -- مؤكد عند السداد
    )
  ),
  
  -- الأرباح المحسوبة
  partner_allocations jsonb,  -- من سيأخذ كم (للرجوع)
  
  -- التدقيق
  idempotency_key uuid NOT NULL UNIQUE,
  device_id text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  
  -- المراجعة
  reversed_at timestamptz,
  reversed_reason text
);

-- عند المرتجع: أضف إدخال معاكس
INSERT INTO profit_ledger (
  invoice_id, original_entry_id, entry_type,
  net_sales, cogs, recognized_status,
  idempotency_key, device_id
) VALUES (
  v_invoice_id,
  (SELECT id FROM profit_ledger WHERE invoice_id = v_invoice_id),
  'refund',
  -(SELECT net_sales FROM profit_ledger WHERE invoice_id = v_invoice_id),
  -(SELECT cogs FROM profit_ledger WHERE invoice_id = v_invoice_id),
  'accrued',
  p_idempotency_key,
  p_device_id
);
```

### A.4 مشكلة الفصل بين Sale Type و Payment Status

**الخطأ:**
```sql
-- ❌ خلط بين نوع البيع وحالة الدفع
UPDATE invoices SET
  payment_type = CASE 
    WHEN fully_paid THEN 'cash'  -- ❌ يغيّر نوع البيع!
    ELSE 'debt'
  END
WHERE id = invoice_id;
```

**المشكلة:**
- البيع الأصلي كان "دين"
- بعد السداد الكامل تغيّر إلى "نقدي"
- التقارير تظهر أنه كان دائماً نقدي
- محاسبة خاطئة

**الحل:**
```sql
-- ✅ فصل واضح بين الحقول
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  sale_type text NOT NULL CHECK (sale_type IN ('cash', 'credit'))
    COMMENT 'نوع البيع الأصلي - لا يتغير';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  payment_status text NOT NULL CHECK (
    payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')
  )
    COMMENT 'حالة السداد الحالية - قد تتغير';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  payment_method text CHECK (
    payment_method IN ('cash', 'card', 'transfer', 'cheque', 'mixed')
  )
    COMMENT 'كيف تم الدفع (قد يختلف عن sale_type)';

-- النتيجة:
-- sale_type = 'credit'        (البيع الأصلي: ديْن)
-- payment_status = 'paid'     (الحالة الحالية: مدفوع)
-- payment_method = 'cash'     (طريقة السداد: نقدي)
-- ✓ واضح وتاريخي وآمن
```

---

## B. التصميم المعماري الصحيح (Target Architecture)

### B.1 المبادئ الأساسية

```
┌─────────────────────────────────────────────────────────────┐
│                 المبدأ الذهبي                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ لا يكون localStorage أو جهاز الكاشير مصدر الحقيقة المالية    │
│                                                             │
│ المصدر الوحيد: PostgreSQL/Supabase                         │
│                                                             │
│ الأجهزة المحلية: تحتفظ بطابور عمليات Offline قابل للإعادة   │
│                                                             │
│ عند الاتصال: العملية الفردية (idempotency_key) قد تُنفذ     │
│            مرة واحدة فقط، أو تعيد النتيجة السابقة            │
│                                                             │
│ سياسة Fail Closed: عند عدم اليقين، رفض الديون              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### B.2 البنية الثلاثية للنظام

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: React Frontend (UI + Local State)              │
│  ├─ Form validation only (UX)                            │
│  ├─ LocalStorage for UI state (preferences, cache)       │
│  └─ IndexedDB Outbox (pending operations)               │
├──────────────────────────────────────────────────────────┤
│  Layer 2: Supabase/PostgreSQL (Authoritative)            │
│  ├─ RPC functions for all financial operations           │
│  ├─ Row-locking for concurrent writes                    │
│  ├─ Immutable ledger tables                              │
│  ├─ idempotency checks                                   │
│  ├─ Sequential numbering (sequences)                     │
│  └─ RLS policies for data isolation                      │
├──────────────────────────────────────────────────────────┤
│  Layer 3: Sync Worker (Offline Resilience)               │
│  ├─ IndexedDB Outbox reader                              │
│  ├─ RPC caller with retry logic                          │
│  ├─ Conflict detection                                   │
│  ├─ State update writer                                  │
│  └─ User notification (rejected, pending, synced)        │
└──────────────────────────────────────────────────────────┘
```

### B.3 دورة حياة عملية مالية

```
عملية: بيع نقدي بـ $100

الحالة 1: ONLINE
┌─────────────────────────────────┐
│ 1. المستخدم يضغط "إتمام البيع"   │
│ 2. التحقق من الكمية محلياً        │
│ 3. استدعاء RPC مباشرة             │
│ 4. RPC تتحقق، تنشئ، تحدث ذرياً    │
│ 5. إيصال محلي + cloud            │
└─────────────────────────────────┘

الحالة 2: OFFLINE
┌─────────────────────────────────┐
│ 1. المستخدم يضغط "إتمام البيع"   │
│ 2. التحقق من المخزون المحلي       │
│ 3. حفظ في IndexedDB Outbox:      │
│    {                              │
│      id: UUIDv4(),               │
│      type: 'cash_sale',          │
│      idempotency: UUIDv4(),      │
│      status: 'pending',          │
│      payload: {...},             │
│      deviceId: 'POS-3'           │
│    }                              │
│ 4. إيصال مؤقت: OFF-POS-3-001     │
│ 5. حفظ محلي                       │
└─────────────────────────────────┘

الحالة 3: RECONNECT
┌─────────────────────────────────┐
│ 1. Sync Worker يدير Outbox      │
│ 2. للعملية واحدة:                │
│    - استدعاء RPC مع idempotency │
│    - Server: "موجود بالفعل"     │
│    - أو: "جديد، مقبول" → رقم    │
│    - أو: "مرفوض: مخزون ناقص"    │
│ 3. تحديث الحالة في IndexedDB     │
│    status: 'synced'|'rejected'  │
│ 4. تنبيه المستخدم                │
│ 5. إزالة من الطابور أو إعادة    │
└─────────────────────────────────┘
```

---

## C. نموذج البيانات الصحيح (Database Schema)

### C.1 جداول الأساس

```sql
-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. الفواتير (مع الفصل والتاريخ المجمد)                  ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE invoices (
  -- الهويات
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  operation_id uuid NOT NULL UNIQUE COMMENT 'idempotency key',
  
  -- الترقيم
  invoice_number text NOT NULL UNIQUE COMMENT 'INV-000001 من sequence',
  sequence_number bigint NOT NULL UNIQUE,
  created_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- نوع العملية (لا يتغير)
  sale_type text NOT NULL CHECK (sale_type IN ('cash', 'credit')),
  invoice_type text NOT NULL CHECK 
    (invoice_type IN ('sale', 'maintenance')),
  
  -- حالة الدفع (يتغير)
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (
    payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')
  ),
  payment_method text CHECK (
    payment_method IN ('cash', 'card', 'transfer', 'cheque', 'mixed')
  ),
  
  -- بيانات العميل
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  customer_phone text,
  
  -- المالية (مجمدة عند الإنشاء)
  subtotal numeric(18,4) NOT NULL CHECK (subtotal >= 0),
  discount_type text CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric(18,4) NOT NULL DEFAULT 0,
  discount_amount numeric(18,4) GENERATED ALWAYS AS (
    CASE discount_type
      WHEN 'percentage' THEN (subtotal * discount_value / 100)
      ELSE discount_value
    END
  ) STORED,
  
  net_sales numeric(18,4) GENERATED ALWAYS AS (subtotal - discount_amount) STORED,
  
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(18,4) GENERATED ALWAYS AS (net_sales * tax_rate / 100) STORED,
  
  total numeric(18,4) GENERATED ALWAYS AS (net_sales + tax_amount) STORED,
  
  -- الأرباح (محسوبة من البنود)
  cogs numeric(18,4) NOT NULL DEFAULT 0,
  gross_profit numeric(18,4) GENERATED ALWAYS AS (net_sales - cogs) STORED,
  
  -- الديون (للآجل فقط)
  debt_paid numeric(18,4) NOT NULL DEFAULT 0,
  debt_remaining numeric(18,4) NOT NULL DEFAULT 0,
  
  -- المصدر
  sync_source text NOT NULL DEFAULT 'online' CHECK 
    (sync_source IN ('online', 'offline')),
  device_id text,
  
  -- التدقيق
  revenue_recognition_status text NOT NULL DEFAULT 'accrued' CHECK (
    revenue_recognition_status IN ('accrued', 'pending', 'confirmed')
  ),
  
  -- التوقيت
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- الملاحظات
  notes text
);

-- فهارس الأداء والفريدية
CREATE UNIQUE INDEX invoices_operation_id_ux ON invoices(operation_id);
CREATE UNIQUE INDEX invoices_invoice_number_ux ON invoices(invoice_number);
CREATE UNIQUE INDEX invoices_sequence_number_ux ON invoices(sequence_number);
CREATE INDEX invoices_customer_id_idx ON invoices(customer_id, created_at DESC);
CREATE INDEX invoices_user_store_date_idx ON invoices(user_id, store_id, created_at DESC);
CREATE INDEX invoices_payment_status_idx ON invoices(payment_status) 
  WHERE payment_status != 'paid';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. بنود الفاتورة (سعر + تكلفة مجمدة)                    ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- المنتج
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  
  -- الكمية والوحدة
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,  -- 'piece', 'kg', 'liter', etc.
  
  -- الأسعار (مجمدة من لحظة البيع)
  sale_price_per_unit numeric(18,4) NOT NULL,
  cost_price_per_unit numeric(18,4) NOT NULL,
  
  -- المجاميع
  line_total numeric(18,4) GENERATED ALWAYS AS (
    quantity * sale_price_per_unit
  ) STORED,
  
  line_cogs numeric(18,4) GENERATED ALWAYS AS (
    quantity * cost_price_per_unit
  ) STORED,
  
  line_profit numeric(18,4) GENERATED ALWAYS AS (
    (quantity * sale_price_per_unit) - (quantity * cost_price_per_unit)
  ) STORED,
  
  -- المخزن
  warehouse_id uuid REFERENCES warehouses(id),
  
  -- التدقيق
  created_at timestamptz DEFAULT now()
);

CREATE INDEX invoice_items_invoice_idx ON invoice_items(invoice_id);
CREATE INDEX invoice_items_product_idx ON invoice_items(product_id);
```

### C.2 جداول الديون والسداد

```sql
-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. سجلات الديون                                          ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  
  -- الربط
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  
  -- المبالغ
  total_amount numeric(18,4) NOT NULL CHECK (total_amount > 0),
  currency_code text NOT NULL DEFAULT 'USD',
  
  -- الدفع
  total_paid numeric(18,4) NOT NULL DEFAULT 0,
  remaining_debt numeric(18,4) GENERATED ALWAYS AS (
    total_amount - total_paid
  ) STORED,
  
  -- الحالة
  status text NOT NULL DEFAULT 'due' CHECK (
    status IN ('due', 'partially_paid', 'overdue', 'fully_paid')
  ),
  
  -- التواريخ
  created_at date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  last_payment_at timestamptz,
  
  -- التدقيق
  created_by uuid REFERENCES auth.users(id),
  notes text
);

CREATE INDEX debts_customer_id_idx ON debts(customer_id);
CREATE INDEX debts_status_idx ON debts(status) WHERE status != 'fully_paid';
CREATE INDEX debts_due_date_idx ON debts(due_date);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. دفتر الدفعات (مع idempotency)                       ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES debts(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  
  -- المبلغ
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL,
  
  -- طريقة الدفع
  payment_method text NOT NULL CHECK (
    payment_method IN ('cash', 'card', 'transfer', 'cheque', 'mixed')
  ),
  
  -- Idempotency
  idempotency_key uuid NOT NULL UNIQUE COMMENT 'منع تكرار الدفع',
  
  -- المصدر
  sync_source text NOT NULL DEFAULT 'online',
  device_id text,
  
  -- التوقيت
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- الملاحظات
  notes text
);

CREATE INDEX debt_payments_debt_id_idx ON debt_payments(debt_id);
CREATE INDEX debt_payments_invoice_id_idx ON debt_payments(invoice_id);
CREATE UNIQUE INDEX debt_payments_idempotency_ux ON debt_payments(idempotency_key);
```

### C.3 جداول الأموال والأرباح

```sql
-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. دفتر حركات الصندوق (Immutable)                      ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  
  -- الربط بالعمليات
  invoice_id uuid REFERENCES invoices(id),
  debt_payment_id uuid REFERENCES debt_payments(id),
  refund_id uuid,  -- للمرتجعات
  
  -- النوع المالي
  movement_type text NOT NULL CHECK (
    movement_type IN (
      'cash_sale',          -- بيع نقدي
      'debt_payment',       -- سداد ديْن
      'refund',            -- مرتجع
      'opening_float',      -- رصيد افتتاحي
      'cash_in',           -- إيداع إضافي
      'cash_out',          -- سحب
      'closing_adjustment'  -- تسوية إغلاق
    )
  ),
  
  -- المبلغ
  amount numeric(18,4) NOT NULL,  -- قد يكون موجب أو سالب
  currency_code text NOT NULL,
  
  -- Idempotency
  idempotency_key uuid NOT NULL UNIQUE,
  
  -- المصدر
  sync_source text NOT NULL DEFAULT 'online',
  device_id text,
  
  -- التوقيت
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Audit
  created_at timestamptz DEFAULT now()
);

CREATE INDEX cash_movements_store_date_idx ON cash_movements(
  store_id, occurred_at DESC
);
CREATE INDEX cash_movements_movement_type_idx ON cash_movements(movement_type);
CREATE UNIQUE INDEX cash_movements_idempotency_ux ON cash_movements(idempotency_key);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. دفتر الأرباح (Ledger - لا حذف)                     ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE profit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- الربط
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  original_entry_id uuid REFERENCES profit_ledger(id),
  
  -- النوع
  entry_type text NOT NULL CHECK (
    entry_type IN ('sale', 'refund', 'adjustment')
  ),
  
  -- الحساب
  net_sales numeric(18,4) NOT NULL,
  cogs numeric(18,4) NOT NULL,
  gross_profit numeric(18,4) GENERATED ALWAYS AS (net_sales - cogs) STORED,
  
  -- التحقيق
  recognized_status text NOT NULL CHECK (
    recognized_status IN ('accrued', 'pending_collection', 'confirmed')
  ),
  
  -- توزيع الشركاء
  partner_allocations jsonb,  -- [{partnerId, amount, percentage}, ...]
  
  -- Idempotency
  idempotency_key uuid NOT NULL UNIQUE,
  
  -- المصدر
  device_id text,
  
  -- التوقيت
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- العكس (للمرتجعات)
  reversed_at timestamptz,
  reversed_reason text,
  
  CONSTRAINT profit_entry_not_self CHECK (original_entry_id != id)
);

CREATE INDEX profit_ledger_invoice_idx ON profit_ledger(invoice_id);
CREATE INDEX profit_ledger_entry_type_idx ON profit_ledger(entry_type);
CREATE INDEX profit_ledger_recognized_idx ON profit_ledger(recognized_status);
CREATE UNIQUE INDEX profit_ledger_idempotency_ux ON profit_ledger(idempotency_key);
```

---

## D. وظائف RPC الذرية (Atomic RPC Functions)

### D.1 بيع نقدي ذري

```sql
CREATE OR REPLACE FUNCTION process_cash_sale_atomic(
  p_operation_id uuid,
  p_user_id uuid,
  p_store_id uuid,
  p_customer_name text,
  p_customer_id uuid,
  p_items jsonb,  -- [{product_id, qty, price, cost}, ...]
  p_subtotal numeric(18,4),
  p_discount_type text,
  p_discount_value numeric(18,4),
  p_tax_rate numeric(5,2),
  p_device_id text,
  p_idempotency_key uuid
)
RETURNS TABLE (
  success boolean,
  message text,
  invoice_id uuid,
  invoice_number text,
  cash_movement_id uuid
) AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_seq bigint;
  v_invoice_number text;
  v_cogs numeric(18,4) := 0;
  v_line_profit numeric(18,4);
  v_item jsonb;
  v_warehouse_stock warehouse_stock%ROWTYPE;
  v_discount_amount numeric(18,4);
  v_net_sales numeric(18,4);
  v_tax_amount numeric(18,4);
  v_total numeric(18,4);
  v_movement_id uuid;
BEGIN
  -- تحقق: هل العملية موجودة بالفعل (idempotency)
  SELECT * INTO v_invoice 
  FROM invoices 
  WHERE operation_id = p_operation_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      true, 'عملية موجودة بالفعل' , v_invoice.id, v_invoice.invoice_number,
      (SELECT id FROM cash_movements WHERE invoice_id = v_invoice.id LIMIT 1);
    RETURN;
  END IF;

  -- احجز رقم الفاتورة (sequence ذري)
  v_seq := nextval('invoice_number_seq');
  v_invoice_number := 'INV-' || LPAD(v_seq::text, 6, '0');

  -- تحقق: هل الأرقام مكررة (فحص الفريدية)
  IF EXISTS (SELECT 1 FROM invoices WHERE invoice_number = v_invoice_number) THEN
    RAISE EXCEPTION 'رقم فاتورة مكرر: %', v_invoice_number;
  END IF;

  -- احسب الخصم
  v_discount_amount := CASE 
    WHEN p_discount_type = 'percentage' THEN (p_subtotal * p_discount_value / 100)
    WHEN p_discount_type = 'fixed' THEN p_discount_value
    ELSE 0
  END;

  v_net_sales := p_subtotal - v_discount_amount;
  v_tax_amount := v_net_sales * p_tax_rate / 100;
  v_total := v_net_sales + v_tax_amount;

  -- تحقق: خصم المخزون (للبيع النقدي، نتحقق من الكمية)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_warehouse_stock
    FROM warehouse_stock
    WHERE product_id = (v_item->>'product_id')::uuid
      AND warehouse_id = (v_item->>'warehouse_id')::uuid
    FOR UPDATE;  -- ← قفل لمنع race condition

    IF NOT FOUND OR v_warehouse_stock.available_quantity < (v_item->>'quantity')::numeric THEN
      RAISE EXCEPTION 'مخزون ناقص للمنتج: %', v_item->>'product_name';
    END IF;

    -- اخصم من المخزون
    UPDATE warehouse_stock SET
      available_quantity = available_quantity - (v_item->>'quantity')::numeric,
      updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid
      AND warehouse_id = (v_item->>'warehouse_id')::uuid;

    -- اجمع COGS
    v_cogs := v_cogs + ((v_item->>'quantity')::numeric * (v_item->>'cost')::numeric);
  END LOOP;

  -- أنشئ الفاتورة
  INSERT INTO invoices (
    operation_id, user_id, store_id, invoice_number, sequence_number,
    sale_type, invoice_type, payment_status, payment_method,
    customer_id, customer_name, subtotal, discount_type, discount_value,
    tax_rate, cogs, sync_source, device_id
  ) VALUES (
    p_operation_id, p_user_id, p_store_id, v_invoice_number, v_seq,
    'cash', 'sale', 'paid', 'cash',
    p_customer_id, p_customer_name, p_subtotal, p_discount_type, p_discount_value,
    p_tax_rate, v_cogs, 'online', p_device_id
  ) RETURNING * INTO v_invoice;

  -- أدرج بنود الفاتورة
  INSERT INTO invoice_items (
    invoice_id, product_id, product_name, quantity, unit,
    sale_price_per_unit, cost_price_per_unit, warehouse_id
  )
  SELECT 
    v_invoice.id, 
    (item->>'product_id')::uuid,
    item->>'product_name',
    (item->>'quantity')::numeric,
    item->>'unit',
    (item->>'price')::numeric,
    (item->>'cost')::numeric,
    (item->>'warehouse_id')::uuid
  FROM jsonb_array_elements(p_items) AS item;

  -- سجّل حركة نقدية
  INSERT INTO cash_movements (
    store_id, invoice_id, movement_type, amount, currency_code,
    idempotency_key, sync_source, device_id, occurred_at
  ) VALUES (
    p_store_id, v_invoice.id, 'cash_sale', v_total, 'USD',
    p_idempotency_key, 'online', p_device_id, now()
  ) RETURNING id INTO v_movement_id;

  -- سجّل الربح
  INSERT INTO profit_ledger (
    invoice_id, entry_type, net_sales, cogs, recognized_status,
    idempotency_key, device_id
  ) VALUES (
    v_invoice.id, 'sale', v_net_sales, v_cogs, 'confirmed',
    p_idempotency_key, p_device_id
  );

  -- النجاح
  RETURN QUERY SELECT 
    true, 'تم الفاتورة بنجاح', v_invoice.id, v_invoice_number, v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### D.2 سداد دين ذري (مع القفل)

```sql
CREATE OR REPLACE FUNCTION process_debt_payment_atomic(
  p_debt_id uuid,
  p_amount numeric(18,4),
  p_payment_method text,
  p_device_id text,
  p_idempotency_key uuid
)
RETURNS TABLE (
  success boolean,
  message text,
  new_payment_status text,
  debt_remaining numeric(18,4)
) AS $$
DECLARE
  v_debt debts%ROWTYPE;
  v_invoice invoices%ROWTYPE;
  v_payment_id uuid;
  v_movement_id uuid;
  v_payment_ratio numeric;
  v_existing_payment uuid;
BEGIN
  -- 1. تحقق من idempotency
  SELECT id INTO v_existing_payment
  FROM debt_payments
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT * INTO v_debt FROM debts WHERE id = p_debt_id;
    RETURN QUERY SELECT true::boolean, 'دفعة موجودة بالفعل'::text,
      v_debt.status, v_debt.remaining_debt;
    RETURN;
  END IF;

  -- 2. قفل الدين (انتظر إذا كان مقفولاً من جهاز آخر)
  SELECT * INTO v_debt
  FROM debts
  WHERE id = p_debt_id
  FOR UPDATE;  -- ← القفل الحرج

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الدين غير موجود', NULL, NULL;
    RETURN;
  END IF;

  -- 3. التحقق من المبلغ
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 'المبلغ يجب أن يكون موجب', NULL, NULL;
    RETURN;
  END IF;

  IF p_amount > v_debt.remaining_debt THEN
    RETURN QUERY SELECT false, 
      'المبلغ أكثر من المتبقي: ' || v_debt.remaining_debt::text, NULL, NULL;
    RETURN;
  END IF;

  -- 4. سجّل الدفعة
  INSERT INTO debt_payments (
    debt_id, invoice_id, amount, currency_code, payment_method,
    idempotency_key, sync_source, device_id, received_at
  ) VALUES (
    p_debt_id, v_debt.invoice_id, p_amount, v_debt.currency_code, p_payment_method,
    p_idempotency_key, 'online', p_device_id, now()
  ) RETURNING id INTO v_payment_id;

  -- 5. حدّث الدين
  UPDATE debts SET
    total_paid = total_paid + p_amount,
    remaining_debt = remaining_debt - p_amount,
    status = CASE 
      WHEN (remaining_debt - p_amount) <= 0 THEN 'fully_paid'
      ELSE 'partially_paid'
    END,
    last_payment_at = now()
  WHERE id = p_debt_id;

  -- 6. حدّث الفاتورة المرتبطة
  SELECT * INTO v_invoice FROM invoices WHERE id = v_debt.invoice_id;
  
  UPDATE invoices SET
    debt_paid = debt_paid + p_amount,
    debt_remaining = debt_remaining - p_amount,
    payment_status = CASE
      WHEN (debt_remaining - p_amount) <= 0 THEN 'paid'
      ELSE 'partially_paid'
    END,
    updated_at = now()
  WHERE id = v_debt.invoice_id;

  -- 7. سجّل حركة نقدية
  INSERT INTO cash_movements (
    store_id, invoice_id, debt_payment_id, movement_type, amount,
    currency_code, idempotency_key, sync_source, device_id, occurred_at
  ) VALUES (
    v_invoice.store_id, v_invoice.id, v_payment_id, 'debt_payment', p_amount,
    v_debt.currency_code, p_idempotency_key, 'online', p_device_id, now()
  ) RETURNING id INTO v_movement_id;

  -- 8. تأكيد الأرباح المعلقة (نسبة السداد)
  v_payment_ratio := p_amount / v_debt.total_amount;
  
  UPDATE profit_ledger SET
    recognized_status = CASE
      WHEN v_payment_ratio >= 1.0 THEN 'confirmed'
      WHEN v_payment_ratio > 0 THEN 'partially_confirmed'
      ELSE recognized_status
    END
  WHERE invoice_id = v_debt.invoice_id
    AND recognized_status IN ('accrued', 'pending_collection');

  -- 9. النجاح
  SELECT status, remaining_debt INTO v_debt.status, v_debt.remaining_debt
  FROM debts WHERE id = p_debt_id;

  RETURN QUERY SELECT true, 'تم السداد بنجاح', v_debt.status, v_debt.remaining_debt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

يتابع في الجزء التالي: E-I (Offline Sync, Conflict Matrix, TypeScript Plan, Testing, Roadmap)

*هل تريد أن أستمر بالأقسام المتبقية؟ أم تفضل التركيز على أي قسم معين؟*
