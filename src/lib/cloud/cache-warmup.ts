/**
 * Global Background Sync & Cache Warmup Service
 * FlowPOS Pro
 * 
 * Preloads and keeps Invoices, Customers, Debts, Purchases, Categories,
 * Warehouses, and Expenses warm in localStorage in the background.
 * Ensures all tabs work offline seamlessly without requiring the user to manually visit them.
 */

import { loadInvoicesCloud } from './invoices-cloud';
import { loadCustomersCloud } from './customers-cloud';
import { loadDebtsCloud } from './debts-cloud';
import { loadPurchaseInvoicesCloud } from './purchase-invoices-cloud';
import { loadCategoriesCloud } from './categories-cloud';
import { loadExpensesCloud } from './expenses-cloud';
import { loadWarehousesCloud } from './warehouses-cloud';

let isWarmingUp = false;
let lastWarmupTime = 0;
const WARMUP_INTERVAL_MS = 45000; // 45s throttle to prevent redundant network bursts

export const warmupAllCaches = async (force: boolean = false): Promise<void> => {
  // If offline, don't attempt network preloading
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  if (isWarmingUp) return;
  if (!force && Date.now() - lastWarmupTime < WARMUP_INTERVAL_MS) return;

  isWarmingUp = true;
  lastWarmupTime = Date.now();

  console.log('[CacheWarmup] 🔄 Preloading all store tabs into local cache...');

  try {
    // Run all preloaders concurrently in the background without blocking UI
    await Promise.allSettled([
      loadInvoicesCloud().catch(e => console.warn('[CacheWarmup] Invoices preload error:', e)),
      loadCustomersCloud().catch(e => console.warn('[CacheWarmup] Customers preload error:', e)),
      loadDebtsCloud().catch(e => console.warn('[CacheWarmup] Debts preload error:', e)),
      loadPurchaseInvoicesCloud().catch(e => console.warn('[CacheWarmup] Purchases preload error:', e)),
      loadCategoriesCloud().catch(e => console.warn('[CacheWarmup] Categories preload error:', e)),
      loadExpensesCloud().catch(e => console.warn('[CacheWarmup] Expenses preload error:', e)),
      loadWarehousesCloud().catch(e => console.warn('[CacheWarmup] Warehouses preload error:', e)),
    ]);
    console.log('[CacheWarmup] ✅ All tabs cached & ready for offline access');
  } catch (err) {
    console.warn('[CacheWarmup] Warmup encountered error:', err);
  } finally {
    isWarmingUp = false;
  }
};
