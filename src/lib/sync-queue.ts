/**
 * Sync Queue - FlowPOS Pro
 * ========================
 * نظام طابور التزامن الذكي للعمل offline-first
 * يحفظ العمليات محلياً أولاً ثم يرفعها للسحابة
 */

import { secureSet, secureGet, secureRemove } from './secure-storage';
import { emitEvent, EVENTS } from './events';
import { addToHistory, updateHistoryStatus } from './sync-history';
import { isGuestDemoMode } from './demo-data';
import { isOperationCancelled } from './cancellation-registry';

// Storage key
const SYNC_QUEUE_KEY = 'sync_queue';
const SYNC_QUEUE_NAMESPACE = 'hp_sync';

// ============= Types =============

export type OperationType = 
  | 'sale' 
  | 'expense' 
  | 'debt' 
  | 'debt_payment'
  | 'debt_sale_bundle' // Atomic debt sale operation (invoice + debt + stock + customer)
  | 'stock_update' 
  | 'customer_update'
  | 'customer_create'
  | 'expense_atomic'
  | 'customer_delete'
  | 'invoice_create'
  | 'profit_record'
  | 'profit_reverse'
  | 'shift_open'
  | 'shift_close'
  | 'shift_transaction'
  | 'debt_writeoff'
  | 'quick_purchase'    // Quick single-item purchase (bakery mode)
  | 'purchase_invoice'  // Full purchase invoice with items
  | 'invoice_refund'    // Offline invoice refund (restores stock + reverses profit)
  | 'invoice_refund_partial' // Offline partial invoice refund
  | 'store_settings_update' // Offline store & print settings update
  | 'recurring_expense_create'
  | 'recurring_expense_update'
  | 'recurring_expense_delete';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  timestamp: string;
  data: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  errorClass?: 'retryable' | 'terminal';
  createdAt: string;
  lastAttempt?: string;
}

/**
 * استخراج رسالة الخطأ الحقيقية من Supabase / PostgREST بدقة
 * يمنع تحويل أخطاء الخادم إلى 'Unknown error'
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return 'خطأ غير محدد';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    return error.message || 'خطأ غير معروف في المعالجة';
  }
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const code = err.code ? `[كود: ${err.code}] ` : '';
    const message = (err.message || err.error || err.error_description || '') as string;
    const details = err.details ? ` (${err.details})` : '';
    const hint = err.hint ? ` [تلميح: ${err.hint}]` : '';
    const combined = `${code}${message}${details}${hint}`.trim();
    if (combined) return combined;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const isTerminalSyncError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return [
    'insufficient stock',
    'product not found',
    'invalid item',
    'invalid sale item',
    'invalid stock quantity',
    'invalid item quantity',
    'invalid operation id',
    'invalid payment type',
    'invalid financial',
    'sale items are required',
    'warehouse not found',
    'missing sale operation id',
    'missing invoice item',
  ].some(fragment => normalized.includes(fragment));
};


export interface SyncQueueStatus {
  pendingCount: number;
  failedCount: number;
  processingCount: number;
  isProcessing: boolean;
  lastSyncTime?: string;
}

// ============= State =============

let isProcessing = false;
let lastSyncTime: string | null = null;

// ============= Core Functions =============

/**
 * تحميل الطابور من التخزين الآمن
 */
export const mergePendingQueue = () => {
  const queue = loadQueue();
  let merged = false;
  const keysToDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('hyperpos_sync_pending_')) {
      merged = true;
      keysToDelete.push(key);
    }
  }
  if (merged) {
    saveQueue(queue);
    keysToDelete.forEach(k => {
      const id = k.replace('hyperpos_sync_pending_', '');
      if (queue.find(x => x.id === id)) localStorage.removeItem(k);
    });
  }
};

export const loadQueue = (): QueuedOperation[] => {
    try {
      const queue = secureGet<QueuedOperation[]>(SYNC_QUEUE_KEY, { namespace: SYNC_QUEUE_NAMESPACE }) || [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('hyperpos_sync_pending_')) {
          try {
            const op = JSON.parse(localStorage.getItem(key) || 'null');
            if (op && !queue.find(x => x.id === op.id)) queue.push(op);
          } catch {}
        }
      }
      if (!queue.length) return [];
    const staleBefore = Date.now() - 5 * 60 * 1000;
    let recovered = false;
    const normalized = queue.map(operation => {
      const lastAttempt = operation.lastAttempt ? Date.parse(operation.lastAttempt) : 0;
      if (operation.status === 'processing' && (!lastAttempt || lastAttempt < staleBefore)) {
        recovered = true;
        return { ...operation, status: 'pending' as const, error: undefined };
      }
      return operation;
    });
    if (recovered) secureSet(SYNC_QUEUE_KEY, normalized, { namespace: SYNC_QUEUE_NAMESPACE });
    return normalized;
  } catch (error) {
    console.error('Error loading sync queue:', error);
    return [];
  }
};

/**
 * حفظ الطابور في التخزين الآمن
 */
const saveQueue = (queue: QueuedOperation[]): void => {
  try {
    secureSet(SYNC_QUEUE_KEY, queue, { namespace: SYNC_QUEUE_NAMESPACE });
    emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  } catch (error) {
    console.error('Error saving sync queue:', error);
  }
};

/**
 * إضافة عملية للطابور
 */
export const addToQueue = (
  type: OperationType,
  data: Record<string, unknown>,
  maxRetries: number = 3
): QueuedOperation => {
  const candidateOpKey = String(data.uniqueKey || data.operationId || data.localId || '');
  const candidateInvoiceNum = (data.bundle as any)?.invoiceNumber || data.invoiceNumber;
  if ((candidateOpKey && isOperationCancelled(candidateOpKey)) || (candidateInvoiceNum && isOperationCancelled(String(candidateInvoiceNum)))) {
    console.warn('[SyncQueue] Blocked adding cancelled operation to queue:', candidateOpKey || candidateInvoiceNum);
    return {
      id: `blocked_cancelled_${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      data,
      retryCount: 0,
      maxRetries,
      status: 'failed',
      error: 'العملية مسجلة كملغاة مسبقاً',
      createdAt: new Date().toISOString(),
    };
  }

  if (isGuestDemoMode()) {
    return {
      id: `demo_op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      data,
      retryCount: 0,
      maxRetries,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
  }

  const queue = loadQueue();
  
  const operation: QueuedOperation = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `op_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    timestamp: new Date().toISOString(),
    data,
    retryCount: 0,
    maxRetries,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  localStorage.setItem('hyperpos_sync_pending_' + operation.id, JSON.stringify(operation));
    setTimeout(mergePendingQueue, 0);
  
  // Track in history for UI display
  addToHistory(operation.id, type, undefined, operation.data as any);
  
  console.log(`[SyncQueue] Added operation: ${type}`, operation.id);

  return operation;
};

/** Add a business operation once, using its stable server idempotency key. */
export const addUniqueOperation = (
  type: OperationType,
  data: Record<string, unknown>,
  uniqueKey: string,
  maxRetries: number = 10,
): QueuedOperation => {
  const existing = addToQueueIfNotExists(type, data, uniqueKey, maxRetries);
  if (existing) return existing;
  return addToQueue(type, { ...data, uniqueKey }, maxRetries);
};

/**
 * إضافة أو دمج عملية تحديث إعدادات المتجر في الطابور
 * إذا كانت هناك عملية سابقة معلقة، يتم دمج البيانات بها لتجنب التكرار وضمان شمول التحديث
 */
export const enqueueStoreSettingsUpdate = (
  data: Record<string, unknown>,
  maxRetries: number = 5
): QueuedOperation => {
  const queue = loadQueue();
  const existingIndex = queue.findIndex(
    op => op.type === 'store_settings_update' && (op.status === 'pending' || op.status === 'failed')
  );

  if (existingIndex !== -1) {
    const existingOp = queue[existingIndex];
    const prevSync = (existingOp.data.sync_settings as Record<string, unknown>) || {};
    const newSync = (data.sync_settings as Record<string, unknown>) || {};
    existingOp.data = {
      ...existingOp.data,
      ...data,
      sync_settings: {
        ...prevSync,
        ...newSync,
      },
    };
    existingOp.status = 'pending';
    existingOp.timestamp = new Date().toISOString();
    saveQueue(queue);
    try {
      localStorage.setItem('hyperpos_sync_pending_' + existingOp.id, JSON.stringify(existingOp));
    } catch {
      // ignore
    }
    console.log('[SyncQueue] Merged store_settings_update into existing queued operation:', existingOp.id);
    return existingOp;
  }

  return addToQueue('store_settings_update', data, maxRetries);
};


/**
 * تحديث حالة عملية
 */
export const updateOperationStatus = (
  operationId: string,
  status: QueuedOperation['status'],
  error?: string
): void => {
  const queue = loadQueue();
  const index = queue.findIndex(op => op.id === operationId);
  
  if (index !== -1) {
    queue[index].status = status;
    queue[index].lastAttempt = new Date().toISOString();
    
    if (error) {
      queue[index].error = error;
    }
    
    if (status === 'failed') {
      queue[index].retryCount += 1;
    }
    
    saveQueue(queue);
  }
};

/**
 * حذف عملية من الطابور
 */
export const removeFromQueue = (operationId: string): void => {
  const queue = loadQueue();
  const filtered = queue.filter(op => op.id !== operationId);
  saveQueue(filtered);
};

/** إعادة عملية واحدة لحالة الانتظار حتى تُعاد محاولتها فوراً ووضعها في بداية الطابور */
export const resetOperationForRetry = (operationId: string): boolean => {
  const queue = loadQueue();
  const index = queue.findIndex(op => op.id === operationId);
  if (index === -1) return false;
  const opCandidate = queue[index];
  const retryOpKey = String(opCandidate.data.uniqueKey || opCandidate.data.operationId || opCandidate.data.localId || opCandidate.id);
  const retryInvNum = (opCandidate.data?.bundle as any)?.invoiceNumber || opCandidate.data?.invoiceNumber;
  if (isOperationCancelled(retryOpKey) || (retryInvNum && isOperationCancelled(String(retryInvNum)))) {
    console.warn('[SyncQueue] Cannot retry cancelled operation:', operationId);
    return false;
  }

  const [op] = queue.splice(index, 1);
  op.status = 'pending';
  op.retryCount = 0;
  op.error = undefined;
  op.errorClass = undefined;
  // أولوية: وضع العملية في مقدمة الطابور لتتم معالجتها أولاً
  queue.unshift(op);
  saveQueue(queue);
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  return true;
};


/**
 * الحصول على العمليات المعلقة
 */
export const getPendingOperations = (): QueuedOperation[] => {
  const queue = loadQueue();
  return queue.filter(op => 
    op.status === 'pending' || 
    (op.status === 'failed' && op.retryCount < op.maxRetries)
  );
};

/**
 * الحصول على العمليات الفاشلة
 */
export const getFailedOperations = (): QueuedOperation[] => {
  const queue = loadQueue();
  return queue.filter(op => 
    op.status === 'failed' && op.retryCount >= op.maxRetries
  );
};

/**
 * الحصول على حالة الطابور
 */
export const getQueueStatus = (): SyncQueueStatus => {
  const queue = loadQueue();
  
  return {
    pendingCount: queue.filter(op => op.status === 'pending').length,
    failedCount: queue.filter(op => op.status === 'failed' && op.retryCount >= op.maxRetries).length,
    processingCount: queue.filter(op => op.status === 'processing').length,
    isProcessing,
    lastSyncTime: lastSyncTime || undefined,
  };
};

/**
 * معالجة الطابور
 * يتم استدعاؤها عند عودة الإنترنت أو عند طلب المزامنة يدوياً
 */
export const processQueue = async (
  processor: (operation: QueuedOperation) => Promise<boolean>,
  targetOperationId?: string,
): Promise<{ processed: number; failed: number; targetSuccess?: boolean }> => {
  if (isGuestDemoMode()) {
    return { processed: 0, failed: 0 };
  }

  if (isProcessing) {
    console.log('[SyncQueue] Already processing, skipping...');
    return { processed: 0, failed: 0 };
  }
  
  isProcessing = true;
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  
  let processed = 0;
  let failed = 0;
  let targetSuccess: boolean | undefined = undefined;
  
  try {
    let pending = getPendingOperations();
    if (targetOperationId) {
      // إعطاء الأولوية للعملية المستهدفة ليتم رفعها أولاً فوراً
      const targetOp = pending.find(op => op.id === targetOperationId);
      if (targetOp) {
        pending = [targetOp, ...pending.filter(op => op.id !== targetOperationId)];
      }
    }
    console.log(`[SyncQueue] Processing ${pending.length} operations...`);
    
    for (const operation of pending) {
      const opKey = String(operation.data.uniqueKey || operation.data.operationId || operation.data.localId || operation.id);
      const bInv = (operation.data?.bundle as any)?.invoiceNumber || operation.data?.invoiceNumber;
      if (isOperationCancelled(opKey) || (bInv && isOperationCancelled(String(bInv)))) {
        console.warn(`[SyncQueue] Skipping upload for cancelled operation: ${operation.id} (${opKey})`);
        removeFromQueue(operation.id);
        try { localStorage.removeItem('hyperpos_sync_pending_' + operation.id); } catch {}
        updateHistoryStatus(operation.id, 'failed', 'تم إلغاء العملية محلياً ومنع رفعها للسحابة');
        continue;
      }

      updateOperationStatus(operation.id, 'processing');
      updateHistoryStatus(operation.id, 'syncing');
      
      try {
        const success = await processor(operation);
        
        if (success) {
          removeFromQueue(operation.id);
          updateHistoryStatus(operation.id, 'synced');
          processed++;
          if (operation.id === targetOperationId) {
            targetSuccess = true;
          }
          console.log(`[SyncQueue] Processed: ${operation.id}`);
        } else {
          updateOperationStatus(operation.id, 'failed', 'Processing returned false');
          updateHistoryStatus(operation.id, 'failed', 'Processing returned false');
          failed++;
          if (operation.id === targetOperationId) {
            targetSuccess = false;
          }
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        const terminal = isTerminalSyncError(errorMessage);
        if (terminal) {
          const queue = loadQueue();
          const index = queue.findIndex(item => item.id === operation.id);
          if (index !== -1) {
            queue[index].status = 'failed';
            queue[index].retryCount = queue[index].maxRetries;
            queue[index].error = errorMessage;
            queue[index].errorClass = 'terminal';
            queue[index].lastAttempt = new Date().toISOString();
            saveQueue(queue);
          }
          const uniqueKey = String(operation.data.uniqueKey || operation.data.operationId || operation.data.localId || '');
          if (uniqueKey && (operation.type === 'invoice_create' || operation.type === 'debt_sale_bundle')) {
            const { rollbackPendingStockDeduction } = await import('./cloud/products-cloud');
            await rollbackPendingStockDeduction(uniqueKey);
          }
        } else {
          updateOperationStatus(operation.id, 'failed', errorMessage);
        }
        updateHistoryStatus(operation.id, 'failed', errorMessage);
        failed++;
        if (operation.id === targetOperationId) {
          targetSuccess = false;
        }
        console.error(`[SyncQueue] Failed operation ${operation.id} (${operation.type}):`, errorMessage);
      }
    }
    
    lastSyncTime = new Date().toISOString();
    
  } finally {
    isProcessing = false;
    emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  }
  
  return { processed, failed, targetSuccess };
};

/**
 * إعادة تنشيط كافة العمليات الفاشلة والمتعثرة لتجهيزها للمزامنة الجماعية
 */
export const retryFailedOperations = (): number => {
  const queue = loadQueue();
  let revivedCount = 0;

  queue.forEach(op => {
    if (op.status === 'failed' || op.retryCount >= op.maxRetries) {
      op.status = 'pending';
      op.retryCount = 0;
      op.error = undefined;
      op.errorClass = undefined;
      revivedCount++;
    }
  });

  if (revivedCount > 0) {
    saveQueue(queue);
    emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  }

  return revivedCount;
};

/**
 * مسح الطابور
 */
export const clearQueue = (): void => {
  secureRemove(SYNC_QUEUE_KEY, { namespace: SYNC_QUEUE_NAMESPACE });
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
};

/**
 * مسح العمليات المكتملة فقط
 */
export const clearCompletedOperations = (): void => {
  const queue = loadQueue();
  const filtered = queue.filter(op => op.status !== 'completed');
  saveQueue(filtered);
};

/**
 * التحقق من وجود عمليات معلقة لنوع معين
 */
export const hasPendingOperations = (type?: OperationType): boolean => {
  const pending = getPendingOperations();
  if (type) {
    return pending.some(op => op.type === type);
  }
  return pending.length > 0;
};

/**
 * الحصول على عمليات بحسب التوقيع الزمني
 * يمنع التكرار عند إعادة التزامن
 */
export const getOperationByTimestamp = (timestamp: string): QueuedOperation | undefined => {
  const queue = loadQueue();
  return queue.find(op => op.timestamp === timestamp);
};

/**
 * إضافة عملية مع منع التكرار
 */
export const addToQueueIfNotExists = (
  type: OperationType,
  data: Record<string, unknown>,
  uniqueKey: string,
  maxRetries: number = 3,
): QueuedOperation | null => {
  const queue = loadQueue();
  
  // التحقق من عدم وجود عملية مشابهة
  const exists = queue.some(op => 
    op.type === type && 
    op.data.uniqueKey === uniqueKey &&
    (op.status === 'pending' || op.status === 'processing' ||
      (op.status === 'failed' && op.retryCount < op.maxRetries))
  );
  
  if (exists) {
    console.log(`[SyncQueue] Operation already exists: ${type} - ${uniqueKey}`);
    return queue.find(op => op.type === type && op.data.uniqueKey === uniqueKey) || null;
  }
  
  return addToQueue(type, { ...data, uniqueKey }, maxRetries);
};






