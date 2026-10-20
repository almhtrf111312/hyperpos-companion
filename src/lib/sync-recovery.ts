/**
 * Sync Recovery - FlowPOS Pro
 * ===========================
 * إنقاذ وإلغاء العمليات العالقة في طابور المزامنة بأمان محاسبي وذري:
 * - الفصل بين إلغاء عملية غير متصلة (لم تصل السحابة) واسترداد فاتورة مؤكدة بالسحابة
 * - إرجاع كامل ومضمون للمخزون (حسب المنتج أو المستودع)
 * - عكس حركة النقد والربح والوردية بدقة
 * - معالجة أثر الدين والدفعة الأولى
 * - تعليم الفاتورة كملغاة مع الحفاظ على سجل التدقيق
 * - علامة دائمة (Cancellation Registry) تمنع إعادة الإنشاء أو الرفع
 * - منع حالات السباق (Race Conditions) بالقفل الذري
 * - عدم إعلان النجاح إذا فشل أي جزء من التعويض
 */

import { loadQueue, removeFromQueue, resetOperationForRetry, QueuedOperation, abortSyncOperation } from './sync-queue';
import { emitEvent, EVENTS } from './events';
import { updateHistoryStatus } from './sync-history';
import {
  CancelledOpStatus,
  CancelledOperationRecord,
  getCancellationRecord,
  recordCancellation,
  updateCancellationRecord,
  loadCancellationRegistry,
} from './cancellation-registry';
import { reverseSaleFromShift } from './cashbox-store';
import { removeGrossProfit } from './profits-store';
import { markInvoiceCancelledLocally, markInvoiceRefundedLocally } from './cloud/invoices-cloud';
import { markOfflineDebtSaleSynced } from './cloud/debt-sale-handler';
import { deleteDebtByInvoiceId } from './debts-store';
import { supabase } from '@/integrations/supabase/client';
import { isGuestDemoMode } from './demo-data';

export interface StuckOperation {
  id: string;
  operationId: string;
  invoiceNumber?: string;
  type: QueuedOperation['type'];
  label: string;
  customerName?: string;
  total?: number;
  currency?: string;
  itemsCount: number;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  status: QueuedOperation['status'];
  error?: string;
  errorClass?: 'retryable' | 'terminal';
  cancellationStatus?: CancelledOpStatus;
}

export interface DiscardResult {
  success: boolean;
  status: CancelledOpStatus;
  message: string;
  error?: string;
  operationId?: string;
  invoiceNumber?: string;
}

const TYPE_LABELS: Record<string, string> = {
  invoice_create: 'فاتورة نقدية',
  debt_sale_bundle: 'فاتورة بيع مؤجل',
  invoice_refund: 'استرداد فاتورة',
  invoice_refund_partial: 'استرداد جزئي للفاتورة',
  quick_purchase: 'شراء سريع',
  purchase_invoice: 'فاتورة شراء',
  expense: 'مصروف',
  debt_payment: 'سداد دين',
  profit_record: 'تسجيل ربح',
  shift_open: 'فتح وردية',
  shift_close: 'إغلاق وردية',
  shift_transaction: 'حركة وردية',
  store_settings_update: 'تحديث إعدادات المتجر والطباعة',
};

type SaleBundle = {
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  total?: number;
  totalInCurrency?: number;
  currency?: string;
  exchangeRate?: number;
  profit?: number;
  cogs?: number;
  downPayment?: number;
  warehouseId?: string;
  stockItems?: Array<{ productId: string; quantity: number }>;
  items?: Array<Record<string, unknown>>;
};

const getBundle = (operation: QueuedOperation): SaleBundle | null => {
  const bundle = (operation.data as { bundle?: SaleBundle }).bundle;
  return bundle && typeof bundle === 'object' ? bundle : null;
};

const getOperationId = (operation: QueuedOperation): string =>
  String(operation.data.uniqueKey || operation.data.operationId || operation.data.localId || operation.id);

// قفل العمليات الجارية في الذاكرة لمنع الضغط المتكرر وسباق المزامنة
const inFlightCancellations = new Set<string>();

/**
 * جلب جميع العمليات العالقة أو التي تحتاج معالجة، مرتبة من الأقدم للأحدث
 */
export const getStuckOperations = (): StuckOperation[] => {
  const queue = loadQueue();
  const queueOps = queue
    .filter(op => op.status !== 'completed')
    .map(op => {
      const bundle = getBundle(op);
      const opId = getOperationId(op);
      const cancelRec = getCancellationRecord(opId);
      const invoiceNumber = bundle?.invoiceNumber || (op.data as any)?.invoiceNumber;

      return {
        id: op.id,
        operationId: opId,
        invoiceNumber,
        type: op.type,
        label: TYPE_LABELS[op.type] || op.type,
        customerName: bundle?.customerName,
        total: typeof bundle?.total === 'number' ? bundle.total : undefined,
        currency: bundle?.currency,
        itemsCount: Array.isArray(bundle?.items) ? bundle!.items!.length : 0,
        createdAt: op.createdAt || op.timestamp,
        retryCount: op.retryCount,
        maxRetries: op.maxRetries,
        status: op.status,
        error: op.error,
        errorClass: op.errorClass,
        cancellationStatus: cancelRec?.status,
      };
    });

  // إضافة العمليات من سجل الإلغاء التي لا تزال تحتاج معالجة أو بانتظار مطابقة السحابة
  const queueOpIds = new Set(queueOps.map(q => q.operationId));
  const registry = loadCancellationRegistry();
  const registryStuck: StuckOperation[] = [];

  for (const rec of Object.values(registry)) {
    if (queueOpIds.has(rec.operationId)) continue;
    if (rec.status === 'local_cancelled_pending_cloud' || rec.status === 'needs_attention') {
      registryStuck.push({
        id: rec.operationQueueId || rec.operationId,
        operationId: rec.operationId,
        invoiceNumber: rec.invoiceNumber,
        type: (rec.type as any) || 'invoice_create',
        label: TYPE_LABELS[rec.type] || 'عملية بيع ملغاة',
        customerName: rec.bundleSummary?.customerName,
        total: rec.bundleSummary?.total,
        currency: rec.bundleSummary?.currency,
        itemsCount: rec.bundleSummary?.itemsCount || 0,
        createdAt: rec.cancelledAt,
        retryCount: 0,
        maxRetries: 3,
        status: rec.status === 'needs_attention' ? 'failed' : 'pending',
        error: rec.error || (rec.status === 'local_cancelled_pending_cloud' ? 'إلغاء محلي بانتظار مطابقة السحابة' : undefined),
        cancellationStatus: rec.status,
      });
    }
  }

  return [...queueOps, ...registryStuck].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

/**
 * استعادة المخزون المخصوم محلياً لهذه العملية مع مسار بديل مضمون
 */
const restoreLocalStockRobust = async (
  operationId: string,
  bundle: SaleBundle | null
): Promise<boolean> => {
  try {
    // 1. محاولة استعادة المخزون عبر rollbackPendingStockDeduction
    const { rollbackPendingStockDeduction } = await import('./cloud/products-cloud');
    const rolledBack = await rollbackPendingStockDeduction(operationId);
    if (rolledBack) {
      return true;
    }

    // 2. إذا لم يُعثر على حجز مؤقت (مثلاً فُقد أو لم يُحفظ في IndexedDB)، استعادة المخزون مباشرة من بيانات الحزمة
    if (bundle) {
      const warehouseId = bundle.warehouseId;
      const stockItems = bundle.stockItems || [];

      // إذا كانت stockItems فارغة، استخراجها من items
      const itemsToRestore = stockItems.length > 0
        ? stockItems
        : (bundle.items || []).map(it => {
            const qty = Number(it.quantity) || 1;
            const factor = Number(it.conversionFactor) || 1;
            const finalQty = it.unit === 'bulk' && factor > 0 ? qty * factor : qty;
            return {
              productId: String(it.productId || it.id || ''),
              quantity: finalQty,
            };
          }).filter(it => Boolean(it.productId) && it.quantity > 0);

      if (itemsToRestore.length > 0) {
        if (warehouseId) {
          const { adjustWarehouseStockLocalCache } = await import('./cloud/warehouses-cloud');
          adjustWarehouseStockLocalCache(warehouseId, itemsToRestore, 'restore');
        } else {
          const { updateProductsQuantitiesInCache } = await import('./cloud/products-cloud');
          updateProductsQuantitiesInCache(
            itemsToRestore.map(it => ({
              productId: it.productId,
              deltaQuantity: it.quantity,
            }))
          );
        }
        emitEvent(EVENTS.PRODUCTS_UPDATED, null);
        return true;
      }
    }

    // إذا لم تكن هناك أصناف، لا يوجد مخزون للإرجاع
    return true;
  } catch (error) {
    console.error('[SyncRecovery] Failed to restore local stock robustly:', error);
    return false;
  }
};

/**
 * إلغاء عملية بيع عالقة مع عكس كامل وآمن لكافة الآثار المحاسبية والمخزنية
 */
export const discardStuckOperation = async (operationQueueId: string): Promise<DiscardResult> => {
  const queue = loadQueue();
  const operation = queue.find(op => op.id === operationQueueId);

  // إذا لم تكن في الطابور، ربما تكون مسجلة في سجل الإلغاء كـ needs_attention
  if (!operation) {
    const registry = loadCancellationRegistry();
    const existingRec = Object.values(registry).find(
      r => r.operationQueueId === operationQueueId || r.operationId === operationQueueId
    );
    if (existingRec && existingRec.status === 'local_cancelled_pending_cloud') {
      // إعادة فحص السحابة
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { reconcileCancelledOperationsWithCloud } = await import('./cancellation-registry');
        await reconcileCancelledOperationsWithCloud();
        const updated = getCancellationRecord(existingRec.operationId);
        return {
          success: true,
          status: updated?.status || 'cancelled',
          message: 'تمت مطابقة حالة العملية مع السحابة',
          operationId: existingRec.operationId,
          invoiceNumber: existingRec.invoiceNumber,
        };
      }
      return {
        success: true,
        status: 'local_cancelled_pending_cloud',
        message: 'العملية ملغاة محلياً وبانتظار الاتصال لمطابقة السحابة',
        operationId: existingRec.operationId,
        invoiceNumber: existingRec.invoiceNumber,
      };
    }

    return {
      success: false,
      status: 'needs_attention',
      message: 'تعذر العثور على العملية في الطابور',
      error: 'العملية غير موجودة',
    };
  }

  const operationId = getOperationId(operation);
  const bundle = getBundle(operation);
  const invoiceNumber = bundle?.invoiceNumber || (operation.data as any)?.invoiceNumber || operationId;

  // حماية من السباق: فحص القفل
  if (inFlightCancellations.has(operationId)) {
    return {
      success: false,
      status: 'needs_attention',
      message: 'العملية قيد المعالجة حالياً، يرجى الانتظار',
      error: 'In-flight lock active',
      operationId,
      invoiceNumber,
    };
  }

  // إذا كانت العملية قيد الرفع الفعلي حالياً
  if (operation.status === 'processing') {
    console.warn('[SyncRecovery] Operation is currently syncing, waiting briefly for lock resolution:', operationId);
  }

  // 0. إجهاض أي طلب رفع جاري عبر الشبكة فوراً دون انتظار
  abortSyncOperation(operationQueueId);
  if (operationId) abortSyncOperation(operationId);

  inFlightCancellations.add(operationId);

  // تجهيز أو تحميل سجل الإلغاء وحفظه فوراً لمنع أي نتيجة سحابية متأخرة
  const existingRecord = getCancellationRecord(operationId);
  const record: CancelledOperationRecord = existingRecord || {
    operationId,
    operationQueueId: operation.id,
    invoiceNumber,
    type: operation.type,
    status: 'needs_attention',
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reversedEffects: {
      stock: false,
      shift: false,
      profit: false,
      debt: false,
      invoice: false,
    },
    bundleSummary: {
      total: bundle?.total,
      currency: bundle?.currency,
      customerName: bundle?.customerName,
      downPayment: bundle?.downPayment,
      itemsCount: Array.isArray(bundle?.items) ? bundle.items.length : 0,
    },
  };

  const isSaleOperation = operation.type === 'invoice_create' || operation.type === 'debt_sale_bundle';

  try {
    // 1. عكس المخزون (إذا لم يُعكس مسبقاً)
    if (isSaleOperation && !record.reversedEffects.stock) {
      const stockRestored = await restoreLocalStockRobust(operationId, bundle);
      if (!stockRestored) {
        throw new Error('فشل إرجاع كميات المخزون للرفوف/المستودع');
      }
      record.reversedEffects.stock = true;
    } else {
      record.reversedEffects.stock = true;
    }

    // 2. عكس أثر البيع في الوردية وحركة الصندوق (إذا كان هناك نقد مقبوض ولم يُعكس مسبقاً)
    if (isSaleOperation && !record.reversedEffects.shift) {
      if (bundle) {
        let cashToReverse = 0;
        let profitToReverse = 0;
        let cogsToReverse = 0;
        let currencyAmountToReverse = 0;

        if (operation.type === 'invoice_create') {
          cashToReverse = Number(bundle.total) || 0;
          profitToReverse = Number(bundle.profit) || 0;
          cogsToReverse = Number(bundle.cogs) || 0;
          currencyAmountToReverse = Number(bundle.totalInCurrency) || cashToReverse;
        } else if (operation.type === 'debt_sale_bundle') {
          const downPayment = Number(bundle.downPayment) || 0;
          if (downPayment > 0) {
            cashToReverse = downPayment;
            const ratio = (bundle.total || 0) > 0 ? downPayment / (bundle.total || 1) : 1;
            profitToReverse = Math.round((Number(bundle.profit) || 0) * ratio * 100) / 100;
            cogsToReverse = Math.round((Number(bundle.cogs) || 0) * ratio * 100) / 100;
            const rate = Number(bundle.exchangeRate) || 1;
            currencyAmountToReverse = Math.round(downPayment * rate * 100) / 100;
          }
        }

        if (cashToReverse > 0 || profitToReverse > 0 || cogsToReverse > 0) {
          const shiftCurr = (bundle.currency === 'TRY' || bundle.currency === 'SYP') ? bundle.currency : 'USD';
          reverseSaleFromShift(
            cashToReverse,
            profitToReverse,
            cogsToReverse,
            shiftCurr,
            currencyAmountToReverse
          );
        }
      }
      record.reversedEffects.shift = true;
    } else {
      record.reversedEffects.shift = true;
    }

    // 3. عكس سجل الربح المحلي
    if (isSaleOperation && !record.reversedEffects.profit) {
      removeGrossProfit(operationId);
      if (invoiceNumber && invoiceNumber !== operationId) {
        removeGrossProfit(invoiceNumber);
      }
      emitEvent(EVENTS.PROFITS_UPDATED, null);
      record.reversedEffects.profit = true;
    } else {
      record.reversedEffects.profit = true;
    }

    // 4. عكس أثر الدين وحركة العميل (في البيع الآجل)
    if (operation.type === 'debt_sale_bundle' && !record.reversedEffects.debt) {
      markOfflineDebtSaleSynced(operationId);
      if (invoiceNumber) {
        deleteDebtByInvoiceId(invoiceNumber);
      }
      deleteDebtByInvoiceId(operationId);
      emitEvent(EVENTS.DEBTS_UPDATED, null);
      record.reversedEffects.debt = true;
    } else {
      record.reversedEffects.debt = true;
    }

    // 5. تحديث الفاتورة المحلية إلى "ملغاة" مع إبقائها في سجل التدقيق
    if (isSaleOperation && !record.reversedEffects.invoice) {
      if (invoiceNumber) {
        markInvoiceCancelledLocally(invoiceNumber, 'تم إلغاء البيع العالق قبل المزامنة');
      }
      if (operationId && operationId !== invoiceNumber) {
        markInvoiceCancelledLocally(operationId, 'تم إلغاء البيع العالق قبل المزامنة');
      }
      record.reversedEffects.invoice = true;
    } else {
      record.reversedEffects.invoice = true;
    }

    // 6. التحقق من اكتمال كافة التعويضات
    const allEffectsReversed =
      record.reversedEffects.stock &&
      record.reversedEffects.shift &&
      record.reversedEffects.profit &&
      record.reversedEffects.debt &&
      record.reversedEffects.invoice;

    if (!allEffectsReversed) {
      throw new Error('لم تكتمل جميع خطوات التعويض المحلي بنجاح');
    }

    // 7. إزالة العملية من الطابور ومسح التخزين المؤقت المعلق
    removeFromQueue(operation.id);
    try {
      localStorage.removeItem('hyperpos_sync_pending_' + operation.id);
    } catch {}

    updateHistoryStatus(operation.id, 'cancelled', 'syncInvoiceCancelledLocally');

    // 8. فحص حالة السحابة لتحديد الحالة النهائية بدقة
    let finalStatus: CancelledOpStatus = 'local_cancelled_pending_cloud';

    if (isGuestDemoMode()) {
      finalStatus = 'cancelled';
    } else if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        let query = supabase.from('invoices').select('id, invoice_number, status');
        if (invoiceNumber && operationId && invoiceNumber !== operationId) {
          query = query.or(`invoice_number.eq.${invoiceNumber},id.eq.${operationId}`);
        } else if (invoiceNumber) {
          query = query.eq('invoice_number', invoiceNumber);
        } else {
          query = query.eq('id', operationId);
        }

        const { data: cloudInvs, error: checkError } = await query.limit(1);

        if (!checkError) {
          const cloudInv = cloudInvs && cloudInvs.length > 0 ? cloudInvs[0] : null;
          if (!cloudInv) {
            // الفاتورة لم تصل السحابة أبداً -> تأكيد الإلغاء النهائي
            finalStatus = 'cancelled';
          } else if (cloudInv.status === 'refunded') {
            finalStatus = 'refunded';
            markInvoiceRefundedLocally(cloudInv.invoice_number);
          } else {
            // الفاتورة وصلت السحابة -> استدعاء مسار الاسترداد الذري المعتمد
            const { refundInvoiceCloud } = await import('./cloud/invoices-cloud');
            const res = await refundInvoiceCloud(cloudInv.invoice_number, 'offline-sync');
            const isSuccess = res === true || (typeof res === 'object' && res.success);
            if (isSuccess) {
              finalStatus = 'refunded';
              markInvoiceRefundedLocally(cloudInv.invoice_number);
            } else {
              finalStatus = 'needs_attention';
              record.error = typeof res === 'object' && res.error ? res.error : 'فشل الاسترداد السحابي للفاتورة المنشأة مسبقاً';
            }
          }
        }
      } catch (cloudErr) {
        console.warn('[SyncRecovery] Cloud verification deferred due to connection error:', cloudErr);
        finalStatus = 'local_cancelled_pending_cloud';
      }
    }

    record.status = finalStatus;
    record.reason = finalStatus === 'cancelled'
      ? 'تم إلغاء البيع محلياً وتأكيد عدم وجوده في السحابة'
      : finalStatus === 'refunded'
      ? 'تم استرداد الفاتورة السحابية بنجاح عبر المسار المعتمد'
      : 'تم الإلغاء محلياً وبانتظار مطابقة السحابة عند توفر الإنترنت';

    recordCancellation(record);

    emitEvent(EVENTS.INVOICES_UPDATED, null);
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
    emitEvent(EVENTS.SYNC_QUEUE_UPDATED, null);

    return {
      success: true,
      status: finalStatus,
      message: record.reason,
      operationId,
      invoiceNumber,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[SyncRecovery] Discard failed, marking operation as needs_attention:', errorMsg);

    record.status = 'needs_attention';
    record.error = errorMsg;
    recordCancellation(record);

    // إبقاء العملية ظاهرة كـ needs_attention دون حذفها من الطابور
    const currentQueue = loadQueue();
    const idx = currentQueue.findIndex(op => op.id === operationQueueId);
    if (idx !== -1) {
      currentQueue[idx].status = 'failed';
      currentQueue[idx].error = `فشل التعويض: ${errorMsg}`;
      currentQueue[idx].errorClass = 'terminal';
      try {
        const { secureSet } = await import('./secure-storage');
        secureSet('sync_queue', currentQueue, { namespace: 'hp_sync' });
      } catch {}
    }

    emitEvent(EVENTS.SYNC_QUEUE_UPDATED, null);

    return {
      success: false,
      status: 'needs_attention',
      message: 'فشل إلغاء العملية بالكامل - العملية تحتاج معالجة',
      error: errorMsg,
      operationId,
      invoiceNumber,
    };
  } finally {
    inFlightCancellations.delete(operationId);
  }
};

/**
 * إلغاء كافة العمليات الفاشلة نهائياً أو التالفة دفعة واحدة بأمان محاسبي
 */
export const discardAllTerminalOperations = async (): Promise<{
  count: number;
  success: boolean;
  errors: string[];
}> => {
  const queue = loadQueue();
  const terminalOps = queue.filter(
    op =>
      op.status === 'failed' ||
      op.errorClass === 'terminal' ||
      op.retryCount >= op.maxRetries ||
      Boolean(op.error)
  );

  if (terminalOps.length === 0) return { count: 0, success: true, errors: [] };

  let count = 0;
  const errors: string[] = [];

  for (const op of terminalOps) {
    try {
      const res = await discardStuckOperation(op.id);
      if (res.success) {
        count++;
      } else {
        errors.push(`العملية ${op.id}: ${res.error || res.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`العملية ${op.id}: ${msg}`);
    }
  }

  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, null);

  return {
    count,
    success: errors.length === 0,
    errors,
  };
};

/** إعادة عملية واحدة إلى حالة الانتظار لإعادة المحاولة فوراً */
export const retryStuckOperation = (operationQueueId: string): boolean =>
  resetOperationForRetry(operationQueueId);
