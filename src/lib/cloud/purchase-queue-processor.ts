/**
 * Purchase Queue Processor - processes offline purchase operations
 * Handles quick_purchase and purchase_invoice types from the sync queue
 */

import { supabase } from '@/integrations/supabase/client';
import { finalizePurchaseInvoiceCloud } from './purchase-invoices-cloud';

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const invoiceNumber = `QP-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];

  // 1. Resolve or create target product
  let targetProductId = data.productId;
  if (!targetProductId) {
    if (data.barcode?.trim()) {
      const { data: byBarcode } = await supabase
        .from('products')
        .select('id, quantity, cost_price, purchase_history')
        .eq('user_id', user.id)
        .eq('barcode', data.barcode.trim())
        .maybeSingle();
      if (byBarcode) targetProductId = byBarcode.id;
    }
    if (!targetProductId && data.productName?.trim()) {
      const { data: byName } = await supabase
        .from('products')
        .select('id, quantity, cost_price, purchase_history')
        .eq('user_id', user.id)
        .ilike('name', data.productName.trim())
        .maybeSingle();
      if (byName) targetProductId = byName.id;
    }
  }

  if (targetProductId) {
    const { data: existingProd } = await supabase
      .from('products')
      .select('quantity, cost_price, purchase_history')
      .eq('id', targetProductId)
      .single();

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

    const updates: Record<string, any> = {
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

    await supabase.from('products').update(updates).eq('id', targetProductId);
  } else {
    // Insert new product
    const { data: newProd } = await supabase
      .from('products')
      .insert({
        user_id: user.id,
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
      })
      .select('id')
      .single();

    if (newProd) targetProductId = newProd.id;
  }

  // 2. Create invoice
  const { data: invoice, error: invError } = await supabase
    .from('purchase_invoices')
    .insert({
      user_id: user.id,
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
    })
    .select()
    .single();

  if (invError) throw invError;

  // 3. Create invoice item
  const { error: itemError } = await supabase
    .from('purchase_invoice_items')
    .insert({
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

  if (itemError) throw itemError;

  return true;
}

export async function processPurchaseInvoiceFromQueue(data: PurchaseInvoiceData): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Create the invoice
  const { data: invoice, error: invError } = await supabase
    .from('purchase_invoices')
    .insert({
      user_id: user.id,
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
    })
    .select()
    .single();

  if (invError) throw invError;

  // Add all items
  for (const item of data.items) {
    const { error } = await supabase
      .from('purchase_invoice_items')
      .insert({
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
    if (error) throw error;
  }

  // Finalize (updates product stock/history)
  await finalizePurchaseInvoiceCloud(invoice.id);

  return true;
}
