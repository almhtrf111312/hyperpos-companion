/**
 * Transaction Lock - FlowPOS Pro
 * ==============================
 * نظام الأقفال لمنع تداخل العمليات المتزامنة
 * يضمن دقة الأرقام 100% عند التحديث السريع أو العمليات الخلفية
 */

// ============= Types =============

interface Lock {
  id: string;
  acquiredAt: number;
  timeout: number;
  resource: string;
}

interface LockResult {
  acquired: boolean;
  lockId?: string;
  error?: string;
}

// ============= State =============

const activeLocks: Map<string, Lock> = new Map();
const lockQueue: Map<string, Array<() => void>> = new Map();

// Default timeout: 10 seconds
const DEFAULT_TIMEOUT = 10000;

// ============= Core Functions =============

/**
 * محاولة الحصول على قفل لمورد معين
 */
export const acquireLock = async (
  resource: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<LockResult> => {
  const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // التحقق من وجود قفل نشط
  const existingLock = activeLocks.get(resource);
  
  if (existingLock) {
    // التحقق من انتهاء صلاحية القفل
    const now = Date.now();
    if (now - existingLock.acquiredAt > existingLock.timeout) {
      // القفل منتهي الصلاحية، حذفه
      activeLocks.delete(resource);
      console.log(`[Lock] Expired lock released: ${existingLock.id}`);
    } else {
      // انتظار تحرر القفل
      return new Promise((resolve) => {
        // إضافة للطابور
        if (!lockQueue.has(resource)) {
          lockQueue.set(resource, []);
        }
        
        const timeoutId = setTimeout(() => {
          // انتهت مهلة الانتظار
          const queue = lockQueue.get(resource);
          if (queue) {
            const index = queue.indexOf(resolveWait);
            if (index > -1) {
              queue.splice(index, 1);
            }
          }
          resolve({
            acquired: false,
            error: `Lock timeout: resource "${resource}" is busy`,
          });
        }, timeout);
        
        const resolveWait = () => {
          clearTimeout(timeoutId);
          // محاولة الحصول على القفل مرة أخرى
          const lock: Lock = {
            id: lockId,
            acquiredAt: Date.now(),
            timeout,
            resource,
          };
          activeLocks.set(resource, lock);
          resolve({ acquired: true, lockId });
        };
        
        lockQueue.get(resource)!.push(resolveWait);
      });
    }
  }
  
  // إنشاء قفل جديد
  const lock: Lock = {
    id: lockId,
    acquiredAt: Date.now(),
    timeout,
    resource,
  };
  
  activeLocks.set(resource, lock);
  console.log(`[Lock] Acquired: ${lockId} for ${resource}`);
  
  return { acquired: true, lockId };
};

/**
 * تحرير قفل
 */
export const releaseLock = (lockId: string): boolean => {
  // البحث عن القفل وحذفه
  for (const [resource, lock] of activeLocks.entries()) {
    if (lock.id === lockId) {
      activeLocks.delete(resource);
      console.log(`[Lock] Released: ${lockId}`);
      
      // تنفيذ العملية التالية في الطابور
      const queue = lockQueue.get(resource);
      if (queue && queue.length > 0) {
        const next = queue.shift();
        if (next) {
          // تأخير صغير لضمان تحرر القفل
          setTimeout(next, 0);
        }
      }
      
      return true;
    }
  }
  
  console.warn(`[Lock] Lock not found: ${lockId}`);
  return false;
};

/**
 * التحقق من وجود قفل على مورد
 */
export const isLocked = (resource: string): boolean => {
  const lock = activeLocks.get(resource);
  if (!lock) return false;
  
  // التحقق من انتهاء الصلاحية
  if (Date.now() - lock.acquiredAt > lock.timeout) {
    activeLocks.delete(resource);
    return false;
  }
  
  return true;
};

/**
 * تنفيذ عملية مع قفل تلقائي
 * يضمن تحرير القفل حتى في حالة حدوث خطأ
 */
export const withLock = async <T>(
  resource: string,
  operation: () => Promise<T>,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{ success: boolean; result?: T; error?: string }> => {
  const lockResult = await acquireLock(resource, timeout);
  
  if (!lockResult.acquired) {
    return {
      success: false,
      error: lockResult.error || 'Failed to acquire lock',
    };
  }
  
  try {
    const result = await operation();
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (lockResult.lockId) {
      releaseLock(lockResult.lockId);
    }
  }
};

/**
 * تنفيذ عملية متزامنة مع قفل
 */
export const withLockSync = <T>(
  resource: string,
  operation: () => T
): { success: boolean; result?: T; error?: string } => {
  // للعمليات المتزامنة، نتحقق فقط من القفل
  if (isLocked(resource)) {
    return {
      success: false,
      error: `Resource "${resource}" is locked`,
    };
  }
  
  const lockId = `sync_${Date.now()}`;
  const lock: Lock = {
    id: lockId,
    acquiredAt: Date.now(),
    timeout: 5000, // 5 seconds for sync operations
    resource,
  };
  
  activeLocks.set(resource, lock);
  
  try {
    const result = operation();
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    activeLocks.delete(resource);
    
    // تنفيذ الطابور إن وجد
    const queue = lockQueue.get(resource);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      if (next) setTimeout(next, 0);
    }
  }
};

// ============= Resource Constants =============

export const LOCK_RESOURCES = {
  CASHBOX: 'cashbox',
  INVENTORY: 'inventory',
  SALE_PROCESSING: 'sale_processing',
  EXPENSE_PROCESSING: 'expense_processing',
  DEBT_PROCESSING: 'debt_processing',
  STOCK_UPDATE: 'stock_update',
  PROFIT_RECORD: 'profit_record',
} as const;

/**
 * مسح جميع الأقفال (للتنظيف)
 */
export const clearAllLocks = (): void => {
  activeLocks.clear();
  lockQueue.clear();
  console.log('[Lock] All locks cleared');
};

/**
 * الحصول على حالة الأقفال النشطة (للتصحيح)
 */
export const getActiveLocks = (): Array<{ resource: string; lockId: string; age: number }> => {
  const now = Date.now();
  return Array.from(activeLocks.entries()).map(([resource, lock]) => ({
    resource,
    lockId: lock.id,
    age: now - lock.acquiredAt,
  }));
};
