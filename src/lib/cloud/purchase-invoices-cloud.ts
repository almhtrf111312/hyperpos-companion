 import { supabase } from '@/integrations/supabase/client';
 
 export interface PurchaseInvoice {
   id: string;
   user_id: string;
   invoice_number: string;
   supplier_name: string;
   supplier_company?: string;
   invoice_date: string;
   expected_items_count: number;
   expected_total_quantity: number;
   expected_grand_total: number;
   actual_items_count: number;
   actual_total_quantity: number;
   actual_grand_total: number;
   status: 'draft' | 'reconciled' | 'finalized';
   notes?: string;
   created_at: string;
   updated_at: string;
 }
 
 export interface PurchaseInvoiceItem {
   id: string;
   invoice_id: string;
   product_id?: string;
   product_name: string;
   barcode?: string;
   category?: string;
   quantity: number;
   cost_price: number;
   sale_price?: number;
   total_cost: number;
   created_at: string;
 }
 
 export interface CreatePurchaseInvoiceInput {
   invoice_number: string;
   supplier_name: string;
   supplier_company?: string;
   invoice_date: string;
   expected_items_count: number;
   expected_total_quantity: number;
   expected_grand_total: number;
   notes?: string;
 }
 
 export interface CreatePurchaseInvoiceItemInput {
   invoice_id: string;
   product_id?: string;
   product_name: string;
   barcode?: string;
   category?: string;
   quantity: number;
   cost_price: number;
   sale_price?: number;
 }
 
 // Local storage cache helpers
 const LOCAL_CACHE_KEY = 'hyperpos_purchase_invoices_cache';

 const savePurchaseInvoicesLocally = (invoices: PurchaseInvoice[]) => {
   try {
     localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(invoices));
   } catch { /* ignore */ }
 };

 const loadPurchaseInvoicesLocally = (): PurchaseInvoice[] | null => {
   try {
     const data = localStorage.getItem(LOCAL_CACHE_KEY);
     return data ? JSON.parse(data) : null;
   } catch { return null; }
 };

 // Load all purchase invoices
 export async function loadPurchaseInvoicesCloud(): Promise<PurchaseInvoice[]> {
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return [];

   // Offline: return local cache
   if (!navigator.onLine) {
     const local = loadPurchaseInvoicesLocally();
     if (local) return local;
     return [];
   }

   const { data, error } = await supabase
     .from('purchase_invoices')
     .select('*')
     .order('created_at', { ascending: false });

   if (error) {
     console.error('Error loading purchase invoices:', error);
     return [];
   }

   const invoices = (data || []) as PurchaseInvoice[];
   savePurchaseInvoicesLocally(invoices);
   return invoices;
 }
 
 // Load single purchase invoice with items
 export async function loadPurchaseInvoiceWithItems(invoiceId: string): Promise<{
   invoice: PurchaseInvoice | null;
   items: PurchaseInvoiceItem[];
 }> {
   const { data: invoice, error: invoiceError } = await supabase
     .from('purchase_invoices')
     .select('*')
     .eq('id', invoiceId)
     .single();
 
   if (invoiceError) {
     console.error('Error loading purchase invoice:', invoiceError);
     return { invoice: null, items: [] };
   }
 
   const { data: items, error: itemsError } = await supabase
     .from('purchase_invoice_items')
     .select('*')
     .eq('invoice_id', invoiceId)
     .order('created_at', { ascending: true });
 
   if (itemsError) {
     console.error('Error loading purchase invoice items:', itemsError);
     return { invoice: invoice as PurchaseInvoice, items: [] };
   }
 
   return {
     invoice: invoice as PurchaseInvoice,
     items: (items || []) as PurchaseInvoiceItem[]
   };
 }
 
 // Create new purchase invoice
 export async function addPurchaseInvoiceCloud(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoice | null> {
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return null;
 
   const { data, error } = await supabase
     .from('purchase_invoices')
     .insert({
       user_id: user.id,
       ...input,
       status: 'draft',
       actual_items_count: 0,
       actual_total_quantity: 0,
       actual_grand_total: 0
     })
     .select()
     .single();
 
   if (error) {
     console.error('Error creating purchase invoice:', error);
     return null;
   }
 
   return data as PurchaseInvoice;
 }
 
 // Add item to purchase invoice
 export async function addPurchaseInvoiceItemCloud(input: CreatePurchaseInvoiceItemInput): Promise<PurchaseInvoiceItem | null> {
   const total_cost = input.quantity * input.cost_price;
 
   const { data, error } = await supabase
     .from('purchase_invoice_items')
     .insert({
       ...input,
       total_cost
     })
     .select()
     .single();
 
   if (error) {
     console.error('Error adding purchase invoice item:', error);
     return null;
   }
 
   // Update invoice totals
   await updateInvoiceTotals(input.invoice_id);
 
   return data as PurchaseInvoiceItem;
 }
 
 // Update invoice totals based on items
 async function updateInvoiceTotals(invoiceId: string): Promise<void> {
   const { data: items } = await supabase
     .from('purchase_invoice_items')
     .select('quantity, total_cost')
     .eq('invoice_id', invoiceId);
 
   if (!items) return;
 
   const actual_items_count = items.length;
   const actual_total_quantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
   const actual_grand_total = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
 
   await supabase
     .from('purchase_invoices')
     .update({
       actual_items_count,
       actual_total_quantity,
       actual_grand_total
     })
     .eq('id', invoiceId);
 }
 
 // Delete item from purchase invoice
 export async function deletePurchaseInvoiceItemCloud(itemId: string, invoiceId: string): Promise<boolean> {
   const { error } = await supabase
     .from('purchase_invoice_items')
     .delete()
     .eq('id', itemId);
 
   if (error) {
     console.error('Error deleting purchase invoice item:', error);
     return false;
   }
 
   await updateInvoiceTotals(invoiceId);
   return true;
 }
 
 // Finalize purchase invoice and update product stock
 export async function finalizePurchaseInvoiceCloud(invoiceId: string): Promise<boolean> {
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return false;
 
   // Get invoice and items
   const { invoice, items } = await loadPurchaseInvoiceWithItems(invoiceId);
   if (!invoice || items.length === 0) return false;
 
   // Start transaction-like operations
   try {
     // For each item, create or update product
     for (const item of items) {
       if (item.product_id) {
         // Update existing product quantity
         const { data: product } = await supabase
           .from('products')
           .select('quantity, purchase_history')
           .eq('id', item.product_id)
           .single();
 
         if (product) {
           const newQuantity = (product.quantity || 0) + item.quantity;
           const purchaseHistory = Array.isArray(product.purchase_history) 
             ? product.purchase_history 
             : [];
           
           purchaseHistory.push({
             invoice_id: invoiceId,
             invoice_number: invoice.invoice_number,
             supplier_name: invoice.supplier_name,
             date: invoice.invoice_date,
             quantity: item.quantity,
             cost_price: item.cost_price,
             added_at: new Date().toISOString()
           });
 
           await supabase
             .from('products')
             .update({
               quantity: newQuantity,
               cost_price: item.cost_price,
               purchase_history: purchaseHistory
             })
             .eq('id', item.product_id);
         }
       } else {
         // Create new product
         const { data: newProduct } = await supabase
           .from('products')
           .insert({
             user_id: user.id,
             name: item.product_name,
             barcode: item.barcode,
             category: item.category,
             quantity: item.quantity,
             cost_price: item.cost_price,
             sale_price: item.sale_price || item.cost_price,
             purchase_history: [{
               invoice_id: invoiceId,
               invoice_number: invoice.invoice_number,
               supplier_name: invoice.supplier_name,
               date: invoice.invoice_date,
               quantity: item.quantity,
               cost_price: item.cost_price,
               added_at: new Date().toISOString()
             }]
           })
           .select()
           .single();
 
         // Update item with new product_id
         if (newProduct) {
           await supabase
             .from('purchase_invoice_items')
             .update({ product_id: newProduct.id })
             .eq('id', item.id);
         }
       }
     }
 
     // Update invoice status
     await supabase
       .from('purchase_invoices')
       .update({ status: 'finalized' })
       .eq('id', invoiceId);
 
     return true;
   } catch (error) {
     console.error('Error finalizing purchase invoice:', error);
     return false;
   }
 }
 
 // Delete purchase invoice
 export async function deletePurchaseInvoiceCloud(invoiceId: string): Promise<boolean> {
   const { error } = await supabase
     .from('purchase_invoices')
     .delete()
     .eq('id', invoiceId);
 
   if (error) {
     console.error('Error deleting purchase invoice:', error);
     return false;
   }
 
   return true;
 }
 
 // Update purchase invoice status
 export async function updatePurchaseInvoiceStatusCloud(
   invoiceId: string, 
   status: 'draft' | 'reconciled' | 'finalized'
 ): Promise<boolean> {
   const { error } = await supabase
     .from('purchase_invoices')
     .update({ status })
     .eq('id', invoiceId);
 
   if (error) {
     console.error('Error updating purchase invoice status:', error);
     return false;
   }
 
   return true;
 }