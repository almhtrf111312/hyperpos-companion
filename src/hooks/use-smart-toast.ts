import { useState, useEffect, useCallback } from 'react';
import React from 'react';

export interface SmartToastData {
  id: string;
  type?: 'cash_sale' | 'debt_sale' | 'settings' | 'refund' | 'sync' | 'success' | 'error' | 'warning' | 'info';
  title: React.ReactNode;
  subtitle?: React.ReactNode;          // مثال: رقم الفاتورة #INV-2026-002
  statusBadge?: React.ReactNode;       // مثال: "الآن • معتمدة" أو "الآن • تم الحفظ"
  primaryLabel?: React.ReactNode;      // السطر الأول في الصندوق الداخلي (مثال: رقم الفاتورة / العميل)
  primaryValue?: React.ReactNode;      // قيمة السطر الأول الخاصة بالعملية
  secondaryLabel?: React.ReactNode;    // السطر الثاني في الصندوق الداخلي (مثال: القطعة / التفاصيل)
  secondaryValue?: React.ReactNode;    // قيمة السطر الثاني الخاصة بالعملية
  description?: React.ReactNode;       // النص التفصيلي للإشعارات العامة وإشعارات الإعدادات
  pillText?: React.ReactNode;          // الكبسولة البارزة على اليسار (مثال: المبلغ بالعملة أو شارة "محفوظ ✓")
  duration?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: (id: string) => void;

  // الحقول التوافقية
  operation?: string;
  itemName?: string;
  itemCount?: number;
  isMultiple?: boolean;
  price?: string | number;
  currency?: string;
  stockQuantity?: number;
  invoiceNumber?: string;
  time?: string;
  details?: React.ReactNode;
}

// Global emitter state
let listeners: ((data: SmartToastData[]) => void)[] = [];
let currentToasts: SmartToastData[] = [];
let activeToastUntil = 0;

export const isSmartToastActive = (): boolean => {
  return Date.now() < activeToastUntil || currentToasts.length > 0;
};

export const showSmartToast = (data: Omit<SmartToastData, 'id'> & { id?: string }) => {
  // 1. مسح أي إشعار sonner قديم فوراً لمنع التراكب
  try {
    import('sonner').then(({ toast: sonnerToast }) => {
      sonnerToast.dismiss();
    }).catch(() => {});
  } catch {}

  const defaultDuration = (() => {
    try {
      const saved = localStorage.getItem('hyperpos_toast_duration');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 500 && val <= 10000) return val;
      }
    } catch {}
    return 2500;
  })();

  const duration = data.duration || defaultDuration;
  activeToastUntil = Date.now() + duration;

  const id = data.id || Math.random().toString(36).substring(2, 9);
  const lang = (typeof window !== 'undefined' && localStorage.getItem('hyperpos_language')) || 'ar';

  let {
    type = 'success',
    title,
    subtitle,
    statusBadge,
    primaryLabel,
    primaryValue,
    secondaryLabel,
    secondaryValue,
    description,
    pillText,
    invoiceNumber,
    itemName,
    itemCount,
    isMultiple,
    price,
  } = data;

  if (invoiceNumber && !subtitle) {
    subtitle = `#${String(invoiceNumber).replace(/^#/, '')}`;
  }

  // 🛡️ معالجة شاملة لمنع ظهور الإشعار فارغاً:
  // إذا تم تمرير نص مفرد في title فقط دون description ودون primaryValue
  if (!description && !primaryValue && title) {
    description = title;
    if (type === 'error') {
      title = lang === 'en' ? 'Error' : lang === 'tr' ? 'Hata' : 'خطأ';
    } else if (type === 'warning') {
      title = lang === 'en' ? 'Warning' : lang === 'tr' ? 'Uyarı' : 'تنبيه';
    } else if (type === 'info') {
      title = lang === 'en' ? 'Notice' : lang === 'tr' ? 'Bildirim' : 'إشعار';
    } else if (type === 'settings') {
      title = lang === 'en' ? 'Settings' : lang === 'tr' ? 'Ayarlar' : 'إعدادات النظام';
    } else {
      title = lang === 'en' ? 'Successful' : lang === 'tr' ? 'Başarılı' : 'تم بنجاح';
    }
  } else if (!title && description) {
    if (type === 'error') {
      title = lang === 'en' ? 'Error' : lang === 'tr' ? 'Hata' : 'خطأ';
    } else if (type === 'warning') {
      title = lang === 'en' ? 'Warning' : lang === 'tr' ? 'Uyarı' : 'تنبيه';
    } else if (type === 'info') {
      title = lang === 'en' ? 'Notice' : lang === 'tr' ? 'Bildirim' : 'إشعار';
    } else if (type === 'settings') {
      title = lang === 'en' ? 'Settings' : lang === 'tr' ? 'Ayarlar' : 'إعدادات النظام';
    } else {
      title = lang === 'en' ? 'Successful' : lang === 'tr' ? 'Başarılı' : 'تم بنجاح';
    }
  }

  if (!statusBadge) {
    if (type === 'cash_sale') {
      statusBadge = lang === 'en' ? 'Now • Approved' : lang === 'tr' ? 'Şimdi • Onaylandı' : 'الآن • معتمدة';
    } else if (type === 'debt_sale') {
      statusBadge = lang === 'en' ? 'Now • Deferred Debt' : lang === 'tr' ? 'Şimdi • Vadeli' : 'الآن • ذمم مؤجلة';
    } else if (type === 'settings') {
      statusBadge = lang === 'en' ? 'Now • Saved' : lang === 'tr' ? 'Şimdi • Kaydedildi' : 'الآن • تم الحفظ';
    } else if (type === 'sync') {
      statusBadge = lang === 'en' ? 'Now • Synced' : lang === 'tr' ? 'Şimdi • Senkronize' : 'الآن • متزامن';
    } else if (type === 'refund') {
      statusBadge = lang === 'en' ? 'Now • Refunded' : lang === 'tr' ? 'Şimdi • İade Edildi' : 'الآن • مسترد';
    } else if (type === 'error') {
      statusBadge = lang === 'en' ? 'Now • Error' : lang === 'tr' ? 'Şimdi • Hata' : 'الآن • خطأ';
    } else if (type === 'warning') {
      statusBadge = lang === 'en' ? 'Now • Warning' : lang === 'tr' ? 'Şimdi • Uyarı' : 'الآن • تنبيه';
    } else {
      statusBadge = lang === 'en' ? 'Now • Saved' : lang === 'tr' ? 'Şimdi • Kaydedildi' : 'الآن • تم الحفظ';
    }
  }

  if (!pillText) {
    if (price) {
      pillText = String(price);
    } else if (type === 'settings' || type === 'success') {
      pillText = lang === 'en' ? 'Saved ✓' : lang === 'tr' ? 'Kaydedildi ✓' : 'محفوظ ✓';
    } else if (type === 'error') {
      pillText = lang === 'en' ? 'Error ✕' : lang === 'tr' ? 'Hata ✕' : 'خطأ ✕';
    } else if (type === 'warning' || type === 'debt_sale') {
      pillText = lang === 'en' ? 'Alert ⚠' : lang === 'tr' ? 'Uyarı ⚠' : 'تنبيه ⚠';
    } else {
      pillText = lang === 'en' ? 'Done ✓' : lang === 'tr' ? 'Tamam ✓' : 'تم ✓';
    }
  }

  if (!primaryLabel && !primaryValue && itemName) {
    primaryLabel = lang === 'en' ? 'Item' : lang === 'tr' ? 'Ürün' : 'القطعة';
    primaryValue = itemName;
  }

  if (!secondaryLabel && !secondaryValue && (itemCount || isMultiple)) {
    secondaryLabel = lang === 'en' ? 'Quantity' : lang === 'tr' ? 'Miktar' : 'الكمية';
    secondaryValue = isMultiple
      ? (itemCount ? `وحدات متعددة (${itemCount} قطع)` : 'وحدات متعددة')
      : (itemCount ? `${itemCount} قطع` : undefined);
  }

  const toastItem: SmartToastData = {
    ...data,
    id,
    type,
    title,
    subtitle,
    statusBadge,
    primaryLabel,
    primaryValue,
    secondaryLabel,
    secondaryValue,
    description,
    pillText,
    duration,
  };

  // ✅ الإشعار فوري داخل التطبيق حصراً (In-App Only - 0ms delay) بدون أي استدعاء خارجي لأندرويد
  currentToasts = [...currentToasts.filter(t => t.id !== id), toastItem].slice(-2);
  listeners.forEach(fn => fn([...currentToasts]));
};

export const hideSmartToastById = (id: string) => {
  currentToasts = currentToasts.filter(t => t.id !== id);
  if (currentToasts.length === 0) {
    activeToastUntil = 0;
  }
  listeners.forEach(fn => fn([...currentToasts]));
};

export const hideSmartToast = () => {
  currentToasts = [];
  activeToastUntil = 0;
  listeners.forEach(fn => fn([]));
};

export function useSmartToastListener() {
  const [toasts, setToasts] = useState<SmartToastData[]>(() => [...currentToasts]);

  useEffect(() => {
    const listener = (data: SmartToastData[]) => setToasts(data);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    hideSmartToastById(id);
  }, []);

  return {
    toasts,
    toast: toasts[toasts.length - 1] || null,
    dismissToast,
    hideSmartToast,
  };
}
