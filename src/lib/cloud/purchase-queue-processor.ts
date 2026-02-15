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

  const { data: invoice, error: invError } = await supabase
    .from('purchase_invoices')
    .insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      supplier_name: data.productName,
      invoice_date: new Date().toISOString().split('T')[0],
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

  const { error: itemError } = await supabase
    .from('purchase_invoice_items')
    .insert({
      invoice_id: invoice.id,
      product_name: data.productName,
      quantity: data.quantity,
      cost_price: data.costPrice,
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
