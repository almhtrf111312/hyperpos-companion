/**
 * Sync Recovery - FlowPOS Pro
 * ===========================
 * إنقاذ العمليات العالقة في طابور المزامنة:
 * - عرض سبب الفشل الحقيقي
 * - استرداد الفاتورة وإرجاع أصنافها إلى سلة نقطة البيع
 * - حذف العملية نهائياً مع إرجاع المخزون المخصوم محلياً
 */

import { loadQueue, removeFromQueue, resetOperationForRetry, QueuedOperation } from './sync-queue';
import { emitEvent, EVENTS } from './events';
import { updateHistoryStatus } from './sync-history';

export const CART_STORAGE_KEY = 'hyperpos_temp_cart';
export const CART_RECOVERED_EVENT = 'posCartRecovered';

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
  canRestoreToCart: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  invoice_create: 'فاتورة نقدية',
  debt_sale_bundle: 'فاتورة دين',
  invoice_refund: 'استرداد فاتورة',
  quick_purchase: 'شراء سريع',
  purchase_invoice: 'فاتورة شراء',
  expense: 'مصروف',
  debt_payment: 'سداد دين',
  profit_record: 'تسجيل ربح',
  shift_open: 'فتح وردية',
  shift_close: 'إغلاق وردية',
  shift_transaction: 'حركة وردية',
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
        canRestoreToCart: op.type === 'invoice_create' || op.type === 'debt_sale_bundle',
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

const bundleToCartItems = (bundle: SaleBundle) => {
  const items = Array.isArray(bundle.items) ? bundle.items : [];
  return items.map(raw => {
    const item = raw as Record<string, unknown>;
    return {
      id: String(item.id ?? ''),
      name: String(item.name ?? 'منتج'),
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 1),
      category: item.category ? String(item.category) : undefined,
      unit: (item.unit === 'bulk' ? 'bulk' : 'piece') as 'piece' | 'bulk',
      conversionFactor: item.conversionFactor ? Number(item.conversionFactor) : undefined,
      costPrice: item.costPrice !== undefined ? Number(item.costPrice) : undefined,
    };
  }).filter(item => item.id && item.quantity > 0);
};

export interface RecoveryResult {
  success: boolean;
  itemsCount: number;
  customerName?: string;
  message: string;
}

/**
 * استرداد العملية العالقة وإعادة أصنافها إلى سلة نقطة البيع
 */
export const recoverOperationToCart = async (operationQueueId: string): Promise<RecoveryResult> => {
  const operation = loadQueue().find(op => op.id === operationQueueId);
  if (!operation) return { success: false, itemsCount: 0, message: 'العملية غير موجودة' };

  const bundle = getBundle(operation);
  const cartItems = bundle ? bundleToCartItems(bundle) : [];

  if (cartItems.length === 0) {
    return { success: false, itemsCount: 0, message: 'لا توجد أصناف قابلة للإرجاع في هذه العملية' };
  }

  await restoreLocalStock(operation);
  removeFromQueue(operation.id);
  updateHistoryStatus(operation.id, 'failed', 'تم استرداد العملية يدوياً');

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch (error) {
    console.error('[SyncRecovery] Failed to stage recovered cart:', error);
  }

  emitEvent(CART_RECOVERED_EVENT, cartItems);
  emitEvent(EVENTS.INVOICES_UPDATED, null);

  return {
    success: true,
    itemsCount: cartItems.length,
    customerName: bundle?.customerName,
    message: `تم استرداد ${cartItems.length} صنف إلى سلة نقطة البيع`,
  };
};

/**
 * حذف العملية العالقة نهائياً مع إرجاع المخزون المخصوم محلياً
 */
export const discardStuckOperation = async (operationQueueId: string): Promise<boolean> => {
  const operation = loadQueue().find(op => op.id === operationQueueId);
  if (!operation) return false;

  await restoreLocalStock(operation);
  removeFromQueue(operation.id);
  updateHistoryStatus(operation.id, 'failed', 'تم حذف العملية يدوياً');
  emitEvent(EVENTS.INVOICES_UPDATED, null);
  return true;
};

/** إعادة عملية واحدة إلى حالة الانتظار لإعادة المحاولة فوراً */
export const retryStuckOperation = (operationQueueId: string): boolean =>
  resetOperationForRetry(operationQueueId);

