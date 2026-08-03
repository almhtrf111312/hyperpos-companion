import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitEvent, EVENTS } from '@/lib/events';
import { invalidateInvoicesCache } from './invoices-cloud';
import { invalidateProductsCache } from './products-cloud';

type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;

export interface AtomicSaleBundle {
  customerName: string;
  customerPhone?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    total?: number;
    costPrice?: number;
    profit?: number;
    unit?: 'piece' | 'bulk';
    conversionFactor?: number;
  }>;
  stockItems: Array<{ productId: string; quantity: number; productName?: string }>;
  subtotal: number;
  discount: number;
  discountPercentage?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  currency: string;
  profit: number;
  warehouseId?: string;
}

export interface AtomicSaleResult {
  success: boolean;
  alreadyProcessed: boolean;
  invoiceId: string;
  invoiceNumber: string;
}

export async function processPosSaleAtomic(
  operationId: string,
  paymentType: 'cash' | 'debt',
  bundle: AtomicSaleBundle,
): Promise<AtomicSaleResult> {
  if (!operationId || operationId.length < 8) throw new Error('Missing or invalid sale operation id');
  const itemById = new Map(bundle.items.map(item => [item.id, item]));
  const rpcItems = bundle.stockItems.map(stockItem => {
    const item = itemById.get(stockItem.productId);
    if (!item) throw new Error(`Missing invoice item for product ${stockItem.productId}`);

    const quantity = Number(stockItem.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid stock quantity for ${item.name}`);
    }
    return {
      product_id: stockItem.productId,
      product_name: item.name,
      quantity,
      unit_price: item.price,
      cost_price: item.costPrice || 0,
      amount_original: item.total ?? item.price * item.quantity,
      amount_usd: item.total ?? item.price * item.quantity,
      profit: item.profit || 0,
      unit: item.unit || 'piece',
      conversion_factor: item.conversionFactor || 1,
    };
  });

  const { data, error } = await sb.rpc('process_pos_sale_atomic', {
    _operation_id: operationId,
    _payment_type: paymentType,
    _customer_name: bundle.customerName,
    _customer_phone: bundle.customerPhone || '',
    _subtotal: bundle.subtotal,
    _discount: bundle.discount,
    _discount_percentage: bundle.discountPercentage || 0,
    _tax_rate: bundle.taxRate || 0,
    _tax_amount: bundle.taxAmount || 0,
    _total: bundle.total,
    _profit: bundle.profit,
    _currency: bundle.currency,
    _warehouse_id: bundle.warehouseId || null,
    _items: rpcItems,
  });

  if (error) throw new Error(error.message || 'Atomic sale failed');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success || !row.invoice_id || !row.invoice_number) {
    throw new Error('Atomic sale returned an invalid result');
  }

  invalidateInvoicesCache();
  invalidateProductsCache();
  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  if (paymentType === 'debt') emitEvent(EVENTS.DEBTS_UPDATED, null);

  return {
    success: true,
    alreadyProcessed: Boolean(row.already_processed),
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
  };
}