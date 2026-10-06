/**
 * Sync Recovery - FlowPOS Pro
 * ===========================
 * إنقاذ العمليات العالقة في طابور المزامنة:
 * - عرض سبب الفشل الحقيقي
 * - إعادة المحاولة أو إلغاء العملية مع إرجاع المخزون المحجوز محلياً
 */

import { loadQueue, removeFromQueue, resetOperationForRetry, QueuedOperation } from './sync-queue';
import { emitEvent, EVENTS } from './events';
import { updateHistoryStatus } from './sync-history';

export interface StuckOperation {
  id: string;
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
  customerName?: string;
  total?: number;
  currency?: string;
  items?: Array<Record<string, unknown>>;
};

const getBundle = (operation: QueuedOperation): SaleBundle | null => {
  const bundle = (operation.data as { bundle?: SaleBundle }).bundle;
  return bundle && typeof bundle === 'object' ? bundle : null;
};

const getOperationId = (operation: QueuedOperation): string =>
  String(operation.data.uniqueKey || operation.data.operationId || operation.data.localId || '');

/** كل العمليات التي لم تُرفع بعد، مرتبة من الأقدم للأحدث */
export const getStuckOperations = (): StuckOperation[] => {
  return loadQueue()
    .filter(op => op.status !== 'completed')
    .map(op => {
      const bundle = getBundle(op);
      return {
        id: op.id,
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
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

/** إرجاع المخزون المخصوم محلياً لهذه العملية (إن وُجد) */
const restoreLocalStock = async (operation: QueuedOperation): Promise<void> => {
  const operationId = getOperationId(operation);
  if (!operationId) return;
  try {
    const { rollbackPendingStockDeduction } = await import('./cloud/products-cloud');
    await rollbackPendingStockDeduction(operationId);
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  } catch (error) {
    console.error('[SyncRecovery] Failed to restore local stock:', error);
  }
};

/**
 * إلغاء العملية العالقة مع إرجاع المخزون المخصوم محلياً
 */
export const discardStuckOperation = async (operationQueueId: string): Promise<boolean> => {
  const operation = loadQueue().find(op => op.id === operationQueueId);
  if (!operation) return false;

  await restoreLocalStock(operation);
  removeFromQueue(operation.id);
  updateHistoryStatus(operation.id, 'failed', 'تم إلغاء العملية غير المكتملة يدوياً');
  emitEvent(EVENTS.INVOICES_UPDATED, null);
  return true;
};

/**
 * إلغاء كافة العمليات الفاشلة نهائياً أو التالفة دفعة واحدة
 * مع إرجاع حجز المخزون المحلي وحذفها من الطابور نهائياً
 */
export const discardAllTerminalOperations = async (): Promise<{ count: number; success: boolean }> => {
  const queue = loadQueue();
  const terminalOps = queue.filter(
    op =>
      op.status === 'failed' ||
      op.errorClass === 'terminal' ||
      op.retryCount >= op.maxRetries ||
      Boolean(op.error)
  );

  if (terminalOps.length === 0) return { count: 0, success: true };

  for (const op of terminalOps) {
    try {
      await restoreLocalStock(op);
      removeFromQueue(op.id);
      updateHistoryStatus(op.id, 'failed', 'تم إلغاء العملية التالفة نهائياً');
    } catch (err) {
      console.warn('[SyncRecovery] Failed to discard terminal op:', op.id, err);
    }
  }

  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, null);
  return { count: terminalOps.length, success: true };
};

/** إعادة عملية واحدة إلى حالة الانتظار لإعادة المحاولة فوراً */
export const retryStuckOperation = (operationQueueId: string): boolean =>
  resetOperationForRetry(operationQueueId);


