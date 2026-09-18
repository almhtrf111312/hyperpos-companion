 import { supabase } from '@/integrations/supabase/client';
 import { isNoInventoryMode } from '@/lib/store-type-config';
 import { emitEvent, EVENTS } from '@/lib/events';
 import { getOwnerIdForInsert } from '@/lib/supabase-store';
 
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
 
   // استخدام owner_id لضمان عزل الصلاحيات (الكاشير يكتب تحت حساب المالك)
   const ownerId = await getOwnerIdForInsert() || user.id;

   const { data, error } = await supabase
     .from('purchase_invoices')
     .insert({
       user_id: ownerId,
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
 
   // استخدام owner_id لضمان عزل الصلاحيات عند إنشاء منتجات جديدة
   const ownerId = await getOwnerIdForInsert() || user.id;

   // Get invoice and items
   const { invoice, items } = await loadPurchaseInvoiceWithItems(invoiceId);
   if (!invoice || items.length === 0) return false;
 
    // Start transaction-like operations
    try {
      const noInventory = isNoInventoryMode();

      // For each item, create or update product
      for (const item of items) {
        if (item.product_id) {
          if (noInventory) {
            // في وضع الفرن: فقط تحديث سعر التكلفة وسجل الشراء بدون زيادة الكمية
            const { data: product } = await supabase
              .from('products')
              .select('purchase_history')
              .eq('id', item.product_id)
              .single();

            if (product) {
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
                  cost_price: item.cost_price,
                  purchase_history: purchaseHistory
                })
                .eq('id', item.product_id);
            }
          } else {
            // Update existing product quantity + stock
            const { data: product } = await supabase
              .from('products')
              .select('quantity, cost_price, purchase_history')
              .eq('id', item.product_id)
              .single();
  
            if (product) {
              const oldQty = product.quantity || 0;
              const oldCost = Number(product.cost_price) || 0;
              const newQuantity = oldQty + item.quantity;
              // Weighted Average Cost: blend old inventory cost with newly-purchased cost
              const avgCost = newQuantity > 0 && item.quantity > 0
                ? Math.round(((oldQty * oldCost) + (item.quantity * item.cost_price)) / newQuantity * 100) / 100
                : (item.cost_price ?? oldCost);
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
                  cost_price: avgCost,
                  purchase_history: purchaseHistory
                })
                .eq('id', item.product_id);
            }
          }
        } else {
          // Check if product already exists by barcode or name
          interface ProductRow { id: string; quantity: number; cost_price: number; purchase_history: unknown[] }
          let existingProduct: ProductRow | null = null;
          if (item.barcode?.trim()) {
            const { data } = await supabase
              .from('products')
              .select('id, quantity, cost_price, purchase_history')
              .eq('user_id', ownerId)
              .eq('barcode', item.barcode.trim())
              .maybeSingle();
            existingProduct = data as unknown as ProductRow | null;
          }
          if (!existingProduct && item.product_name?.trim()) {
            const { data } = await supabase
              .from('products')
              .select('id, quantity, cost_price, purchase_history')
              .eq('user_id', ownerId)
              .ilike('name', item.product_name.trim())
              .maybeSingle();
            existingProduct = data as unknown as ProductRow | null;
          }

          if (existingProduct) {
            const oldQty = existingProduct.quantity || 0;
            const oldCost = Number(existingProduct.cost_price) || 0;
            const newQuantity = noInventory ? 99999 : oldQty + item.quantity;
            const avgCost = newQuantity > 0 && item.quantity > 0
              ? Math.round(((oldQty * oldCost) + (item.quantity * item.cost_price)) / newQuantity * 100) / 100
              : (item.cost_price ?? oldCost);

            const purchaseHistory = Array.isArray(existingProduct.purchase_history)
              ? existingProduct.purchase_history
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
                cost_price: avgCost,
                purchase_history: purchaseHistory as unknown as import('@/integrations/supabase/types').Json
              })
              .eq('id', existingProduct.id);

            await supabase
              .from('purchase_invoice_items')
              .update({ product_id: existingProduct.id })
              .eq('id', item.id);
          } else {
            // Create new product with safe defaults
            const newProductData: Record<string, unknown> = {
              user_id: ownerId,
              name: item.product_name,
              barcode: item.barcode || null,
              category: item.category || null,
              quantity: noInventory ? 99999 : item.quantity,
              cost_price: item.cost_price,
              sale_price: item.sale_price || item.cost_price,
              min_stock_level: 5,
              purchase_history: [{
                invoice_id: invoiceId,
                invoice_number: invoice.invoice_number,
                supplier_name: invoice.supplier_name,
                date: invoice.invoice_date,
                quantity: item.quantity,
                cost_price: item.cost_price,
                added_at: new Date().toISOString()
              }]
            };

            const { data: newProduct } = await supabase
              .from('products')
              .insert({
                user_id: ownerId,
                name: item.product_name,
                barcode: item.barcode || null,
                category: item.category || null,
                quantity: noInventory ? 99999 : item.quantity,
                cost_price: item.cost_price,
                sale_price: item.sale_price || item.cost_price,
                min_stock_level: 5,
                purchase_history: [{
                  invoice_id: invoiceId,
                  invoice_number: invoice.invoice_number,
                  supplier_name: invoice.supplier_name,
                  date: invoice.invoice_date,
                  quantity: item.quantity,
                  cost_price: item.cost_price,
                  added_at: new Date().toISOString()
                }] as unknown as import('@/integrations/supabase/types').Json
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
 
 // Delete purchase invoice with full inventory deduction and financial reversal
 export async function deletePurchaseInvoiceCloud(invoiceId: string): Promise<boolean> {
   try {
     const isOfflineInvoice = invoiceId.startsWith('local_');
 
     // 1. Load invoice and its items before deleting
     let invoice: PurchaseInvoice | null = null;
     let items: PurchaseInvoiceItem[] = [];
 
     if (!isOfflineInvoice) {
       const result = await loadPurchaseInvoiceWithItems(invoiceId);
       invoice = result.invoice;
       items = result.items;
     } else {
       const localInvoices = loadPurchaseInvoicesLocally();
       invoice = localInvoices.find(i => i.id === invoiceId) || null;
     }
 
     // 2. Inventory reversal: Deduct item quantities and remove purchase history
     if (items.length > 0 && !isNoInventoryMode()) {
       for (const item of items) {
          if (!item.quantity || item.quantity <= 0) continue;

          interface TargetProductRow { id: string; quantity: number; cost_price: number; purchase_history: unknown[] }
          let targetProduct: TargetProductRow | null = null;
         if (item.product_id) {
           const { data } = await supabase
             .from('products')
             .select('id, quantity, cost_price, purchase_history')
             .eq('id', item.product_id)
             .maybeSingle();
           targetProduct = data as unknown as TargetProductRow | null;
         }
 
         if (!targetProduct && invoice?.user_id) {
           if (item.barcode?.trim()) {
             const { data } = await supabase
               .from('products')
               .select('id, quantity, cost_price, purchase_history')
               .eq('user_id', invoice.user_id)
               .eq('barcode', item.barcode.trim())
               .maybeSingle();
             targetProduct = data as unknown as TargetProductRow | null;
           }
           if (!targetProduct && item.product_name?.trim()) {
             const { data } = await supabase
               .from('products')
               .select('id, quantity, cost_price, purchase_history')
               .eq('user_id', invoice.user_id)
               .ilike('name', item.product_name.trim())
               .maybeSingle();
             targetProduct = data as unknown as TargetProductRow | null;
           }
         }
 
         if (targetProduct) {
           const currentQty = targetProduct.quantity || 0;
           const newQty = Math.max(0, currentQty - item.quantity);
           const oldHistory = Array.isArray(targetProduct.purchase_history)
             ? targetProduct.purchase_history
             : [];
            const updatedHistory = (oldHistory as Array<Record<string, unknown>>).filter((h) =>
             h.invoice_id !== invoiceId &&
             h.invoice_id !== invoice?.invoice_number &&
             h.invoice_number !== invoice?.invoice_number
           );
           const lastEntry = updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1] : null;
            const newCostPrice: number = (lastEntry?.cost_price as number | undefined) ?? targetProduct.cost_price;
 
           await supabase
             .from('products')
             .update({
               quantity: newQty,
               purchase_history: updatedHistory as unknown as import('@/integrations/supabase/types').Json,
               cost_price: newCostPrice,
               updated_at: new Date().toISOString(),
             })
             .eq('id', targetProduct.id);
         }
       }
     }
 
     // 3. Financial reversal: Remove any associated expenses
     if (invoice?.invoice_number) {
       try {
         await supabase
           .from('expenses')
           .delete()
           .or(`notes.ilike.%${invoice.invoice_number}%,description.ilike.%${invoice.invoice_number}%`);
       } catch (e) {
         console.warn('Could not cleanup cloud expenses for invoice:', e);
       }
 
       // Cleanup local expenses cache
       try {
         const rawExpenses = localStorage.getItem('hyperpos_expenses_v1');
         if (rawExpenses) {
           const parsed = JSON.parse(rawExpenses);
           if (Array.isArray(parsed)) {
              const filtered = (parsed as Array<Record<string, string | undefined>>).filter((e) =>
               !e.notes?.includes(invoice.invoice_number) &&
               !e.description?.includes(invoice.invoice_number) &&
               !e.title?.includes(invoice.invoice_number)
             );
             if (filtered.length !== parsed.length) {
               localStorage.setItem('hyperpos_expenses_v1', JSON.stringify(filtered));
               emitEvent(EVENTS.EXPENSES_UPDATED);
             }
           }
         }
        } catch (localErr) {
          console.warn('[deletePurchaseInvoiceCloud] local expenses cleanup failed:', localErr);
        }
      }
 
     // 4. Delete invoice items from cloud
     if (!isOfflineInvoice) {
       await supabase
         .from('purchase_invoice_items')
         .delete()
         .eq('invoice_id', invoiceId);
 
       // 5. Delete purchase invoice record
       const { error } = await supabase
         .from('purchase_invoices')
         .delete()
         .eq('id', invoiceId);
 
       if (error) {
         console.error('Error deleting purchase invoice:', error);
         return false;
       }
     }
 
     // 6. Update local invoices cache
     const localInvoices = loadPurchaseInvoicesLocally();
     const updatedInvoices = localInvoices.filter(i => i.id !== invoiceId);
     savePurchaseInvoicesLocally(updatedInvoices);
 
     // 7. Emit updates across app
     emitEvent(EVENTS.PURCHASES_UPDATED);
     emitEvent(EVENTS.PRODUCTS_UPDATED);
     emitEvent(EVENTS.EXPENSES_UPDATED);
 
     return true;
   } catch (error) {
     console.error('Error in deletePurchaseInvoiceCloud:', error);
     return false;
   }
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