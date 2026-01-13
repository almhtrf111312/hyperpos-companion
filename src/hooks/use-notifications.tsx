import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  type: 'debt_overdue' | 'debt_due_today' | 'low_stock' | 'out_of_stock';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: {
    customerId?: string;
    customerName?: string;
    productId?: string;
    productName?: string;
    amount?: number;
    quantity?: number;
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
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Mock data for debts
const mockDebts = [
  { id: '1', customer: 'أحمد محمد', amount: 1500, dueDate: '2025-01-05', status: 'overdue' },
  { id: '2', customer: 'خالد عمر', amount: 850, dueDate: '2025-01-13', status: 'due_today' },
  { id: '3', customer: 'سامي حسن', amount: 2200, dueDate: '2025-01-15', status: 'due_soon' },
  { id: '4', customer: 'محمود علي', amount: 500, dueDate: '2025-01-08', status: 'overdue' },
];

// Mock data for products
const mockProducts = [
  { id: '1', name: 'iPhone 15 Pro Max', quantity: 15, status: 'in_stock' },
  { id: '2', name: 'Samsung Galaxy S24', quantity: 20, status: 'in_stock' },
  { id: '3', name: 'AirPods Pro 2', quantity: 5, status: 'low_stock' },
  { id: '4', name: 'شاشة iPhone 13', quantity: 0, status: 'out_of_stock' },
  { id: '5', name: 'شاحن سريع 65W', quantity: 3, status: 'low_stock' },
  { id: '6', name: 'كابل Lightning', quantity: 2, status: 'low_stock' },
];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasCheckedInitial, setHasCheckedInitial] = useState(false);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show toast notification
    const toastType = notification.type.includes('overdue') || notification.type === 'out_of_stock' 
      ? 'error' 
      : 'warning';
    
    if (toastType === 'error') {
      toast.error(notification.title, { description: notification.message });
    } else {
      toast.warning(notification.title, { description: notification.message });
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
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Check for overdue debts and low stock on mount
  useEffect(() => {
    if (hasCheckedInitial) return;
    setHasCheckedInitial(true);

    const checkAlerts = () => {
      // Check overdue debts
      const overdueDebts = mockDebts.filter(d => d.status === 'overdue');
      overdueDebts.forEach(debt => {
        addNotification({
          type: 'debt_overdue',
          title: 'دين متأخر',
          message: `الدين المستحق من ${debt.customer} بقيمة $${debt.amount} متأخر عن موعد السداد`,
          data: {
            customerId: debt.id,
            customerName: debt.customer,
            amount: debt.amount,
          },
        });
      });

      // Check due today debts
      const dueTodayDebts = mockDebts.filter(d => d.status === 'due_today');
      dueTodayDebts.forEach(debt => {
        addNotification({
          type: 'debt_due_today',
          title: 'دين مستحق اليوم',
          message: `الدين المستحق من ${debt.customer} بقيمة $${debt.amount} يستحق اليوم`,
          data: {
            customerId: debt.id,
            customerName: debt.customer,
            amount: debt.amount,
          },
        });
      });

      // Check low stock products
      const lowStockProducts = mockProducts.filter(p => p.status === 'low_stock');
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
      const outOfStockProducts = mockProducts.filter(p => p.status === 'out_of_stock');
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
    };

    // Small delay to show toasts after page load
    const timer = setTimeout(checkAlerts, 1000);
    return () => clearTimeout(timer);
  }, [hasCheckedInitial, addNotification]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      addNotification,
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
