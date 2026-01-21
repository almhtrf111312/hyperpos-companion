// Unified Store - Automatically switches between localStorage and Cloud based on auth state
// This provides backward compatibility while enabling cloud sync for authenticated users

import { getCurrentUserId } from './supabase-store';

// Re-export cloud stores for direct use
export * from './cloud/products-cloud';
export * from './cloud/categories-cloud';
export * from './cloud/customers-cloud';
export * from './cloud/invoices-cloud';
export * from './cloud/debts-cloud';
export * from './cloud/partners-cloud';
export * from './cloud/expenses-cloud';

// Helper to check if cloud sync is available
export const isCloudSyncEnabled = (): boolean => {
  return !!getCurrentUserId();
};

// Invalidate all caches (useful after sync)
export const invalidateAllCaches = async () => {
  const { invalidateProductsCache } = await import('./cloud/products-cloud');
  const { invalidateCategoriesCache } = await import('./cloud/categories-cloud');
  const { invalidateCustomersCache } = await import('./cloud/customers-cloud');
  const { invalidateInvoicesCache } = await import('./cloud/invoices-cloud');
  const { invalidateDebtsCache } = await import('./cloud/debts-cloud');
  const { invalidatePartnersCache } = await import('./cloud/partners-cloud');
  const { invalidateExpensesCache } = await import('./cloud/expenses-cloud');
  
  invalidateProductsCache();
  invalidateCategoriesCache();
  invalidateCustomersCache();
  invalidateInvoicesCache();
  invalidateDebtsCache();
  invalidatePartnersCache();
  invalidateExpensesCache();
};
