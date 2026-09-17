import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { toast } from 'sonner';
import { loadProductsCloud, getStatus } from '@/lib/cloud/products-cloud';
import { loadDebtsCloud } from '@/lib/cloud/debts-cloud';
import { sendLocalNotification } from '@/lib/native-notifications';

export interface Notification {
  id: string;
  type: 'debt_overdue' | 'debt_due_today' | 'low_stock' | 'out_of_stock' | 'expired' | 'expiring_soon' | 'license_status' | 'license_expiring';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
  data?: {
    customerId?: string;
    customerName?: string;
    productId?: string;
    productName?: string;
    amount?: number;
    quantity?: number;
    expiryDate?: string;
    licenseExpiresAt?: string;
    licenseDaysRemaining?: number;
  };
}

interface NotificationsContextType {
  notifications: Notification[];
  archivedNotifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  archiveNotification: (id: string) => void;
  restoreNotification: (id: string) => void;
  deleteArchivedNotification: (id: string) => void;
  clearAllArchived: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  refreshNotifications: () => void;
  checkLicenseStatus: (expiresAt: string | null, remainingDays: number | null, isTrial?: boolean) => void;
}

export const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const ARCHIVED_STORAGE_KEY = 'hyperpos_archived_notifications';

const loadArchivedFromStorage = (): Notification[] => {
  try {
    const raw = localStorage.getItem(ARCHIVED_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }));
  } catch { return []; }
};

const saveArchivedToStorage = (items: Notification[]) => {
  try {
    localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(items));
  } catch {}
};

const getExpiryStatus = (expiryDate: string): 'expired' | 'expiring_soon' | 'valid' => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring_soon';
  return 'valid';
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [archivedNotifications, setArchivedNotifications] = useState<Notification[]>(loadArchivedFromStorage);
  const [hasCheckedInitial, setHasCheckedInitial] = useState(false);

  // Sync archived to localStorage
  useEffect(() => {
    saveArchivedToStorage(archivedNotifications);
  }, [archivedNotifications]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => {
      const exists = prev.some(n => {
        if (n.type !== notification.type) return false;
        if (notification.data?.productId && n.data?.productId === notification.data.productId) return true;
        if (notification.data?.customerId && n.data?.customerId === notification.data.customerId) return true;
        if (n.type === 'license_status' || n.type === 'license_expiring') {
          return notification.type === 'license_status' || notification.type === 'license_expiring';
        }
        return false;
      });
      if (exists) return prev;

      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        read: false,
      };
      return [newNotification, ...prev];
    });

    if (notification.type !== 'license_status') {
      const toastType = notification.type.includes('overdue') ||
                       notification.type === 'out_of_stock' ||
                       notification.type === 'expired'
        ? 'error' : 'warning';
      if (toastType === 'error') {
        toast.error(notification.title, { description: notification.message });
      } else {
        toast.warning(notification.title, { description: notification.message });
      }

      // فحص تفضيلات المستخدم قبل إرسال الإشعار الأصلي لنظام أندرويد
      try {
        const raw = localStorage.getItem('hyperpos_settings_v1');
        const settings = raw ? JSON.parse(raw) : null;
        const prefs = settings?.notificationSettings;

        // إذا كان المفتاح الرئيسي معطلاً لا نرسل أي إشعار أصلي
        const masterEnabled = prefs?.masterEnabled !== false; // true by default if not set

        // ربط نوع الإشعار بمفتاحه التفضيلي
        let typeAllowed = true;
        if (prefs && masterEnabled) {
          if (notification.type === 'low_stock' || notification.type === 'out_of_stock') {
            typeAllowed = prefs.lowStock !== false;
          } else if (notification.type === 'debt_overdue' || notification.type === 'debt_due_today') {
            typeAllowed = prefs.newDebt !== false;
          } else if (notification.type === 'expired' || notification.type === 'expiring_soon') {
            // expiry notifications use lowStock toggle as proxy
            typeAllowed = prefs.lowStock !== false;
          }
        }

        if (masterEnabled && typeAllowed) {
          sendLocalNotification(notification.title, notification.message).catch(() => {});
        }
      } catch {
        // فشل القراءة — أرسل الإشعار بشكل افتراضي
        sendLocalNotification(notification.title, notification.message).catch(() => {});
      }
    }
  }, []);


  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications(prev => prev.filter(n => n.persistent));
  }, []);

  const archiveNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification) {
        setArchivedNotifications(archived => [notification, ...archived]);
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  const restoreNotification = useCallback((id: string) => {
    setArchivedNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification) {
        setNotifications(active => [notification, ...active]);
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  const deleteArchivedNotification = useCallback((id: string) => {
    setArchivedNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllArchived = useCallback(() => {
    setArchivedNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const checkLicenseStatus = useCallback((expiresAt: string | null, remainingDays: number | null, isTrial?: boolean) => {
    if (!expiresAt || remainingDays === null) return;
    setNotifications(prev => prev.filter(n => n.type !== 'license_status' && n.type !== 'license_expiring'));

    const expiryDate = new Date(expiresAt).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const trialPrefix = isTrial ? '(تجريبي) ' : '';

    if (remainingDays <= 7) {
      const newNotification: Notification = {
        id: 'license_expiring_' + Date.now(),
        type: 'license_expiring',
        title: `⚠️ ${trialPrefix}الترخيص ينتهي قريباً`,
        message: `متبقي ${remainingDays} ${remainingDays === 1 ? 'يوم' : 'أيام'} على انتهاء الترخيص`,
        timestamp: new Date(),
        read: false,
        persistent: true,
        data: { licenseExpiresAt: expiresAt, licenseDaysRemaining: remainingDays },
      };
      setNotifications(prev => [newNotification, ...prev]);
      toast.warning(newNotification.title, { description: newNotification.message });
    } else if (remainingDays <= 30 || isTrial) {
      const newNotification: Notification = {
        id: 'license_status_' + Date.now(),
        type: 'license_status',
        title: `🔑 ${trialPrefix}حالة الترخيص`,
        message: isTrial
          ? `متبقي ${remainingDays} يوم من الفترة التجريبية`
          : `الترخيص صالح حتى ${expiryDate} (متبقي ${remainingDays} يوم)`,
        timestamp: new Date(),
        read: false,
        persistent: true,
        data: { licenseExpiresAt: expiresAt, licenseDaysRemaining: remainingDays },
      };
      setNotifications(prev => [newNotification, ...prev]);
    } else {
      const newNotification: Notification = {
        id: 'license_status_' + Date.now(),
        type: 'license_status',
        title: `✅ الترخيص مفعّل`,
        message: `الترخيص صالح حتى ${expiryDate}`,
        timestamp: new Date(),
        read: true,
        persistent: true,
        data: { licenseExpiresAt: expiresAt, licenseDaysRemaining: remainingDays },
      };
      setNotifications(prev => [newNotification, ...prev]);
    }
  }, []);

  const checkAlerts = useCallback(async () => {
    try {
      const [products, debts] = await Promise.all([loadProductsCloud(), loadDebtsCloud()]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      debts.forEach(debt => {
        if (debt.remainingDebt > 0 && debt.dueDate) {
          const dueDate = new Date(debt.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            addNotification({
              type: 'debt_overdue', title: 'دين متأخر',
              message: `الدين المستحق من ${debt.customerName} بقيمة $${debt.remainingDebt} متأخر عن موعد السداد`,
              data: { customerId: debt.id, customerName: debt.customerName, amount: debt.remainingDebt },
            });
          } else if (diffDays === 0) {
            addNotification({
              type: 'debt_due_today', title: 'دين مستحق اليوم',
              message: `الدين المستحق من ${debt.customerName} بقيمة $${debt.remainingDebt} يستحق اليوم`,
              data: { customerId: debt.id, customerName: debt.customerName, amount: debt.remainingDebt },
            });
          }
        }
      });

      products.filter(p => p.status === 'low_stock').forEach(product => {
        addNotification({
          type: 'low_stock', title: 'مخزون منخفض',
          message: `المنتج "${product.name}" لديه كمية منخفضة (${product.quantity} فقط)`,
          data: { productId: product.id, productName: product.name, quantity: product.quantity },
        });
      });

      products.filter(p => p.status === 'out_of_stock').forEach(product => {
        addNotification({
          type: 'out_of_stock', title: 'نفذ المخزون',
          message: `المنتج "${product.name}" نفذ من المخزون`,
          data: { productId: product.id, productName: product.name, quantity: 0 },
        });
      });

      products.forEach(product => {
        if (product.expiryDate) {
          const status = getExpiryStatus(product.expiryDate);
          if (status === 'expired') {
            addNotification({
              type: 'expired', title: 'منتج منتهي الصلاحية ⚠️',
              message: `المنتج "${product.name}" انتهت صلاحيته في ${product.expiryDate}`,
              data: { productId: product.id, productName: product.name, expiryDate: product.expiryDate },
            });
          } else if (status === 'expiring_soon') {
            addNotification({
              type: 'expiring_soon', title: 'صلاحية قريبة الانتهاء',
              message: `المنتج "${product.name}" ستنتهي صلاحيته في ${product.expiryDate}`,
              data: { productId: product.id, productName: product.name, expiryDate: product.expiryDate },
            });
          }
        }
      });
    } catch (error) {
      console.error('Failed to check alerts:', error);
    }
  }, [addNotification]);

  const refreshNotifications = useCallback(() => {
    setNotifications(prev => prev.filter(n => n.persistent));
    setTimeout(() => { checkAlerts(); }, 100);
  }, [checkAlerts]);

  useEffect(() => {
    if (hasCheckedInitial) return;
    setHasCheckedInitial(true);
    const timer = setTimeout(checkAlerts, 1000);
    return () => clearTimeout(timer);
  }, [hasCheckedInitial, checkAlerts]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      archivedNotifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      archiveNotification,
      restoreNotification,
      deleteArchivedNotification,
      clearAllArchived,
      addNotification,
      refreshNotifications,
      checkLicenseStatus,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

const defaultNotificationsContext: NotificationsContextType = {
  notifications: [],
  archivedNotifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotification: () => {},
  clearAllNotifications: () => {},
  archiveNotification: () => {},
  restoreNotification: () => {},
  deleteArchivedNotification: () => {},
  clearAllArchived: () => {},
  addNotification: () => {},
  refreshNotifications: () => {},
  checkLicenseStatus: () => {},
};

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    console.warn('useNotifications called outside NotificationsProvider, using default values');
    return defaultNotificationsContext;
  }
  return context;
}
