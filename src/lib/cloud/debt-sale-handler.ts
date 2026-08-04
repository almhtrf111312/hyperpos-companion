/**
 * Debt Sale Handler - FlowPOS Pro
 * ================================
 * معالج البيع بالدين مع دعم العمل Offline
 * يضمن مزامنة ذرية لجميع العمليات المتعلقة بالبيع بالدين
 */

import { addToQueue, OperationType } from '@/lib/sync-queue';
import { findOrCreateCustomerCloud, updateCustomerStatsCloud } from './customers-cloud';
import { addGrossProfit } from '@/lib/profits-store';
import { addGrossProfitCloud } from './profits-cloud';
import { distributeDetailedProfitCloud } from '@/lib/cloud/partners-cloud';
import { secureSet, secureGet } from '@/lib/secure-storage';
import { processPosSaleAtomic } from './pos-sale-atomic';
import { confirmPendingStockDeduction } from './products-cloud';
import { invalidateProductsCache } from './products-cloud';
import { emitEvent, EVENTS } from '@/lib/events';

// ============= Types =============

export interface DebtSaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: 'piece' | 'bulk';
  costPrice: number;
  bulkCostPrice?: number;
  conversionFactor?: number;
  category?: string;
  total?: number;
  profit?: number;
}

export interface DebtSaleBundle {
  // Customer info
  customerName: string;
  customerPhone: string;
  
  // Invoice data
  items: DebtSaleItem[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  totalInCurrency: number;
  currency: string;
  currencySymbol: string;
  
  // Tax data
  taxRate?: number;
  taxAmount?: number;
  
  // Profit data
  profit: number;
  cogs: number;
  profitsByCategory: Record<string, number>;
  
  // Stock data
  stockItems: Array<{ productId: string; productName: string; quantity: number }>;
  warehouseId?: string;
  
  // Metadata
  cashierId?: string;
  cashierName?: string;
}

export interface DebtSaleResult {
  success: boolean;
  invoiceId?: string;
  isOffline?: boolean;
  error?: string;
}

// ============= Local Storage for Offline =============

const OFFLINE_DEBT_SALES_KEY = 'offline_debt_sales';
const OFFLINE_NAMESPACE = 'hp_offline';

interface OfflineDebtSale {
  localId: string;
  bundle: DebtSaleBundle;
  timestamp: string;
  synced: boolean;
}

const getOfflineDebtSales = (): OfflineDebtSale[] => {
  try {
    return secureGet<OfflineDebtSale[]>(OFFLINE_DEBT_SALES_KEY, { namespace: OFFLINE_NAMESPACE }) || [];
  } catch {
    return [];
  }
};

const saveOfflineDebtSale = (sale: OfflineDebtSale): void => {
  const sales = getOfflineDebtSales();
  sales.push(sale);
  secureSet(OFFLINE_DEBT_SALES_KEY, sales, { namespace: OFFLINE_NAMESPACE });
};

export const markOfflineDebtSaleSynced = (localId: string): void => {
  const sales = getOfflineDebtSales();
  const updated = sales.filter(s => s.localId !== localId);
  secureSet(OFFLINE_DEBT_SALES_KEY, updated, { namespace: OFFLINE_NAMESPACE });
};

// ============= Main Handler =============

/**
 * معالجة البيع بالدين مع دعم العمل Offline
 * يحفظ محلياً أولاً ثم يرفع للسحابة
 */
export async function processDebtSaleWithOfflineSupport(
  bundle: DebtSaleBundle,
  isOnline: boolean,
  existingOperationId?: string,
): Promise<DebtSaleResult> {
  const localId = existingOperationId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `debt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);
  
  if (!isOnline) {
    // =============== Offline Mode ===============
    console.log('[DebtSale] Offline mode - saving locally');
    
    // Save to local storage
    saveOfflineDebtSale({
      localId,
      bundle,
      timestamp: new Date().toISOString(),
      synced: false,
    });
    
    // Add to sync queue as atomic bundle
    addToQueue('debt_sale_bundle' as OperationType, {
      localId,
      bundle,
      timestamp: new Date().toISOString(),
    });
    
    return {
      success: true,
      invoiceId: localId,
      isOffline: true,
    };
  }
  
  // =============== Online Mode ===============
  console.log('[DebtSale] Online mode - processing cloud transaction');
  
  try {
    // Invoice + debt + stock are committed first in one idempotent transaction.
    const sale = await processPosSaleAtomic(localId, 'debt', bundle);
    await confirmPendingStockDeduction(localId);
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);

    // Customer bookkeeping is best-effort and must never block the debt invoice.
    if (!sale.alreadyProcessed) {
      const customer = await findOrCreateCustomerCloud(bundle.customerName, bundle.customerPhone).catch(() => null);
      if (customer) await updateCustomerStatsCloud(customer.id, bundle.total, true).catch(() => false);
    }
    
    // Step 6: Record profit
    if (!sale.alreadyProcessed) {
      addGrossProfit(sale.invoiceNumber, bundle.profit, bundle.cogs, bundle.total);
      addGrossProfitCloud({ invoiceId: sale.invoiceNumber, grossProfit: bundle.profit, cogs: bundle.cogs, revenue: bundle.total }).catch(() => {});
    }
    
    // Step 7: Distribute to partners - ✅ استخدام Cloud API
    const categoryProfits = Object.entries(bundle.profitsByCategory)
      .filter(([_, profit]) => profit > 0)
      .map(([category, profit]) => ({ category, profit }));
    
    if (!sale.alreadyProcessed && categoryProfits.length > 0) {
      distributeDetailedProfitCloud(categoryProfits, sale.invoiceNumber, bundle.customerName, true);
    }
    
    return {
      success: true,
      invoiceId: sale.invoiceNumber,
      isOffline: false,
    };
    
  } catch (error) {
    console.error('[DebtSale] Online transaction failed:', error);
    
    return {
      success: false,
      invoiceId: localId,
      isOffline: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * معالجة حزمة البيع بالدين من طابور المزامنة
 * يتم استدعاؤها عند عودة الاتصال
 */
export async function processDebtSaleBundleFromQueue(
  data: { localId: string; bundle: DebtSaleBundle }
): Promise<boolean> {
  console.log('[DebtSale] Processing queued bundle:', data.localId);
  
  try {
    const result = await processDebtSaleWithOfflineSupport(data.bundle, true, data.localId);
    
    if (result.success && !result.isOffline) {
      // Mark as synced
      markOfflineDebtSaleSynced(data.localId);
      console.log('[DebtSale] Bundle synced successfully:', data.localId);
      return true;
    }
    
    throw new Error(result.error || 'Debt sale synchronization failed');
  } catch (error) {
    console.error('[DebtSale] Failed to process queued bundle:', error);
    throw error;
  }
}
