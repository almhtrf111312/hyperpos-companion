// Cloud Sync Provider - Wraps the app and ensures cloud sync is properly initialized
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { setCurrentUserId, fetchStoreSettings, saveStoreSettings } from '@/lib/supabase-store';
import { EVENTS, emitEvent, emitAppRefresh } from '@/lib/events';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { executePendingCloudClear } from '@/lib/clear-demo-data';
import { processQueue, getQueueStatus, getFailedOperations, loadQueue } from '@/lib/sync-queue';
import { processDebtSaleBundleFromQueue } from '@/lib/cloud/debt-sale-handler';
import { processCashSaleBundleFromQueue } from '@/lib/cloud/cash-sale-handler';
import { processQuickPurchaseFromQueue, processPurchaseInvoiceFromQueue } from '@/lib/cloud/purchase-queue-processor';
import { showToast } from '@/lib/toast-config';
import { useNetworkStatus, checkRealInternetAccess } from '@/hooks/use-network-status';
import { processGenericQueuedOperation } from '@/lib/cloud/sync-operation-processor';
import { warmupAllCaches } from '@/lib/cloud/cache-warmup';
import { isGuestDemoMode } from '@/lib/demo-data';
import { isOperationCancelled, reconcileCancelledOperationsWithCloud } from '@/lib/cancellation-registry';
import { resetOfflineInvoiceCounter, clearOfflineLease } from '@/lib/offline-lease';
import {
  loadUnifiedStoreSettings,
  mergeStoreSettings,
  applySettingsToRuntime,
  saveUnifiedStoreSettings,
  buildCloudStorePayload,
  pullStoreSettingsWithGuard,
  DEFAULT_UNIFIED_SETTINGS,
} from '@/lib/store-settings-sync';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';
const LAST_USER_KEY = 'hyperpos_last_user_id';

// فترة إعادة المحاولة الدورية التلقائية في الخلفية: 45 ثانية عند وجود عمليات معلقة
const PERIODIC_RETRY_INTERVAL_MS = 30 * 1000;

/**
 * توضيح السبب الحقيقي لفشل المزامنة الصادر من الخادم بدقة
 */
function formatSyncServerError(error: unknown): string {
  if (!error) return 'خطأ غير محدد أثناء الاتصال بالخادم';
  const raw = typeof error === 'string' ? error : (error as { message?: string })?.message || String(error);
  const lower = raw.toLowerCase();

  // 1. انتهاء الجلسة أو خطأ المصادقة
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('session') || lower.includes('unauthorized') || lower.includes('auth')) {
    return 'انتهاء الجلسة (يرجى تسجيل الدخول مجدداً)';
  }

  // 2. خطأ في صلاحيات الحساب
  if (lower.includes('permission') || lower.includes('row-level security') || lower.includes('policy') || lower.includes('access denied') || lower.includes('forbidden')) {
    return 'خطأ في صلاحيات الحساب (لا تملك الصلاحية الكافية لإتمام هذه العملية)';
  }

  // 3. تعارض في البيانات
  if (lower.includes('conflict') || lower.includes('duplicate') || lower.includes('unique constraint') || lower.includes('already exists')) {
    return 'تعارض في البيانات (البيانات موجودة مسبقاً في السحابة)';
  }

  if (lower.includes('foreign key') || lower.includes('violates foreign key')) {
    return 'تعارض في البيانات (سجل مرتبط غير موجود في السحابة)';
  }

  // 4. استجابة بطيئة أو انقطاع
  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('gateway')) {
    return 'استجابة الخادم بطيئة (مهلة الاتصال)';
  }

  return raw;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  targetSuccess?: boolean;
}

interface CloudSyncContextType {
  isReady: boolean;
  isSyncing: boolean;
  isPaused: boolean;
  hasInternetAccess: boolean;
  isOnline: boolean;
  lastSyncTime: string | null;
  syncNow: (forceDirect?: boolean, targetOperationId?: string) => Promise<SyncResult>;
  syncImmediately: () => Promise<SyncResult>;
  pauseSync: () => void;
  resumeSync: () => void;
}

// 1. تعريف الكائن الآمن الافتراضي:
const SAFE_CLOUD_SYNC_FALLBACK: CloudSyncContextType = {
  isReady: false,
  isSyncing: false,
  isPaused: false,
  hasInternetAccess: true,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSyncTime: null,
  syncNow: async () => ({ success: false, processed: 0, failed: 0 }),
  syncImmediately: async () => ({ success: false, processed: 0, failed: 0 }),
  pauseSync: () => {},
  resumeSync: () => {},
};

// Export context for safe usage in components that may render outside provider
// eslint-disable-next-line react-refresh/only-export-components
export const CloudSyncContext = createContext<CloudSyncContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useCloudSyncContext = () => {
  const context = useContext(CloudSyncContext);
  if (!context) {
    console.warn('[CloudSync] useCloudSyncContext accessed outside provider, using safe fallback');
    return SAFE_CLOUD_SYNC_FALLBACK;
  }
  return context;
};

interface CloudSyncProviderProps {
  children: ReactNode;
}

const PAUSE_KEY = 'hyperpos_sync_paused';

export function CloudSyncProvider({ children }: CloudSyncProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
  });
  const [hasInternetAccess, setHasInternetAccess] = useState(true);
  const { isOnline } = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const periodicRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pauseSync = useCallback(() => {
    setIsPaused(true);
    try { localStorage.setItem(PAUSE_KEY, '1'); } catch { /* noop */ }
    showToast.info('تم إيقاف المزامنة مؤقتاً', 'البيانات الجديدة ستُحفظ محلياً وتُرفع عند الاستئناف');
  }, []);

  const resumeSync = useCallback(() => {
    setIsPaused(false);
    try { localStorage.removeItem(PAUSE_KEY); } catch { /* noop */ }
    showToast.success('تم استئناف المزامنة', 'جاري رفع التغييرات...');
    setTimeout(() => { syncNowRef.current?.(); }, 50);
  }, []);

  const syncNowRef = useRef<((forceDirect?: boolean, targetOperationId?: string) => Promise<SyncResult>) | null>(null);
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef(false);

  // Enable realtime sync for instant updates across devices
  useRealtimeSync();
  
  // مراقبة عودة الاتصال بالإنترنت لتشغيل المزامنة التلقائية
  // مع فحص فعلي للإنترنت (وليس فقط الشبكة)
  useEffect(() => {
    if (isGuestDemoMode()) return;
    if (isOnline && wasOffline && user) {
      // الشبكة عادت - لكن نفحص الإنترنت الفعلي أولاً
      console.log('[CloudSync] Network restored, checking real internet access...');
      checkRealInternetAccess(6000).then(hasInternet => {
        if (hasInternet) {
          console.log('[CloudSync] Real internet confirmed, starting sync...');
          showToast.info('جاري المزامنة...', 'جاري رفع البيانات المعلقة');
          syncNowRef.current?.();
        } else {
          console.log('[CloudSync] Network connected but no real internet access, will retry later');
          // ✅ رسالة تنبيه ناعمة بدلاً من خطأ أحمر
          showToast.info('متصل بالشبكة — في انتظار الإنترنت', 'سيتم المزامنة تلقائياً عند توفر الاتصال');
        }
      });
    }
    setWasOffline(!isOnline);
  }, [isOnline, wasOffline, user]);

  // مستمع حدث عودة الإنترنت من المتصفح مباشرةً
  useEffect(() => {
    if (!user || isGuestDemoMode()) return;
    const handleOnline = () => {
      console.log('[CloudSync] window online event fired, triggering sync & warmup...');
      setTimeout(() => {
        syncNowRef.current?.(true);
        warmupAllCaches(true).catch(() => {});
      }, 200);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  // مؤقت دوري لإعادة محاولة المزامنة
  useEffect(() => {
    if (!user || isGuestDemoMode()) return;

    periodicRetryRef.current = setInterval(async () => {
      if (isSyncingRef.current) return;
      console.log('[CloudSync] Periodic background sync check...');
      const hasInternet = await checkRealInternetAccess(4000);
      if (hasInternet) {
        syncNowRef.current?.();
        warmupAllCaches().catch(() => {});
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
          key !== 'hyperpos_theme' &&
          key !== 'hyperpos_setup_complete' &&
          key !== 'hyperpos_privacy_accepted' &&
          key !== 'hyperpos_privacy_version' &&
          key !== 'hyperpos_recurring_expenses_v1') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[CloudSync] Cleared ${keysToRemove.length} user-specific localStorage keys`);
  }, []);

  const initializeCloudData = useCallback(async () => {
    if (!user) return;
    if (isGuestDemoMode()) {
      setIsReady(true);
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);

    try {
      // Fetch recurring expenses and store settings from cloud
      import('@/lib/cloud/recurring-expenses-cloud').then(({ loadRecurringExpensesCloud }) => {
        loadRecurringExpensesCloud().catch(() => {});
      });

      // سحب الإعدادات بحماية Anti-Overwrite Guard (Pull-Before-Push) دون أي رفع تلقائي
      await pullStoreSettingsWithGuard();

      const isJustSignedUp = typeof window !== 'undefined' && sessionStorage.getItem('hyperpos_just_signed_up') === 'true';
      if (!isJustSignedUp) {
        localStorage.setItem('hyperpos_setup_complete', 'true');
      }

      setLastSyncTime(new Date().toISOString());

      // Warm up and cache all store tabs in the background (invoices, customers, debts, purchases, etc.)
      warmupAllCaches().catch(() => {});
    } catch (error) {
      console.error('Cloud sync initialization error:', error);
    } finally {
      setIsSyncing(false);
      setIsReady(true);
    }
  }, [user]);

  // Initialize cloud sync when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (isGuestDemoMode()) {
      setIsReady(true);
      return;
    }

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
      // 🎫 مسح تذكرة الأوفلاين وعدادها عند تبديل الحساب
      clearOfflineLease();
      // ✅ مسح IndexedDB عند تغيير المستخدم
      import('@/lib/indexeddb-cache').then(({ clearProductsIDB }) => {
        clearProductsIDB();
        console.log('[CloudSync] Cleared IndexedDB products cache on user change');
      });
    }
    localStorage.setItem(LAST_USER_KEY, user.id);

    setCurrentUserId(user.id);
    initializeCloudData();
  }, [user, authLoading, clearUserLocalStorage, initializeCloudData]);

  const syncNow = useCallback(async (forceDirect: boolean = false, targetOperationId?: string): Promise<SyncResult> => {
    if (isGuestDemoMode()) {
      return { success: true, processed: 0, failed: 0 };
    }
    if (!user) return { success: false, processed: 0, failed: 0 };
    if (isPaused) {
      console.log('[CloudSync] Sync skipped: paused by user');
      return { success: false, processed: 0, failed: 0 };
    }

    if (isSyncingRef.current) {
      console.log('[CloudSync] Sync already in progress, waiting briefly...');
      const startWait = Date.now();
      while (isSyncingRef.current && Date.now() - startWait < 3000) {
        await new Promise(r => setTimeout(r, 150));
      }
      if (isSyncingRef.current) {
        pendingSyncRef.current = true;
        return { success: false, processed: 0, failed: 0 };
      }
    }

    // Verify internet access
    // ✅ في المزامنة الفورية بعد عملية البيع (forceDirect)، لا نحظر المعالجة بفحوصات خارجية بطيئة
    // بل نتصل مباشرة بـ Supabase لمعالجة الطابور، فإذا رد الخادم كان هذا إثباتاً قاطعاً للاتصال
    if (navigator.onLine) {
      if (!forceDirect) {
        const hasInternet = await checkRealInternetAccess(3000);
        setHasInternetAccess(hasInternet);
        if (!hasInternet) {
          console.log('[CloudSync] No real internet access, skipping periodic sync silently');
          return { success: false, processed: 0, failed: 0 };
        }
      }
    } else {
      setHasInternetAccess(false);
      return { success: false, processed: 0, failed: 0 };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      await executePendingCloudClear();

      const pendingBefore = getQueueStatus().pendingCount + getQueueStatus().processingCount;

      try {
        await reconcileCancelledOperationsWithCloud();
      } catch (recErr) {
        console.warn('[CloudSyncProvider] Cancellation reconciliation error:', recErr);
      }

      let processedRefund = false;
      let processedNonRefund = false;
      const result = await processQueue(async (operation) => {
        const opKey = String(operation.data.uniqueKey || operation.data.operationId || operation.data.localId || operation.id);
        const bInv = (operation.data?.bundle as any)?.invoiceNumber || operation.data?.invoiceNumber;
        if (isOperationCancelled(opKey) || (bInv && isOperationCancelled(String(bInv)))) {
          console.warn('[CloudSyncProvider] Skipping cancelled operation from processor:', opKey || bInv);
          return true;
        }

        if (operation.type === 'invoice_refund') processedRefund = true;
        else processedNonRefund = true;
        if (operation.type === 'debt_sale_bundle') {
          return await processDebtSaleBundleFromQueue((operation.data as unknown) as Parameters<typeof processDebtSaleBundleFromQueue>[0]);
        }
        if (operation.type === 'invoice_create') {
          return await processCashSaleBundleFromQueue((operation.data as unknown) as Parameters<typeof processCashSaleBundleFromQueue>[0]);
        }
        if (operation.type === 'quick_purchase') {
          return await processQuickPurchaseFromQueue((operation.data as unknown) as Parameters<typeof processQuickPurchaseFromQueue>[0]);
        }
        if (operation.type === 'purchase_invoice') {
          return await processPurchaseInvoiceFromQueue((operation.data as unknown) as Parameters<typeof processPurchaseInvoiceFromQueue>[0]);
        }
        if (operation.type === 'invoice_refund') {
          const { refundInvoiceCloud } = await import('@/lib/cloud/invoices-cloud');
          const invoiceNumber = (operation.data as { invoiceNumber: string }).invoiceNumber;
          const res = await refundInvoiceCloud(invoiceNumber, 'offline-sync');
          // An already-refunded invoice is an idempotent success; a real failure retries.
          return res === true || (typeof res === 'object' && (res.success || res.alreadyRefunded === true));
        }
        if (operation.type === 'invoice_refund_partial') {
          const { refundInvoicePartialCloud } = await import('@/lib/cloud/invoices-cloud');
          const { invoiceNumber, itemsToRefund, operationId } = operation.data as { invoiceNumber: string; itemsToRefund: any[]; operationId?: string };
          const res = await refundInvoicePartialCloud(invoiceNumber, itemsToRefund, operationId || `legacy-${operation.id}`);
          if (!res.success) throw new Error(res.error || 'فشل الاسترداد الجزئي');
          return true;
        }
        if (operation.type === 'store_settings_update') {
          const { saveStoreSettingsDirect } = await import('@/lib/supabase-store');
          return await saveStoreSettingsDirect(operation.data as Record<string, unknown>);
        }
        return processGenericQueuedOperation(operation);
      }, targetOperationId);

      // 🔔 إشعار موحد ونهائي يمنع تكدس الإشعارات
      if (pendingBefore > 0 || result.processed > 0 || result.failed > 0) {
        // معرف ثابت لـ Toast لضمان استبدال أي إشعار سابق وعدم تراكمها
        const TOAST_SYNC_ID = 'unified-sync-summary';

        if (result.processed > 0 && result.failed === 0) {
          showToast.success('اكتملت المزامنة بنجاح', {
            id: TOAST_SYNC_ID,
            description: `تمت مزامنة كافة العمليات بنجاح (${result.processed} عملية) ✓`,
            duration: 4000,
          });
        } else if (result.processed > 0 && result.failed > 0) {
          showToast.info('اكتملت المزامنة جزئياً', {
            id: TOAST_SYNC_ID,
            description: `تمت مزامنة ${result.processed} عملية بنجاح — تعذرت ${result.failed} عملية`,
            duration: 5000,
          });
        } else if (result.failed > 0 && result.processed === 0) {
          showToast.error('تعذرت المزامنة', {
            id: TOAST_SYNC_ID,
            description: `فشلت مزامنة ${result.failed} عملية — يرجى مراجعة سبب التعثر في قائمة العمليات`,
            duration: 5000,
          });
        }
      } else if (forceDirect && !targetOperationId) {
        // إذا ضغط المستخدم ولم تكن هناك أي عمليات معلقة
        showToast.info('النظام متطابق', {
          id: 'unified-sync-summary',
          description: 'لا توجد فواتير أو عمليات معلقة بحاجة للمزامنة',
          duration: 3000,
        });
      }

      if (result.processed > 0) {
        const { invalidateAllCaches } = await import('@/lib/cloud');
        await invalidateAllCaches();
        warmupAllCaches(true).catch(() => {});
        // 🎫 مزامنة ناجحة بالكامل = تصفير عداد فواتير الأوفلاين
        if (result.failed === 0) resetOfflineInvoiceCounter();
      }

      const cloudSettings = await fetchStoreSettings();
      if (cloudSettings) {
        const localSettings = loadUnifiedStoreSettings();
        const merged = mergeStoreSettings(localSettings, cloudSettings);
        applySettingsToRuntime(merged);

        const isJustSignedUp = typeof window !== 'undefined' && sessionStorage.getItem('hyperpos_just_signed_up') === 'true';
        if (!isJustSignedUp) {
          localStorage.setItem('hyperpos_setup_complete', 'true');
        }
      }

      emitEvent(EVENTS.PRODUCTS_UPDATED);
      emitEvent(EVENTS.INVOICES_UPDATED);
      emitEvent(EVENTS.DEBTS_UPDATED);
      emitEvent(EVENTS.CUSTOMERS_UPDATED);
      emitEvent(EVENTS.PARTNERS_UPDATED);
      emitEvent(EVENTS.EXPENSES_UPDATED);
      emitEvent(EVENTS.SETTINGS_UPDATED);

      setLastSyncTime(new Date().toISOString());
      setHasInternetAccess(true);

      return {
        success: targetOperationId
          ? (result.targetSuccess ?? (result.failed === 0 && result.processed > 0))
          : (result.failed === 0 && result.processed > 0),
        processed: result.processed,
        failed: result.failed,
        targetSuccess: result.targetSuccess,
      };
    } catch (error) {
      console.error('Manual sync error:', error);
      // ✅ عرض سبب الفشل الحقيقي من الخادم إذا كان الجهاز متصلاً بالشبكة
      if (navigator.onLine && !forceDirect) {
        const friendlyError = formatSyncServerError(error);
        showToast.error('فشلت المزامنة', {
          description: friendlyError,
        });
      }
      return { success: false, processed: 0, failed: 1, targetSuccess: false };
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);

      // إذا ورد طلب مزامنة أثناء تنفيذ هذه العملية، نشغله فوراً لمعالجة العناصر الجديدة
      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        setTimeout(() => {
          syncNowRef.current?.(true);
        }, 50);
      }
    }
  }, [user, isPaused]);

  // expose latest syncNow to refs (for resume callback)
  useEffect(() => { syncNowRef.current = syncNow; }, [syncNow]);

  const syncImmediately = useCallback(async (): Promise<SyncResult> => {
    if (!user || isPaused) return { success: false, processed: 0, failed: 0 };
    return await (syncNowRef.current ? syncNowRef.current(true) : syncNow(true));
  }, [user, syncNow, isPaused]);

  return (
    <CloudSyncContext.Provider value={{ isReady, isSyncing, isPaused, hasInternetAccess, isOnline, lastSyncTime, syncNow, syncImmediately, pauseSync, resumeSync }}>
      {children}
    </CloudSyncContext.Provider>
  );
}