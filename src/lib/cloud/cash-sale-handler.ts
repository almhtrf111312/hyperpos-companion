/**
 * Cash Sale Handler - FlowPOS Pro
 * ================================
 * معالج البيع النقدي مع دعم العمل Offline
 * يضمن حفظ الفاتورة محلياً ومزامنتها لاحقاً
 */

import { addInvoiceCloud } from './invoices-cloud';
import { findOrCreateCustomerCloud, updateCustomerStatsCloud } from './customers-cloud';
import { deductStockBatchCloud } from './products-cloud';
import { deductWarehouseStockBatchCloud } from './warehouses-cloud';
import { addGrossProfit } from '@/lib/profits-store';
import { distributeDetailedProfitCloud } from './partners-cloud';

// ============= Types =============

export interface CashSaleBundle {
  customerName: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    costPrice: number;
    profit: number;
  }>;
  subtotal: number;
  discount: number;
  discountPercentage: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  totalInCurrency: number;
  currency: string;
  currencySymbol: string;
  profit: number;
  cogs: number;
  profitsByCategory: Record<string, number>;
  stockItems: Array<{ productId: string; quantity: number }>;
  warehouseId?: string;
  wholesaleMode?: boolean;
}

/**
 * Process a cash sale bundle from the sync queue (when coming back online)
 */
export async function processCashSaleBundleFromQueue(
  data: { bundle: CashSaleBundle }
): Promise<boolean> {
  const { bundle } = data;
  console.log('[CashSale] Processing queued bundle for:', bundle.customerName);

  try {
    // 1. Find or create customer
    const customer = bundle.customerName && bundle.customerName !== 'عميل نقدي'
      ? await findOrCreateCustomerCloud(bundle.customerName)
      : null;

    // 2. Create invoice in cloud
    const invoice = await addInvoiceCloud({
      type: 'sale',
      customerName: bundle.customerName || 'عميل نقدي',
      items: bundle.items,
      subtotal: bundle.subtotal,
      discount: bundle.discount,
      discountPercentage: bundle.discountPercentage,
      taxRate: bundle.taxRate,
      taxAmount: bundle.taxAmount,
      total: bundle.total,
      totalInCurrency: bundle.totalInCurrency,
      currency: bundle.currency,
      currencySymbol: bundle.currencySymbol,
      paymentType: 'cash',
      status: 'paid',
      profit: bundle.profit,
    });

    if (!invoice) {
      throw new Error('Failed to create invoice in cloud');
    }

    // 3. Record profit
    addGrossProfit(invoice.id, bundle.profit, bundle.cogs, bundle.total);

    // 4. Distribute profit to partners
    const categoryProfits = Object.entries(bundle.profitsByCategory)
      .filter(([_, profit]) => profit > 0)
      .map(([category, profit]) => ({ category, profit }));

    if (categoryProfits.length > 0) {
      await distributeDetailedProfitCloud(
        categoryProfits,
        invoice.id,
        bundle.customerName || 'عميل نقدي',
        false
      ).catch(err => console.error('[CashSale] Partner distribution failed:', err));
    }

    // 5. Deduct stock
    if (bundle.warehouseId) {
      await deductWarehouseStockBatchCloud(bundle.warehouseId, bundle.stockItems);
    } else {
      await deductStockBatchCloud(bundle.stockItems);
    }

    // 6. Update customer stats
    if (customer) {
      await updateCustomerStatsCloud(customer.id, bundle.total, false);
    }

    console.log('[CashSale] Bundle synced successfully:', invoice.id);
    return true;
  } catch (error) {
    console.error('[CashSale] Failed to process queued bundle:', error);
    return false;
  }
}
