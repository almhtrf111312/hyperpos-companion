import { toast } from 'sonner';
import { showSmartToast } from '@/hooks/use-smart-toast';

/**
 * Unified toast notification utility linked to Smart Dynamic Island Notifications
 * 
 * ✅ Includes throttling to prevent repeated notifications
 * ✅ Automatically displays the new Smart Dynamic Island UI for all app actions
 */

// Throttle map to prevent repeated notifications
const lastToastTime: Map<string, number> = new Map();
const THROTTLE_MS = 1500; // 1.5 seconds throttle per unique message

// Additional map to track very recent identical messages (aggressive throttling)
const recentMessages: Map<string, number> = new Map();
const AGGRESSIVE_THROTTLE_MS = 400; // Block identical messages within 400ms

// Generate a key for throttling based on message content
const getThrottleKey = (type: string, message: string): string => {
  return `${type}:${message}`;
};

// Check if we should show the toast (throttle check)
const shouldShowToast = (key: string): boolean => {
  const now = Date.now();
  
  // ✅ Aggressive throttling - block if same message appeared very recently
  const recentTime = recentMessages.get(key);
  if (recentTime && now - recentTime < AGGRESSIVE_THROTTLE_MS) {
    return false; // Blocked by aggressive throttle
  }
  
  // ✅ Normal throttling
  const lastTime = lastToastTime.get(key);
  if (lastTime && now - lastTime < THROTTLE_MS) {
    return false; // Blocked by normal throttle
  }
  
  lastToastTime.set(key, now);
  recentMessages.set(key, now);
  return true;
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  
  for (const [key, time] of lastToastTime.entries()) {
    if (now - time > THROTTLE_MS * 2) {
      lastToastTime.delete(key);
    }
  }
  
  for (const [key, time] of recentMessages.entries()) {
    if (now - time > AGGRESSIVE_THROTTLE_MS * 2) {
      recentMessages.delete(key);
    }
  }
}, 30000);

export interface ToastOptions {
  description?: string;
  persistent?: boolean;
  operation?: string;
  itemName?: string;
  itemCount?: number;
  isMultiple?: boolean;
  price?: string | number;
  currency?: string;
  stockQuantity?: number;
  statusBadge?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

function parseToastArgs(optionsOrDesc?: string | ToastOptions) {
  if (!optionsOrDesc) return {};
  if (typeof optionsOrDesc === 'string') {
    return { subtitle: optionsOrDesc };
  }
  return {
    subtitle: optionsOrDesc.description,
    operation: optionsOrDesc.operation,
    itemName: optionsOrDesc.itemName,
    itemCount: optionsOrDesc.itemCount,
    isMultiple: optionsOrDesc.isMultiple,
    price: optionsOrDesc.price,
    currency: optionsOrDesc.currency,
    stockQuantity: optionsOrDesc.stockQuantity,
    statusBadge: optionsOrDesc.statusBadge,
    primaryAction: optionsOrDesc.primaryAction,
    duration: optionsOrDesc.duration,
  };
}

export const showToast = {
  success: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('success', message);
    if (!shouldShowToast(key)) return;
    
    const parsed = parseToastArgs(optionsOrDesc);
    showSmartToast({
      title: message,
      type: 'success',
      time: 'الآن',
      ...parsed,
    });
  },
    
  error: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('error', message);
    if (!shouldShowToast(key)) return;
    
    const parsed = parseToastArgs(optionsOrDesc);
    const persistent = typeof optionsOrDesc === 'object' && optionsOrDesc?.persistent;
    showSmartToast({
      title: message,
      type: 'error',
      time: 'الآن',
      duration: parsed.duration || (persistent ? 10000 : 5000),
      ...parsed,
    });
  },
    
  warning: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('warning', message);
    if (!shouldShowToast(key)) return;
    
    const parsed = parseToastArgs(optionsOrDesc);
    showSmartToast({
      title: message,
      type: 'warning',
      time: 'الآن',
      ...parsed,
    });
  },
    
  info: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('info', message);
    if (!shouldShowToast(key)) return;
    
    const parsed = parseToastArgs(optionsOrDesc);
    showSmartToast({
      title: message,
      type: 'info',
      time: 'الآن',
      ...parsed,
    });
  },
};

// Global interceptor for any direct toast.* calls throughout the codebase
if (typeof window !== 'undefined' && !(window as unknown as { __smart_toast_intercepted?: boolean }).__smart_toast_intercepted) {
  (window as unknown as { __smart_toast_intercepted?: boolean }).__smart_toast_intercepted = true;

  const origSuccess = toast.success;
  const origError = toast.error;
  const origWarning = toast.warning;
  const origInfo = toast.info;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.success = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.success(message, typeof data === 'object' ? data : undefined);
    }
    return origSuccess(message, data);
  }) as typeof toast.success;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.error = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.error(message, typeof data === 'object' ? data : undefined);
    }
    return origError(message, data);
  }) as typeof toast.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.warning = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.warning(message, typeof data === 'object' ? data : undefined);
    }
    return origWarning(message, data);
  }) as typeof toast.warning;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.info = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.info(message, typeof data === 'object' ? data : undefined);
    }
    return origInfo(message, data);
  }) as typeof toast.info;
}
