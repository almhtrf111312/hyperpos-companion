// Cloud Invoices Store - Supabase-backed invoices management
import {
  fetchFromSupabase,
  insertToSupabase,
  updateInSupabase,
  deleteFromSupabase,
  getCurrentUserId,
  setCurrentUserId,
  isCashierUser
} from '../supabase-store';
import { supabase } from '@/integrations/supabase/client';
import { emitEvent, EVENTS } from '../events';
import { saveToOfflineCache, loadFromOfflineCache } from '../offline-cache';

export type InvoiceType = 'sale' | 'maintenance';
export type PaymentType = 'cash' | 'debt';
export type InvoiceStatus = 'paid' | 'pending' | 'cancelled';

export interface InvoiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  costPrice?: number; // ✅ سعر التكلفة لحظة البيع
  profit?: number;    // ✅ الربح لكل عنصر
}

export interface CloudInvoice {
  id: string;
  user_id: string;
  invoice_number: string;
  invoice_type: string;
  date: string;
  time: string;
  cashier_id: string | null;
  cashier_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount: number;
  discount_percentage: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  profit: number;
  currency: string;
  exchange_rate: number;
  payment_type: string;
  status: string;
  debt_paid: number;
  debt_remaining: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountPercentage?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  totalInCurrency: number;
  currency: string;
  currencySymbol: string;
  paymentType: PaymentType;
  status: InvoiceStatus;
  serviceDescription?: string;
  serviceType?: string;
  productType?: string;
  partsCost?: number;
  profit?: number;
  debtPaid?: number;
  debtRemaining?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cashierId?: string;
  cashierName?: string;
}

// Transform cloud to legacy
function toInvoice(cloud: CloudInvoice): Invoice {
  const subtotal = Number(cloud.subtotal) || 0;
  const rawDiscount = Number(cloud.discount) || 0;
  const discountPercentage = Number(cloud.discount_percentage) || 0;

  // Calculate actual discount amount:
  // If discountPercentage > 0, it means the raw discount is a percentage, so compute the actual amount
  const actualDiscount = discountPercentage > 0
    ? (subtotal * discountPercentage) / 100
    : rawDiscount;

  return {
    id: cloud.invoice_number || cloud.id,
    type: (cloud.invoice_type as InvoiceType) || 'sale',
    customerName: cloud.customer_name || 'عميل',
    customerPhone: cloud.customer_phone || undefined,
    items: [], // Items loaded separately
    subtotal,
    discount: actualDiscount,
    discountPercentage,
    total: Number(cloud.total) || 0,
    totalInCurrency: Number(cloud.total) || 0,
    currency: cloud.currency || 'USD',
    currencySymbol: '$',
    paymentType: (cloud.payment_type as PaymentType) || 'cash',
    status: (cloud.status as InvoiceStatus) || 'paid',
    profit: Number(cloud.profit) || 0,
    debtPaid: Number(cloud.debt_paid) || 0,
    debtRemaining: Number(cloud.debt_remaining) || 0,
    createdAt: cloud.created_at,
    updatedAt: cloud.updated_at,
    cashierId: cloud.cashier_id || undefined,
    cashierName: cloud.cashier_name || undefined,
  };
}

// Cache
let invoicesCache: Invoice[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

// Generate invoice number
const getNextInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const datePrefix = `${year}${month}${day}`;

  const invoices = await loadInvoicesCloud();

  // Filter invoices created today to sequence them
  // Assuming ID format is YYYYMMDD-XXX
  const todayInvoices = invoices.filter(inv =>
    inv.id.startsWith(datePrefix)
  );

  const nextNumber = todayInvoices.length + 1;
  // Use 3 digits for sequence (e.g. 001)
  return `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;
};

// Load invoices
// ✅ Owners see all invoices, cashiers see only their own
export const loadInvoicesCloud = async (): Promise<Invoice[]> => {
  let userId = getCurrentUserId();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      userId = user.id;
      setCurrentUserId(user.id);
    }
  }
  if (!userId) {
    // Fallback to offline cache
    const cached = loadFromOfflineCache<Invoice[]>('invoices');
    if (cached) {
      console.log('[InvoicesCloud] Serving from offline cache (no user)');
      return cached;
    }
    return [];
  }

  if (invoicesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return invoicesCache;
  }

  try {
    const isCashier = await isCashierUser();

    let cloudInvoices = await fetchFromSupabase<CloudInvoice>('invoices', {
      column: 'created_at',
      ascending: false,
    });

    if (isCashier) {
      cloudInvoices = cloudInvoices.filter(inv => inv.cashier_id === userId);
    }

    const invoicesWithItems = await Promise.all(
      cloudInvoices.map(async (cloud) => {
        const invoice = toInvoice(cloud);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: items } = await (supabase as any)
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', cloud.id);

        const rawItems = (items || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          name: item.product_name as string,
          price: Number(item.unit_price) || 0,
          quantity: Number(item.quantity) || 1,
          total: Number(item.amount_original) || 0,
          costPrice: Number(item.cost_price) || 0,
        }));

        // ✅ Fix for old invoices: detect if item totals don't match invoice total
        // Old data may have cost_price stored in unit_price and cost-based amounts in amount_original
        if (rawItems.length > 0 && invoice.total > 0) {
          const itemsTotal = rawItems.reduce((sum: number, item: InvoiceItem) => sum + item.total, 0);

          // If items total doesn't match invoice total (with tolerance), recalculate
          if (Math.abs(itemsTotal - invoice.total) > 0.01 && itemsTotal > 0) {
            // The invoice.total is always correct - redistribute proportionally
            const ratio = invoice.total / itemsTotal;
            rawItems.forEach((item: InvoiceItem) => {
              item.total = Math.round(item.price * item.quantity * ratio * 100) / 100;
              item.price = Math.round(item.price * ratio * 100) / 100;
            });
          }
        }

        invoice.items = rawItems;

        return invoice;
      })
    );

    invoicesCache = invoicesWithItems;
    cacheTimestamp = Date.now();

    // Save to offline cache
    saveToOfflineCache('invoices', invoicesCache);

    return invoicesCache;
  } catch (error) {
    console.error('[InvoicesCloud] Failed to fetch:', error);
    // Fallback to offline cache
    const cached = loadFromOfflineCache<Invoice[]>('invoices');
    if (cached) {
      console.log('[InvoicesCloud] Serving from offline cache (fetch failed)');
      return cached;
    }
    if (invoicesCache) return invoicesCache;
    return [];
  }
};

export const invalidateInvoicesCache = () => {
  invoicesCache = null;
  cacheTimestamp = 0;
};

// Add invoice
export const addInvoiceCloud = async (
  invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Invoice | null> => {
  const invoiceNumber = await getNextInvoiceNumber();
  const now = new Date();

  // ✅ جلب معرف المستخدم من المتغير أو مباشرة من supabase
  let userId = getCurrentUserId();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
    console.log('[addInvoiceCloud] Fallback to supabase.auth.getUser:', userId);
  }

  // ✅ جلب اسم الكاشير/المستخدم الحالي
  let cashierName = '';
  if (userId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();
      cashierName = profile?.full_name || '';
    } catch (e) {
      console.warn('[addInvoiceCloud] Could not fetch cashier name:', e);
    }
  }

  const inserted = await insertToSupabase<CloudInvoice>('invoices', {
    invoice_number: invoiceNumber,
    invoice_type: invoice.type,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    customer_name: invoice.customerName,
    customer_phone: invoice.customerPhone || null,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    discount_percentage: invoice.discountPercentage || 0,
    tax_rate: invoice.taxRate || 0,
    tax_amount: invoice.taxAmount || 0,
    total: invoice.total,
    profit: invoice.profit || 0,
    currency: invoice.currency,
    exchange_rate: 1,
    payment_type: invoice.paymentType,
    status: invoice.status,
    debt_paid: invoice.debtPaid || 0,
    debt_remaining: invoice.debtRemaining || 0,
    notes: invoice.notes || invoice.serviceDescription || null,
    cashier_id: userId, // ✅ تسجيل معرف الكاشير
    cashier_name: cashierName || invoice.cashierName || null, // ✅ تسجيل اسم الكاشير
  });

  if (inserted) {
    // ✅ Batch insert - إدراج جميع العناصر دفعة واحدة لتسريع العملية
    if (invoice.items.length > 0) {
      const itemsToInsert = invoice.items.map(item => ({
        invoice_id: inserted.id,
        product_id: item.id || null,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        cost_price: item.costPrice || 0,
        amount_original: item.total,
        profit: item.profit || 0,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('invoice_items').insert(itemsToInsert);
    }

    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);

    return {
      ...invoice,
      id: invoiceNumber,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
      cashierId: userId || undefined,
      cashierName: cashierName || undefined,
    };
  }

  return null;
};

// Update invoice
export const updateInvoiceCloud = async (
  id: string,
  updates: Partial<Invoice>
): Promise<Invoice | null> => {
  // Find invoice by invoice_number
  const invoices = await loadInvoicesCloud();
  const invoice = invoices.find(inv => inv.id === id);
  if (!invoice) return null;

  // Get the actual UUID from cloud
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cloudInvoice } = await (supabase as any)
    .from('invoices')
    .select('id')
    .eq('invoice_number', id)
    .eq('user_id', getCurrentUserId())
    .maybeSingle();

  if (!cloudInvoice) return null;

  const cloudUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) cloudUpdates.status = updates.status;
  if (updates.paymentType !== undefined) cloudUpdates.payment_type = updates.paymentType;
  if (updates.debtPaid !== undefined) cloudUpdates.debt_paid = updates.debtPaid;
  if (updates.debtRemaining !== undefined) cloudUpdates.debt_remaining = updates.debtRemaining;

  const success = await updateInSupabase('invoices', cloudInvoice.id, cloudUpdates);

  if (success) {
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    return { ...invoice, ...updates, updatedAt: new Date().toISOString() };
  }

  return null;
};

// Delete invoice
export const deleteInvoiceCloud = async (id: string): Promise<boolean> => {
  // حفظ نسخة في سلة المحذوفات قبل الحذف
  try {
    const invoice = invoicesCache?.find(inv => inv.id === id);
    if (invoice) {
      const { addToTrash } = await import('../trash-store');
      addToTrash('invoice', `فاتورة ${id} - ${invoice.customerName}`, invoice as unknown as Record<string, unknown>);
    }
  } catch (e) {
    console.warn('[deleteInvoiceCloud] Failed to save to trash:', e);
  }

  // Find by invoice_number - also fetch total for reversal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cloudInvoice } = await (supabase as any)
    .from('invoices')
    .select('id, total, profit')
    .eq('invoice_number', id)
    .eq('user_id', getCurrentUserId())
    .maybeSingle();

  if (!cloudInvoice) return false;

  // ✅ 1. Restore Stock
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items } = await (supabase as any)
      .from('invoice_items')
      .select('product_id, quantity')
      .eq('invoice_id', cloudInvoice.id);

    if (items && items.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsToRestore = items
        .filter((item: any) => item.product_id)
        .map((item: any) => ({
          productId: item.product_id,
          quantity: Number(item.quantity) || 0
        }));

      if (itemsToRestore.length > 0) {
        const { restoreStockBatchCloud } = await import('./products-cloud');
        await restoreStockBatchCloud(itemsToRestore);
      }
    }
  } catch (err) {
    console.error('[deleteInvoiceCloud] Error restoring stock:', err);
  }

  // ✅ 2. Reverse cashbox balance (subtract invoice total from fund)
  try {
    const invoiceTotal = Number(cloudInvoice.total) || 0;
    if (invoiceTotal > 0) {
      const { updateCashboxBalance } = await import('../cashbox-store');
      updateCashboxBalance(invoiceTotal, 'withdrawal');
      console.log(`[deleteInvoiceCloud] ✅ Reversed cashbox: -$${invoiceTotal}`);
    }
  } catch (err) {
    console.error('[deleteInvoiceCloud] Error reversing cashbox:', err);
  }

  // ✅ 3. Remove gross profit record
  try {
    const { removeGrossProfit } = await import('../profits-store');
    removeGrossProfit(id);
    console.log(`[deleteInvoiceCloud] ✅ Removed gross profit record for ${id}`);
  } catch (err) {
    console.error('[deleteInvoiceCloud] Error removing profit record:', err);
  }

  // ✅ 4. Reverse partner profit distributions
  try {
    const { loadPartnersCloud, updatePartnerCloud } = await import('./partners-cloud');
    const partners = await loadPartnersCloud();

    for (const partner of partners) {
      // Find all profit records linked to this invoice
      const relatedProfits = partner.profitHistory.filter(
        (p: { invoiceId: string }) => p.invoiceId === id
      );

      if (relatedProfits.length > 0) {
        const totalToReverse = relatedProfits.reduce(
          (sum: number, p: { amount: number }) => sum + p.amount, 0
        );

        // Also check pending profits (for debt invoices)
        const relatedPending = (partner.pendingProfitDetails || []).filter(
          (p: { invoiceId: string }) => p.invoiceId === id
        );
        const pendingToReverse = relatedPending.reduce(
          (sum: number, p: { amount: number }) => sum + p.amount, 0
        );

        await updatePartnerCloud(partner.id, {
          confirmedProfit: partner.confirmedProfit - totalToReverse,
          currentBalance: partner.currentBalance - totalToReverse,
          totalProfitEarned: partner.totalProfitEarned - totalToReverse,
          pendingProfit: partner.pendingProfit - pendingToReverse,
          pendingProfitDetails: (partner.pendingProfitDetails || []).filter(
            (p: { invoiceId: string }) => p.invoiceId !== id
          ),
          profitHistory: partner.profitHistory.filter(
            (p: { invoiceId: string }) => p.invoiceId !== id
          ),
        });

        console.log(`[deleteInvoiceCloud] ✅ Reversed $${totalToReverse} profit from partner ${partner.name}`);
      }
    }
  } catch (err) {
    console.error('[deleteInvoiceCloud] Error reversing partner profits:', err);
  }

  // ✅ 5. Delete from database
  const success = await deleteFromSupabase('invoices', cloudInvoice.id);

  if (success) {
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
  }

  return success;
};

// Get invoice by ID
export const getInvoiceByIdCloud = async (id: string): Promise<Invoice | null> => {
  const invoices = await loadInvoicesCloud();
  return invoices.find(inv => inv.id === id) || null;
};

// Get invoice stats
export const getInvoiceStatsCloud = async () => {
  const invoices = await loadInvoicesCloud();
  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(inv =>
    new Date(inv.createdAt).toDateString() === today
  );

  return {
    total: invoices.length,
    todayCount: todayInvoices.length,
    todaySales: todayInvoices.reduce((sum, inv) => sum + inv.total, 0),
    totalSales: invoices.reduce((sum, inv) => sum + inv.total, 0),
    pendingDebts: invoices.filter(inv =>
      inv.paymentType === 'debt' && inv.status === 'pending'
    ).length,
    totalProfit: invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0),
  };
};

// Update invoice by invoice_number - للتحديث المباشر بدون تحميل كل الفواتير
export const updateInvoiceByNumberCloud = async (
  invoiceNumber: string,
  updates: Partial<Invoice>
): Promise<boolean> => {
  const userId = getCurrentUserId();
  if (!userId) return false;

  const cloudUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) cloudUpdates.status = updates.status;
  if (updates.paymentType !== undefined) cloudUpdates.payment_type = updates.paymentType;
  if (updates.debtPaid !== undefined) cloudUpdates.debt_paid = updates.debtPaid;
  if (updates.debtRemaining !== undefined) cloudUpdates.debt_remaining = updates.debtRemaining;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('invoices')
    .update(cloudUpdates)
    .eq('invoice_number', invoiceNumber)
    .eq('user_id', userId);

  if (!error) {
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    return true;
  }

  return false;
};
