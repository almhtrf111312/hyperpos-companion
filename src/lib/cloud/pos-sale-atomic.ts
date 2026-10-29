import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitEvent, EVENTS } from '@/lib/events';
import { invalidateInvoicesCache } from './invoices-cloud';
import { isGuestDemoMode } from '@/lib/demo-data';
import { round8 } from '@/lib/money-engine';

type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;

export interface AtomicSaleBundle {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  taxMode?: 'inclusive' | 'exclusive';
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
  currencySymbol?: string;
  currencyName?: string;
  exchangeRate?: number;
  profit: number;
  warehouseId?: string;
  /** دفعة أولى مقبوضة نقداً عند البيع المؤجل (بالدولار) — تُخصم من الدين */
  downPayment?: number;
}


export interface AtomicSaleResult {
  success: boolean;
  alreadyProcessed: boolean;
  invoiceId: string;
  invoiceNumber: string;
  /** القيم المعتمدة من الخادم (بالدولار) — مصدر الحقيقة بعد المزامنة */
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  total?: number;
  cogs?: number;
  profit?: number;
  debtPaid?: number;
  debtRemaining?: number;
  /** البيع تجاوز المخزون المتاح (عجز مسجّل، لم يُوقف الفاتورة) */
  stockShortage?: boolean;
}

/**
 * التحقق مما إذا كان النص UUID صالحاً
 */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * بناء مصفوفة الأصناف بالتنسيق الدقيق الذي تتوقعه دالة process_pos_sale_atomic
 */
function buildRpcItems(bundle: AtomicSaleBundle) {
  // الاعتماد مباشرة على bundle.items بالكميات المباعة الفعلية لمنع مضاعفة معامل التحويل
  return bundle.items.map(item => {
    if (!item.id || !isValidUUID(item.id)) {
      throw new Error(`Invalid item: product "${item.name}" is not synced yet`);
    }

    const quantity = Math.round(Number(item.quantity) * 1000) / 1000;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Invalid item quantity for ${item.name}`);
    }

    const lineTotalUSD = round8(item.total ?? (item.price * item.quantity));
    return {
      product_id: item.id,
      product_name: item.name,
      quantity,
      unit_price: round8(item.price),
      cost_price: round8(item.costPrice || 0),
      amount_original: lineTotalUSD,
      amount_usd: lineTotalUSD,
      profit: round8(item.profit || 0),
      unit: item.unit || 'piece',
      conversion_factor: item.conversionFactor || 1,
    };
  });
}

export async function processPosSaleAtomic(
  operationId: string,
  paymentType: 'cash' | 'debt',
  bundle: AtomicSaleBundle,
): Promise<AtomicSaleResult> {
  if (isGuestDemoMode()) {
    return {
      success: true,
      alreadyProcessed: false,
      invoiceId: operationId,
      invoiceNumber: `INV-DEMO-${Date.now().toString().slice(-4)}`,
      subtotal: bundle.subtotal,
      discount: bundle.discount,
      taxAmount: bundle.taxAmount || 0,
      total: bundle.total,
      cogs: 0,
      profit: bundle.profit,
      debtPaid: bundle.downPayment || 0,
      debtRemaining: Math.max(0, bundle.total - (bundle.downPayment || 0)),
      stockShortage: false,
    };
  }

  if (!operationId || operationId.length < 8) throw new Error('Missing or invalid sale operation id');

  const rpcItems = buildRpcItems(bundle);

  // ✅ المحاولة الأولى: استدعاء الدالة الذرية process_pos_sale_atomic
  try {
    const { data, error } = await sb.rpc('process_pos_sale_atomic', {
      _operation_id: operationId,
      _payment_type: paymentType,
      _customer_name: bundle.customerName,
      _customer_phone: bundle.customerPhone || '',
      _subtotal: round8(bundle.subtotal),
      _discount: round8(bundle.discount),
      _discount_percentage: bundle.discountPercentage || 0,
      _tax_rate: bundle.taxRate || 0,
      _tax_amount: round8(bundle.taxAmount || 0),
      _total: round8(bundle.total),
      _profit: round8(bundle.profit),
      _currency: bundle.currency,
      _warehouse_id: (bundle.warehouseId && isValidUUID(bundle.warehouseId)) ? bundle.warehouseId : null,
      _items: rpcItems,
      _down_payment: paymentType === 'debt'
        ? Math.max(0, Math.min(Number(bundle.downPayment || 0), Number(bundle.total || 0)))
        : 0,
      _exchange_rate: Number((bundle as any).exchangeRate) || 1,
      _tax_mode: bundle.taxMode || 'exclusive',
    });

    if (error) {
      const errorObj = error as unknown as Record<string, unknown>;
      const detailedMsg = error.message || (typeof errorObj?.details === 'string' ? errorObj.details : '') || 'فشل تنفيذ البيع الذري';
      console.error('[AtomicSale] RPC error:', detailedMsg, error);
      throw new Error(detailedMsg);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success || !row.invoice_id || !row.invoice_number) {
      throw new Error('Atomic sale returned an invalid result');
    }

    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    if (paymentType === 'debt') emitEvent(EVENTS.DEBTS_UPDATED, null);

    if (row.stock_shortage) {
      console.warn('[AtomicSale] Sale synced with stock shortage (negative stock recorded):', row.invoice_number);
    }

    return {
      success: true,
      alreadyProcessed: Boolean(row.already_processed),
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      subtotal: Number(row.subtotal) || 0,
      discount: Number(row.discount) || 0,
      taxAmount: Number(row.tax_amount) || 0,
      total: Number(row.total) || 0,
      cogs: Number(row.cogs) || 0,
      profit: Number(row.profit) || 0,
      debtPaid: Number(row.debt_paid) || 0,
      debtRemaining: Number(row.debt_remaining) || 0,
      stockShortage: Boolean(row.stock_shortage),
    };
  } catch (rpcError) {
    // ⚠️ تم تعطيل الإدراج البديل المباشر: كان يحفظ الفاتورة بدون خصم مخزون
    // (يستدعي دالة غير موجودة) وبأعمدة غير صحيحة للبنود. العملية الذرية آمنة
    // للتكرار، لذا نترك العملية في طابور المزامنة لإعادة المحاولة.
    console.warn('[AtomicSale] RPC failed, keeping operation queued for retry:', rpcError);
    throw rpcError instanceof Error ? rpcError : new Error(String(rpcError));
  }
}
