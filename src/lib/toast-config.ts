import { toast } from 'sonner';
import { showSmartToast } from '@/hooks/use-smart-toast';

/**
 * Unified toast notification utility linked to Flow POS Pro notifications system
 * 
 * ✅ Standardized Sonner toast implementation across the app
 * ✅ Retains SmartToast exclusively for completed sale invoices
 * ✅ Prevents message stacking using deterministic message IDs
 * ✅ Throttles rapid identical messages
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
  
  // Aggressive throttling - block if same message appeared very recently
  const recentTime = recentMessages.get(key);
  if (recentTime && now - recentTime < AGGRESSIVE_THROTTLE_MS) {
    return false;
  }
  
  // Normal throttling
  const lastTime = lastToastTime.get(key);
  if (lastTime && now - lastTime < THROTTLE_MS) {
    return false;
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

export function getSavedToastDuration(): number {
  if (typeof window === 'undefined') return 2600;
  try {
    const saved = localStorage.getItem('hyperpos_toast_duration');
    if (saved) {
      const val = Number(saved);
      if (!isNaN(val) && val >= 500 && val <= 10000) return val;
    }
  } catch {}
  return 2600;
}

export interface ToastOptions {
  id?: string | number;
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
  invoiceNumber?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  isInvoice?: boolean;
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
    invoiceNumber: optionsOrDesc.invoiceNumber,
    primaryAction: optionsOrDesc.primaryAction,
    duration: optionsOrDesc.duration,
  };
}

function formatHelperDescription(options?: ToastOptions): string | undefined {
  if (!options) return undefined;
  if (options.description) return options.description;
  const parts: string[] = [];
  if (options.itemName) parts.push(options.itemName);
  if (options.itemCount && options.itemCount > 1) parts.push(`${options.itemCount} قطع`);
  if (options.price) parts.push(`${options.price}`);
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

export const showToast = {
  success: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('success', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const isInvoiceSale = isObj && Boolean(optionsOrDesc.invoiceNumber || optionsOrDesc.isInvoice);

    // 🌟 الكرت الكبير مخصص حصراً لاكتمال فاتورة البيع
    if (isInvoiceSale) {
      const parsed = parseToastArgs(optionsOrDesc);
      showSmartToast({
        title: message,
        type: 'success',
        time: 'الآن',
        ...parsed,
      });
      return;
    }

    // 🔔 كل ما عدا ذلك يُعرض عبر Sonner
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc);

    const duration = (isObj && optionsOrDesc.duration) ? optionsOrDesc.duration : getSavedToastDuration();
    const toastId = isObj && optionsOrDesc.id ? optionsOrDesc.id : key;

    toast.success(message, {
      id: toastId,
      description: desc || undefined,
      duration,
      action: isObj && optionsOrDesc.primaryAction ? {
        label: optionsOrDesc.primaryAction.label,
        onClick: optionsOrDesc.primaryAction.onClick,
      } : undefined,
    });
  },
    
  error: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('error', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc);

    const toastId = isObj && optionsOrDesc.id ? optionsOrDesc.id : key;
    // الأخطاء: إما مستمرة حتى الإغلاق اليدوي بالزر (Default) أو مدة 6 ثوانٍ على الأقل
    const isPersistent = isObj && (optionsOrDesc as any).persistent === true;
    const duration = (isObj && optionsOrDesc.duration)
      ? Math.max(optionsOrDesc.duration, 6000)
      : (isPersistent ? Infinity : 6000);

    toast.error(message, {
      id: toastId,
      description: desc || undefined,
      duration,
      closeButton: true,
      action: isObj && optionsOrDesc.primaryAction ? {
        label: optionsOrDesc.primaryAction.label,
        onClick: optionsOrDesc.primaryAction.onClick,
      } : undefined,
    });
  },
    
  warning: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('warning', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc);

    const toastId = isObj && optionsOrDesc.id ? optionsOrDesc.id : key;
    const duration = (isObj && optionsOrDesc.duration) ? Math.max(optionsOrDesc.duration, 6000) : 6000;

    toast.warning(message, {
      id: toastId,
      description: desc || undefined,
      duration,
      closeButton: true,
      action: isObj && optionsOrDesc.primaryAction ? {
        label: optionsOrDesc.primaryAction.label,
        onClick: optionsOrDesc.primaryAction.onClick,
      } : undefined,
    });
  },
    
  info: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('info', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc);

    const toastId = isObj && optionsOrDesc.id ? optionsOrDesc.id : key;
    const duration = (isObj && optionsOrDesc.duration) ? optionsOrDesc.duration : getSavedToastDuration();

    toast.info(message, {
      id: toastId,
      description: desc || undefined,
      duration,
      action: isObj && optionsOrDesc.primaryAction ? {
        label: optionsOrDesc.primaryAction.label,
        onClick: optionsOrDesc.primaryAction.onClick,
      } : undefined,
    });
  },
};
