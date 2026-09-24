/**
 * Purchase Queue Processor - processes offline purchase operations
 * Handles quick_purchase and purchase_invoice types from the sync queue
 */

import { supabase } from '@/integrations/supabase/client';
import { finalizePurchaseInvoiceCloud } from './purchase-invoices-cloud';
import { getOwnerIdForInsert, filterTablePayload } from '@/lib/supabase-store';
import { extractErrorMessage } from '@/lib/sync-queue';

interface QuickPurchaseData {
  productName: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
  imageUrl?: string;
  barcode?: string;
  category?: string;
  salePrice?: number;
  wholesalePrice?: number;
  minStockLevel?: number;
  expiryDate?: string;
  productId?: string;
}

interface PurchaseInvoiceData {
  invoiceNumber: string;
  supplierName: string;
  supplierCompany?: string;
  invoiceDate: string;
  notes?: string;
  imageUrl?: string;
  items: Array<{
    product_name: string;
    barcode?: string;
    category?: string;
    quantity: number;
    cost_price: number;
    sale_price?: number;
    product_id?: string;
  }>;
}

export async function processQuickPurchaseFromQueue(data: QuickPurchaseData): Promise<boolean> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    throw new Error('المستخدم غير مسجل الدخول لمزامنة مشتريات الطابور');
  }

  // استخدام owner_id لضمان عزل الصلاحيات
  const ownerId = await getOwnerIdForInsert() || user.id;

  const invoiceNumber = `QP-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];

  // 1. Resolve or create target product
  let targetProductId = data.productId;
  if (!targetProductId) {
    if (data.barcode?.trim()) {
      const { data: byBarcode } = await supabase
        .from('products')
        .select('id, quantity, cost_price, purchase_history')
        .eq('user_id', ownerId)
        .eq('barcode', data.barcode.trim())
        .maybeSingle();
      if (byBarcode) targetProductId = byBarcode.id;
    }
    if (!targetProductId && data.productName?.trim()) {
      const { data: byName } = await supabase
        .from('products')
        .select('id, quantity, cost_price, purchase_history')
        .eq('user_id', ownerId)
        .ilike('name', data.productName.trim())
        .maybeSingle();
      if (byName) targetProductId = byName.id;
    }
  }

  if (targetProductId) {
    const { data: existingProd, error: fetchErr } = await supabase
      .from('products')
      .select('quantity, cost_price, purchase_history')
      .eq('id', targetProductId)
      .single();

    if (fetchErr) {
      throw new Error(`تعذر جلب المنتج للتحديث: ${extractErrorMessage(fetchErr)}`);
    }

    const curQty = existingProd?.quantity || 0;
    const curCost = Number(existingProd?.cost_price) || 0;
    const newQty = curQty + data.quantity;
    const avgCost = newQty > 0 && data.costPrice > 0
      ? Math.round(((curQty * curCost) + (data.quantity * data.costPrice)) / newQty * 100) / 100
      : data.costPrice;

    const hist = Array.isArray(existingProd?.purchase_history) ? [...existingProd.purchase_history] : [];
    hist.push({
      invoice_id: invoiceNumber,
      invoice_number: invoiceNumber,
      supplier_name: data.productName,
      date: today,
      quantity: data.quantity,
      cost_price: data.costPrice,
      added_at: new Date().toISOString(),
    });

    interface ProductUpdates {
      quantity: number;
      cost_price: number;
      purchase_history: unknown[];
      updated_at: string;
      sale_price?: number;
      category?: string;
      barcode?: string;
      expiry_date?: string;
      image_url?: string;
      custom_fields?: Record<string, unknown> | null;
    }
    const updates: ProductUpdates = {
      quantity: newQty,
      cost_price: avgCost,
      purchase_history: hist,
      updated_at: new Date().toISOString(),
    };
    if (data.salePrice) updates.sale_price = data.salePrice;
    if (data.category) updates.category = data.category;
    if (data.barcode) updates.barcode = data.barcode;
    if (data.expiryDate) updates.expiry_date = data.expiryDate;
    if (data.imageUrl) updates.image_url = data.imageUrl;
    if (data.wholesalePrice) {
      updates.custom_fields = { wholesalePrice: data.wholesalePrice };
    }

    const cleanUpdates = filterTablePayload('products', updates as unknown as Record<string, unknown>);
    const { error: updErr } = await supabase
      .from('products')
      .update(cleanUpdates as Parameters<ReturnType<typeof supabase.from>['update']>[0])
      .eq('id', targetProductId);

    if (updErr) {
      throw new Error(`فشل تحديث المنتج: ${extractErrorMessage(updErr)}`);
    }
  } else {
    // Insert new product
    const newProdPayload = filterTablePayload('products', {
      user_id: ownerId,
      name: data.productName,
      barcode: data.barcode || null,
      category: data.category || null,
      cost_price: data.costPrice,
      sale_price: data.salePrice || data.costPrice,
      quantity: data.quantity,
      min_stock_level: data.minStockLevel || 5,
      expiry_date: data.expiryDate || null,
      image_url: data.imageUrl || null,
      custom_fields: data.wholesalePrice ? { wholesalePrice: data.wholesalePrice } : null,
      purchase_history: [{
        invoice_id: invoiceNumber,
        invoice_number: invoiceNumber,
        supplier_name: data.productName,
        date: today,
        quantity: data.quantity,
        cost_price: data.costPrice,
        added_at: new Date().toISOString(),
      }]
    });

    const { data: newProd, error: prodErr } = await supabase
      .from('products')
      .insert(newProdPayload as Parameters<ReturnType<typeof supabase.from>['insert']>[0])
      .select('id')
      .single();

    if (prodErr || !newProd) {
      throw new Error(`فشل إنشاء منتج جديد للمشتريات: ${extractErrorMessage(prodErr)}`);
    }

    targetProductId = newProd.id;
  }

  // 2. Create invoice
  const invoicePayload = filterTablePayload('purchase_invoices', {
    user_id: ownerId,
    invoice_number: invoiceNumber,
    supplier_name: data.productName,
    invoice_date: today,
    expected_items_count: 1,
    expected_total_quantity: data.quantity,
    expected_grand_total: data.totalCost,
    actual_items_count: 1,
    actual_total_quantity: data.quantity,
    actual_grand_total: data.totalCost,
    status: 'finalized',
    image_url: data.imageUrl || null,
  });

  const { data: invoice, error: invError } = await supabase
    .from('purchase_invoices')
    .insert(invoicePayload as Parameters<ReturnType<typeof supabase.from>['insert']>[0])
    .select()
    .single();

  if (invError || !invoice) {
    throw new Error(`فشل إنشاء فاتورة الشراء: ${extractErrorMessage(invError)}`);
  }

  // 3. Create invoice item
  const itemPayload = filterTablePayload('purchase_invoice_items', {
    invoice_id: invoice.id,
    product_id: targetProductId || null,
    product_name: data.productName,
    barcode: data.barcode || null,
    category: data.category || null,
    quantity: data.quantity,
    cost_price: data.costPrice,
    sale_price: data.salePrice || data.costPrice,
    total_cost: data.totalCost,
  });

  const { error: itemError } = await supabase
    .from('purchase_invoice_items')
    .insert(itemPayload as Parameters<ReturnType<typeof supabase.from>['insert']>[0]);

  if (itemError) {
    throw new Error(`فشل حفظ بند فاتورة الشراء: ${extractErrorMessage(itemError)}`);
  }

  return true;
}

export async function processPurchaseInvoiceFromQueue(data: PurchaseInvoiceData): Promise<boolean> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    throw new Error('المستخدم غير مسجل الدخول لمزامنة فاتورة المشتريات');
  }

  // استخدام owner_id لضمان عزل الصلاحيات
  const ownerId = await getOwnerIdForInsert() || user.id;

  // Create the invoice
  const invPayload = filterTablePayload('purchase_invoices', {
    user_id: ownerId,
    invoice_number: data.invoiceNumber,
    supplier_name: data.supplierName,
    supplier_company: data.supplierCompany || null,
    invoice_date: data.invoiceDate,
    expected_items_count: 0,
    expected_total_quantity: 0,
    expected_grand_total: 0,
    actual_items_count: data.items.length,
    actual_total_quantity: data.items.reduce((s, i) => s + i.quantity, 0),
    actual_grand_total: data.items.reduce((s, i) => s + i.quantity * i.cost_price, 0),
    status: 'draft',
    notes: data.notes || null,
    image_url: data.imageUrl || null,
  });

  const { data: invoice, error: invError } = await supabase
    .from('purchase_invoices')
    .insert(invPayload as Parameters<ReturnType<typeof supabase.from>['insert']>[0])
    .select()
    .single();

  if (invError || !invoice) {
    throw new Error(`فشل إنشاء فاتورة المشتريات: ${extractErrorMessage(invError)}`);
  }

  // Add all items
  for (const item of data.items) {
    const itemPayload = filterTablePayload('purchase_invoice_items', {
      invoice_id: invoice.id,
      product_name: item.product_name,
      barcode: item.barcode || null,
      category: item.category || null,
      quantity: item.quantity,
      cost_price: item.cost_price,
      sale_price: item.sale_price || 0,
      total_cost: item.quantity * item.cost_price,
      product_id: item.product_id || null,
    });

    const { error } = await supabase
      .from('purchase_invoice_items')
      .insert(itemPayload as Parameters<ReturnType<typeof supabase.from>['insert']>[0]);

    if (error) {
      throw new Error(`فشل إضافة بند الفاتورة (${item.product_name}): ${extractErrorMessage(error)}`);
    }
  }

  // Finalize (updates product stock/history)
  await finalizePurchaseInvoiceCloud(invoice.id);

  return true;
}
