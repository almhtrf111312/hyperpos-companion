/**
 * Sync Queue - FlowPOS Pro
 * ========================
 * نظام طابور التزامن الذكي للعمل offline-first
 * يحفظ العمليات محلياً أولاً ثم يرفعها للسحابة
 */

import { secureSet, secureGet, secureRemove } from './secure-storage';
import { emitEvent, EVENTS } from './events';

// Storage key
const SYNC_QUEUE_KEY = 'sync_queue';
const SYNC_QUEUE_NAMESPACE = 'hp_sync';

// ============= Types =============

export type OperationType = 
  | 'sale' 
  | 'expense' 
  | 'debt' 
  | 'debt_payment'
  | 'stock_update' 
  | 'customer_update'
  | 'invoice_create'
  | 'profit_record';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  timestamp: string;
  data: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  createdAt: string;
  lastAttempt?: string;
}

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
export const loadQueue = (): QueuedOperation[] => {
  try {
    const queue = secureGet<QueuedOperation[]>(SYNC_QUEUE_KEY, { namespace: SYNC_QUEUE_NAMESPACE });
    return queue || [];
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
  const queue = loadQueue();
  
  const operation: QueuedOperation = {
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    data,
    retryCount: 0,
    maxRetries,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  queue.push(operation);
  saveQueue(queue);
  
  console.log(`[SyncQueue] Added operation: ${type}`, operation.id);
  
  return operation;
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
 * يتم استدعاؤها عند عودة الإنترنت
 */
export const processQueue = async (
  processor: (operation: QueuedOperation) => Promise<boolean>
): Promise<{ processed: number; failed: number }> => {
  if (isProcessing) {
    console.log('[SyncQueue] Already processing, skipping...');
    return { processed: 0, failed: 0 };
  }
  
  isProcessing = true;
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  
  let processed = 0;
  let failed = 0;
  
  try {
    const pending = getPendingOperations();
    console.log(`[SyncQueue] Processing ${pending.length} operations...`);
    
    for (const operation of pending) {
      updateOperationStatus(operation.id, 'processing');
      
      try {
        const success = await processor(operation);
        
        if (success) {
          removeFromQueue(operation.id);
          processed++;
          console.log(`[SyncQueue] Processed: ${operation.id}`);
        } else {
          updateOperationStatus(operation.id, 'failed', 'Processing returned false');
          failed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updateOperationStatus(operation.id, 'failed', errorMessage);
        failed++;
        console.error(`[SyncQueue] Failed: ${operation.id}`, error);
      }
    }
    
    lastSyncTime = new Date().toISOString();
    
  } finally {
    isProcessing = false;
    emitEvent(EVENTS.SYNC_QUEUE_UPDATED, getQueueStatus());
  }
  
  return { processed, failed };
};

/**
 * إعادة محاولة العمليات الفاشلة
 */
export const retryFailedOperations = (): void => {
  const queue = loadQueue();
  
  queue.forEach(op => {
    if (op.status === 'failed') {
      op.status = 'pending';
      op.retryCount = 0;
      op.error = undefined;
    }
  });
  
  saveQueue(queue);
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
  uniqueKey: string
): QueuedOperation | null => {
  const queue = loadQueue();
  
  // التحقق من عدم وجود عملية مشابهة
  const exists = queue.some(op => 
    op.type === type && 
    op.data.uniqueKey === uniqueKey &&
    (op.status === 'pending' || op.status === 'processing')
  );
  
  if (exists) {
    console.log(`[SyncQueue] Operation already exists: ${type} - ${uniqueKey}`);
    return null;
  }
  
  return addToQueue(type, { ...data, uniqueKey });
};
