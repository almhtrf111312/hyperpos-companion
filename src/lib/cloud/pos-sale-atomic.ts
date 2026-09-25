import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitEvent, EVENTS } from '@/lib/events';
import { invalidateInvoicesCache } from './invoices-cloud';

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
  const itemById = new Map(bundle.items.map(item => [item.id, item]));
  return bundle.stockItems.map(stockItem => {
    const item = itemById.get(stockItem.productId);
    if (!item) throw new Error(`Missing invoice item for product ${stockItem.productId}`);

    const quantity = Math.round(Number(stockItem.quantity) * 1000) / 1000;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Invalid stock quantity for ${item.name}`);
    }

    // ✅ التأكد من أن product_id هو UUID صالح
    // إذا لم يكن UUID (صنف حر أو مؤقت)، نتركه كما هو ونترك الـ RPC يتعامل معه
    const productId = stockItem.productId;

    return {
      product_id: productId,
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
}

export async function processPosSaleAtomic(
  operationId: string,
  paymentType: 'cash' | 'debt',
  bundle: AtomicSaleBundle,
): Promise<AtomicSaleResult> {
  if (!operationId || operationId.length < 8) throw new Error('Missing or invalid sale operation id');

  const rpcItems = buildRpcItems(bundle);

  // ✅ المحاولة الأولى: استدعاء الدالة الذرية process_pos_sale_atomic
  try {
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

    if (error) {
      // ✅ سجّل الخطأ الكامل من Supabase للتشخيص
      console.error('[AtomicSale] RPC error:', {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
      throw new Error(error.message || 'Atomic sale failed');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success || !row.invoice_id || !row.invoice_number) {
      throw new Error('Atomic sale returned an invalid result');
    }

    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    if (paymentType === 'debt') emitEvent(EVENTS.DEBTS_UPDATED, null);

    return {
      success: true,
      alreadyProcessed: Boolean(row.already_processed),
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
    };
  } catch (rpcError) {
    // ✅ المحاولة الثانية: Fallback Insert — إدراج مباشر في invoices + invoice_items
    console.warn('[AtomicSale] RPC failed, attempting fallback direct insert:', rpcError);
    
    return await fallbackDirectInsert(operationId, paymentType, bundle, rpcItems, rpcError);
  }
}

/**
 * مسار الإدراج البديل (Fallback Insert)
 * يُستخدم عند فشل دالة process_pos_sale_atomic
 * يدرج الفاتورة مباشرة في جدولي invoices و invoice_items
 */
async function fallbackDirectInsert(
  operationId: string,
  paymentType: 'cash' | 'debt',
  bundle: AtomicSaleBundle,
  rpcItems: Array<Record<string, unknown>>,
  originalError: unknown,
): Promise<AtomicSaleResult> {
  try {
    // 1. إنشاء رقم فاتورة فريد
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 2. إدراج رأس الفاتورة في جدول invoices
    const { data: inserted, error: insertError } = await sb
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: paymentType === 'debt' ? 'debt' : 'cash',
        customer_name: bundle.customerName,
        customer_phone: bundle.customerPhone || '',
        subtotal: bundle.subtotal,
        discount: bundle.discount,
        discount_percentage: bundle.discountPercentage || 0,
        tax_rate: bundle.taxRate || 0,
        tax_amount: bundle.taxAmount || 0,
        total: bundle.total,
        profit: bundle.profit,
        currency: bundle.currency,
        payment_type: paymentType,
        status: 'active',
        warehouse_id: bundle.warehouseId || null,
      })
      .select('id, invoice_number')
      .single();

    if (insertError || !inserted) {
      console.error('[AtomicSale] Fallback insert header failed:', {
        message: insertError?.message,
        details: (insertError as any)?.details,
        hint: (insertError as any)?.hint,
      });
      // إذا فشل حتى الـ Fallback، نرمي الخطأ الأصلي
      throw originalError;
    }

    // 3. إدراج الأصناف في جدول invoice_items
    // ⚠️ جدول invoice_items لا يحتوي على حقل user_id
    const invoiceItems = rpcItems.map(item => ({
      invoice_id: inserted.id,
      product_id: isValidUUID(String(item.product_id)) ? item.product_id : null,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price: item.cost_price,
      total: item.amount_original,
      profit: item.profit,
      unit: item.unit || 'piece',
      conversion_factor: item.conversion_factor || 1,
    }));

    const { error: itemsError } = await sb
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      console.error('[AtomicSale] Fallback insert items failed:', {
        message: itemsError.message,
        details: (itemsError as any)?.details,
        hint: (itemsError as any)?.hint,
      });
      // الفاتورة الرئيسية تم إدراجها بنجاح، الأصناف فشلت
      // نكمل مع تحذير
      console.warn('[AtomicSale] Invoice header saved but items failed - will need manual review');
    }

    // 4. خصم المخزون سحابياً
    for (const stockItem of bundle.stockItems) {
      if (!isValidUUID(stockItem.productId)) continue;
      try {
        await sb.rpc('deduct_product_stock', {
          p_product_id: stockItem.productId,
          p_quantity: stockItem.quantity,
          p_warehouse_id: bundle.warehouseId || null,
        });
      } catch (stockErr) {
        console.warn('[AtomicSale] Fallback stock deduction failed for:', stockItem.productId, stockErr);
      }
    }

    console.log('[AtomicSale] ✅ Fallback insert succeeded:', inserted.invoice_number);
    
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    if (paymentType === 'debt') emitEvent(EVENTS.DEBTS_UPDATED, null);

    return {
      success: true,
      alreadyProcessed: false,
      invoiceId: inserted.id,
      invoiceNumber: inserted.invoice_number,
    };
  } catch (fallbackError) {
    console.error('[AtomicSale] Both RPC and fallback failed:', {
      rpcError: originalError,
      fallbackError,
    });
    // رمي الخطأ الأصلي مع تفاصيل الـ Fallback
    const origMsg = originalError instanceof Error ? originalError.message : String(originalError);
    const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    throw new Error(`فشل المزامنة: ${origMsg} | Fallback: ${fbMsg}`);
  }
}