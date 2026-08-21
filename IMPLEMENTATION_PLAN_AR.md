# خطة التطبيق والحلول العملية
## Implementation Plan & Code Solutions

---

## الجزء الأول: الحلول الفورية (Week 1)

### الحل 1: حماية عملية السداد

**الملف:** `src/lib/cloud/debts-cloud.ts`

```typescript
/**
 * تسجيل دفع آمن مع فحوصات كاملة
 * Safe payment recording with full validation
 */
export async function recordPaymentCloudSafe(
  debtId: string,
  paymentAmount: number
): Promise<PaymentResult> {
  // 1. التحقق من صحة المدخلات
  if (typeof paymentAmount !== 'number' || isNaN(paymentAmount)) {
    throw new Error('المبلغ يجب أن يكون رقماً صحيحاً');
  }

  if (paymentAmount <= 0) {
    throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  }

  if (paymentAmount % 1 !== 0 && Math.round(paymentAmount * 100) % 1 !== 0) {
    // تجنب الأخطاء العشرية
    throw new Error('المبلغ يحتوي على أكثر من منزلتين عشريتين');
  }

  // 2. تحميل الدين الحالي
  let debt: Debt | null = null;
  try {
    const { data } = await sb
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .single();
    
    if (!data) {
      throw new Error('سجل الدين غير موجود');
    }
    debt = toDebt(data as CloudDebt);
  } catch (err) {
    console.error('Error loading debt:', err);
    throw new Error('فشل تحميل سجل الدين');
  }

  // 3. التحقق من عدم تجاوز المتبقي
  const maxAllowed = Math.round(debt.remainingDebt * 100) / 100;
  const roundedPayment = Math.round(paymentAmount * 100) / 100;

  if (roundedPayment > maxAllowed) {
    throw new Error(
      `المبلغ المسموح: ${maxAllowed.toFixed(2)}. ` +
      `لا يمكن سداد: ${roundedPayment.toFixed(2)}`
    );
  }

  // 4. التحقق من عدم وجود دفع مزدوج (في آخر 60 ثانية)
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const recentPayments = await sb
    .from('payments')
    .select('id', { count: 'exact' })
    .eq('debt_id', debtId)
    .gte('created_at', oneMinuteAgo);

  if (recentPayments.error) {
    console.warn('Warning checking recent payments:', recentPayments.error);
    // لا نوقف العملية، لكن نسجل التحذير
  } else if (recentPayments.count && recentPayments.count > 0) {
    throw new Error('تم تسجيل دفع للتو، يرجى الانتظار 60 ثانية');
  }

  // 5. تسجيل الدفع بشكل آمن
  try {
    return await recordPaymentCloud(debtId, paymentAmount);
  } catch (err) {
    console.error('Error recording payment:', err);
    throw new Error('فشل تسجيل الدفع. يرجى المحاولة لاحقاً');
  }
}

// ============================================
// دالة مساعدة: تسجيل الدفع (الوظيفة الأساسية)
// ============================================
async function recordPaymentCloud(
  debtId: string,
  paymentAmount: number
): Promise<PaymentResult> {
  const debt = await loadDebtCloud(debtId);
  
  const newTotalPaid = debt.totalPaid + paymentAmount;
  const newRemainingDebt = debt.totalDebt - newTotalPaid;

  // حساب الحالة الجديدة
  let newStatus: DebtStatus = 'due';
  if (newRemainingDebt <= 0) {
    newStatus = 'fully_paid';
  } else if (newTotalPaid > 0) {
    newStatus = 'partially_paid';
  }

  // تحديث سجل الدين
  const { error: debtError } = await sb
    .from('debts')
    .update({
      total_paid: newTotalPaid,
      remaining_debt: Math.max(0, newRemainingDebt),
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', debtId);

  if (debtError) throw debtError;

  // تسجيل حركة الدفع
  const { error: paymentError } = await sb
    .from('payments')
    .insert([{
      debt_id: debtId,
      amount: paymentAmount,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }]);

  if (paymentError) console.warn('Payment record failed:', paymentError);

  // تحديث الفاتورة
  await updateInvoiceCloud(debt.invoiceId, {
    debt_paid: newTotalPaid,
    debt_remaining: Math.max(0, newRemainingDebt),
    status: newStatus === 'fully_paid' ? 'paid' : 'pending',
    payment_type: newStatus === 'fully_paid' ? 'cash' : 'debt',
  });

  // تأكيد الأرباح المعلقة
  if (newTotalPaid > debt.totalPaid) {
    const paymentRatio = paymentAmount / debt.totalDebt;
    await confirmPendingProfitCloud(debt.invoiceId, paymentRatio);
  }

  // تحديث إحصائيات العميل
  const customer = await loadCustomerCloud(debt.customerName);
  if (customer?.id) {
    await updateCustomerStatsCloud(customer.id, -paymentAmount, true);
  }

  // إصدار إشعار
  emitEvent(EVENTS.DEBTS_UPDATED, null);

  return {
    success: true,
    newStatus,
    debtRemaining: Math.max(0, newRemainingDebt),
  };
}
```

**الاستخدام:**
```typescript
// في الواجهة الأمامية (Debts.tsx)
try {
  const result = await recordPaymentCloudSafe(debtId, paymentAmount);
  
  if (result.success) {
    toast.success(`تم السداد بنجاح. المتبقي: ${result.debtRemaining}`);
  }
} catch (error) {
  toast.error(error.message);
}
```

---

### الحل 2: فحص حد الائتمان

**الملف:** `src/lib/cloud/customers-cloud.ts`

```typescript
/**
 * التحقق من حد الائتمان قبل البيع بالدين
 * Validate credit limit before debt sale
 */
export async function validateCreditBeforeSale(
  customerId: string | null,
  customerName: string,
  saleAmount: number
): Promise<CreditValidationResult> {
  // إذا لم يكن هناك عميل محدد، لا توجد قيود
  if (!customerId || !customerName) {
    return { valid: true, message: 'عميل جديد - بدون قيود', availableCredit: Infinity };
  }

  // تحميل بيانات العميل
  let customer: Customer;
  try {
    customer = await loadCustomerCloud(customerId);
  } catch (err) {
    // إذا حدث خطأ في التحميل، نسمح بالبيع (default allow)
    console.warn('Could not load customer, allowing sale:', err);
    return { valid: true, message: 'لم يتمكن من التحقق، العملية مسموحة' };
  }

  // الحد الافتراضي: 10,000 (يمكن تخصيصه لكل عميل)
  const creditLimit = customer.creditLimit || 10000;

  // الدين الحالي للعميل
  const currentDebt = customer.totalDebt || 0;

  // الائتمان المتاح
  const availableCredit = creditLimit - currentDebt;

  // الفحص
  if (saleAmount <= 0) {
    return { valid: false, message: 'المبلغ غير صحيح' };
  }

  if (saleAmount > availableCredit) {
    return {
      valid: false,
      message: `تجاوز الحد الائتماني. المتاح: ${availableCredit.toFixed(2)} من أصل ${creditLimit}`,
      availableCredit,
    };
  }

  // فحص إضافي: هل العميل متأخر في السداد؟
  const overdueDebts = await calculateOverdueDebts(customerId);
  if (overdueDebts > 0) {
    return {
      valid: false,
      message: `لديك ديون متأخرة: ${overdueDebts.toFixed(2)}. يجب السداد أولاً`,
      availableCredit: 0, // منع أي بيع
    };
  }

  return {
    valid: true,
    message: `الائتمان متاح. المتبقي: ${availableCredit.toFixed(2)}`,
    availableCredit,
  };
}

/**
 * حساب الديون المتأخرة
 */
async function calculateOverdueDebts(customerId: string): Promise<number> {
  const debts = await loadDebtsCloud();
  const today = new Date().toISOString().split('T')[0];

  return debts
    .filter(debt =>
      debt.id === customerId &&
      debt.status !== 'fully_paid' &&
      debt.dueDate < today
    )
    .reduce((sum, debt) => sum + debt.remainingDebt, 0);
}

// ============================================
// تعريفات الأنواع
// ============================================
interface CreditValidationResult {
  valid: boolean;
  message: string;
  availableCredit?: number;
}
```

**الاستخدام في CartPanel:**
```typescript
// File: src/components/pos/CartPanel.tsx

async function handleCompleteSale() {
  // تحديد نوع الدفع
  if (paymentType === 'debt') {
    // فحص الائتمان
    const creditCheck = await validateCreditBeforeSale(
      customerId,       // معرف العميل
      customerName,     // اسم العميل
      totalAmount       // المبلغ
    );

    if (!creditCheck.valid) {
      showError(creditCheck.message);
      return;  // إيقاف البيع
    }

    // ✅ يمكن المتابعة
    console.log(`✓ الائتمان متاح: ${creditCheck.availableCredit}`);
  }

  // المتابعة مع البيع...
  await processDebtSaleWithOfflineSupport(bundle);
}
```

---

### الحل 3: استخدام Database Sequence للفواتير

**الملف:** `supabase/migrations/[new_migration].sql`

```sql
-- ============================================
-- إنشاء Sequence للفواتير
-- ============================================

-- 1. حذف الـ Sequence القديم إن وجد
DROP SEQUENCE IF EXISTS invoice_number_seq CASCADE;

-- 2. إنشاء Sequence جديد
CREATE SEQUENCE invoice_number_seq START 1 INCREMENT 1;

-- 3. إضافة عمود جديد للتتبع
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sequence_number BIGINT;

-- 4. إضافة index على sequence_number
CREATE INDEX IF NOT EXISTS idx_invoices_sequence
  ON invoices(user_id, sequence_number DESC);

-- ============================================
-- تحديث دالة إنشاء الفاتورة الذرية
-- ============================================

CREATE OR REPLACE FUNCTION public.process_pos_sale_atomic_v2(
  _operation_id text,
  _payment_type text,
  _customer_name text,
  _customer_phone text,
  _subtotal numeric,
  _discount numeric,
  _discount_percentage numeric,
  _tax_rate numeric,
  _tax_amount numeric,
  _total numeric,
  _profit numeric,
  _currency text,
  _warehouse_id uuid,
  _items jsonb
)
RETURNS TABLE(success boolean, already_processed boolean, invoice_id uuid, invoice_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _existing public.invoices%ROWTYPE;
  _new_invoice public.invoices%ROWTYPE;
  _next_seq BIGINT;              -- الرقم التسلسلي الجديد
  _number text;
  _item jsonb;
  _product_id uuid;
  _quantity integer;
  _available integer;
  _product_name text;
  _unit text;
  _conversion_factor numeric;
  _track_inventory boolean := true;
BEGIN
  -- ✅ الحصول على الرقم التسلسلي الفريد (آمن 100%)
  _next_seq := nextval('invoice_number_seq');
  
  -- ✅ تكوين رقم الفاتورة بناءً على التسلسل
  _number := 'INV-' || LPAD(_next_seq::text, 6, '0');

  -- التحقق من وجود فاتورة مطابقة
  SELECT i.* INTO _existing FROM public.invoices i
  WHERE i.user_id = _caller AND i.operation_id = trim(_operation_id)
  LIMIT 1;

  IF FOUND THEN
    -- إذا كانت الفاتورة موجودة بالفعل (إعادة محاولة)
    RETURN QUERY SELECT true, true, _existing.id, _existing.invoice_number;
    RETURN;
  END IF;

  -- إنشاء الفاتورة الجديدة
  INSERT INTO public.invoices (
    user_id,
    invoice_number,
    sequence_number,              -- ✅ حفظ الرقم التسلسلي
    operation_id,
    invoice_type,
    date,
    time,
    customer_name,
    customer_phone,
    subtotal,
    discount,
    discount_percentage,
    tax_rate,
    tax_amount,
    total,
    profit,
    currency,
    exchange_rate,
    payment_type,
    status
  ) SELECT
    _caller,
    _number,
    _next_seq,                    -- ✅ استخدام الرقم التسلسلي الفريد
    trim(_operation_id),
    'sale',
    CURRENT_DATE,
    CURRENT_TIME,
    COALESCE(NULLIF(_customer_name, ''), 'عميل'),
    _customer_phone,
    COALESCE(_subtotal, 0),
    COALESCE(_discount, 0),
    COALESCE(_discount_percentage, 0),
    COALESCE(_tax_rate, 0),
    COALESCE(_tax_amount, 0),
    COALESCE(_total, 0),
    COALESCE(_profit, 0),
    COALESCE(NULLIF(_currency, ''), 'USD'),
    1,
    _payment_type,
    CASE WHEN _payment_type = 'debt' THEN 'pending' ELSE 'paid' END
  FROM (SELECT 1) seed
  RETURNING * INTO _new_invoice;

  -- [بقية الدالة تبقى كما هي...]
  
  RETURN QUERY SELECT true, false, _new_invoice.id, _new_invoice.invoice_number;
END;
$$;

-- ============================================
-- إصلاح الفواتير الموجودة (اختياري)
-- ============================================

-- إذا كان لديك فواتير قديمة، قم بتحديثها مع ترقيم تسلسلي
DO $$
DECLARE
  _rec RECORD;
  _seq BIGINT := 1;
BEGIN
  FOR _rec IN
    SELECT id FROM invoices ORDER BY created_at ASC
  LOOP
    UPDATE invoices
      SET sequence_number = _seq
      WHERE id = _rec.id;
    _seq := _seq + 1;
  END LOOP;
END $$;

-- تحديث الـ Sequence للبدء من الرقم الذي بعد آخر فاتورة
SELECT setval('invoice_number_seq', MAX(sequence_number) + 1)
  FROM invoices;
```

**الاستخدام في TypeScript:**
```typescript
// File: src/lib/cloud/pos-sale-atomic.ts

export async function processPosSaleAtomic(
  operationId: string,
  paymentType: 'cash' | 'debt',
  bundle: AtomicSaleBundle,
): Promise<AtomicSaleResult> {
  // ...

  // الآن استدعاء الدالة الجديدة
  const { data, error } = await sb.rpc('process_pos_sale_atomic_v2', {
    _operation_id: operationId,
    _payment_type: paymentType,
    // ... باقي المتغيرات
  });

  if (error) {
    console.error('Invoice creation failed:', error);
    throw new Error('فشل إنشاء الفاتورة');
  }

  return {
    success: true,
    alreadyProcessed: Boolean(data[0]?.already_processed),
    invoiceId: data[0]?.invoice_id,
    invoiceNumber: data[0]?.invoice_number,
  };
}
```

---

## الجزء الثاني: الحلول المتوسطة (Week 2-3)

### الحل 4: نقل الأرباح للسحابة

**الملف:** `src/lib/cloud/profits-cloud.ts` (جديد)

```typescript
/**
 * إدارة السجلات المالية في السحابة
 * Cloud-based profit records management
 */

import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitEvent, EVENTS } from '../events';

type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;

// ============================================
// أنواع البيانات
// ============================================

export interface ProfitRecord {
  id?: string;
  userId: string;
  invoiceId: string;
  invoiceNumber: string;
  grossProfit: number;
  cogs: number;  // Cost of Goods Sold
  totalSale: number;
  profitType: 'cash' | 'pending';  // نقدي أو معلق
  partnerDistributions?: {
    partnerId: string;
    amount: number;
    percentage: number;
  }[];
  category?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfitSummary {
  totalGrossProfit: number;
  totalCOGS: number;
  totalSales: number;
  cashProfit: number;       // أرباح حققت بالفعل
  pendingProfit: number;    // أرباح في انتظار السداد
  profitMargin: number;     // النسبة المئوية
}

// ============================================
// إضافة سجل ربح
// ============================================

export async function addProfitRecordCloud(record: ProfitRecord): Promise<string> {
  const userId = record.userId;

  if (!userId) {
    throw new Error('معرف المستخدم مفقود');
  }

  const { data, error } = await sb
    .from('profit_records')
    .insert([{
      user_id: userId,
      invoice_id: record.invoiceId,
      invoice_number: record.invoiceNumber,
      gross_profit: record.grossProfit,
      cogs: record.cogs,
      total_sale: record.totalSale,
      profit_type: record.profitType,
      category: record.category,
      notes: record.notes,
      partner_distributions: record.partnerDistributions,
      created_at: new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (error) {
    console.error('Error adding profit record:', error);
    throw error;
  }

  emitEvent(EVENTS.PROFITS_UPDATED, { recordId: data.id });
  return data.id;
}

// ============================================
// حذف سجل ربح (للمرتجعات)
// ============================================

export async function removeProfitRecordCloud(recordId: string): Promise<void> {
  const { error } = await sb
    .from('profit_records')
    .delete()
    .eq('id', recordId);

  if (error) {
    console.error('Error removing profit record:', error);
    throw error;
  }

  emitEvent(EVENTS.PROFITS_UPDATED, null);
}

// ============================================
// الحصول على ملخص الأرباح
// ============================================

export async function getProfitSummaryCloud(
  fromDate: string,
  toDate: string,
  userId: string
): Promise<ProfitSummary> {
  const { data, error } = await sb
    .from('profit_records')
    .select('gross_profit, cogs, total_sale, profit_type')
    .eq('user_id', userId)
    .gte('created_at', `${fromDate}T00:00:00`)
    .lte('created_at', `${toDate}T23:59:59`);

  if (error) {
    console.error('Error fetching profit records:', error);
    throw error;
  }

  const records = data || [];

  const totalGrossProfit = records.reduce((sum, r) => sum + (r.gross_profit || 0), 0);
  const totalCOGS = records.reduce((sum, r) => sum + (r.cogs || 0), 0);
  const totalSales = records.reduce((sum, r) => sum + (r.total_sale || 0), 0);

  const cashProfit = records
    .filter(r => r.profit_type === 'cash')
    .reduce((sum, r) => sum + (r.gross_profit || 0), 0);

  const pendingProfit = records
    .filter(r => r.profit_type === 'pending')
    .reduce((sum, r) => sum + (r.gross_profit || 0), 0);

  const profitMargin = totalSales > 0
    ? (totalGrossProfit / totalSales) * 100
    : 0;

  return {
    totalGrossProfit,
    totalCOGS,
    totalSales,
    cashProfit,
    pendingProfit,
    profitMargin,
  };
}

// ============================================
// الحصول على سجلات الأرباح المفصلة
// ============================================

export async function getProfitRecordsCloud(
  fromDate: string,
  toDate: string,
  userId: string,
  limit: number = 100
): Promise<ProfitRecord[]> {
  const { data, error } = await sb
    .from('profit_records')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', `${fromDate}T00:00:00`)
    .lte('created_at', `${toDate}T23:59:59`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching profit records:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    userId: row.user_id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    grossProfit: row.gross_profit,
    cogs: row.cogs,
    totalSale: row.total_sale,
    profitType: row.profit_type,
    partnerDistributions: row.partner_distributions,
    category: row.category,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
```

**جدول قاعدة البيانات:**
```sql
-- إنشاء جدول سجلات الأرباح
CREATE TABLE IF NOT EXISTS profit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID,
  invoice_number TEXT NOT NULL,
  gross_profit DECIMAL(10, 2) NOT NULL,
  cogs DECIMAL(10, 2) NOT NULL,
  total_sale DECIMAL(10, 2) NOT NULL,
  profit_type TEXT CHECK (profit_type IN ('cash', 'pending')),
  category TEXT,
  notes TEXT,
  partner_distributions JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_profit_records_user_date
  ON profit_records(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profit_records_invoice
  ON profit_records(user_id, invoice_number);

-- RLS Policy
ALTER TABLE profit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profit records"
  ON profit_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profit records"
  ON profit_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profit records"
  ON profit_records FOR DELETE
  USING (auth.uid() = user_id);
```

---

### الحل 5: إصلاح عكس الأرباح

**الملف:** `src/lib/cloud/invoices-cloud.ts` (تحديث)

```typescript
/**
 * تحديث دالة المرتجع لاستخدام السحابة
 */
export async function refundInvoiceCloud(invoiceId: string): Promise<void> {
  // 1. تحميل الفاتورة
  const invoice = await loadInvoiceCloud(invoiceId);
  
  if (invoice.status === 'refunded') {
    throw new Error('تم استرجاع هذه الفاتورة بالفعل');
  }

  // 2. استعادة المخزون
  if (!isNoInventoryMode()) {
    for (const item of invoice.items) {
      await add_product_quantity(item.id, item.quantity);
    }
  }

  // 3. حذف الديون المرتبطة
  const debts = await loadDebtsCloud();
  const relatedDebt = debts.find(d =>
    d.invoiceId === invoice.id ||
    d.invoiceId === invoice.invoiceNumber
  );

  if (relatedDebt) {
    await deleteDebtCloud(relatedDebt.id);
  }

  // 4. ✅ عكس الأرباح في السحابة (بدلاً من localStorage)
  await revertProfitDistributionCloud(invoice.id);

  // 5. إعادة حساب إحصائيات العميل
  await recalculateCustomerStatsCloud(invoice.customerName);

  // 6. ✅ عكس الأرباح على الشركاء في السحابة
  await revertPartnerProfitsCloud(invoice.id);

  // 7. وضع علامة مسترجعة
  await updateInvoiceCloud(invoice.id, {
    status: 'refunded',
    notes: `مسترجعة بتاريخ ${new Date().toLocaleDateString('ar-SA')}`,
  });

  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.PROFITS_UPDATED, null);
  emitEvent(EVENTS.PARTNERS_UPDATED, null);
}

/**
 * ✅ عكس الأرباح في السحابة
 */
async function revertProfitDistributionCloud(invoiceId: string): Promise<void> {
  // تحميل سجلات الأرباح المرتبطة بهذه الفاتورة
  const { data, error } = await sb
    .from('profit_records')
    .select('*')
    .eq('invoice_id', invoiceId);

  if (error) {
    console.error('Error loading profit records:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('No profit records found for invoice:', invoiceId);
    return;
  }

  // حذف سجلات الأرباح
  const { error: deleteError } = await sb
    .from('profit_records')
    .delete()
    .eq('invoice_id', invoiceId);

  if (deleteError) {
    console.error('Error reverting profits:', deleteError);
    throw deleteError;
  }

  console.log(`✓ Reverted ${data.length} profit records for invoice ${invoiceId}`);
}

/**
 * ✅ عكس أرباح الشركاء في السحابة
 */
async function revertPartnerProfitsCloud(invoiceId: string): Promise<void> {
  // تحميل توزيعات الأرباح للشركاء
  const { data: distributions, error } = await sb
    .from('partner_profits')  // جدول جديد
    .select('*')
    .eq('invoice_id', invoiceId);

  if (error) {
    console.error('Error loading partner profits:', error);
    return;  // لا نوقف العملية إذا حدث خطأ
  }

  if (!distributions || distributions.length === 0) {
    return;
  }

  // عكس كل توزيع
  for (const dist of distributions) {
    const partner = await loadPartnerCloud(dist.partner_id);
    
    if (dist.profit_type === 'pending') {
      // إزالة من الأرباح المعلقة
      await sb
        .from('partners')
        .update({
          pending_profit: (partner.pending_profit || 0) - dist.amount,
        })
        .eq('id', dist.partner_id);
    } else {
      // إعادة إزالة من الرصيد الحالي
      await sb
        .from('partners')
        .update({
          current_balance: (partner.current_balance || 0) - dist.amount,
          confirmed_profit: (partner.confirmed_profit || 0) - dist.amount,
        })
        .eq('id', dist.partner_id);
    }
  }

  // حذف توزيعات الأرباح
  await sb
    .from('partner_profits')
    .delete()
    .eq('invoice_id', invoiceId);

  console.log(`✓ Reverted partner profits for invoice ${invoiceId}`);
}
```

---

## قائمة المهام التفصيلية

### Week 1: الثابت الأساسي

- [ ] **اليوم 1:** تطبيق حماية السداد
  - [ ] تعديل `recordPaymentCloudSafe()`
  - [ ] إضافة فحوصات المبلغ
  - [ ] إضافة حماية الدفع المزدوج
  - [ ] اختبار شامل

- [ ] **اليوم 2:** فحص حد الائتمان
  - [ ] تعديل البيع بالدين
  - [ ] إضافة فحص `validateCreditBeforeSale()`
  - [ ] إضافة تحذيرات الديون المتأخرة
  - [ ] اختبار عملي

- [ ] **اليوم 3-4:** نقل الفواتير للـ Sequence
  - [ ] إنشاء migration جديد
  - [ ] تحديث دالة `process_pos_sale_atomic()`
  - [ ] اختبار تعدد المستخدمين
  - [ ] اختبار الأداء

### Week 2-3: نقل البيانات

- [ ] **اليوم 1-2:** نقل الأرباح للسحابة
  - [ ] إنشاء جدول `profit_records`
  - [ ] كتابة وظائف `profits-cloud.ts`
  - [ ] ترحيل البيانات القديمة

- [ ] **اليوم 3-4:** إصلاح عكس الأرباح
  - [ ] تحديث `refundInvoiceCloud()`
  - [ ] استخدام السحابة بدلاً من localStorage

---

*ملاحظة: الأكواد أعلاه وسائط جاهزة للتطبيق. قد تحتاج تعديلات صغيرة حسب البيئة.*

*آخر تحديث: أغسطس 2026*
