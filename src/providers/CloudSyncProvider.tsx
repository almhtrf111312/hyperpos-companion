// Cloud Sync Provider - Wraps the app and ensures cloud sync is properly initialized
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { setCurrentUserId, fetchStoreSettings, saveStoreSettings } from '@/lib/supabase-store';
import { EVENTS, emitEvent } from '@/lib/events';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { toast } from 'sonner';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

interface CloudSyncContextType {
  isReady: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextType | null>(null);

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

  // Enable realtime sync for instant updates across devices
  useRealtimeSync();

  // Initialize cloud sync when user is authenticated
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
      // Fetch store settings from cloud
      const cloudSettings = await fetchStoreSettings();
      
      if (cloudSettings) {
        // Apply cloud settings to localStorage for local access
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
        // First time user - migrate local settings to cloud
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
          // Create default store
          await saveStoreSettings({
            name: 'متجري',
            store_type: 'phones',
            language: 'ar',
            theme: 'dark',
            exchange_rates: { TRY: 33, SYP: 14000 },
          });
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
    if (!user || isSyncing) return;

    setIsSyncing(true);

    try {
      // Invalidate all caches to force fresh data
      const { invalidateAllCaches } = await import('@/lib/cloud');
      invalidateAllCaches();

      // Refresh settings from cloud
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

      // Emit events to refresh all UI
      emitEvent(EVENTS.PRODUCTS_UPDATED);
      emitEvent(EVENTS.INVOICES_UPDATED);
      emitEvent(EVENTS.DEBTS_UPDATED);
      emitEvent(EVENTS.CUSTOMERS_UPDATED);
      emitEvent(EVENTS.PARTNERS_UPDATED);
      emitEvent(EVENTS.EXPENSES_UPDATED);
      emitEvent(EVENTS.SETTINGS_UPDATED);

      setLastSyncTime(new Date().toISOString());
      toast.success('تمت المزامنة بنجاح');
    } catch (error) {
      console.error('Manual sync error:', error);
      toast.error('فشل في المزامنة');
    } finally {
      setIsSyncing(false);
    }
  }, [user, isSyncing]);

  return (
    <CloudSyncContext.Provider value={{ isReady, isSyncing, lastSyncTime, syncNow }}>
      {children}
    </CloudSyncContext.Provider>
  );
}