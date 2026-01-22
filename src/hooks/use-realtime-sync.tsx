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

    // Create realtime channel for all user data
    const channel = supabase
      .channel(`user-sync-${user.id}`)
      // Products changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('[Realtime] Products changed:', payload.eventType);
        invalidateProductsCache();
        emitEvent(EVENTS.PRODUCTS_UPDATED);
      })
      // Categories changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'categories',
        filter: `user_id=eq.${user.id}`
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
        filter: `user_id=eq.${user.id}`
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
        filter: `user_id=eq.${user.id}`
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
        filter: `user_id=eq.${user.id}`
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
        filter: `user_id=eq.${user.id}`
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
        filter: `user_id=eq.${user.id}`
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
        filter: `user_id=eq.${user.id}`
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
            };
            
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
            emitEvent(EVENTS.SETTINGS_UPDATED);
          } catch (e) {
            console.error('[Realtime] Failed to update local settings:', e);
          }
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);
}
