// CloudSyncProvider - Wraps the app and initializes cloud sync
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { setCurrentUserId, fetchStoreSettings, saveStoreSettings } from '@/lib/supabase-store';
import { toast } from 'sonner';

interface CloudSyncContextType {
  isReady: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextType>({
  isReady: false,
  isSyncing: false,
  lastSyncTime: null,
  syncNow: async () => {},
});

export const useCloudSyncContext = () => useContext(CloudSyncContext);

interface CloudSyncProviderProps {
  children: ReactNode;
}

export function CloudSyncProvider({ children }: CloudSyncProviderProps) {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Initialize cloud sync when user logs in
  useEffect(() => {
    const initializeSync = async () => {
      if (user?.id) {
        console.log('[CloudSync] Initializing for user:', user.id);
        setCurrentUserId(user.id);
        
        // Try to load store settings from cloud
        const cloudSettings = await fetchStoreSettings();
        
        if (cloudSettings) {
          // Apply cloud settings to localStorage for local caching
          const localSettings = {
            storeSettings: {
              name: cloudSettings.name,
              type: cloudSettings.store_type,
              phone: cloudSettings.phone,
              address: cloudSettings.address,
              logo: cloudSettings.logo_url,
            },
            exchangeRates: cloudSettings.exchange_rates,
            syncSettings: cloudSettings.sync_settings,
            notificationSettings: cloudSettings.notification_settings,
            printSettings: cloudSettings.print_settings,
          };
          
          localStorage.setItem('hyperpos_settings_v1', JSON.stringify(localSettings));
          console.log('[CloudSync] Loaded settings from cloud');
        } else {
          // First time user - migrate local settings to cloud
          const localSettingsRaw = localStorage.getItem('hyperpos_settings_v1');
          if (localSettingsRaw) {
            try {
              const localSettings = JSON.parse(localSettingsRaw);
              await saveStoreSettings({
                name: localSettings.storeSettings?.name || 'متجري',
                store_type: localSettings.storeSettings?.type || 'phones',
                phone: localSettings.storeSettings?.phone,
                address: localSettings.storeSettings?.address,
                logo_url: localSettings.storeSettings?.logo,
                exchange_rates: localSettings.exchangeRates || { USD: 1, TRY: 32, SYP: 14500 },
                sync_settings: localSettings.syncSettings,
                notification_settings: localSettings.notificationSettings,
                print_settings: localSettings.printSettings,
              });
              console.log('[CloudSync] Migrated local settings to cloud');
            } catch (e) {
              console.error('[CloudSync] Failed to migrate settings:', e);
            }
          }
        }
        
        setLastSyncTime(new Date().toISOString());
        setIsReady(true);
      } else {
        setCurrentUserId(null);
        setIsReady(false);
      }
    };

    initializeSync();
  }, [user?.id]);

  const syncNow = async () => {
    if (!user?.id) return;
    
    setIsSyncing(true);
    try {
      // Re-fetch all data from cloud
      const { invalidateAllCaches } = await import('@/lib/cloud');
      await invalidateAllCaches();
      
      setLastSyncTime(new Date().toISOString());
      toast.success('تم المزامنة بنجاح');
    } catch (error) {
      console.error('[CloudSync] Sync failed:', error);
      toast.error('فشل في المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <CloudSyncContext.Provider value={{ isReady, isSyncing, lastSyncTime, syncNow }}>
      {children}
    </CloudSyncContext.Provider>
  );
}
