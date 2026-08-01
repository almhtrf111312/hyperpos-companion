// Realtime Sync Hook - Enables instant data synchronization across devices
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { EVENTS, emitEvent } from '@/lib/events';
import { invalidateAllCaches } from '@/lib/cloud';
import { fetchStoreSettings, getOwnerIdForInsert } from '@/lib/supabase-store';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

// Unified tables list for easier management and consistent owner-scoping
const SYNC_TABLES = [
  { name: 'products', event: EVENTS.PRODUCTS_UPDATED },
  { name: 'categories', event: EVENTS.CATEGORIES_UPDATED },
  { name: 'invoices', event: EVENTS.INVOICES_UPDATED },
  { name: 'debts', event: EVENTS.DEBTS_UPDATED },
  { name: 'customers', event: EVENTS.CUSTOMERS_UPDATED },
  { name: 'partners', event: EVENTS.PARTNERS_UPDATED },
  { name: 'expenses', event: EVENTS.EXPENSES_UPDATED },
  { name: 'warehouses', event: EVENTS.WAREHOUSES_UPDATED },
  { name: 'stock_transfers', event: EVENTS.STOCK_TRANSFERS_UPDATED },
  { name: 'stock_movements', event: EVENTS.PRODUCTS_UPDATED },
  { name: 'purchases', event: EVENTS.PURCHASES_UPDATED },
  { name: 'maintenance_services', event: EVENTS.MAINTENANCE_UPDATED },
  { name: 'recurring_expenses', event: EVENTS.RECURRING_EXPENSES_UPDATED },
];

export function useRealtimeSync() {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  // Helper to refresh all data safely (debounced to avoid loops)
  const refreshData = async (reason: string) => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 2000) return; // Ignore if refreshed in last 2s
    lastRefreshRef.current = now;
    
    console.log(`[Realtime] Triggering global refresh due to: ${reason}`);
    await invalidateAllCaches();
    
    // Emit events to trigger UI re-fetches
    SYNC_TABLES.forEach(table => emitEvent(table.event));
    emitEvent(EVENTS.SETTINGS_UPDATED);
  };

  useEffect(() => {
    if (!user) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupChannel = async () => {
      // ✅ Crucial: Get the correct ownerId (especially for cashiers)
      const ownerId = await getOwnerIdForInsert();
      
      if (!isMounted || !ownerId) return;

      console.log(`[Realtime] Initializing sync for owner: ${ownerId}`);

      // Cleanup existing channel if any
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Create realtime channel for all owner data
      const channel = supabase.channel(`owner-sync-${ownerId}`);

      // Register all tables with the same owner-scoped filter
      SYNC_TABLES.forEach(table => {
        channel.on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: table.name,
          filter: `user_id=eq.${ownerId}`
        }, (payload) => {
          console.log(`[Realtime] ${table.name} changed (${payload.eventType})`);
          // Note: Cache invalidation is now handled in individual cloud stores
          // but we emit events to trigger UI updates.
          emitEvent(table.event);
        });
      });

      // Special handling for store settings
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stores',
        filter: `user_id=eq.${ownerId}`
      }, async (payload) => {
        console.log('[Realtime] Store settings changed:', payload.eventType);
        const settings = await fetchStoreSettings();
        if (settings) {
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
      });

      channel.subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        // ✅ Refresh on successful subscription/reconnection to catch missed updates
        if (status === 'SUBSCRIBED') {
          refreshData('SUBSCRIBED');
        }
      });

      channelRef.current = channel;
    };

    setupChannel();

    // ✅ Listen for online/resume events to refresh data
    const handleOnline = () => refreshData('ONLINE');
    const handleFocus = () => refreshData('FOCUS');

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);
}
