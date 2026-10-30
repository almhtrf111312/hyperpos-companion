import { supabase } from '@/integrations/supabase/client';
import { isNoInventoryMode } from '@/lib/store-type-config';
import { round8 } from '@/lib/money-engine';
import { emitEvent, EVENTS } from '@/lib/events';
import { getOwnerIdForInsert, getCurrentUserId } from '@/lib/supabase-store';
import { getPendingOperations } from '@/lib/sync-queue';
import { isGuestDemoMode } from '@/lib/demo-data';
 
 export interface PurchaseInvoice {
   id: string;
   user_id: string;
   invoice_number: string;
  image_url?: string | null;
   supplier_name: string;
   supplier_company?: string;
  supplier_phone?: string;
  payment_type?: string;
   invoice_date: string;
   expected_items_count: number;
   expected_total_quantity: number;
   expected_grand_total: number;
   actual_items_count: number;
   actual_total_quantity: number;
   actual_grand_total: number;
   status: 'draft' | 'reconciled' | 'finalized' | 'superseded';
  replaced_by?: string;
  operation_id?: string;
  edit_reason?: string;
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

let purchaseInvoicesCache: PurchaseInvoice[] | null = null;
let purchaseCacheTimestamp = 0;
const PURCHASE_CACHE_TTL = 30000;

export const invalidatePurchaseInvoicesCache = () => {
  purchaseInvoicesCache = null;
  purchaseCacheTimestamp = 0;
};

const savePurchaseInvoicesLocally = (invoices: PurchaseInvoice[]) => {
  try {
    purchaseInvoicesCache = invoices;
    purchaseCacheTimestamp = Date.now();
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
  if (isGuestDemoMode()) {
    const local = loadPurchaseInvoicesLocally();
    return local || [];
  }
  // 1. Offline fast-path: zero network delay, instant local cache + queue
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const local = loadPurchaseInvoicesLocally();
    return mergeSyncQueuePurchases(local || purchaseInvoicesCache || []);
  }

  // 2. Safe userId retrieval using local session
  let userId = getCurrentUserId();
  if (!userId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id || null;
    } catch { /* ignore */ }
  }

  if (!userId) {
    const local = loadPurchaseInvoicesLocally();
    return mergeSyncQueuePurchases(local || purchaseInvoicesCache || []);
  }

  if (purchaseInvoicesCache && Date.now() - purchaseCacheTimestamp < PURCHASE_CACHE_TTL) {
    return mergeSyncQueuePurchases(purchaseInvoicesCache);
  }

  try {
    const { data, error } = await supabase
      .from('purchase_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error loading purchase invoices from cloud:', error);
      const local = loadPurchaseInvoicesLocally();
      return mergeSyncQueuePurchases(local || purchaseInvoicesCache || []);
    }

    const invoices = (data || []) as PurchaseInvoice[];
    savePurchaseInvoicesLocally(invoices);
    return mergeSyncQueuePurchases(invoices);
  } catch (err) {
    console.warn('Exception loading purchase invoices, falling back to local cache:', err);
    const local = loadPurchaseInvoicesLocally();
    return mergeSyncQueuePurchases(local || purchaseInvoicesCache || []);
  }
}
 
// Load single purchase invoice with items
export async function loadPurchaseInvoiceWithItems(invoiceId: string): Promise<{
  invoice: PurchaseInvoice | null;
  items: PurchaseInvoiceItem[];
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const local = loadPurchaseInvoicesLocally() || [];
    const invoice = local.find(i => i.id === invoiceId || i.invoice_number === invoiceId) || null;
    return { invoice, items: [] };
  }

  try {
    const { data: invoice, error: invoiceError } = await supabase
      .from('purchase_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.warn('Error loading purchase invoice:', invoiceError);
      const local = loadPurchaseInvoicesLocally() || [];
      const cached = local.find(i => i.id === invoiceId || i.invoice_number === invoiceId) || null;
      return { invoice: cached, items: [] };
    }

    const { data: items, error: itemsError } = await supabase
      .from('purchase_invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.warn('Error loading purchase invoice items:', itemsError);
      return { invoice: invoice as PurchaseInvoice, items: [] };
    }

    return {
      invoice: invoice as PurchaseInvoice,
      items: (items || []) as PurchaseInvoiceItem[]
    };
  } catch (err) {
    console.warn('Exception loading purchase invoice with items:', err);
    const local = loadPurchaseInvoicesLocally() || [];
    const cached = local.find(i => i.id === invoiceId || i.invoice_number === invoiceId) || null;
    return { invoice: cached, items: [] };
  }
}

// Create new purchase invoice
 export async function addPurchaseInvoiceCloud(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoice | null> {
   if (isGuestDemoMode()) {
     const tempId = `demo_pi_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
     const demoInvoice: PurchaseInvoice = {
       id: tempId,
       user_id: 'guest-demo-user',
       invoice_number: input.invoice_number,
       supplier_name: input.supplier_name,
       supplier_company: input.supplier_company,
       invoice_date: input.invoice_date,
       expected_items_count: input.expected_items_count,
       expected_total_quantity: input.expected_total_quantity,
       expected_grand_total: input.expected_grand_total,
       actual_items_count: 0,
       actual_total_quantity: 0,
       actual_grand_total: 0,
       status: 'draft',
       notes: input.notes,
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString(),
     };
     const local = loadPurchaseInvoicesLocally() || [];
     local.unshift(demoInvoice);
     savePurchaseInvoicesLocally(local);
     emitEvent(EVENTS.PURCHASES_UPDATED, null);
     return demoInvoice;
   }
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
   if (isGuestDemoMode()) {
     const tempId = `demo_pii_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
     return {
       id: tempId,
       invoice_id: input.invoice_id,
       product_id: input.product_id,
       product_name: input.product_name,
       barcode: input.barcode,
       category: input.category,
       quantity: input.quantity,
       cost_price: input.cost_price,
       sale_price: input.sale_price,
       total_cost: input.quantity * input.cost_price,
       created_at: new Date().toISOString(),
     };
   }
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
              // ⚖️ الكمية والتكلفة (المتوسط المرجح) تُحسب ذرياً في الخادم — المخزون السالب يُغطّى بسعر الشراء الجديد أولاً
              const { error: wacErr } = await (supabase as any).rpc('receive_stock_wac', {
                _product_id: item.product_id,
                _quantity: item.quantity,
                _unit_cost: item.cost_price || 0,
                _reference: `purchase_invoice:${invoice.invoice_number}`,
              });
              if (wacErr) throw wacErr;
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
                .update({ purchase_history: purchaseHistory })
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
              ? round8(((oldQty * oldCost) + (item.quantity * item.cost_price)) / newQuantity)
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
 
     // ⚖️ تحديث المخزون والتكلفة WAC محلياً وفورياً
     for (const item of items) {
       if (!item.product_id) continue;
       try {
         const { loadProductsFromLocalCache, saveProductsToLocalCache, updateProductInIDB } = await import('./products-cloud');
         const localProducts = loadProductsFromLocalCache() || [];
         const prodIndex = localProducts.findIndex(p => p.id === item.product_id);
         if (prodIndex !== -1) {
           const current = localProducts[prodIndex];
           const currentQty = Number(current.quantity) || 0;
           const currentCost = Number(current.cost_price) || 0;
           const purchasedQty = Number(item.quantity) || 0;
           const purchasedCost = Number(item.cost_price) || 0;

           let newCost = currentCost;
           if (currentQty <= 0) {
             newCost = purchasedCost > 0 ? purchasedCost : currentCost;
           } else if (purchasedCost > 0) {
             newCost = Math.round(((currentQty * currentCost) + (purchasedQty * purchasedCost)) / (currentQty + purchasedQty) * 100000000) / 100000000;
           }
           const newQty = currentQty + purchasedQty;

           localProducts[prodIndex] = {
             ...current,
             quantity: newQty,
             cost_price: newCost,
             status: newQty > 0 ? 'available' : 'out_of_stock'
           };
           saveProductsToLocalCache(localProducts);
           await updateProductInIDB(item.product_id, {
             quantity: newQty,
             cost_price: newCost,
             status: newQty > 0 ? 'available' : 'out_of_stock'
           });
         }
       } catch (e) {
         console.warn('[PurchaseInvoices] Local WAC update error:', e);
       }
     }
     emitEvent(EVENTS.PRODUCTS_UPDATED, null);

     invalidatePurchaseInvoicesCache();
     emitEvent(EVENTS.PURCHASE_INVOICES_UPDATED, null);

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
         // Bind the invoice number as a parameter (no filter-string interpolation)
         const safe = String(invoice.invoice_number).replace(/[\\%_]/g, (c) => `\\${c}`);
         await supabase.from('expenses').delete().ilike('notes', `%${safe}%`);
         await supabase.from('expenses').delete().ilike('description', `%${safe}%`);
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
/** Merge pending (not yet synced) purchase invoices from the sync queue into the list. */
function mergeSyncQueuePurchases(list: PurchaseInvoice[]): PurchaseInvoice[] {
  try {
    const existing = new Set(list.map(i => i.invoice_number));
    const pending = getPendingOperations()
      .filter(op => op.type === 'purchase_invoice')
      .map(op => {
        const d = op.data as Record<string, any>;
        return {
          id: `queued-${op.id}`,
          user_id: '',
          invoice_number: String(d.invoiceNumber ?? ''),
          supplier_name: String(d.supplierName ?? ''),
          supplier_company: d.supplierCompany,
          invoice_date: String(d.invoiceDate ?? op.createdAt?.slice(0, 10) ?? ''),
          expected_items_count: Number(d.expectedItemsCount ?? 0),
          expected_total_quantity: Number(d.expectedTotalQuantity ?? 0),
          expected_grand_total: Number(d.expectedGrandTotal ?? 0),
          status: 'draft',
          notes: d.notes,
          created_at: op.createdAt,
        } as unknown as PurchaseInvoice;
      })
      .filter(p => p.invoice_number && !existing.has(p.invoice_number));
    return pending.length ? [...pending, ...list] : list;
  } catch {
    return list;
  }
}


export interface EditPurchaseInvoiceLine {
  product_id?: string;
  product_name: string;
  barcode?: string;
  category?: string;
  quantity: number;
  cost_price: number;
  sale_price?: number;
}

/**
 * Atomic server-side purchase invoice editing function.
 * Reverses old stock, verifies non-negative stock, adds new lines,
 * recalculates weighted average cost, marks old invoice superseded,
 * and maintains full audit log and idempotency.
 */
export async function editPurchaseInvoiceAtomic(
  invoiceId: string,
  newLines: EditPurchaseInvoiceLine[],
  opId?: string,
  reason: string = 'تعديل فاتورة شراء'
): Promise<{ success: boolean; newInvoiceId?: string; error?: string }> {
  const finalOpId = opId || `edit_pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    if (isGuestDemoMode()) {
      const local = loadPurchaseInvoicesLocally();
      const orig = local.find(i => i.id === invoiceId);
      if (!orig) return { success: false, error: 'الفاتورة غير موجودة' };
      orig.status = 'superseded' as any;
      const newInv: PurchaseInvoice = {
        ...orig,
        id: `demo_pi_${Date.now()}`,
        invoice_number: `${orig.invoice_number}-REV`,
        status: orig.status === 'finalized' ? 'finalized' : 'draft',
        actual_items_count: newLines.length,
        actual_total_quantity: newLines.reduce((s, l) => s + (l.quantity || 0), 0),
        actual_grand_total: newLines.reduce((s, l) => s + (l.quantity * l.cost_price || 0), 0),
        notes: `${orig.notes || ''} [تعديل للفاتورة #${orig.invoice_number}]`,
        updated_at: new Date().toISOString(),
      };
      local.unshift(newInv);
      savePurchaseInvoicesLocally(local);
      emitEvent(EVENTS.PURCHASES_UPDATED, null);
      emitEvent(EVENTS.PRODUCTS_UPDATED, null);
      return { success: true, newInvoiceId: newInv.id };
    }

    const { data, error } = await (supabase as any).rpc('edit_purchase_invoice_atomic', {
      _invoice_id: invoiceId,
      _new_lines: newLines,
      _op_id: finalOpId,
      _reason: reason
    });

    if (error) {
      console.error('Error in edit_purchase_invoice_atomic RPC:', error);
      return { success: false, error: error.message || 'فشل تعديل الفاتورة' };
    }

    emitEvent(EVENTS.PURCHASES_UPDATED, null);
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
    return { success: true, newInvoiceId: data as string };
  } catch (err: any) {
    console.error('Exception in editPurchaseInvoiceAtomic:', err);
    return { success: false, error: err?.message || 'حدث خطأ أثناء الاتصال بالخادم' };
  }
}
