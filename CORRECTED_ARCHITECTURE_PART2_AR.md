# تصميم معماري آمن - الجزء الثاني
## Part 2: Offline Sync, Conflict Resolution, TypeScript, Testing, Roadmap

---

## E. استراتيجية المزامنة Offline (Offline-First Outbox Pattern)

### E.1 جدول Outbox المحلي (IndexedDB)

```typescript
/**
 * نوع العمليات المعلقة المحفوظة في IndexedDB
 * لا يجوز استخدام localStorage - محدود وغير آمن
 */

interface OfflineOperation {
  // الهوية
  id: string;                    // UUIDv4 - مفتاح أساسي
  idempotency_key: string;       // نفس الـ UUID (للاستدعاء المكرر)
  
  // السياق
  device_id: string;             // معرف الجهاز (فريد)
  store_id: string;              // معرف المتجر
  user_id: string;               // معرف المستخدم
  
  // النوع
  operation_type:
    | 'cash_sale'
    | 'credit_sale'
    | 'debt_payment'
    | 'refund'
    | 'cash_movement';
  
  // البيانات
  payload: {
    // حسب نوع العملية
    [key: string]: unknown;
  };
  
  // الحالة
  sync_status:
    | 'pending'        // في الانتظار
    | 'syncing'        // جارٍ الإرسال
    | 'synced'         // نجح
    | 'rejected'       // مرفوض من الخادم
    | 'conflict';      // تعارض (تحتاج تدخل)
  
  rejection_reason?: string;     // السبب إن رُفضت
  conflict_details?: object;     // تفاصيل التعارض
  
  // الإعادة
  retry_count: number;           // عدد الحاولات
  last_retry_at?: string;        // آخر محاولة
  next_retry_at?: string;        // المحاولة التالية
  
  // النتيجة
  server_response?: {
    invoice_id?: string;
    invoice_number?: string;
    payment_id?: string;
    [key: string]: unknown;
  };
  
  // التوقيت
  occurred_at: string;           // وقت الجهاز المحلي
  created_at: string;            // وقت الحفظ المحلي
  synced_at?: string;            // وقت النجاح
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ جدول IndexedDB                                          ║
// ╚═══════════════════════════════════════════════════════════╝

// IndexedDB Database: 'hyperpos_offline'
// Store: 'operations'
// Key Path: 'id'
// Indexes:
//   - sync_status (for querying pending)
//   - device_id + store_id (for filtering by location)
//   - created_at (for sorting)
//   - idempotency_key (UNIQUE - for deduplication)
```

### E.2 آلية المزامنة (Sync Worker)

```typescript
/**
 * Service Worker / Sync Worker
 * يعمل بشكل دوري أو عند عودة الاتصال
 */

class OfflineSyncWorker {
  private db: IDBDatabase;
  private supabase: SupabaseClient;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(db: IDBDatabase, supabase: SupabaseClient) {
    this.db = db;
    this.supabase = supabase;
  }

  /**
   * بدء المزامنة الدورية
   * تعمل كل 30 ثانية عند الاتصال
   */
  startSyncWorker() {
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine && !this.isSyncing) {
        await this.syncAllPending();
      }
    }, 30000);
  }

  /**
   * مزامنة جميع العمليات المعلقة
   */
  async syncAllPending(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. حمّل جميع العمليات المعلقة بالترتيب
      const pending = await this.loadPendingOperations();

      if (pending.length === 0) return;

      console.log(`Syncing ${pending.length} pending operations...`);

      // 2. للعملية الواحدة
      for (const operation of pending) {
        await this.syncOperation(operation);
      }
    } catch (error) {
      console.error('Sync worker error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * حمّل العمليات المعلقة
   */
  private async loadPendingOperations(): Promise<OfflineOperation[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('operations', 'readonly');
      const store = tx.objectStore('operations');
      const index = store.index('sync_status');
      const range = IDBKeyRange.only('pending');
      const request = index.getAll(range);

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * مزامنة عملية واحدة
   */
  private async syncOperation(operation: OfflineOperation): Promise<void> {
    try {
      // 1. حدّث الحالة إلى "syncing"
      await this.updateOperationStatus(operation.id, 'syncing');

      // 2. استدعِ RPC المناسبة حسب النوع
      let result;
      switch (operation.operation_type) {
        case 'cash_sale':
          result = await this.syncCashSale(operation);
          break;
        case 'credit_sale':
          result = await this.syncCreditSale(operation);
          break;
        case 'debt_payment':
          result = await this.syncDebtPayment(operation);
          break;
        case 'refund':
          result = await this.syncRefund(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.operation_type}`);
      }

      // 3. تعامل مع النتيجة
      if (result.success) {
        await this.updateOperationStatus(operation.id, 'synced', {
          server_response: result,
          synced_at: new Date().toISOString(),
        });

        // إشعار المستخدم
        this.notifyUser({
          type: 'success',
          title: 'تم المزامنة',
          message: `العملية ${result.invoice_number || result.payment_id} نجحت`,
        });
      } else {
        await this.updateOperationStatus(operation.id, 'rejected', {
          rejection_reason: result.message,
        });

        this.notifyUser({
          type: 'error',
          title: 'فشلت العملية',
          message: result.message,
          action: { label: 'المراجعة', action: 'open_offline_queue' },
        });
      }
    } catch (error) {
      // عند حدوث خطأ: أعد المحاولة لاحقاً
      const nextRetry = new Date(Date.now() + 60000); // بعد دقيقة

      await this.updateOperationStatus(operation.id, 'pending', {
        retry_count: operation.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        next_retry_at: nextRetry.toISOString(),
      });

      console.error(`Failed to sync ${operation.id}:`, error);
    }
  }

  /**
   * مزامنة بيع نقدي
   */
  private async syncCashSale(op: OfflineOperation): Promise<any> {
    const { data, error } = await this.supabase.rpc(
      'process_cash_sale_atomic',
      {
        p_operation_id: op.id,
        p_user_id: op.user_id,
        p_store_id: op.store_id,
        p_items: op.payload.items,
        p_subtotal: op.payload.subtotal,
        p_discount_type: op.payload.discount_type,
        p_discount_value: op.payload.discount_value,
        p_tax_rate: op.payload.tax_rate,
        p_device_id: op.device_id,
        p_idempotency_key: op.idempotency_key,
      }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: data.success,
      message: data.message,
      invoice_id: data.invoice_id,
      invoice_number: data.invoice_number,
    };
  }

  /**
   * مزامنة سداد ديْن
   */
  private async syncDebtPayment(op: OfflineOperation): Promise<any> {
    const { data, error } = await this.supabase.rpc(
      'process_debt_payment_atomic',
      {
        p_debt_id: op.payload.debt_id,
        p_amount: op.payload.amount,
        p_payment_method: op.payload.payment_method,
        p_device_id: op.device_id,
        p_idempotency_key: op.idempotency_key,
      }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: data.success,
      message: data.message,
      new_payment_status: data.new_payment_status,
    };
  }

  /**
   * تحديث حالة العملية في IndexedDB
   */
  private async updateOperationStatus(
    operationId: string,
    newStatus: string,
    updates?: Partial<OfflineOperation>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('operations', 'readwrite');
      const store = tx.objectStore('operations');
      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.sync_status = newStatus;
          Object.assign(operation, updates);

          const putRequest = store.put(operation);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * إشعار المستخدم
   */
  private notifyUser(notification: {
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    action?: { label: string; action: string };
  }): void {
    // استخدم toast أو نظام إشعارات محلي
    console.log('Notification:', notification);
    // TODO: integrate with toast library
  }

  stopSyncWorker() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}
```

### E.3 حفظ العملية Offline

```typescript
/**
 * عند فقدان الاتصال أو البيع Offline
 * حفظ في IndexedDB بدلاً من localStorage
 */

async function saveOperationOffline(
  operation: OfflineOperation
): Promise<string> {
  return new Promise((resolve, reject) => {
    const db = await openOfflineDB();
    const tx = db.transaction('operations', 'readwrite');
    const store = tx.objectStore('operations');

    const request = store.add(operation);

    request.onsuccess = () => {
      console.log(`Operation saved offline: ${operation.id}`);
      resolve(operation.id);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// مثال: بيع نقدي عند عدم الاتصال
async function handleCashSaleOffline(payload: CashSalePayload): Promise<string> {
  const deviceId = getDeviceId();
  const operation: OfflineOperation = {
    id: uuidv4(),
    idempotency_key: uuidv4(),  // نفسه
    device_id: deviceId,
    store_id: getStoreId(),
    user_id: getCurrentUserId(),
    operation_type: 'cash_sale',
    payload,
    sync_status: 'pending',
    retry_count: 0,
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // حفظ
  const operationId = await saveOperationOffline(operation);

  // إيصال مؤقت
  const tempReceipt = `OFF-${deviceId}-${Date.now()}`;
  return tempReceipt;
}
```

---

## F. مصفوفة حل التعارضات (Conflict Resolution Matrix)

### F.1 سيناريوهات التعارض

```typescript
/**
 * عند محاولة مزامنة عملية ووجود تضارب
 * هذا هو قرار النظام
 */

type ConflictScenario = {
  scenario: string;
  condition: string;
  serverDecision: string;
  userNotification: string;
  effect: string;
};

const CONFLICT_MATRIX: ConflictScenario[] = [
  {
    scenario: 'C1: ديون مسبقاً من جهاز آخر',
    condition:
      'جهاز A: بيع دين، جهاز B: بيع نقدي (نفس العميل)\n' +
      'أثناء Offline، كلاهما لم يعرف عن الآخر',
    serverDecision:
      'قبول الأول، رفض الثاني\n' +
      'السبب: حد الائتمان استُهلك',
    userNotification:
      '"صاحبك باع له نقدي من جهاز آخر.\n' +
      'بيعك الآجل رُفض: حد ائتماني"',
    effect:
      'الجهاز B: العملية = rejected\n' +
      'المستخدم يرى الآجل في طابور رفض\n' +
      'يمكن تحويلها لنقدي أو إلغاؤها',
  },

  {
    scenario: 'C2: دفعتا دين متزامنتان',
    condition:
      'جهاز A: دفع $100\n' +
      'جهاز B: دفع $100\n' +
      'الدين الأصلي = $100',
    serverDecision:
      'الأولى: ✓ مقبولة\n' +
      'الثانية: ✗ مرفوضة (يتجاوز المتبقي)',
    userNotification:
      '"جهاز آخر سدّد الدين.\n' +
      'دفعتك الثانية رُفضت"',
    effect:
      'الجهاز B: العملية = rejected\n' +
      'التفاصيل: "المبلغ أكثر من المتبقي"\n' +
      'الصندوق: -$100\n' +
      'الدين: $0',
  },

  {
    scenario: 'C3: مخزون باع من جهازين',
    condition:
      'المنتج: كمية = 5\n' +
      'جهاز A: بيع 3\n' +
      'جهاز B: بيع 3\n' +
      'كلاهما Offline',
    serverDecision:
      'الأول: ✓ (كمية كافية)\n' +
      'الثاني: ✗ (كمية ناقصة)',
    userNotification:
      '"المخزون باع من جهاز آخر.\n' +
      'بيعك رُفض: كمية ناقصة"',
    effect:
      'الجهاز B: الفاتورة = rejected\n' +
      'التفاصيل: "مخزون ناقص"\n' +
      'المستودع: الكمية الفعلية = 2\n' +
      'المستخدم يمكنه التعديل والإعادة',
  },

  {
    scenario: 'C4: مرتجع متعدد (نفس الفاتورة)',
    condition:
      'جهاز A: استرجع فاتورة\n' +
      'جهاز B: استرجع نفس الفاتورة\n' +
      'Offline',
    serverDecision:
      'الأول: ✓ (الفاتورة في حالة paid)\n' +
      'الثاني: ✗ (الفاتورة صارت refunded)',
    userNotification:
      '"تم استرجاع الفاتورة مسبقاً.\n' +
      'استرجاعك الثاني رُفض"',
    effect:
      'الجهاز B: المرتجع = rejected\n' +
      'المخزون: +عنصر 1 مرة فقط\n' +
      'الصندوق: -دولار 1 مرة فقط\n' +
      'الأرباح: معكوسة مرة واحدة',
  },

  {
    scenario: 'C5: تعديل المنتج أثناء البيع',
    condition:
      'جهاز A: سعر = $100 (محلي)\n' +
      'جهاز B: غيّر السعر = $80\n' +
      'جهاز A نزّل Offline وباع بـ $100',
    serverDecision:
      'استخدم سعر البيع من لحظة العملية = $100\n' +
      'لا تستبدل بسعر اليوم',
    userNotification:
      'بدون، تم بنجاح\n' +
      'السعر محفوظ من لحظة البيع',
    effect:
      'الفاتورة: السعر = $100 ✓\n' +
      'الأرباح: محسوبة على $100\n' +
      'البيانات ثابتة من لحظة الإنشاء',
  },

  {
    scenario: 'C6: حد الائتمان تجاوز',
    condition:
      'العميل: حد = $1000\n' +
      'جهاز A Offline: بيع $600\n' +
      'جهاز B Online: بيع $600\n' +
      'A لا يعرف عن B',
    serverDecision:
      'جهاز B: ✓ (متاح $400 بعد)\n' +
      'جهاز A عند Reconnect:\n' +
      '✗ رفض (حد استُهلك)',
    userNotification:
      '"حد الائتمان استُهلك من جهاز آخر.\n' +
      'بيعك الآجل رُفض"',
    effect:
      'A: العملية = rejected\n' +
      'A: خيارات:\n' +
      '  - تحويل لنقدي وإعادة\n' +
      '  - إلغاء البيع',
  },
];
```

### F.2 نموذج القرار

```typescript
/**
 * عند التعارض:
 * لا تستخدم "Last Write Wins" للبيانات المالية
 * بدلاً من ذلك: استخدم الترتيب الزمني + القواعد
 */

type ConflictResolution = {
  // النوع: never accept last-write-wins
  strategy: 'FIRST_WRITE_WINS' | 'REJECT_DUPLICATE' | 'MERGE_IF_COMPATIBLE';

  // الحقول التي تطبق عليها
  appliesTo: string[];

  // مثال
  example: string;
};

const RESOLUTION_STRATEGIES: ConflictResolution[] = [
  {
    strategy: 'FIRST_WRITE_WINS',
    appliesTo: ['cash_sale', 'credit_sale', 'refund'],
    example:
      'إذا طلب 1 وصل → قبول\n' +
      'إذا طلب 2 (نفس idempotency) → أعد طلب 1\n' +
      'إذا طلب 2 (عملية جديدة) + تضارب → رفض',
  },

  {
    strategy: 'REJECT_DUPLICATE',
    appliesTo: ['debt_payment', 'cash_out'],
    example:
      'إذا دفع 1 = $100، يتبقى $0\n' +
      'إذا دفع 2 = $50 → رفض (لا يوجد رصيد)\n' +
      'لا تقبل "أجزاء" متعددة من نفس الدين',
  },

  {
    strategy: 'MERGE_IF_COMPATIBLE',
    appliesTo: ['inventory_adjustment', 'cash_in'],
    example:
      'إذا إيداع 1 = +$100\n' +
      'إذا إيداع 2 = +$200\n' +
      'اقبل كليهما (لا تتضاربان)',
  },
];
```

---

## G. خطة التكامل TypeScript (TypeScript Integration Plan)

### G.1 Types والواجهات

```typescript
// ============════════════════════════════════════════════════
// File: src/types/financial.ts
// ============════════════════════════════════════════════════

/** نوع البيع الأصلي */
export type SaleType = 'cash' | 'credit';

/** حالة السداد الحالية */
export type PaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'refunded';

/** طريقة السداد */
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'cheque'
  | 'mixed';

/** الفاتورة */
export interface Invoice {
  id: string;
  operationId: string;  // UUID - للـ idempotency
  invoiceNumber: string;  // INV-000001
  sequenceNumber: bigint;

  // النوع
  saleType: SaleType;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;

  // البيانات
  customerId?: string;
  customerName: string;
  subtotal: Decimal;
  discountType: 'fixed' | 'percentage';
  discountValue: Decimal;
  discountAmount: Decimal;  // محسوبة
  netSales: Decimal;  // محسوبة
  taxRate: Decimal;
  taxAmount: Decimal;  // محسوبة
  total: Decimal;  // محسوبة

  // الأرباح
  cogs: Decimal;  // من البنود
  grossProfit: Decimal;  // محسوبة = netSales - cogs

  // الديون
  debtPaid: Decimal;
  debtRemaining: Decimal;

  // التوقيت
  createdAt: Date;
  updatedAt: Date;
}

/** بند الفاتورة */
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  quantity: Decimal;
  unit: string;

  // الأسعار (مجمدة)
  salePricePerUnit: Decimal;
  costPricePerUnit: Decimal;

  // المجاميع (محسوبة)
  lineTotal: Decimal;
  lineCogs: Decimal;
  lineProfit: Decimal;
}

/** الدين */
export interface Debt {
  id: string;
  invoiceId: string;
  customerId: string;

  totalAmount: Decimal;
  totalPaid: Decimal;
  remainingDebt: Decimal;  // محسوبة

  status: 'due' | 'partially_paid' | 'overdue' | 'fully_paid';
  dueDate: Date;
  lastPaymentAt?: Date;
}

/** سجل الدفع */
export interface DebtPayment {
  id: string;
  debtId: string;
  invoiceId: string;

  amount: Decimal;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;  // منع التكرار

  receivedAt: Date;
}

/** حركة نقدية */
export interface CashMovement {
  id: string;
  storeId: string;

  movementType:
    | 'cash_sale'
    | 'debt_payment'
    | 'refund'
    | 'opening_float'
    | 'cash_in'
    | 'cash_out'
    | 'closing_adjustment';

  amount: Decimal;  // قد يكون موجب أو سالب
  idempotencyKey: string;

  occurredAt: Date;
}

/** دفتر الأرباح */
export interface ProfitLedger {
  id: string;
  invoiceId: string;
  originalEntryId?: string;

  entryType: 'sale' | 'refund' | 'adjustment';

  netSales: Decimal;
  cogs: Decimal;
  grossProfit: Decimal;  // محسوبة

  recognizedStatus: 'accrued' | 'pending_collection' | 'confirmed';

  idempotencyKey: string;
}

/** عملية Offline معلقة */
export interface OfflineOperation {
  id: string;
  idempotencyKey: string;

  deviceId: string;
  storeId: string;

  operationType:
    | 'cash_sale'
    | 'credit_sale'
    | 'debt_payment'
    | 'refund';

  payload: unknown;

  syncStatus:
    | 'pending'
    | 'syncing'
    | 'synced'
    | 'rejected'
    | 'conflict';

  rejectionReason?: string;

  retryCount: number;
  lastRetryAt?: Date;
  nextRetryAt?: Date;

  serverResponse?: Record<string, unknown>;

  occurredAt: Date;
  createdAt: Date;
  syncedAt?: Date;
}
```

### G.2 استخدام Decimal (وليس float)

```typescript
// ❌ خطأ
const total = 100.1 + 200.2;  // = 300.40000000000006

// ✅ صحيح
import Decimal from 'decimal.js';

const subtotal = new Decimal('100.1');
const tax = new Decimal('200.2');
const total = subtotal.plus(tax);  // = 300.3
console.log(total.toString());  // "300.3"

// للتخزين في DB
const value = total.toFixed(4);  // "300.3000"
```

### G.3 واجهات API الآمنة

```typescript
// ============════════════════════════════════════════════════
// File: src/services/financial/offline-sync.ts
// ============════════════════════════════════════════════════

/**
 * خدمة مزامنة آمنة
 * - كل عملية = idempotency_key فريد
 * - لا تعتمد على localStorage
 * - تستخدم IndexedDB للإيداع الموثوق
 */

export class OfflineSyncService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * حفظ عملية بيع نقدي Offline
   */
  async saveCashSaleOffline(payload: {
    storeId: string;
    customerId?: string;
    customerName: string;
    items: InvoiceItem[];
    subtotal: Decimal;
    discount: Decimal;
    tax: Decimal;
  }): Promise<{ operationId: string; tempReceipt: string }> {
    const operationId = crypto.randomUUID();
    const operation: OfflineOperation = {
      id: operationId,
      idempotencyKey: operationId,  // نفسه
      deviceId: getDeviceId(),
      storeId: payload.storeId,
      operationType: 'cash_sale',
      payload,
      syncStatus: 'pending',
      retryCount: 0,
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await saveToIndexedDB('operations', operation);

    const tempReceipt = `OFF-${getDeviceId()}-${Date.now()}`;
    return { operationId, tempReceipt };
  }

  /**
   * مزامنة عملية عند عودة الاتصال
   */
  async syncOperation(operation: OfflineOperation): Promise<{
    success: boolean;
    message: string;
    result?: Record<string, unknown>;
  }> {
    try {
      let result;

      switch (operation.operationType) {
        case 'cash_sale':
          result = await this.supabase.rpc('process_cash_sale_atomic', {
            p_operation_id: operation.id,
            p_idempotency_key: operation.idempotencyKey,
            p_device_id: operation.deviceId,
            // ... بقية البيانات من payload
          });
          break;

        case 'debt_payment':
          result = await this.supabase.rpc('process_debt_payment_atomic', {
            p_debt_id: operation.payload.debt_id,
            p_amount: operation.payload.amount,
            p_idempotency_key: operation.idempotencyKey,
            p_device_id: operation.deviceId,
          });
          break;

        default:
          return { success: false, message: 'Unknown operation type' };
      }

      if (result.error) {
        return { success: false, message: result.error.message };
      }

      return {
        success: result.data.success,
        message: result.data.message,
        result: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

---

## H. خطة الاختبار (Testing & Validation Plan)

```typescript
// ============════════════════════════════════════════════════
// File: tests/financial.spec.ts
// ============════════════════════════════════════════════════

describe('💰 Financial Operations - Atomic & Offline-Safe', () => {
  
  describe('1. Cash Sale Atomic', () => {
    it('✅ يجب إنشاء فاتورة + بنود + حركة نقدية ذرياً', async () => {
      // Arrange
      const payload = {
        items: [
          { productId: 'p1', qty: 2, price: 100, cost: 60 },
        ],
        subtotal: 200,
        discount: 10,
        tax: 5,
      };

      // Act
      const result = await rpc('process_cash_sale_atomic', {
        ...payload,
        p_operation_id: 'op-123',
        p_idempotency_key: 'idem-123',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoice_number).toMatch(/INV-\d+/);

      // 2. تحقق: الفاتورة موجودة
      const invoice = await db.query('SELECT * FROM invoices WHERE ...');
      expect(invoice.gross_profit).toBe(130);  // net_sales - cogs

      // 3. تحقق: المخزون اقتطع
      const stock = await db.query('SELECT * FROM warehouse_stock WHERE ...');
      expect(stock.available_quantity).toBe(-2);  // تقليل

      // 4. تحقق: حركة نقدية
      const movement = await db.query('SELECT * FROM cash_movements WHERE ...');
      expect(movement.movement_type).toBe('cash_sale');
    });

    it('✅ يجب إعادة النتيجة نفسها عند تكرار operation_id', async () => {
      // Act: نفس operation_id
      const result1 = await rpc('process_cash_sale_atomic', {
        ... payload,
        p_operation_id: 'op-dup',
      });

      const result2 = await rpc('process_cash_sale_atomic', {
        ...payload,
        p_operation_id: 'op-dup',  // نفسه
      });

      // Assert
      expect(result1.invoice_number).toBe(result2.invoice_number);
      expect(result2.success).toBe(true);
      expect(result2.already_processed).toBe(true);
    });

    it('❌ يجب رفض البيع عند مخزون ناقص', async () => {
      // Arrange
      const payload = {
        items: [{ productId: 'p1', qty: 1000, ... }],  // كمية فوق المتاح
      };

      // Act
      const result = await rpc('process_cash_sale_atomic', { ...payload });

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('مخزون ناقص');

      // تحقق: لا فاتورة تم إنشاؤها
      const invoice = await db.query(
        'SELECT * FROM invoices WHERE operation_id = ...'
      );
      expect(invoice).toBeNull();
    });
  });

  describe('2. Debt Payment Atomic', () => {
    it('✅ يجب قفل الدين ومنع الدفع المزدوج', async () => {
      // Arrange
      const debt = await createTestDebt({ amount: 100 });

      // Act: جهازان معاً
      const promise1 = rpc('process_debt_payment_atomic', {
        p_debt_id: debt.id,
        p_amount: 100,
        p_idempotency_key: 'pay1',
      });

      const promise2 = rpc('process_debt_payment_atomic', {
        p_debt_id: debt.id,
        p_amount: 100,
        p_idempotency_key: 'pay2',  // idempotency مختلف
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);  // مرفوض
      expect(result2.message).toContain('أكثر من المتبقي');

      // تحقق: دفعة واحدة فقط
      const payments = await db.query('SELECT * FROM debt_payments WHERE ...');
      expect(payments.length).toBe(1);
    });

    it('✅ يجب تحديث الفاتورة + الصندوق + الأرباح', async () => {
      // Act
      const result = await rpc('process_debt_payment_atomic', {
        p_debt_id: debt.id,
        p_amount: 50,
        p_idempotency_key: 'pay-123',
      });

      // Assert
      expect(result.success).toBe(true);

      // تحقق: الدين
      const updatedDebt = await db.query('SELECT * FROM debts WHERE ...');
      expect(updatedDebt.total_paid).toBe(50);
      expect(updatedDebt.remaining_debt).toBe(50);
      expect(updatedDebt.status).toBe('partially_paid');

      // تحقق: الفاتورة
      const invoice = await db.query(
        'SELECT * FROM invoices WHERE id = ...'
      );
      expect(invoice.payment_status).toBe('partially_paid');

      // تحقق: الصندوق
      const movement = await db.query(
        'SELECT * FROM cash_movements WHERE ...'
      );
      expect(movement.amount).toBe(50);
    });
  });

  describe('3. Offline Sync', () => {
    it('✅ يجب حفظ العملية في IndexedDB', async () => {
      // Act
      const { operationId } = await syncService.saveCashSaleOffline({
        ...payload,
      });

      // Assert
      const stored = await getFromIndexedDB('operations', operationId);
      expect(stored).toBeDefined();
      expect(stored.syncStatus).toBe('pending');
    });

    it('✅ يجب مزامنة عند عودة الاتصال', async () => {
      // Arrange
      const operation = await getFromIndexedDB('operations', operationId);

      // Act
      const result = await syncService.syncOperation(operation);

      // Assert
      expect(result.success).toBe(true);

      // تحقق: تحديث الحالة
      const updated = await getFromIndexedDB('operations', operationId);
      expect(updated.syncStatus).toBe('synced');
      expect(updated.serverResponse).toBeDefined();
    });

    it('❌ يجب رفض عملية عند تضارب', async () => {
      // Arrange: بيع آجل + حد ائتمان استُهلك من جهاز آخر
      const operation = await getFromIndexedDB('operations', operationId);

      // Act
      const result = await syncService.syncOperation(operation);

      // Assert
      expect(result.success).toBe(false);

      // تحقق: حفظ السبب
      const updated = await getFromIndexedDB('operations', operationId);
      expect(updated.syncStatus).toBe('rejected');
      expect(updated.rejectionReason).toBeDefined();
    });
  });

  describe('4. Conflict Resolution', () => {
    it('✅ يجب منع مرتجع مزدوج', async () => {
      // Act: جهازان يسترجعان الفاتورة
      const result1 = await rpc('process_refund_atomic', {
        p_invoice_id: invoice.id,
        p_idempotency_key: 'ref1',
      });

      const result2 = await rpc('process_refund_atomic', {
        p_invoice_id: invoice.id,
        p_idempotency_key: 'ref2',
      });

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);

      // تحقق: مخزون استعاد مرة واحدة
      const stock = await db.query('SELECT * FROM warehouse_stock WHERE ...');
      expect(stock.available_quantity).toBe(originalQty + qty);  // +qty مرة واحدة
    });
  });
});
```

---

## I. خريطة الطريق المرحلية (Prioritized Implementation Roadmap)

```
PHASE 1: الأساس الآمن (Week 1-2)
═════════════════════════════════════════════════════════════

إجراء: إنشاء RPC functions الذرية للعمليات المالية

[ ] T1.1 كتابة RPC: process_cash_sale_atomic
    - SQLFiles/migrations/rpc_cash_sale.sql
    - يضمن: إنشاء + بنود + مخزون + نقد - ذري كامل
    - اختبار: 5 حالات نجاح + 3 حالات فشل
    ⏱️ الوقت: 4-6 ساعات

[ ] T1.2 كتابة RPC: process_debt_payment_atomic
    - يضمن: قفل الدين + idempotency + تحديث
    - اختبار: دفعات متزامنة
    ⏱️ الوقت: 3-4 ساعات

[ ] T1.3 تعديل الفاتورة: sale_type + payment_status + payment_method
    - migration لإضافة columns
    - تحديث RLS policies
    ⏱️ الوقت: 1-2 ساعات

[ ] T1.4 إنشاء ledger tables للأرباح والحركات النقدية
    - profit_ledger (لا حذف، فقط إضافة)
    - cash_movements (immutable)
    - migration + indexes
    ⏱️ الوقت: 2-3 ساعات

✓ نهاية Phase 1: النظام الخلفي آمن ذرياً


PHASE 2: المزامنة Offline (Week 3-4)
═════════════════════════════════════════════════════════════

إجراء: بناء طبقة Offline-First مع IndexedDB

[ ] T2.1 إنشاء IndexedDB schema
    - Database: 'hyperpos_offline'
    - Store: 'operations'
    - Indexes: sync_status, device_id, idempotency_key
    - TypeScript types: OfflineOperation
    ⏱️ الوقت: 2-3 ساعات

[ ] T2.2 بناء OfflineSyncWorker
    - loadPendingOperations()
    - syncOperation() مع retry logic
    - updateOperationStatus()
    - notifyUser()
    ⏱️ الوقت: 6-8 ساعات

[ ] T2.3 تعديل CartPanel.tsx
    - عند Offline: حفظ في IndexedDB
    - عند Online: تشغيل sync worker
    - عرض إيصال مؤقت أو نهائي
    ⏱️ الوقت: 3-4 ساعات

[ ] T2.4 اختبار شامل
    - Offline sale → Online sync
    - Offline payment → Online sync
    - Duplicate idempotency
    - Conflict scenarios
    ⏱️ الوقت: 4-5 ساعات

✓ نهاية Phase 2: تطبيق Offline آمن


PHASE 3: الدوال الإضافية (Week 5)
═════════════════════════════════════════════════════════════

[ ] T3.1 RPC: process_refund_atomic
    - قفل الفاتورة + عكس الأرباح + استعادة مخزون - ذري
    ⏱️ الوقت: 4-5 ساعات

[ ] T3.2 RPC: process_credit_sale_atomic
    - مع fcheck حد الائتمان محلياً في RPC
    ⏱️ الوقت: 3-4 ساعات

[ ] T3.3 نقل الصندوق والأرباح للسحابة
    - حذف reliance على localStorage
    - جميع الحركات مثل cash_movements
    ⏱️ الوقت: 3-4 ساعات

✓ نهاية Phase 3: نظام متكامل


PHASE 4: المراقبة والتقارير (Week 6)
═════════════════════════════════════════════════════════════

[ ] T4.1 لوحة تحكم Offline operations
    - عرض قائمة العمليات المعلقة
    - حالات الفشل والتعارضات
    - إجراءات يدوية للحل

[ ] T4.2 تقارير مطابقة الصندوق
    - الصندوق المحلي vs. cloud
    - كشف الفروقات والأخطاء

[ ] T4.3 تدقيق الأرباح
    - دفتر الأرباح المتراكم
    - توزيع الشركاء

✓ نهاية Phase 4: إنتاج آمن


الجدول الزمني الإجمالي:
═════════════════════════════════════════════════════════════
Phase 1: 10-15 ساعة عمل
Phase 2: 15-20 ساعة عمل
Phase 3: 10-13 ساعة عمل
Phase 4: 8-10 ساعات عمل
────────────────────────────────
المجموع: ~43-58 ساعة عمل (~6-7 أسابيع بوقت جزئي)
```

---

## الخلاصة النهائية

### ما الذي تغيّر:

✅ **من:** localStorage + استدعاءات منفصلة = فوضى مالية  
✅ **إلى:** PostgreSQL RPC ذرية + IndexedDB Outbox = آمان كامل

✅ **من:** السماح بالبيع عند عدم التيقن  
✅ **إلى:** Fail Closed - رفض الافتراضي للديون

✅ **من:** حذف السجلات المالية  
✅ **إلى:** Ledger immutable - كل شيء مسجّل للأبد

✅ **من:** race conditions بين الأجهزة  
✅ **إلى:** SELECT FOR UPDATE + idempotency_key = آمن تماماً

---

*يتواصل في ملفات إضافية حسب الحاجة*

**آخر تحديث:** أغسطس 2026 - تصميم إنتاجي معتمد
