import { toast } from 'sonner';

/**
 * Unified toast notification utility with consistent positioning and styling
 * Toasts appear at top-right to avoid overlapping with cart FAB
 * Duration reduced to 1.5s for faster workflow
 * 
 * ✅ Includes throttling to prevent repeated notifications
 */

// Throttle map to prevent repeated notifications
const lastToastTime: Map<string, number> = new Map();
const THROTTLE_MS = 3000; // 3 seconds throttle per unique message

// Additional map to track very recent identical messages (aggressive throttling)
const recentMessages: Map<string, number> = new Map();
const AGGRESSIVE_THROTTLE_MS = 500; // Block identical messages within 500ms

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
  
  // Clean up normal throttle map
  for (const [key, time] of lastToastTime.entries()) {
    if (now - time > THROTTLE_MS * 2) {
      lastToastTime.delete(key);
    }
  }
  
  // Clean up aggressive throttle map
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
    
    toast.success(message, {
      position: 'top-right',
      duration: 1500,
      description,
    });
  },
    
  error: (message: string, options?: { description?: string; persistent?: boolean }) => {
    const key = getThrottleKey('error', message);
    if (!shouldShowToast(key)) return;
    
    toast.error(message, {
      position: 'top-right',
      duration: options?.persistent ? Infinity : 2500,
      closeButton: options?.persistent,
      description: options?.description,
    });
  },
    
  warning: (message: string, description?: string) => {
    const key = getThrottleKey('warning', message);
    if (!shouldShowToast(key)) return;
    
    toast.warning(message, {
      position: 'top-right',
      duration: 2000,
      description,
    });
  },
    
  info: (message: string, description?: string) => {
    const key = getThrottleKey('info', message);
    if (!shouldShowToast(key)) return;
    
    toast.info(message, {
      position: 'top-right',
      duration: 1500,
      description,
    });
  },
};
