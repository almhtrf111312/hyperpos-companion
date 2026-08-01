// Realtime Sync Hook - Enables instant data synchronization across devices
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { EVENTS, emitEvent } from '@/lib/events';
import { 
  invalidateProductsCache,
  invalidateCategoriesCache,
  invalidateCustomersCache,
  invalidateInvoicesCache,
  invalidateDebtsCache,
  invalidatePartnersCache,
  invalidateExpensesCache
} from '@/lib/cloud';
import { fetchStoreSettings } from '@/lib/supabase-store';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

export function useRealtimeSync() {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) {
      // Cleanup if user logs out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let cleanupLifecycle: (() => void) | undefined;

    const startSubscription = async () => {
      const { data: ownerId, error: ownerError } = await supabase.rpc('get_owner_id', { _user_id: user.id });
      if (cancelled) return;
      const syncOwnerId = !ownerError && typeof ownerId === 'string' ? ownerId : user.id;

      const refreshAll = () => {
        invalidateProductsCache();
        invalidateCategoriesCache();
        invalidateInvoicesCache();
        invalidateDebtsCache();
        invalidateCustomersCache();
        invalidatePartnersCache();
        invalidateExpensesCache();
        emitEvent(EVENTS.PRODUCTS_UPDATED);
        emitEvent(EVENTS.CATEGORIES_UPDATED);
        emitEvent(EVENTS.INVOICES_UPDATED);
        emitEvent(EVENTS.DEBTS_UPDATED);
        emitEvent(EVENTS.CUSTOMERS_UPDATED);
        emitEvent(EVENTS.PARTNERS_UPDATED);
        emitEvent(EVENTS.EXPENSES_UPDATED);
        emitEvent(EVENTS.WAREHOUSES_UPDATED);
      };

      const onResume = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) refreshAll();
      };
      window.addEventListener('online', refreshAll);
      document.addEventListener('visibilitychange', onResume);
      cleanupLifecycle = () => {
        window.removeEventListener('online', refreshAll);
        document.removeEventListener('visibilitychange', onResume);
      };

      // All business rows are owned by the resolved owner, including cashier sessions.
      const channel = supabase
      .channel(`owner-sync-${syncOwnerId}`)
      // Products changes - مع مسح localStorage للمزامنة الفورية
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Products changed:', payload.eventType);
        // مسح كاش الذاكرة فقط — يبقى IDB/localStorage لعرض فوري
        invalidateProductsCache();
        emitEvent(EVENTS.PRODUCTS_UPDATED);
      })
      // Categories changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'categories',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Categories changed:', payload.eventType);
        invalidateCategoriesCache();
        emitEvent(EVENTS.CATEGORIES_UPDATED);
      })
      // Invoices changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Invoices changed:', payload.eventType);
        invalidateInvoicesCache();
        emitEvent(EVENTS.INVOICES_UPDATED);
      })
      // Debts changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'debts',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Debts changed:', payload.eventType);
        invalidateDebtsCache();
        emitEvent(EVENTS.DEBTS_UPDATED);
      })
      // Customers changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customers',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Customers changed:', payload.eventType);
        invalidateCustomersCache();
        emitEvent(EVENTS.CUSTOMERS_UPDATED);
      })
      // Partners changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'partners',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Partners changed:', payload.eventType);
        invalidatePartnersCache();
        emitEvent(EVENTS.PARTNERS_UPDATED);
      })
      // Expenses changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'expenses',
        filter: `user_id=eq.${syncOwnerId}`
      }, (payload) => {
        console.log('[Realtime] Expenses changed:', payload.eventType);
        invalidateExpensesCache();
        emitEvent(EVENTS.EXPENSES_UPDATED);
      })
      // Store settings changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stores',
        filter: `user_id=eq.${syncOwnerId}`
      }, async (payload) => {
        console.log('[Realtime] Store settings changed:', payload.eventType);
        // Fetch and apply new settings
        const settings = await fetchStoreSettings();
        if (settings) {
          // Update localStorage with new settings
          try {
            const existingRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            
            const updated = {
              ...existing,
              storeSettings: {
                name: settings.name || existing.storeSettings?.name,
                phone: settings.phone || existing.storeSettings?.phone,
                address: settings.address || existing.storeSettings?.address,
                logo: settings.logo_url || existing.storeSettings?.logo,
              },
              exchangeRates: settings.exchange_rates || existing.exchangeRates,
              language: settings.language || existing.language,
              theme: settings.theme || existing.theme,
              taxEnabled: settings.tax_enabled ?? existing.taxEnabled,
              taxRate: settings.tax_rate ?? existing.taxRate,
              discountPercentEnabled: settings.sync_settings?.discountPercentEnabled ?? existing.discountPercentEnabled,
              discountFixedEnabled: settings.sync_settings?.discountFixedEnabled ?? existing.discountFixedEnabled,
              barcodeScanMode: settings.sync_settings?.barcodeScanMode ?? existing.barcodeScanMode,
            };
            
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
            emitEvent(EVENTS.SETTINGS_UPDATED);
          } catch (e) {
            console.error('[Realtime] Failed to update local settings:', e);
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'warehouses',
        filter: `user_id=eq.${syncOwnerId}`
      }, () => {
        emitEvent(EVENTS.WAREHOUSES_UPDATED);
        emitEvent(EVENTS.PRODUCTS_UPDATED);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stock_movements',
        filter: `user_id=eq.${syncOwnerId}`
      }, () => {
        invalidateProductsCache();
        emitEvent(EVENTS.PRODUCTS_UPDATED);
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') refreshAll();
      });

      channelRef.current = channel;
    };

    void startSubscription();

    return () => {
      cancelled = true;
      cleanupLifecycle?.();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);
}
