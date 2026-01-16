// Activity Log Store - Secure encrypted activity tracking
import { secureSet, secureGet, secureRemove } from './secure-storage';

export type ActivityType = 
  | 'login'
  | 'logout'
  | 'sale'
  | 'maintenance'
  | 'debt_created'
  | 'debt_paid'
  | 'product_added'
  | 'product_updated'
  | 'product_deleted'
  | 'customer_added'
  | 'customer_updated'
  | 'settings_changed'
  | 'user_added'
  | 'user_deleted'
  | 'password_changed'
  | 'backup_created'
  | 'invoice_created'
  | 'invoice_deleted';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  description: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

const ACTIVITY_LOG_KEY = 'activity_log';
const STORAGE_NAMESPACE = 'hp_audit';
const MAX_LOGS = 500; // Keep last 500 activities
// Logs expire after 30 days for automatic cleanup
const LOG_EXPIRY = 30 * 24 * 60 * 60 * 1000;

export function loadActivityLogs(): ActivityLog[] {
  try {
    const logs = secureGet<ActivityLog[]>(ACTIVITY_LOG_KEY, { namespace: STORAGE_NAMESPACE });
    return logs || [];
  } catch {
    return [];
  }
}

export function saveActivityLogs(logs: ActivityLog[]) {
  try {
    // Keep only last MAX_LOGS
    const trimmedLogs = logs.slice(0, MAX_LOGS);
    secureSet(ACTIVITY_LOG_KEY, trimmedLogs, { 
      namespace: STORAGE_NAMESPACE,
      expiresIn: LOG_EXPIRY 
    });
  } catch {
    // Ignore storage errors
  }
}

export function addActivityLog(
  type: ActivityType,
  userId: string,
  userName: string,
  description: string,
  details?: Record<string, any>
): ActivityLog {
  const log: ActivityLog = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type,
    userId,
    userName,
    description,
    details,
    timestamp: new Date().toISOString(),
  };

  const logs = loadActivityLogs();
  logs.unshift(log); // Add to beginning
  saveActivityLogs(logs);

  return log;
}

export function getActivityLogsByUser(userId: string): ActivityLog[] {
  return loadActivityLogs().filter(log => log.userId === userId);
}

export function getActivityLogsByType(type: ActivityType): ActivityLog[] {
  return loadActivityLogs().filter(log => log.type === type);
}

export function getActivityLogsByDateRange(startDate: Date, endDate: Date): ActivityLog[] {
  return loadActivityLogs().filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= startDate && logDate <= endDate;
  });
}

export function clearActivityLogs() {
  secureRemove(ACTIVITY_LOG_KEY, { namespace: STORAGE_NAMESPACE });
  // Clean up legacy unencrypted logs
  localStorage.removeItem('hyperpos_activity_log_v1');
}

// Activity type labels
export const activityTypeLabels: Record<ActivityType, { ar: string; en: string; fr: string }> = {
  login: { ar: 'تسجيل دخول', en: 'Login', fr: 'Connexion' },
  logout: { ar: 'تسجيل خروج', en: 'Logout', fr: 'Déconnexion' },
  sale: { ar: 'عملية بيع', en: 'Sale', fr: 'Vente' },
  maintenance: { ar: 'خدمة صيانة', en: 'Maintenance', fr: 'Maintenance' },
  debt_created: { ar: 'إنشاء دين', en: 'Debt Created', fr: 'Dette Créée' },
  debt_paid: { ar: 'تسديد دين', en: 'Debt Paid', fr: 'Dette Payée' },
  product_added: { ar: 'إضافة منتج', en: 'Product Added', fr: 'Produit Ajouté' },
  product_updated: { ar: 'تعديل منتج', en: 'Product Updated', fr: 'Produit Modifié' },
  product_deleted: { ar: 'حذف منتج', en: 'Product Deleted', fr: 'Produit Supprimé' },
  customer_added: { ar: 'إضافة زبون', en: 'Customer Added', fr: 'Client Ajouté' },
  customer_updated: { ar: 'تعديل زبون', en: 'Customer Updated', fr: 'Client Modifié' },
  settings_changed: { ar: 'تغيير إعدادات', en: 'Settings Changed', fr: 'Paramètres Modifiés' },
  user_added: { ar: 'إضافة مستخدم', en: 'User Added', fr: 'Utilisateur Ajouté' },
  user_deleted: { ar: 'حذف مستخدم', en: 'User Deleted', fr: 'Utilisateur Supprimé' },
  password_changed: { ar: 'تغيير كلمة مرور', en: 'Password Changed', fr: 'Mot de passe Changé' },
  backup_created: { ar: 'إنشاء نسخة احتياطية', en: 'Backup Created', fr: 'Sauvegarde Créée' },
  invoice_created: { ar: 'إنشاء فاتورة', en: 'Invoice Created', fr: 'Facture Créée' },
  invoice_deleted: { ar: 'حذف فاتورة', en: 'Invoice Deleted', fr: 'Facture Supprimée' },
};
