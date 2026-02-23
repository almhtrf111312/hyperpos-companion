// Cloud Sync Provider - Wraps the app and ensures cloud sync is properly initialized
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { setCurrentUserId, fetchStoreSettings, saveStoreSettings } from '@/lib/supabase-store';
import { EVENTS, emitEvent } from '@/lib/events';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { toast } from 'sonner';
import { executePendingCloudClear } from '@/lib/clear-demo-data';
import { processQueue, hasPendingOperations } from '@/lib/sync-queue';
import { processDebtSaleBundleFromQueue } from '@/lib/cloud/debt-sale-handler';
import { processCashSaleBundleFromQueue } from '@/lib/cloud/cash-sale-handler';
import { processQuickPurchaseFromQueue, processPurchaseInvoiceFromQueue } from '@/lib/cloud/purchase-queue-processor';
import { showToast } from '@/lib/toast-config';
import { useNetworkStatus, checkRealInternetAccess } from '@/hooks/use-network-status';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';
const LAST_USER_KEY = 'hyperpos_last_user_id';

// فترة إعادة المحاولة الدورية: 30 دقيقة
const PERIODIC_RETRY_INTERVAL_MS = 30 * 60 * 1000;

interface CloudSyncContextType {
  isReady: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<void>;
  syncImmediately: () => void; // مزامنة فورية في الخلفية بعد عملية بيع
}

// Export context for safe usage in components that may render outside provider
export const CloudSyncContext = createContext<CloudSyncContextType | null>(null);

export const useCloudSyncContext = () => {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error('useCloudSyncContext must be used within CloudSyncProvider');
  }
  return context;
};

interface CloudSyncProviderProps {
  children: ReactNode;
}

export function CloudSyncProvider({ children }: CloudSyncProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const periodicRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enable realtime sync for instant updates across devices
  useRealtimeSync();
  
  // مراقبة عودة الاتصال بالإنترنت لتشغيل المزامنة التلقائية
  // مع فحص فعلي للإنترنت (وليس فقط الشبكة)
  useEffect(() => {
    if (isOnline && wasOffline && user) {
      // الشبكة عادت - لكن نفحص الإنترنت الفعلي أولاً
      console.log('[CloudSync] Network restored, checking real internet access...');
      checkRealInternetAccess(15000).then(hasInternet => {
        if (hasInternet) {
          console.log('[CloudSync] Real internet confirmed, starting sync...');
          showToast.info('جاري المزامنة...', 'جاري رفع البيانات المعلقة');
          syncNow();
        } else {
          console.log('[CloudSync] Network connected but no real internet access, will retry later');
          showToast.error('متصل بالشبكة لكن لا يوجد إنترنت', { description: 'سيتم إعادة المحاولة كل 30 دقيقة' });
        }
      });
    }
    setWasOffline(!isOnline);
  }, [isOnline, wasOffline, user]);

  // مؤقت دوري لإعادة محاولة المزامنة كل 30 دقيقة
  useEffect(() => {
    if (!user) return;

    periodicRetryRef.current = setInterval(async () => {
      if (!hasPendingOperations()) return;
      
      console.log('[CloudSync] Periodic retry: checking for pending operations...');
      const hasInternet = await checkRealInternetAccess(15000);
      
      if (hasInternet) {
        console.log('[CloudSync] Periodic retry: internet available, syncing...');
        syncNow();
      } else {
        console.log('[CloudSync] Periodic retry: still no internet, will try again in 30 min');
      }
    }, PERIODIC_RETRY_INTERVAL_MS);

    return () => {
      if (periodicRetryRef.current) {
        clearInterval(periodicRetryRef.current);
      }
    };
  }, [user]);

  // Clear user-specific localStorage when user changes
  const clearUserLocalStorage = useCallback(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('hyperpos_') && 
          key !== 'hyperpos_language' && 
          key !== LAST_USER_KEY &&
          key !== 'hyperpos_stay_logged_in' &&
          key !== 'hyperpos_session_cache' &&
          key !== 'hyperpos_theme') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[CloudSync] Cleared ${keysToRemove.length} user-specific localStorage keys`);
  }, []);

  // Initialize cloud sync when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCurrentUserId(null);
      setIsReady(true);
      return;
    }

    // Check if user changed - clear old data
    const lastUserId = localStorage.getItem(LAST_USER_KEY);
    if (lastUserId && lastUserId !== user.id) {
      console.log('[CloudSync] User changed, clearing old localStorage data + IndexedDB');
      clearUserLocalStorage();
      // ✅ مسح IndexedDB عند تغيير المستخدم
      import('@/lib/indexeddb-cache').then(({ clearProductsIDB }) => {
        clearProductsIDB();
        console.log('[CloudSync] Cleared IndexedDB products cache on user change');
      });
    }
    localStorage.setItem(LAST_USER_KEY, user.id);

    setCurrentUserId(user.id);
    initializeCloudData();
  }, [user, authLoading]);

  const initializeCloudData = useCallback(async () => {
    if (!user) return;

    setIsSyncing(true);

    try {
      // Fetch store settings from cloud
      const cloudSettings = await fetchStoreSettings();
      
      if (cloudSettings) {
        // Apply cloud settings to localStorage (cloud is source of truth)
        const syncObj = cloudSettings.sync_settings && typeof cloudSettings.sync_settings === 'object' 
          ? cloudSettings.sync_settings as Record<string, unknown> : {};
        const settings = {
          storeSettings: {
            name: cloudSettings.name ?? '',
            type: cloudSettings.store_type ?? 'general',
            phone: cloudSettings.phone ?? '',
            address: cloudSettings.address ?? '',
            logo: cloudSettings.logo_url ?? '',
          },
          exchangeRates: cloudSettings.exchange_rates || { TRY: '', SYP: '' },
          language: cloudSettings.language || 'ar',
          theme: cloudSettings.theme || 'dark',
          taxEnabled: cloudSettings.tax_enabled ?? false,
          taxRate: cloudSettings.tax_rate ?? 0,
          printSettings: cloudSettings.print_settings || {},
          notificationSettings: cloudSettings.notification_settings || {},
          // ✅ Restore all synced preferences from cloud
          discountPercentEnabled: syncObj.discountPercentEnabled ?? true,
          discountFixedEnabled: syncObj.discountFixedEnabled ?? true,
          hideMaintenanceSection: syncObj.hideMaintenanceSection ?? false,
          currencyNames: syncObj.currencyNames,
          backupSettings: syncObj.backupSettings,
        };
        
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        emitEvent(EVENTS.SETTINGS_UPDATED);
      } else {
        // First time user - create empty default store (don't migrate old localStorage)
        await saveStoreSettings({
          name: '',
          store_type: 'general',
          language: 'ar',
          theme: 'dark',
          exchange_rates: { TRY: 0, SYP: 0, USD: 1 },
        });
        // Set empty settings in localStorage
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
          storeSettings: { name: '', type: 'general', phone: '', address: '', logo: '' },
          exchangeRates: { TRY: 0, SYP: 0 },
          language: 'ar',
          theme: 'dark',
          taxEnabled: false,
          taxRate: 0,
        }));
        emitEvent(EVENTS.SETTINGS_UPDATED);
      }

      setLastSyncTime(new Date().toISOString());
    } catch (error) {
      console.error('Cloud sync initialization error:', error);
    } finally {
      setIsSyncing(false);
      setIsReady(true);
    }
  }, [user]);

  const syncNow = useCallback(async () => {
    if (!user || isSyncing) return;

    setIsSyncing(true);

    try {
      // أولاً: تنفيذ أي مسح سحابي معلق
      await executePendingCloudClear();
      
      // ثانياً: معالجة طابور المزامنة (البيع بالدين وغيرها)
      await processQueue(async (operation) => {
        if (operation.type === 'debt_sale_bundle') {
          return await processDebtSaleBundleFromQueue(operation.data as { localId: string; bundle: any });
        }
        if (operation.type === 'invoice_create') {
          return await processCashSaleBundleFromQueue(operation.data as { bundle: any });
        }
        if (operation.type === 'quick_purchase') {
          return await processQuickPurchaseFromQueue(operation.data as any);
        }
        if (operation.type === 'purchase_invoice') {
          return await processPurchaseInvoiceFromQueue(operation.data as any);
        }
        // أنواع أخرى يمكن إضافتها هنا
        console.log('[SyncQueue] Processing operation:', operation.type);
        return true; // Default: mark as processed
      });
      
      // ثالثاً: إبطال الكاش وجلب البيانات الجديدة
      const { invalidateAllCaches } = await import('@/lib/cloud');
      invalidateAllCaches();

      // Refresh settings from cloud
      const cloudSettings = await fetchStoreSettings();
      if (cloudSettings) {
        const existingRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        
        const syncSettingsObj = cloudSettings.sync_settings && typeof cloudSettings.sync_settings === 'object' ? cloudSettings.sync_settings as Record<string, unknown> : {};

        const merged = {
          ...existing,
          storeSettings: {
            name: cloudSettings.name || existing.storeSettings?.name,
            type: cloudSettings.store_type || existing.storeSettings?.type || 'general',
            phone: cloudSettings.phone || existing.storeSettings?.phone,
            address: cloudSettings.address || existing.storeSettings?.address,
            logo: cloudSettings.logo_url || existing.storeSettings?.logo,
          },
          exchangeRates: cloudSettings.exchange_rates || existing.exchangeRates,
          taxEnabled: cloudSettings.tax_enabled ?? existing.taxEnabled ?? false,
          taxRate: cloudSettings.tax_rate ?? existing.taxRate ?? 0,
          discountPercentEnabled: syncSettingsObj.discountPercentEnabled ?? existing.discountPercentEnabled ?? true,
          discountFixedEnabled: syncSettingsObj.discountFixedEnabled ?? existing.discountFixedEnabled ?? true,
          // ✅ Sync additional preferences from cloud
          hideMaintenanceSection: syncSettingsObj.hideMaintenanceSection ?? existing.hideMaintenanceSection ?? false,
          currencyNames: syncSettingsObj.currencyNames ?? existing.currencyNames,
          backupSettings: syncSettingsObj.backupSettings ?? existing.backupSettings,
          notificationSettings: cloudSettings.notification_settings ?? existing.notificationSettings,
          printSettings: cloudSettings.print_settings ?? existing.printSettings,
        };
        
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      // Emit events to refresh all UI
      emitEvent(EVENTS.PRODUCTS_UPDATED);
      emitEvent(EVENTS.INVOICES_UPDATED);
      emitEvent(EVENTS.DEBTS_UPDATED);
      emitEvent(EVENTS.CUSTOMERS_UPDATED);
      emitEvent(EVENTS.PARTNERS_UPDATED);
      emitEvent(EVENTS.EXPENSES_UPDATED);
      emitEvent(EVENTS.SETTINGS_UPDATED);

      setLastSyncTime(new Date().toISOString());
      showToast.success('تمت المزامنة بنجاح', 'تم رفع جميع البيانات المعلقة');
    } catch (error) {
      console.error('Manual sync error:', error);
      showToast.error('فشل في المزامنة', { description: 'سيتم إعادة المحاولة لاحقاً' });
    } finally {
      setIsSyncing(false);
    }
  }, [user, isSyncing]);

  /**
   * مزامنة فورية في الخلفية - تُستدعى بعد كل عملية بيع محلية
   * لا تنتظر الانتهاء ولا تظهر أي رسائل للمستخدم
   */
  const syncImmediately = useCallback(() => {
    if (!user) return;
    // تشغيل المزامنة في الخلفية بدون انتظار
    setTimeout(() => {
      syncNow().catch(err => {
        console.warn('[CloudSync] Background sync after sale failed (will retry):', err);
      });
    }, 100); // تأخير بسيط لضمان حفظ الطابور أولاً
  }, [user, syncNow]);

  return (
    <CloudSyncContext.Provider value={{ isReady, isSyncing, lastSyncTime, syncNow, syncImmediately }}>
      {children}
    </CloudSyncContext.Provider>
  );
}