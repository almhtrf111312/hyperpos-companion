// Clear all demo/user data from localStorage and IndexedDB
// This module handles complete data reset locally and on the cloud via RPC reset_user_store_data

import { supabase } from '@/integrations/supabase/client';
import { deleteAllUserData } from './supabase-store';
import { clearProductsIDB } from './indexeddb-cache';

export const STORAGE_KEYS_TO_CLEAR = [
  'hyperpos_products_v1',
  'hyperpos_invoices_v1', 
  'hyperpos_purchase_invoices_v1',
  'hyperpos_maintenance_v1',
  'hyperpos_services_v1',
  'hyperpos_customers_v1',
  'hyperpos_debts_v1',
  'hyperpos_expenses_v1',
  'hyperpos_recurring_expenses_v1',
  'hyperpos_partners_v1',
  'hyperpos_cashbox_v1',
  'hyperpos_shifts_v1',
  'hyperpos_capital_v1',
  'hyperpos_demo_loaded_v2',
  'hyperpos_profit_records_v1',
  'hyperpos_expense_records_v1',
  'hyperpos_warehouses_v1',
  'hyperpos_stock_transfers_v1',
  'hyperpos_held_carts_v1',
  'hyperpos_temp_cart',
  'hyperpos_cart_customer',
  'hyperpos_cart_discount',
  'hyperpos_refund_meta_v1',
  'hyperpos_dashboard_stats_cache_v1',
  'hyperpos_pending_scan',
  'hyperpos_scan_target',
  'hyperpos_product_form_temp',
  'hyperpos_restored_image_temp',
  'hyperpos_categories_v1',
];

const PRESERVED_KEYS = new Set([
  'hyperpos_language',
  'hyperpos_theme',
  'hyperpos_stay_logged_in',
  'hyperpos_session_cache',
  'hyperpos_setup_complete',
  'hyperpos_clear_version',
  'hyperpos_settings_layout_mode',
]);

// Version key to track if data has been cleared
const CLEAR_VERSION_KEY = 'hyperpos_clear_version';
const CURRENT_CLEAR_VERSION = '4'; // Increment this to trigger a new clear

/**
 * مسح جميع مخازن IndexedDB التابعة للبيانات
 */
export const clearIndexedDBData = async (): Promise<void> => {
  try {
    await clearProductsIDB();
  } catch (e) {
    console.warn('[ClearData] clearProductsIDB error:', e);
  }

  if (typeof window !== 'undefined' && window.indexedDB) {
    const dbsToDelete = ['hyperpos_cache', 'flowpos_images_cache', 'hyperpos_cache_db'];
    for (const dbName of dbsToDelete) {
      try {
        const req = indexedDB.deleteDatabase(dbName);
        await new Promise((resolve) => {
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
          req.onblocked = () => resolve(false);
        });
      } catch (e) {
        console.warn(`[ClearData] deleteDatabase(${dbName}) error:`, e);
      }
    }
  }
};

/**
 * مسح جميع مفاتيح localStorage التابعة للبيانات مع الاحتفاظ بإعدادات الحساب والجلسة
 */
export const clearLocalStorageData = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Do not touch Supabase auth sessions
      if (key.startsWith('sb-')) continue;
      // Do not touch preserved settings
      if (PRESERVED_KEYS.has(key)) continue;

      if (key.startsWith('hyperpos_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      localStorage.removeItem(key);
    });

    // إعادة تعيين الصندوق لصفر
    localStorage.setItem('hyperpos_cashbox_v1', JSON.stringify({
      currentBalance: 0,
      lastUpdated: new Date().toISOString(),
    }));

    // إعادة تعيين رأس المال لصفر
    localStorage.setItem('hyperpos_capital_v1', JSON.stringify({
      initialCapital: 0,
      currentCapital: 0,
      totalInvestments: 0,
      totalWithdrawals: 0,
      transactions: [],
      lastUpdated: new Date().toISOString(),
    }));

    console.log('[ClearData] LocalStorage data cleared successfully');
  } catch (e) {
    console.warn('[ClearData] Error clearing localStorage:', e);
  }
};

export const clearDemoDataOnce = () => {
  try {
    const clearedVersion = localStorage.getItem(CLEAR_VERSION_KEY);
    
    // Only clear if we haven't cleared this version yet
    if (clearedVersion !== CURRENT_CLEAR_VERSION) {
      clearLocalStorageData();
      
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
    clearLocalStorageData();
    clearIndexedDBData().catch(() => {});
    return true;
  } catch {
    return false;
  }
};

/**
 * ✅ مسح شامل للبيانات:
 * 1. استدعاء supabase.rpc('reset_user_store_data') لمسح السحابة دفعة واحدة بأمان
 * 2. مسح جميع مفاتيح localStorage ومخازن IndexedDB التابعة للبيانات فوراً بعد نجاح الاستدعاء
 */
export const clearAllDataCompletely = async (): Promise<boolean> => {
  const PENDING_CLOUD_CLEAR_KEY = 'hyperpos_pending_cloud_clear';
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  try {
    if (isOnline) {
      // 1. استدعاء دالة السحابة الموحدة reset_user_store_data
      const { error: rpcError } = await supabase.rpc('reset_user_store_data');
      if (rpcError) {
        console.warn('[ClearData] reset_user_store_data RPC error, falling back to deleteAllUserData:', rpcError);
        const fallbackSuccess = await deleteAllUserData();
        if (!fallbackSuccess) {
          throw new Error(rpcError.message || 'Failed to execute reset_user_store_data');
        }
      }
      console.log('[ClearData] Cloud store data reset successfully');
    } else {
      localStorage.setItem(PENDING_CLOUD_CLEAR_KEY, 'true');
      console.log('[ClearData] Offline - cloud clear scheduled for later');
    }

    // 2. مسح جميع مفاتيح localStorage ومخازن IndexedDB التابعة للبيانات فوراً بعد نجاح الاستدعاء
    clearLocalStorageData();
    await clearIndexedDBData();

    // 3. مسح كاش الذاكرة
    try {
      const { invalidateAllCaches } = await import('./cloud');
      await invalidateAllCaches();
    } catch {
      // ignore
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
    const { error } = await supabase.rpc('reset_user_store_data');
    if (error) {
      await deleteAllUserData();
    }
    localStorage.removeItem(PENDING_CLOUD_CLEAR_KEY);
    console.log('[ClearData] Pending cloud clear executed successfully');
  } catch (error) {
    console.error('[ClearData] Failed to execute pending cloud clear:', error);
  }
};
