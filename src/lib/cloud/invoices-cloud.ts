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
import type { SupabaseClient } from '@supabase/supabase-js';
type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;
import { emitEvent, EVENTS } from '../events';
import { triggerAutoBackup } from '../local-auto-backup';

export type InvoiceType = 'sale' | 'maintenance';
export type PaymentType = 'cash' | 'debt';
export type InvoiceStatus = 'paid' | 'pending' | 'cancelled' | 'refunded';

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

// Normalize customer name based on payment type
function normalizeCustomerName(name: string | null | undefined, paymentType: PaymentType): string {
  if (name && name.trim() && name.trim() !== 'عميل') return name.trim();
  return paymentType === 'debt' ? 'عميل دين' : 'عميل نقدي';
}

// Transform cloud to legacy
function toInvoice(cloud: CloudInvoice): Invoice {
  const subtotal = Number(cloud.subtotal) || 0;
  const rawDiscount = Number(cloud.discount) || 0;
  const discountPercentage = Number(cloud.discount_percentage) || 0;

  // Use stored discount amount directly — it was already rounded when persisted.
  // Only fall back to computing from percentage if the stored amount is missing/zero
  // while a percentage is present (legacy rows).
  const actualDiscount = rawDiscount > 0
    ? rawDiscount
    : (discountPercentage > 0 ? (subtotal * discountPercentage) / 100 : 0);

  return {
    id: cloud.invoice_number || cloud.id,
    type: (cloud.invoice_type as InvoiceType) || 'sale',
    customerName: normalizeCustomerName(cloud.customer_name, cloud.payment_type as PaymentType),
    customerPhone: cloud.customer_phone || undefined,
    items: [], // Items loaded separately
    subtotal,
    discount: actualDiscount,
    discountPercentage,
    taxRate: Number(cloud.tax_rate) || 0,
    taxAmount: Number(cloud.tax_amount) || 0,
    total: Number(cloud.total) || 0,
    totalInCurrency: Number(cloud.total) || 0,
    currency: cloud.currency || 'USD',
    currencySymbol: '$',
    paymentType: (cloud.payment_type as PaymentType) || 'cash',
    status: (cloud.status as InvoiceStatus) || 'paid',
    profit: Number(cloud.profit) || 0,
    debtPaid: Number(cloud.debt_paid) || 0,
    debtRemaining: Number(cloud.debt_remaining) || 0,
    serviceDescription: cloud.notes || undefined,
    partsCost: (cloud.invoice_type === 'maintenance') ? Math.max(0, (Number(cloud.total) || 0) - (Number(cloud.profit) || 0)) : undefined,
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

// Local storage key for offline fallback
const LOCAL_INVOICES_CACHE_KEY = 'hyperpos_invoices_cache';

// Save invoices to localStorage for offline access
const saveInvoicesToLocalCache = (invoices: Invoice[]) => {
  try {
    localStorage.setItem(LOCAL_INVOICES_CACHE_KEY, JSON.stringify({
      invoices,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('[InvoicesCloud] localStorage save failed:', e);
  }
};

// Load invoices from localStorage
const loadInvoicesFromLocalCache = (): Invoice[] | null => {
  try {
    const cached = localStorage.getItem(LOCAL_INVOICES_CACHE_KEY);
    if (cached) {
      const { invoices, timestamp } = JSON.parse(cached);
      // 24hr TTL
      if (Date.now() - timestamp < 86400000 && invoices?.length > 0) {
        console.log('[InvoicesCloud] 📴 Serving', invoices.length, 'invoices from local cache');
        return invoices;
      }
    }
  } catch (e) {
    console.warn('[InvoicesCloud] localStorage load failed:', e);
  }
  return null;
};

// Generate invoice number — uses central RPC for cross-device uniqueness, falls back to date-based scan
const getNextInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  // Try central sequence RPC first
  try {
    const { data, error } = await sb.rpc('get_next_invoice_number');
    if (!error && data != null) {
      const seq = Number(data);
      return `${datePrefix}-${String(seq).padStart(5, '0')}`;
    }
  } catch (e) {
    console.warn('[invoices-cloud] RPC sequence failed, falling back:', e);
  }

  // Fallback: scan today's invoices
  try {
    const { data } = await sb
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${datePrefix}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastNum = data[0].invoice_number;
      const parts = lastNum.split('-');
      if (parts.length >= 2) {
        nextNumber = (parseInt(parts[1], 10) || 0) + 1;
      }
    }
    return `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;
  } catch {
    const invoices = await loadInvoicesCloud();
    const todayInvoices = invoices.filter(inv => inv.id.startsWith(datePrefix));
    const nextNumber = todayInvoices.length + 1;
    return `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;
  }
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
    // Try local cache even without userId
    const localInvoices = loadInvoicesFromLocalCache();
    return localInvoices || [];
  }

  if (invoicesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return invoicesCache;
  }

  // Check if offline
  if (!navigator.onLine) {
    const localInvoices = loadInvoicesFromLocalCache();
    if (localInvoices) {
      invoicesCache = localInvoices;
      cacheTimestamp = Date.now();
      return localInvoices;
    }
    return invoicesCache || [];
  }

  try {
    // Check if user is cashier
    const isCashier = await isCashierUser();

    let cloudInvoices = await fetchFromSupabase<CloudInvoice>('invoices', {
      column: 'created_at',
      ascending: false,
    });

    // If cloud returned empty, check local cache
    if (cloudInvoices.length === 0) {
      const localInvoices = loadInvoicesFromLocalCache();
      if (localInvoices && localInvoices.length > 0) {
        console.log('[InvoicesCloud] ⚠️ Cloud returned empty, using local cache');
        invoicesCache = localInvoices;
        cacheTimestamp = Date.now();
        return localInvoices;
      }
    }

    // ✅ If cashier, filter to only show their own invoices
    if (isCashier) {
      cloudInvoices = cloudInvoices.filter(inv => inv.cashier_id === userId);
    }

    // Load invoice items for each invoice
    const invoicesWithItems = await Promise.all(
      cloudInvoices.map(async (cloud) => {
        const invoice = toInvoice(cloud);

        // Fetch items
        const { data: items } = await sb
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', cloud.id);

        invoice.items = (items || []).map((item: Record<string, unknown>) => ({
          id: (item.product_id as string) || (item.id as string),
          name: item.product_name as string,
          price: Number(item.unit_price) || 0,
          quantity: Number(item.quantity) || 1,
          total: Number(item.amount_original) || 0,
          costPrice: Number(item.cost_price) || 0,
          profit: Number(item.profit) || 0,
        }));

        return invoice;
      })
    );

    invoicesCache = invoicesWithItems;
    cacheTimestamp = Date.now();

    // Save to local cache for offline access
    if (invoicesCache.length > 0) {
      saveInvoicesToLocalCache(invoicesCache);
    }

    return invoicesCache;
  } catch (error) {
    console.error('[InvoicesCloud] Cloud fetch failed:', error);
    const localInvoices = loadInvoicesFromLocalCache();
    if (localInvoices) return localInvoices;
    return invoicesCache || [];
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
      const { data: profile } = await sb
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
    subtotal: Math.round((invoice.subtotal || 0) * 100) / 100,
    discount: Math.round((invoice.discount || 0) * 100) / 100,
    discount_percentage: invoice.discountPercentage || 0,
    tax_rate: invoice.taxRate || 0,
    tax_amount: Math.round((invoice.taxAmount || 0) * 100) / 100,
    total: Math.round((invoice.total || 0) * 100) / 100,
    profit: Math.round((invoice.profit || 0) * 100) / 100,
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
        unit_price: Math.round((item.price || 0) * 100) / 100,
        cost_price: Math.round((item.costPrice || 0) * 100) / 100,
        amount_original: Math.round((item.total || 0) * 100) / 100,
        profit: Math.round((item.profit || 0) * 100) / 100,
      }));

      await sb.from('invoice_items').insert(itemsToInsert);
    }

    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    triggerAutoBackup(`فاتورة جديدة #${invoiceNumber}`);

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
  if (updates.status === 'refunded') {
    console.warn('[updateInvoiceCloud] Refunded status is protected; use refundInvoiceCloud');
    return null;
  }
  // Find invoice by invoice_number
  const invoices = await loadInvoicesCloud();
  const invoice = invoices.find(inv => inv.id === id);
  if (!invoice) return null;

  // Get the actual UUID from cloud
  const { data: cloudInvoice } = await sb
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
  // Find by invoice_number
  const { data: cloudInvoice } = await sb
    .from('invoices')
    .select('id')
    .eq('invoice_number', id)
    .eq('user_id', getCurrentUserId())
    .maybeSingle();

  if (!cloudInvoice) return false;

  const success = await deleteFromSupabase('invoices', cloudInvoice.id);

  if (success) {
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
  }

  return success;
};

export interface RefundResult {
  success: boolean;
  alreadyRefunded?: boolean;
  restoredItemsCount: number;
  restoredUnitsCount: number;
  deletedDebtAmount: number;
  customerBalanceBefore: number;
  customerBalanceAfter: number;
  customerName: string | null;
  invoiceTotal: number;
  invoiceCurrency: string | null;
}

// ✅ In-flight mutex: blocks concurrent refund calls for the same invoice
// (protects against double-click race even before the network round-trip)
const refundInFlight = new Set<string>();

// Refund invoice - marks as refunded, restores stock, settles debts, reverses customer stats
export const refundInvoiceCloud = async (id: string, source: 'online' | 'offline-sync' = 'online'): Promise<RefundResult | boolean> => {
  // ✅ Client-side mutex - reject duplicate concurrent calls immediately
  if (refundInFlight.has(id)) {
    console.warn('[refundInvoiceCloud] Refund already in-flight for:', id);
    return false;
  }
  refundInFlight.add(id);
  try {
    return await refundInvoiceCloudImpl(id, source);
  } finally {
    refundInFlight.delete(id);
  }
};

const refundInvoiceCloudImpl = async (id: string, source: 'online' | 'offline-sync'): Promise<RefundResult | boolean> => {
  // ✅ Reliable userId: always fallback to supabase.auth.getUser()
  let userId = getCurrentUserId();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
    if (userId) setCurrentUserId(userId);
  }
  if (!userId) return false;

  // Stock, debt, customer totals, and invoice status are committed in one locked
  // database transaction. Only the first caller can receive success=true.
  const { data, error } = await supabase.rpc('refund_invoice_atomic', { _invoice_number: id, _source: source });
  if (error) {
    console.error('[refundInvoiceCloud] Atomic refund failed:', error.code);
    return false;
  }

  const atomic = data?.[0];
  if (!atomic) return false;

  if (atomic.already_refunded) {
    return {
      success: false,
      alreadyRefunded: true,
      restoredItemsCount: 0,
      restoredUnitsCount: 0,
      deletedDebtAmount: 0,
      customerBalanceBefore: 0,
      customerBalanceAfter: 0,
      customerName: atomic.customer_name,
      invoiceTotal: Number(atomic.invoice_total) || 0,
      invoiceCurrency: atomic.invoice_currency,
    };
  }

  if (!atomic.success) return false;

  // Secondary accounting cleanup is idempotent and only runs for the caller that
  // won the atomic refund transaction. It cannot restore stock again.
  try {
    const { revertProfitDistributionCloud } = await import('./partners-cloud');
    await revertProfitDistributionCloud(id);
    // Reverse central profit_records
    try {
      const { reverseProfitCloud } = await import('./profits-cloud');
      await reverseProfitCloud(id);
    } catch { /* noop */ }
    // Also revert local for backwards compatibility
    try {
      const { revertProfitDistribution } = await import('../partners-store');
      revertProfitDistribution(id);
    } catch { /* local may not exist */ }
  } catch (err) {
    console.error('[refundInvoiceCloud] Error reverting profit:', err);
  }

  invalidateInvoicesCache();
  const { invalidateDebtsCache } = await import('./debts-cloud');
  invalidateDebtsCache();
  const { invalidateCustomersCache } = await import('./customers-cloud');
  invalidateCustomersCache();
  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.DEBTS_UPDATED, null);
  emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
  return {
    success: true,
    restoredItemsCount: Number(atomic.restored_item_count) || 0,
    restoredUnitsCount: Number(atomic.restored_unit_count) || 0,
    deletedDebtAmount: Number(atomic.deleted_debt_amount) || 0,
    customerBalanceBefore: 0,
    customerBalanceAfter: 0,
    customerName: atomic.customer_name,
    invoiceTotal: Number(atomic.invoice_total) || 0,
    invoiceCurrency: atomic.invoice_currency,
  };
};

// Get invoice by ID
export const getInvoiceByIdCloud = async (id: string): Promise<Invoice | null> => {
  const invoices = await loadInvoicesCloud();
  return invoices.find(inv => inv.id === id) || null;
};

// Get invoice stats
export const getInvoiceStatsCloud = async () => {
  const invoices = await loadInvoicesCloud();
  // ✅ Exclude refunded invoices from stats
  const activeInvoices = invoices.filter(inv => inv.status !== 'refunded');
  const today = new Date().toDateString();
  const todayInvoices = activeInvoices.filter(inv =>
    new Date(inv.createdAt).toDateString() === today
  );

  return {
    total: activeInvoices.length,
    todayCount: todayInvoices.length,
    todaySales: todayInvoices.reduce((sum, inv) => sum + inv.total, 0),
    totalSales: activeInvoices.reduce((sum, inv) => sum + inv.total, 0),
    pendingDebts: activeInvoices.filter(inv =>
      inv.paymentType === 'debt' && inv.status === 'pending'
    ).length,
    totalProfit: activeInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0),
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

  const { error } = await sb
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
