// Realtime Sync Hook - Enables instant data synchronization across devices
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { EVENTS, emitEvent } from '@/lib/events';
import { invalidateAllCaches } from '@/lib/cloud';
import { fetchStoreSettings, getOwnerIdForInsert } from '@/lib/supabase-store';
import { isGuestDemoMode } from '@/lib/demo-data';
import {
  loadUnifiedStoreSettings,
  mergeStoreSettings,
  applySettingsToRuntime,
  pullStoreSettingsWithGuard,
} from '@/lib/store-settings-sync';

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
    // Channel (re)subscriptions happen often on mobile; avoid full reloads within 60s
    const minGap = reason === 'SUBSCRIBED' ? 60000 : 2000;
    if (now - lastRefreshRef.current < minGap) return;
    lastRefreshRef.current = now;
    
    console.log(`[Realtime] Triggering global refresh due to: ${reason}`);
    await invalidateAllCaches();
    await pullStoreSettingsWithGuard();
    
    // Emit events to trigger UI re-fetches
    SYNC_TABLES.forEach(table => emitEvent(table.event));
    emitEvent(EVENTS.SETTINGS_UPDATED);
  };

  useEffect(() => {
    // In Guest Demo Mode, do not connect to Supabase realtime channels
    if (isGuestDemoMode()) {
      return;
    }

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
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.warn('[Realtime] Error removing old channel:', err);
        }
        channelRef.current = null;
      }

      // Create realtime channel with unique timestamp to guarantee a pristine closed state
      const channelTopic = `owner-sync-${ownerId}-${Date.now()}`;
      const channel = supabase.channel(channelTopic);

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
        if (isMounted) {
          try {
            await pullStoreSettingsWithGuard();
            console.log('[Realtime] Unified store settings updated & applied to runtime');
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

    // Refresh only when the device actually comes back online — not on every app resume/focus.
    const handleOnline = () => refreshData('ONLINE');
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.warn('[Realtime] Error removing channel on unmount:', err);
        }
        channelRef.current = null;
      }
    };
  }, [user]);
}
