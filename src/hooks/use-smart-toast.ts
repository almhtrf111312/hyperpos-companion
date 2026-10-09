import { useState, useEffect } from 'react';

export interface SmartToastData {
  id: string;
  title: string;
  subtitle?: string;
  type: 'success' | 'warning' | 'error' | 'info' | 'purple';
  time?: string;
  details?: React.ReactNode;
  duration?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;

  // الحقول المنظمة لتفاصيل العمليات المباشرة
  operation?: string;
  itemName?: string;
  itemCount?: number;
  isMultiple?: boolean;
  price?: string | number;
  currency?: string;
  stockQuantity?: number;
  statusBadge?: string;
}

// Global emitter
let listeners: ((data: SmartToastData | null) => void)[] = [];

export const showSmartToast = (data: Omit<SmartToastData, 'id'>) => {
  const id = Math.random().toString(36).substr(2, 9);
  listeners.forEach((listener) => listener({ ...data, id }));
};

export const hideSmartToast = () => {
  listeners.forEach((listener) => listener(null));
};

export function useSmartToastListener() {
  const [toast, setToast] = useState<SmartToastData | null>(null);

  useEffect(() => {
    const listener = (data: SmartToastData | null) => setToast(data);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return { toast, setToast };
}
