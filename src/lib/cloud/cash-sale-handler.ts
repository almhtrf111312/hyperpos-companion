/**
 * Cash Sale Handler - FlowPOS Pro
 * ================================
 * معالج البيع النقدي مع دعم العمل Offline
 * يضمن حفظ الفاتورة محلياً ومزامنتها لاحقاً
 */

import { findOrCreateCustomerCloud, linkInvoiceToCustomerCloud } from './customers-cloud';
import { addGrossProfit } from '@/lib/profits-store';
import { addGrossProfitCloud } from './profits-cloud';
import { distributeDetailedProfitCloud } from './partners-cloud';
import { processPosSaleAtomic } from './pos-sale-atomic';
import { confirmPendingStockDeduction } from './products-cloud';
import { invalidateProductsCache } from './products-cloud';
import { emitEvent, EVENTS } from '@/lib/events';

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
  data: { operationId?: string; bundle: CashSaleBundle }
): Promise<boolean> {
  const { bundle } = data;
  console.log('[CashSale] Processing queued bundle for:', bundle.customerName);

  try {
    const operationId = data.operationId;
    if (!operationId) throw new Error('Missing sale operation id');
    const sale = await processPosSaleAtomic(operationId, 'cash', bundle);
    await confirmPendingStockDeduction(operationId);
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);

    // Customer bookkeeping is best-effort and must never block the invoice.
    const customer = !sale.alreadyProcessed && bundle.customerName && bundle.customerName !== 'عميل نقدي'
      ? await findOrCreateCustomerCloud(bundle.customerName).catch(() => null)
      : null;

    // 3. Record profit
    if (!sale.alreadyProcessed) {
      // ✅ أرقام الخادم هي المعتمدة (التكلفة من جدول المنتجات، الضريبة خارج الربح)
      const revenue = Math.round((sale.total - sale.taxAmount) * 100) / 100;
      addGrossProfit(sale.invoiceNumber, sale.profit, sale.cogs, revenue);
      addGrossProfitCloud({ invoiceId: sale.invoiceNumber, grossProfit: sale.profit, cogs: sale.cogs, revenue }).catch(() => {});
    }

    // 4. Distribute profit to partners
    const categoryProfits = Object.entries(bundle.profitsByCategory)
      .filter(([_, profit]) => profit > 0)
      .map(([category, profit]) => ({ category, profit }));

    if (!sale.alreadyProcessed && categoryProfits.length > 0) {
      await distributeDetailedProfitCloud(
        categoryProfits,
        sale.invoiceNumber,
        bundle.customerName || 'عميل نقدي',
        false
      ).catch(err => console.error('[CashSale] Partner distribution failed:', err));
    }

    // 5. Link invoice to customer then recompute his stats from active invoices
    if (!sale.alreadyProcessed && customer) {
      await linkInvoiceToCustomerCloud(sale.invoiceNumber, customer.id).catch(() => {});
    }

    console.log('[CashSale] Bundle synced successfully:', sale.invoiceNumber);
    return true;
  } catch (error) {
    // ✅ استخراج رسالة الخطأ الحقيقية بدقة لضمان تسجيلها في حقل error بطابور sync_queue
    const errorMessage = error instanceof Error 
      ? error.message 
      : ((error as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.details as string || String(error));
    console.error('[CashSale] Failed to process queued bundle:', errorMessage, error);
    throw error instanceof Error ? error : new Error(String(errorMessage));
  }
}
