import { showSmartToast, hideSmartToast, hideSmartToastById } from '@/hooks/use-smart-toast';

/**
 * Unified toast notification utility linked to Flow POS Pro notifications system
 * 
 * ✅ Standardized in-app toast implementation across the app (0ms delay)
 * ✅ Unifies all notifications into the large SmartToastCard with swipe-to-dismiss
 * ✅ Guarantees full display of title and description with zero blank states
 * ✅ Throttles rapid identical messages to prevent visual spam
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
  if (typeof window === 'undefined') return 3000;
  try {
    const saved = localStorage.getItem('hyperpos_toast_duration');
    if (saved) {
      const val = Number(saved);
      if (!isNaN(val) && val >= 500 && val <= 10000) return val;
    }
  } catch {}
  return 3000;
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
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  isInvoice?: boolean;
  subtitle?: string;
  primaryLabel?: string;
  primaryValue?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  pillText?: string;
}

function parseToastArgs(optionsOrDesc?: string | ToastOptions) {
  if (!optionsOrDesc) return {};
  if (typeof optionsOrDesc === 'string') {
    return { description: optionsOrDesc };
  }
  return {
    description: optionsOrDesc.description,
    subtitle: optionsOrDesc.subtitle || (optionsOrDesc.invoiceNumber ? `#${optionsOrDesc.invoiceNumber.replace(/^#/, '')}` : undefined),
    statusBadge: optionsOrDesc.statusBadge,
    primaryLabel: optionsOrDesc.primaryLabel,
    primaryValue: optionsOrDesc.primaryValue,
    secondaryLabel: optionsOrDesc.secondaryLabel,
    secondaryValue: optionsOrDesc.secondaryValue,
    pillText: optionsOrDesc.pillText,
    operation: optionsOrDesc.operation,
    itemName: optionsOrDesc.itemName,
    itemCount: optionsOrDesc.itemCount,
    isMultiple: optionsOrDesc.isMultiple,
    price: optionsOrDesc.price,
    currency: optionsOrDesc.currency,
    stockQuantity: optionsOrDesc.stockQuantity,
    invoiceNumber: optionsOrDesc.invoiceNumber,
    primaryAction: optionsOrDesc.primaryAction,
    secondaryAction: optionsOrDesc.secondaryAction,
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
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const key = getThrottleKey('success', message);
    if (!shouldShowToast(key)) return;

    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc) || message;

    const parsed = isObj ? parseToastArgs(optionsOrDesc) : {};
    const duration = (isObj && optionsOrDesc.duration) ? optionsOrDesc.duration : getSavedToastDuration();

    showSmartToast({
      id: isObj && optionsOrDesc.id ? String(optionsOrDesc.id) : undefined,
      type: (isObj && optionsOrDesc.isInvoice) ? 'cash_sale' : 'success',
      title: message,
      description: desc,
      duration,
      ...parsed,
    });
  },
    
  error: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('error', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc) || message;

    const parsed = isObj ? parseToastArgs(optionsOrDesc) : {};
    const isPersistent = isObj && (optionsOrDesc as any).persistent === true;
    const duration = (isObj && optionsOrDesc.duration)
      ? Math.max(optionsOrDesc.duration, 6000)
      : (isPersistent ? Infinity : 6000);

    showSmartToast({
      id: isObj && optionsOrDesc.id ? String(optionsOrDesc.id) : undefined,
      type: 'error',
      title: message,
      description: desc,
      duration,
      ...parsed,
    });
  },
    
  warning: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('warning', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc) || message;

    const parsed = isObj ? parseToastArgs(optionsOrDesc) : {};
    const duration = (isObj && optionsOrDesc.duration) ? Math.max(optionsOrDesc.duration, 5000) : 5000;

    showSmartToast({
      id: isObj && optionsOrDesc.id ? String(optionsOrDesc.id) : undefined,
      type: 'warning',
      title: message,
      description: desc,
      duration,
      ...parsed,
    });
  },
    
  info: (message: string, optionsOrDesc?: string | ToastOptions) => {
    const key = getThrottleKey('info', message);
    if (!shouldShowToast(key)) return;
    
    const isObj = typeof optionsOrDesc === 'object' && optionsOrDesc !== null;
    const desc = typeof optionsOrDesc === 'string'
      ? optionsOrDesc
      : optionsOrDesc?.description || formatHelperDescription(optionsOrDesc) || message;

    const parsed = isObj ? parseToastArgs(optionsOrDesc) : {};
    const duration = (isObj && optionsOrDesc.duration) ? optionsOrDesc.duration : getSavedToastDuration();

    showSmartToast({
      id: isObj && optionsOrDesc.id ? String(optionsOrDesc.id) : undefined,
      type: 'info',
      title: message,
      description: desc,
      duration,
      ...parsed,
    });
  },

  dismiss: (toastId?: string | number) => {
    if (toastId) {
      hideSmartToastById(String(toastId));
    } else {
      hideSmartToast();
    }
  },
};
