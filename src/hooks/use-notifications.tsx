import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { toast } from 'sonner';
import { loadProductsCloud, getStatus } from '@/lib/cloud/products-cloud';
import { loadDebtsCloud } from '@/lib/cloud/debts-cloud';

export interface Notification {
  id: string;
  type: 'debt_overdue' | 'debt_due_today' | 'low_stock' | 'out_of_stock' | 'expired' | 'expiring_soon' | 'license_status' | 'license_expiring';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean; // Persistent notifications won't be cleared with "clear all"
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
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  refreshNotifications: () => void;
  checkLicenseStatus: (expiresAt: string | null, remainingDays: number | null, isTrial?: boolean) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Helper to get expiry status from date string
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
  const [hasCheckedInitial, setHasCheckedInitial] = useState(false);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => {
      // Prevent duplicate notifications based on type and relevant data
      const exists = prev.some(n => {
        if (n.type !== notification.type) return false;
        
        // For product notifications, check productId
        if (notification.data?.productId && n.data?.productId === notification.data.productId) {
          return true;
        }
        
        // For debt notifications, check customerId
        if (notification.data?.customerId && n.data?.customerId === notification.data.customerId) {
          return true;
        }
        
        // For license notifications, always replace
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
    
    // Show toast notification (but not for license_status as it's informational)
    if (notification.type !== 'license_status') {
      const toastType = notification.type.includes('overdue') || 
                       notification.type === 'out_of_stock' || 
                       notification.type === 'expired'
        ? 'error' 
        : 'warning';
      
      if (toastType === 'error') {
        toast.error(notification.title, { description: notification.message });
      } else {
        toast.warning(notification.title, { description: notification.message });
      }
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    // Keep persistent notifications (like license status)
    setNotifications(prev => prev.filter(n => n.persistent));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Check license status and add notification
  const checkLicenseStatus = useCallback((expiresAt: string | null, remainingDays: number | null, isTrial?: boolean) => {
    if (!expiresAt || remainingDays === null) return;
    
    // Remove existing license notifications first
    setNotifications(prev => prev.filter(n => n.type !== 'license_status' && n.type !== 'license_expiring'));
    
    const expiryDate = new Date(expiresAt).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const trialPrefix = isTrial ? '(تجريبي) ' : '';
    
    if (remainingDays <= 7) {
      // Warning: License expiring soon
      const newNotification: Notification = {
        id: 'license_expiring_' + Date.now(),
        type: 'license_expiring',
        title: `⚠️ ${trialPrefix}الترخيص ينتهي قريباً`,
        message: `متبقي ${remainingDays} ${remainingDays === 1 ? 'يوم' : 'أيام'} على انتهاء الترخيص`,
        timestamp: new Date(),
        read: false,
        persistent: true,
        data: {
          licenseExpiresAt: expiresAt,
          licenseDaysRemaining: remainingDays,
        },
      };
      setNotifications(prev => [newNotification, ...prev]);
      
      // Show toast for expiring
      toast.warning(newNotification.title, { description: newNotification.message });
    } else {
      // Info: License status
      const newNotification: Notification = {
        id: 'license_status_' + Date.now(),
        type: 'license_status',
        title: `🔑 ${trialPrefix}حالة الترخيص`,
        message: `الترخيص صالح حتى ${expiryDate}`,
        timestamp: new Date(),
        read: true, // Mark as read by default (informational)
        persistent: true,
        data: {
          licenseExpiresAt: expiresAt,
          licenseDaysRemaining: remainingDays,
        },
      };
      setNotifications(prev => [newNotification, ...prev]);
    }
  }, []);

  const checkAlerts = useCallback(async () => {
    try {
      // Load real data from cloud
      const [products, debts] = await Promise.all([
        loadProductsCloud(),
        loadDebtsCloud()
      ]);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check overdue debts
      debts.forEach(debt => {
        if (debt.remainingDebt > 0 && debt.dueDate) {
          const dueDate = new Date(debt.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          
          const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            addNotification({
              type: 'debt_overdue',
              title: 'دين متأخر',
              message: `الدين المستحق من ${debt.customerName} بقيمة $${debt.remainingDebt} متأخر عن موعد السداد`,
              data: {
                customerId: debt.id,
                customerName: debt.customerName,
                amount: debt.remainingDebt,
              },
            });
          } else if (diffDays === 0) {
            addNotification({
              type: 'debt_due_today',
              title: 'دين مستحق اليوم',
              message: `الدين المستحق من ${debt.customerName} بقيمة $${debt.remainingDebt} يستحق اليوم`,
              data: {
                customerId: debt.id,
                customerName: debt.customerName,
                amount: debt.remainingDebt,
              },
            });
          }
        }
      });

      // Check low stock products
      const lowStockProducts = products.filter(p => p.status === 'low_stock');
      lowStockProducts.forEach(product => {
        addNotification({
          type: 'low_stock',
          title: 'مخزون منخفض',
          message: `المنتج "${product.name}" لديه كمية منخفضة (${product.quantity} فقط)`,
          data: {
            productId: product.id,
            productName: product.name,
            quantity: product.quantity,
          },
        });
      });

      // Check out of stock products
      const outOfStockProducts = products.filter(p => p.status === 'out_of_stock');
      outOfStockProducts.forEach(product => {
        addNotification({
          type: 'out_of_stock',
          title: 'نفذ المخزون',
          message: `المنتج "${product.name}" نفذ من المخزون`,
          data: {
            productId: product.id,
            productName: product.name,
            quantity: 0,
          },
        });
      });

      // Check expired and expiring products
      products.forEach(product => {
        if (product.expiryDate) {
          const status = getExpiryStatus(product.expiryDate);
          if (status === 'expired') {
            addNotification({
              type: 'expired',
              title: 'منتج منتهي الصلاحية ⚠️',
              message: `المنتج "${product.name}" انتهت صلاحيته في ${product.expiryDate}`,
              data: {
                productId: product.id,
                productName: product.name,
                expiryDate: product.expiryDate,
              },
            });
          } else if (status === 'expiring_soon') {
            addNotification({
              type: 'expiring_soon',
              title: 'صلاحية قريبة الانتهاء',
              message: `المنتج "${product.name}" ستنتهي صلاحيته في ${product.expiryDate}`,
              data: {
                productId: product.id,
                productName: product.name,
                expiryDate: product.expiryDate,
              },
            });
          }
        }
      });
    } catch (error) {
      console.error('Failed to check alerts:', error);
    }
  }, [addNotification]);

  const refreshNotifications = useCallback(() => {
    // Clear non-persistent notifications
    setNotifications(prev => prev.filter(n => n.persistent));
    setTimeout(() => {
      checkAlerts();
    }, 100);
  }, [checkAlerts]);

  // Check for alerts on mount
  useEffect(() => {
    if (hasCheckedInitial) return;
    setHasCheckedInitial(true);

    // Small delay to show toasts after page load
    const timer = setTimeout(checkAlerts, 1000);
    return () => clearTimeout(timer);
  }, [hasCheckedInitial, checkAlerts]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      addNotification,
      refreshNotifications,
      checkLicenseStatus,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
