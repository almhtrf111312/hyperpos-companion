// Unified Store - Automatically switches between localStorage and Cloud based on auth state
// This provides backward compatibility while enabling cloud sync for authenticated users

import { getCurrentUserId } from '../supabase-store';

// Re-export cloud stores for direct use
export * from './products-cloud';
export * from './categories-cloud';
export * from './customers-cloud';
export * from './invoices-cloud';
export * from './debts-cloud';
export * from './purchase-invoices-cloud';
export * from './partners-cloud';
export * from './expenses-cloud';
export * from './recurring-expenses-cloud';
export * from './warehouses-cloud';
export * from './cache-warmup';

// Helper to check if cloud sync is available
export const isCloudSyncEnabled = (): boolean => {
  return !!getCurrentUserId();
};

// Invalidate all caches (useful after sync)
export const invalidateAllCaches = async () => {
  const { invalidateProductsCache } = await import('./products-cloud');
  const { invalidateCategoriesCache } = await import('./categories-cloud');
  const { invalidateCustomersCache } = await import('./customers-cloud');
  const { invalidateInvoicesCache } = await import('./invoices-cloud');
  const { invalidateDebtsCache } = await import('./debts-cloud');
  const { invalidatePurchaseInvoicesCache } = await import('./purchase-invoices-cloud');
  const { invalidatePartnersCache } = await import('./partners-cloud');
  const { invalidateExpensesCache } = await import('./expenses-cloud');
  const { invalidateRecurringExpensesCache } = await import('./recurring-expenses-cloud');
  const { invalidateWarehousesCache } = await import('./warehouses-cloud');
  
  invalidateProductsCache();
  invalidateCategoriesCache();
  invalidateCustomersCache();
  invalidateInvoicesCache();
  invalidateDebtsCache();
  invalidatePurchaseInvoicesCache();
  invalidatePartnersCache();
  invalidateExpensesCache();
  invalidateRecurringExpensesCache();
  invalidateWarehousesCache();
};
