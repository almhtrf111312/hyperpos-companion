import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { setCurrentUserId, fetchStoreSettings, saveStoreSettings, insertToSupabase, updateInSupabase, deleteFromSupabase } from '@/lib/supabase-store';
import { EVENTS, emitEvent } from '@/lib/events';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { executePendingCloudClear } from '@/lib/clear-demo-data';
import { processQueue, getPendingOperations } from '@/lib/sync-queue';
import { processDebtSaleBundleFromQueue } from '@/lib/cloud/debt-sale-handler';
import { showToast } from '@/lib/toast-config';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { supabase } from '@/integrations/supabase/client';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

interface CloudSyncContextType {
  isReady: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<void>;
  pendingCount: number;
}

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

async function processProductOperation(data: Record<string, unknown>): Promise<boolean> {
  const action = data.action as string;
  
  if (action === 'add_product') {
    const product = data.product as Record<string, unknown>;
    const cloudData: Record<string, unknown> = {
      name: product.name,
      barcode: product.barcode || null,
      barcode2: product.barcode2 || null,
      barcode3: product.barcode3 || null,
      category: product.category || null,
      cost_price: product.costPrice || 0,
      sale_price: product.salePrice || 0,
      quantity: product.quantity || 0,
      min_stock_level: product.minStockLevel || 1,
      expiry_date: product.expiryDate || null,
      image_url: product.image || null,
      archived: false,
    };
    const inserted = await insertToSupabase('products', cloudData, { silent: true });
    return !!inserted;
  }
  
  if (action === 'update_product') {
    const productId = data.productId as string;
    const updates = data.data as Record<string, unknown>;
    if (productId.startsWith('local_')) return true;
    const cloudUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) cloudUpdates.name = updates.name;
    if (updates.barcode !== undefined) cloudUpdates.barcode = updates.barcode || null;
    if (updates.costPrice !== undefined) cloudUpdates.cost_price = updates.costPrice;
    if (updates.salePrice !== undefined) cloudUpdates.sale_price = updates.salePrice;
    if (updates.quantity !== undefined) cloudUpdates.quantity = updates.quantity;
    if (updates.category !== undefined) cloudUpdates.category = updates.category || null;
    if (updates.minStockLevel !== undefined) cloudUpdates.min_stock_level = updates.minStockLevel;
    if (Object.keys(cloudUpdates).length > 0) {
      return await updateInSupabase('products', productId, cloudUpdates);
    }
    return true;
  }
  
  if (action === 'delete_product') {
    const productId = data.productId as string;
    if (productId.startsWith('local_')) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('stock_transfer_items').delete().eq('product_id', productId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('warehouse_stock').delete().eq('product_id', productId);
    return await deleteFromSupabase('products', productId);
  }
  
  return true;
}

export function CloudSyncProvider({ children }: CloudSyncProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const { isOnline } = useNetworkStatus();
  const wasOfflineRef = useRef(false);

  useRealtimeSync();
  
  useEffect(() => {
    const count = getPendingOperations().length;
    setPendingCount(count);
    
    const handleUpdate = () => {
      setPendingCount(getPendingOperations().length);
    };
    window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleUpdate);
  }, []);

  useEffect(() => {
    if (isOnline && wasOfflineRef.current && user) {
      console.log('[CloudSync] Internet restored, starting auto-sync...');
      showToast.info('جاري المزامنة...', 'جاري رفع البيانات المعلقة');
      syncNow();
    }
    wasOfflineRef.current = !isOnline;
  }, [isOnline, user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCurrentUserId(null);
      setIsReady(true);
      return;
    }

    setCurrentUserId(user.id);
    initializeCloudData();
  }, [user, authLoading]);

  const initializeCloudData = useCallback(async () => {
    if (!user) return;

    setIsSyncing(true);

    try {
      if (navigator.onLine) {
        const cloudSettings = await fetchStoreSettings();
        
        if (cloudSettings) {
          const existingRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          
          const merged = {
            ...existing,
            storeSettings: {
              name: cloudSettings.name || existing.storeSettings?.name || 'متجري',
              phone: cloudSettings.phone || existing.storeSettings?.phone || '',
              address: cloudSettings.address || existing.storeSettings?.address || '',
              logo: cloudSettings.logo_url || existing.storeSettings?.logo || '',
            },
            exchangeRates: cloudSettings.exchange_rates || existing.exchangeRates || { TRY: 33, SYP: 14000 },
            language: cloudSettings.language || existing.language || 'ar',
            theme: cloudSettings.theme || existing.theme || 'dark',
            taxEnabled: cloudSettings.tax_enabled ?? existing.taxEnabled ?? false,
            taxRate: cloudSettings.tax_rate ?? existing.taxRate ?? 0,
            printSettings: cloudSettings.print_settings || existing.printSettings || {},
            notificationSettings: cloudSettings.notification_settings || existing.notificationSettings || {},
          };
          
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
          emitEvent(EVENTS.SETTINGS_UPDATED);
        } else {
          const localRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
          if (localRaw) {
            try {
              const local = JSON.parse(localRaw);
              await saveStoreSettings({
                name: local.storeSettings?.name || 'متجري',
                phone: local.storeSettings?.phone,
                address: local.storeSettings?.address,
                logo_url: local.storeSettings?.logo,
                store_type: local.storeType || 'phones',
                language: local.language || 'ar',
                theme: local.theme || 'dark',
                exchange_rates: local.exchangeRates || { TRY: 33, SYP: 14000 },
                tax_enabled: local.taxEnabled || false,
                tax_rate: local.taxRate || 0,
                print_settings: local.printSettings || {},
                notification_settings: local.notificationSettings || {},
              });
            } catch (e) {
              console.error('Failed to migrate local settings:', e);
            }
          } else {
            await saveStoreSettings({
              name: 'متجري',
              store_type: 'phones',
              language: 'ar',
              theme: 'dark',
              exchange_rates: { TRY: 33, SYP: 14000 },
            });
          }
        }
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
    if (!user || isSyncing || !navigator.onLine) return;

    setIsSyncing(true);

    try {
      await executePendingCloudClear();
      
      const result = await processQueue(async (operation) => {
        if (operation.type === 'debt_sale_bundle') {
          return await processDebtSaleBundleFromQueue(operation.data as { localId: string; bundle: any });
        }
        
        if (operation.type === 'sale' || operation.type === 'stock_update') {
          return await processProductOperation(operation.data);
        }
        
        if (operation.type === 'customer_update') {
          return true;
        }
        
        if (operation.type === 'invoice_create') {
          return true;
        }
        
        if (operation.type === 'expense') {
          return true;
        }
        
        if (operation.type === 'debt' || operation.type === 'debt_payment') {
          return true;
        }

        console.log('[SyncQueue] Processing operation:', operation.type);
        return true;
      });
      
      const { invalidateAllCaches } = await import('@/lib/cloud');
      invalidateAllCaches();

      const cloudSettings = await fetchStoreSettings();
      if (cloudSettings) {
        const existingRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        
        const merged = {
          ...existing,
          storeSettings: {
            name: cloudSettings.name || existing.storeSettings?.name,
            phone: cloudSettings.phone || existing.storeSettings?.phone,
            address: cloudSettings.address || existing.storeSettings?.address,
            logo: cloudSettings.logo_url || existing.storeSettings?.logo,
          },
          exchangeRates: cloudSettings.exchange_rates || existing.exchangeRates,
        };
        
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      emitEvent(EVENTS.PRODUCTS_UPDATED);
      emitEvent(EVENTS.INVOICES_UPDATED);
      emitEvent(EVENTS.DEBTS_UPDATED);
      emitEvent(EVENTS.CUSTOMERS_UPDATED);
      emitEvent(EVENTS.PARTNERS_UPDATED);
      emitEvent(EVENTS.EXPENSES_UPDATED);
      emitEvent(EVENTS.SETTINGS_UPDATED);

      setLastSyncTime(new Date().toISOString());
      setPendingCount(0);
      
      if (result.failed > 0) {
        showToast.error(`تمت المزامنة مع ${result.failed} أخطاء`, { description: 'سيتم إعادة المحاولة لاحقاً' });
      } else {
        showToast.success('تمت المزامنة بنجاح', 'تم رفع جميع البيانات');
      }
    } catch (error) {
      console.error('Sync error:', error);
      showToast.error('فشل في المزامنة', { description: 'سيتم إعادة المحاولة لاحقاً' });
    } finally {
      setIsSyncing(false);
    }
  }, [user, isSyncing]);

  return (
    <CloudSyncContext.Provider value={{ isReady, isSyncing, lastSyncTime, syncNow, pendingCount }}>
      {children}
    </CloudSyncContext.Provider>
  );
}
