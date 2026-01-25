// Clear all demo/user data from localStorage
// This function clears products, invoices, debts, maintenance, and customers data

import { deleteAllUserData } from './supabase-store';

const STORAGE_KEYS_TO_CLEAR = [
  'hyperpos_products_v1',
  'hyperpos_invoices_v1', 
  'hyperpos_maintenance_v1',
  'hyperpos_services_v1',
  'hyperpos_customers_v1',
  'hyperpos_debts_v1',
  'hyperpos_expenses_v1',
  'hyperpos_partners_v1',
  'hyperpos_cashbox_v1',
  'hyperpos_shifts_v1',
  'hyperpos_capital_v1',
  'hyperpos_demo_loaded_v2',
  // ✅ سجلات الأرباح الجديدة
  'hyperpos_profit_records_v1',
  'hyperpos_expense_records_v1',
  // Categories are kept as they're useful defaults
];

// Version key to track if data has been cleared
const CLEAR_VERSION_KEY = 'hyperpos_clear_version';
const CURRENT_CLEAR_VERSION = '3'; // Increment this to trigger a new clear

export const clearDemoDataOnce = () => {
  try {
    const clearedVersion = localStorage.getItem(CLEAR_VERSION_KEY);
    
    // Only clear if we haven't cleared this version yet
    if (clearedVersion !== CURRENT_CLEAR_VERSION) {
      STORAGE_KEYS_TO_CLEAR.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Mark as cleared
      localStorage.setItem(CLEAR_VERSION_KEY, CURRENT_CLEAR_VERSION);
      console.log('Demo data cleared for version', CURRENT_CLEAR_VERSION);
    }
  } catch {
    // Ignore errors
  }
};

// Function to manually clear all data (can be called from settings)
export const clearAllUserData = () => {
  try {
    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * ✅ مسح شامل للبيانات (Local فوري + Cloud عند توفر الإنترنت)
 * يمسح البيانات المحلية فوراً ويحاول مسح السحابة
 * إذا فشل مسح السحابة (بسبب عدم الاتصال) يُجدول لاحقاً
 */
export const clearAllDataCompletely = async (): Promise<boolean> => {
  const PENDING_CLOUD_CLEAR_KEY = 'hyperpos_pending_cloud_clear';
  
  try {
    // 1. مسح Local Storage فوراً (لا يحتاج إنترنت)
    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 2. إعادة تعيين الصندوق لصفر
    localStorage.setItem('hyperpos_cashbox_v1', JSON.stringify({
      currentBalance: 0,
      lastUpdated: new Date().toISOString(),
    }));
    
    // 3. إعادة تعيين رأس المال
    localStorage.setItem('hyperpos_capital_v1', JSON.stringify({
      initialCapital: 0,
      currentCapital: 0,
      totalInvestments: 0,
      totalWithdrawals: 0,
      transactions: [],
      lastUpdated: new Date().toISOString(),
    }));
    
    console.log('[ClearData] Local data cleared successfully');
    
    // 4. محاولة مسح Cloud مع timeout
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (!isOnline) {
      // لا يوجد إنترنت - جدول المسح لاحقاً
      localStorage.setItem(PENDING_CLOUD_CLEAR_KEY, 'true');
      console.log('[ClearData] Offline - cloud clear scheduled for later');
      return true; // نعتبرها نجاح لأن المحلي تم مسحه
    }
    
    // محاولة مسح السحابة مع timeout 10 ثواني
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Cloud clear timeout')), 10000);
    });
    
    try {
      await Promise.race([
        deleteAllUserData(),
        timeoutPromise
      ]);
      console.log('[ClearData] Cloud data cleared successfully');
    } catch (cloudError) {
      console.warn('[ClearData] Cloud clear failed or timed out:', cloudError);
      // جدول المسح لاحقاً
      localStorage.setItem(PENDING_CLOUD_CLEAR_KEY, 'true');
    }
    
    return true;
  } catch (error) {
    console.error('[ClearData] Failed to clear data:', error);
    return false;
  }
};

/**
 * تنفيذ مسح السحابة المعلق (يُستدعى عند عودة الإنترنت)
 */
export const executePendingCloudClear = async (): Promise<void> => {
  const PENDING_CLOUD_CLEAR_KEY = 'hyperpos_pending_cloud_clear';
  const isPending = localStorage.getItem(PENDING_CLOUD_CLEAR_KEY);
  
  if (!isPending) return;
  
  try {
    await deleteAllUserData();
    localStorage.removeItem(PENDING_CLOUD_CLEAR_KEY);
    console.log('[ClearData] Pending cloud clear executed successfully');
  } catch (error) {
    console.error('[ClearData] Failed to execute pending cloud clear:', error);
  }
};
