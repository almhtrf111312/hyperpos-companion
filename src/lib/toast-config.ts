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

export const showToast = {
  success: (message: string, description?: string) => {
    const key = getThrottleKey('success', message);
    if (!shouldShowToast(key)) return;
    
    showSmartToast({
      title: message,
      subtitle: description,
      type: 'success',
      time: 'الآن',
    });
  },
    
  error: (message: string, options?: { description?: string; persistent?: boolean }) => {
    const key = getThrottleKey('error', message);
    if (!shouldShowToast(key)) return;
    
    showSmartToast({
      title: message,
      subtitle: options?.description,
      type: 'error',
      time: 'الآن',
      duration: options?.persistent ? 10000 : 5000,
    });
  },
    
  warning: (message: string, description?: string) => {
    const key = getThrottleKey('warning', message);
    if (!shouldShowToast(key)) return;
    
    showSmartToast({
      title: message,
      subtitle: description,
      type: 'warning',
      time: 'الآن',
    });
  },
    
  info: (message: string, description?: string) => {
    const key = getThrottleKey('info', message);
    if (!shouldShowToast(key)) return;
    
    showSmartToast({
      title: message,
      subtitle: description,
      type: 'info',
      time: 'الآن',
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
      showToast.success(message, typeof data?.description === 'string' ? data.description : undefined);
    }
    return origSuccess(message, data);
  }) as typeof toast.success;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.error = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.error(message, { description: typeof data?.description === 'string' ? data.description : undefined });
    }
    return origError(message, data);
  }) as typeof toast.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.warning = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.warning(message, typeof data?.description === 'string' ? data.description : undefined);
    }
    return origWarning(message, data);
  }) as typeof toast.warning;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast.info = ((message: any, data?: any) => {
    if (typeof message === 'string') {
      showToast.info(message, typeof data?.description === 'string' ? data.description : undefined);
    }
    return origInfo(message, data);
  }) as typeof toast.info;
}
