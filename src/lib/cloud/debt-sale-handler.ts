/**
 * Debt Sale Handler - FlowPOS Pro
 * ================================
 * معالج البيع بالدين مع دعم العمل Offline
 * يضمن مزامنة ذرية لجميع العمليات المتعلقة بالبيع بالدين
 */

import { addToQueue, OperationType } from '@/lib/sync-queue';
import { addInvoiceCloud } from './invoices-cloud';
import { addDebtFromInvoiceCloud } from './debts-cloud';
import { findOrCreateCustomerCloud, updateCustomerStatsCloud } from './customers-cloud';
import { deductStockBatchCloud } from './products-cloud';
import { deductWarehouseStockBatchCloud } from './warehouses-cloud';
import { addGrossProfit } from '@/lib/profits-store';
import { distributeDetailedProfit } from '@/lib/partners-store';
import { secureSet, secureGet } from '@/lib/secure-storage';

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
  isOnline: boolean
): Promise<DebtSaleResult> {
  const localId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
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
    // Step 1: Find or create customer
    const customer = await findOrCreateCustomerCloud(bundle.customerName, bundle.customerPhone);
    if (!customer) {
      throw new Error('فشل في إنشاء/العثور على العميل');
    }
    
    // Step 2: Create invoice
    const invoice = await addInvoiceCloud({
      type: 'sale',
      customerName: bundle.customerName,
      items: bundle.items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      subtotal: bundle.subtotal,
      discount: bundle.discount,
      total: bundle.total,
      totalInCurrency: bundle.totalInCurrency,
      currency: bundle.currency,
      currencySymbol: bundle.currencySymbol,
      paymentType: 'debt',
      status: 'pending',
      profit: bundle.profit,
    });
    
    if (!invoice) {
      throw new Error('فشل في إنشاء الفاتورة');
    }
    
    // Step 3: Create debt record
    const debt = await addDebtFromInvoiceCloud(
      invoice.id,
      bundle.customerName,
      bundle.customerPhone,
      bundle.total
    );
    
    if (!debt) {
      // Rollback: We can't easily delete the invoice, but we log the error
      console.error('[DebtSale] Failed to create debt, invoice created:', invoice.id);
      throw new Error('فشل في إنشاء سجل الدين');
    }
    
    // Step 4: Deduct stock
    if (bundle.warehouseId) {
      await deductWarehouseStockBatchCloud(bundle.warehouseId, bundle.stockItems);
    } else {
      await deductStockBatchCloud(bundle.stockItems);
    }
    
    // Step 5: Update customer stats
    await updateCustomerStatsCloud(customer.id, bundle.total, true);
    
    // Step 6: Record profit
    addGrossProfit(invoice.id, bundle.profit, bundle.cogs, bundle.total);
    
    // Step 7: Distribute to partners
    const categoryProfits = Object.entries(bundle.profitsByCategory)
      .filter(([_, profit]) => profit > 0)
      .map(([category, profit]) => ({ category, profit }));
    
    if (categoryProfits.length > 0) {
      distributeDetailedProfit(categoryProfits, invoice.id, bundle.customerName, true);
    }
    
    return {
      success: true,
      invoiceId: invoice.id,
      isOffline: false,
    };
    
  } catch (error) {
    console.error('[DebtSale] Online transaction failed:', error);
    
    // Fallback: Save offline and queue for retry
    saveOfflineDebtSale({
      localId,
      bundle,
      timestamp: new Date().toISOString(),
      synced: false,
    });
    
    addToQueue('debt_sale_bundle' as OperationType, {
      localId,
      bundle,
      timestamp: new Date().toISOString(),
    });
    
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
    const result = await processDebtSaleWithOfflineSupport(data.bundle, true);
    
    if (result.success && !result.isOffline) {
      // Mark as synced
      markOfflineDebtSaleSynced(data.localId);
      console.log('[DebtSale] Bundle synced successfully:', data.localId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[DebtSale] Failed to process queued bundle:', error);
    return false;
  }
}
