import { getPendingOperations, addToQueue } from '../sync-queue';
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
import { roundCurrency, addCurrency, subtractCurrency } from '../utils';
import { triggerAutoBackup } from '../local-auto-backup';
import { logActivity, diffFields } from '../activity-log';

export type InvoiceType = 'sale' | 'maintenance';
export type PaymentType = 'cash' | 'debt';
export type InvoiceStatus = 'paid' | 'pending' | 'cancelled' | 'refunded';

export interface InvoiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  productId?: string;
  costPrice?: number; // ✅ سعر التكلفة لحظة البيع
  profit?: number;    // ✅ الربح لكل عنصر
  refunded?: boolean; // ✅ بند مُسترد بالكامل (كمية 0 بعد استرداد جزئي)
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
  currency_symbol?: string | null;
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
  pending_sync?: boolean;
  sync_failed?: boolean;
  warehouseId?: string;
  dueDate?: string;
  id: string;
  type: InvoiceType;
  customerId?: string;
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
  subtotalInCurrency?: number;
  debtRemainingInCurrency?: number;
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
  exchangeRate?: number;
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

  const rawCurrency = (cloud.currency || 'USD').toUpperCase();
  const persistedSymbols = (() => {
    try {
      const s = localStorage.getItem('hyperpos_settings_v1');
      if (s) {
        const parsed = JSON.parse(s);
        return parsed.currencySymbols as Record<string, string> | undefined;
      }
    } catch {}
    return undefined;
  })();

  const currencySymbol = (cloud as any).currency_symbol ||
    persistedSymbols?.[rawCurrency] ||
    (rawCurrency === 'TRY' ? (persistedSymbols?.TRY || '₺') :
      rawCurrency === 'SYP' ? (persistedSymbols?.SYP || 'ل.س') :
      rawCurrency === 'USD' ? (persistedSymbols?.USD || '$') :
      rawCurrency === 'JOD' ? 'د.أ' :
      rawCurrency === 'SAR' ? 'ر.س' :
      rawCurrency === 'KWD' ? 'د.ك' :
      rawCurrency === 'AED' ? 'د.إ' :
      rawCurrency === 'LBP' ? 'ل.ل' :
      rawCurrency === 'EUR' ? '€' :
      (rawCurrency !== 'USD' ? rawCurrency : (persistedSymbols?.USD || '$')));

  const exchangeRate = Number(cloud.exchange_rate) || 1;
  const isForeign = rawCurrency !== 'USD' && exchangeRate > 0;
  
  const total = Number(cloud.total) || 0;
  const totalInCurrency = isForeign ? roundCurrency(total * exchangeRate) : total;
  const subtotalInCurrency = isForeign ? roundCurrency(subtotal * exchangeRate) : subtotal;
  const debtRemaining = Number(cloud.debt_remaining) || 0;
  const debtRemainingInCurrency = isForeign ? roundCurrency(debtRemaining * exchangeRate) : debtRemaining;

  return {
    id: cloud.invoice_number || cloud.id,
    type: (cloud.invoice_type as InvoiceType) || 'sale',
    customerId: cloud.customer_id || undefined,
    customerName: normalizeCustomerName(cloud.customer_name, cloud.payment_type as PaymentType),
    customerPhone: cloud.customer_phone || undefined,
    items: [], // Items loaded separately
    subtotal,
    subtotalInCurrency,
    discount: actualDiscount,
    discountPercentage,
    taxRate: Number(cloud.tax_rate) || 0,
    taxAmount: Number(cloud.tax_amount) || 0,
    total,
    totalInCurrency,
    currency: rawCurrency,
    currencySymbol,
    paymentType: (cloud.payment_type as PaymentType) || 'cash',
    status: (cloud.status as InvoiceStatus) || 'paid',
    profit: Number(cloud.profit) || 0,
    debtPaid: Number(cloud.debt_paid) || 0,
    debtRemaining,
    debtRemainingInCurrency,
    serviceDescription: cloud.notes || undefined,
    partsCost: (cloud.invoice_type === 'maintenance') ? Math.max(0, (Number(cloud.total) || 0) - (Number(cloud.profit) || 0)) : undefined,
    createdAt: cloud.created_at,
    updatedAt: cloud.updated_at,
    cashierId: cloud.cashier_id || undefined,
    cashierName: cloud.cashier_name || undefined,
    exchangeRate,
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
      const parsed = JSON.parse(cached);
      const invoices = Array.isArray(parsed) ? parsed : parsed?.invoices;
      if (Array.isArray(invoices) && invoices.length > 0) {
        console.log('[InvoicesCloud] 📴 Serving', invoices.length, 'invoices from local cache');
        return invoices;
      }
    }
  } catch (e) {
    console.warn('[InvoicesCloud] localStorage load failed:', e);
  }
  return null;
};

/**
 * تسجيل فاتورة بيع منفذة محلياً فوراً في كاش الفواتير وذاكرة الجهاز وإطلاق حدث التحديث
 * يضمن ظهور الفاتورة للمستخدم في شاشة الفواتير بسرعة 0ms حتى في حالة عدم توفر الإنترنت
 */
export const recordOfflineInvoiceLocal = (offlineInvoice: Invoice) => {
  try {
    const currentList = invoicesCache || loadInvoicesFromLocalCache() || [];
    invoicesCache = [offlineInvoice, ...currentList.filter(i => i.id !== offlineInvoice.id)];
    cacheTimestamp = Date.now();
    saveInvoicesToLocalCache(invoicesCache);
    emitEvent(EVENTS.INVOICES_UPDATED, invoicesCache);
  } catch (err) {
    console.warn('[InvoicesCloud] recordOfflineInvoiceLocal failed:', err);
  }
};

// Generate invoice number — uses central RPC for cross-device uniqueness, falls back to date-based scan
const getNextInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  // If offline, generate sequentially from local cache immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const local = loadInvoicesFromLocalCache() || [];
    const todayInvoices = local.filter(inv => inv.id && inv.id.startsWith(datePrefix));
    const nextNumber = todayInvoices.length + 1;
    return `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;
  }

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
    const invoices = loadInvoicesFromLocalCache() || [];
    const todayInvoices = invoices.filter(inv => inv.id && inv.id.startsWith(datePrefix));
    const nextNumber = todayInvoices.length + 1;
    return `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;
  }
};

let coldStartServed = false;

// Load invoices
// ✅ Owners see all invoices, cashiers see only their own
export const loadInvoicesCloud = async (): Promise<Invoice[]> => {
  // 1. Instant offline fast-path: zero network delay, instant local cache + queue
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const localInvoices = loadInvoicesFromLocalCache();
    if (localInvoices && localInvoices.length > 0) {
      invoicesCache = localInvoices;
      cacheTimestamp = Date.now();
      return mergeSyncQueueInvoices(localInvoices);
    }
    return mergeSyncQueueInvoices(invoicesCache || []);
  }

  // 2. Safe userId retrieval using local session (no blocking network request)
  let userId = getCurrentUserId();
  if (!userId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        userId = session.user.id;
        setCurrentUserId(session.user.id);
      }
    } catch { /* ignore */ }
  }

  if (!userId) {
    // Return local cache even without userId
    const localInvoices = loadInvoicesFromLocalCache();
    return mergeSyncQueueInvoices(localInvoices || invoicesCache || []);
  }

  if (invoicesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return mergeSyncQueueInvoices(invoicesCache);
  }

  // 3. Instant open: on first load after app start, serve local copy immediately
  // and refresh from server in background without blocking rendering.
  const localInvoices = loadInvoicesFromLocalCache();
  if (!coldStartServed && localInvoices && localInvoices.length > 0) {
    coldStartServed = true;
    invoicesCache = mergeSyncQueueInvoices(localInvoices);
    cacheTimestamp = Date.now();
    void fetchInvoicesFromCloud(userId).then((fresh) => {
      emitEvent(EVENTS.INVOICES_UPDATED, fresh);
    }).catch(() => { /* keep saved copy */ });
    return invoicesCache;
  }
  coldStartServed = true;

  try {
    const cloudInvoices = await fetchInvoicesFromCloud(userId);
    return mergeSyncQueueInvoices(cloudInvoices);
  } catch (err) {
    console.warn('[InvoicesCloud] Cloud fetch failed, serving local cache:', err);
    if (localInvoices) return mergeSyncQueueInvoices(localInvoices);
    return mergeSyncQueueInvoices(invoicesCache || []);
  }
};

const fetchInvoicesFromCloud = async (userId: string): Promise<Invoice[]> => {
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
        invoicesCache = mergeSyncQueueInvoices(localInvoices);
        cacheTimestamp = Date.now();
        return invoicesCache;
      }
    }

    // ✅ If cashier, filter to only show their own invoices
    if (isCashier) {
      cloudInvoices = cloudInvoices.filter(inv => inv.cashier_id === userId);
    }

    // Load invoice items in batches (avoids one request per invoice / N+1)
    const itemsByInvoice = new Map<string, Record<string, unknown>[]>();
    const ids = cloudInvoices.map(c => c.id);
    const BATCH = 150;
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
    const batchResults = await Promise.all(batches.map(async (batch) => {
      const { data, error } = await sb.from('invoice_items').select('*').in('invoice_id', batch);
      if (error) throw error;
      return (data || []) as Record<string, unknown>[];
    }));
    for (const rows of batchResults) {
      for (const row of rows) {
        const key = row.invoice_id as string;
        const list = itemsByInvoice.get(key);
        if (list) list.push(row); else itemsByInvoice.set(key, [row]);
      }
    }

    const invoicesWithItems = await Promise.all(
      cloudInvoices.map(async (cloud) => {
        const invoice = toInvoice(cloud);
        const items = itemsByInvoice.get(cloud.id) || [];

        invoice.items = items.map((item: Record<string, unknown>) => {
          const rawQty = item.quantity == null ? 1 : Number(item.quantity);
          const qty = Number.isFinite(rawQty) ? rawQty : 1;
          return {
            id: (item.product_id as string) || (item.id as string),
            name: item.product_name as string,
            price: Number(item.unit_price) || 0,
            quantity: qty,
            total: Number(item.amount_original) || 0,
            costPrice: Number(item.cost_price) || 0,
            profit: Number(item.profit) || 0,
            refunded: qty <= 0,
          };
        });

        return invoice;
      })
    );

    // دمج العمليات المعلقة في طابور المزامنة لمنع اختفاء الفواتير غير المرفوعة
    const mergedWithQueue = mergeSyncQueueInvoices(invoicesWithItems);
    invoicesCache = mergedWithQueue;
    cacheTimestamp = Date.now();

    // Save to local cache for offline access
    if (invoicesCache.length > 0) {
      saveInvoicesToLocalCache(invoicesCache);
    }

    return invoicesCache;
  } catch (error) {
    console.error('[InvoicesCloud] Cloud fetch failed:', error);
    const localInvoices = loadInvoicesFromLocalCache();
    if (localInvoices) return mergeSyncQueueInvoices(localInvoices);
    return mergeSyncQueueInvoices(invoicesCache || []);
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

  // ✅ جلب معرف المستخدم بأمان دون تعليق الشبكة
  let userId = getCurrentUserId();
  if (!userId && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id || null;
    } catch { /* ignore */ }
  }

  // ✅ جلب اسم الكاشير/المستخدم الحالي
  let cashierName = invoice.cashierName || '';
  if (userId && !cashierName && typeof navigator !== 'undefined' && navigator.onLine) {
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

  // فرع أوفلاين فوري إذا كان الإنترنت مقطوعاً
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineInvoice: Invoice = {
      ...invoice,
      id: invoiceNumber,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      cashierId: userId || undefined,
      cashierName: cashierName || undefined,
      pending_sync: true,
    };
    addToQueue('invoice_create', {
      operationId: invoiceNumber,
      bundle: {
        customerName: invoice.customerName,
        items: invoice.items,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        discountPercentage: invoice.discountPercentage,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        totalInCurrency: invoice.totalInCurrency,
        currency: invoice.currency,
        currencySymbol: invoice.currencySymbol,
        exchangeRate: (invoice as any).exchangeRate || 1,
        profit: invoice.profit,
        notes: invoice.notes || invoice.serviceDescription,
        cashierId: userId,
        cashierName: cashierName || undefined,
        paymentType: invoice.paymentType,
      }
    }, 10);
    const currentList = invoicesCache || loadInvoicesFromLocalCache() || [];
    invoicesCache = [offlineInvoice, ...currentList.filter(i => i.id !== offlineInvoice.id)];
    cacheTimestamp = Date.now();
    saveInvoicesToLocalCache(invoicesCache);
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    triggerAutoBackup(`فاتورة جديدة #${invoiceNumber}`);
    return offlineInvoice;
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
    currency_symbol: invoice.currencySymbol || null,
    exchange_rate: Number((invoice as any).exchangeRate) || 1,
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

  // Fallback: If cloud insert failed, keep locally and queue for retry
  const offlineInvoice: Invoice = {
    ...invoice,
    id: invoiceNumber,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    cashierId: userId || undefined,
    cashierName: cashierName || undefined,
    pending_sync: true,
  };
  addToQueue('invoice_create', {
    operationId: invoiceNumber,
    bundle: {
      customerName: invoice.customerName,
      items: invoice.items,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      discountPercentage: invoice.discountPercentage,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      totalInCurrency: invoice.totalInCurrency,
      currency: invoice.currency,
      currencySymbol: invoice.currencySymbol,
      exchangeRate: (invoice as any).exchangeRate || 1,
      profit: invoice.profit,
      notes: invoice.notes || invoice.serviceDescription,
      cashierId: userId,
      paymentType: invoice.paymentType,
    }
  }, 10);
  const currentList = invoicesCache || loadInvoicesFromLocalCache() || [];
  invoicesCache = [offlineInvoice, ...currentList.filter(i => i.id !== offlineInvoice.id)];
  cacheTimestamp = Date.now();
  saveInvoicesToLocalCache(invoicesCache);
  emitEvent(EVENTS.INVOICES_UPDATED, null);
  return offlineInvoice;
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
    const diff = diffFields(
      invoice,
      { ...invoice, ...updates },
      ['status', 'paymentType', 'debtPaid', 'debtRemaining']
    );
    if (Object.keys(diff).length > 0) {
      void logActivity('invoice_updated', `تعديل فاتورة: ${invoice.id} - ${invoice.customerName}`, {
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.customerName,
        changes: diff,
      });
    }
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    return { ...invoice, ...updates, updatedAt: new Date().toISOString() };
  }

  return null;
};

// Delete invoice
const buildInvoiceSnapshot = (invoice: Invoice) => ({
  invoiceNumber: invoice.id,
  customerName: invoice.customerName,
  customerPhone: invoice.customerPhone || '',
  paymentType: invoice.paymentType,
  subtotal: invoice.subtotal,
  discount: invoice.discount,
  total: invoice.total,
  cashierName: invoice.cashierName || '',
  createdAt: invoice.createdAt,
  items: invoice.items.map(it => ({
    name: it.name,
    quantity: it.quantity,
    price: it.price,
    costPrice: it.costPrice ?? 0,
    total: it.total,
  })),
});

const logInvoiceDeleted = (invoice: Invoice) => {
  logActivity('invoice_deleted', `حذف فاتورة: ${invoice.id} بقيمة $${roundCurrency(invoice.total)}`, {
    entityType: 'invoice',
    entityId: invoice.id,
    entityName: invoice.customerName,
    snapshot: buildInvoiceSnapshot(invoice),
  }).catch(() => undefined);
};

const findLoadedInvoice = async (id: string): Promise<Invoice | null> =>
  (await loadInvoicesCloud()).find(inv => inv.id === id) || null;

const refreshCustomerStatsAfterDelete = async (customerId: string | null) => {
  if (!customerId) return;
  try {
    const { updateCustomerStatsCloud } = await import('./customers-cloud');
    await updateCustomerStatsCloud(customerId);
  } catch (e) {
    console.warn('[deleteInvoiceCloud] failed to refresh customer stats:', e);
  }
};

export const deleteInvoiceCloud = async (id: string): Promise<boolean> => {
  // Find by invoice_number
  const { data: cloudInvoice } = await sb
    .from('invoices')
    .select('id, customer_id')
    .eq('invoice_number', id)
    .eq('user_id', getCurrentUserId())
    .maybeSingle();

  if (!cloudInvoice) return false;

  const invoiceBeforeDelete = await findLoadedInvoice(id);
  const success = await deleteFromSupabase('invoices', cloudInvoice.id);

  if (success) {
    if (invoiceBeforeDelete) logInvoiceDeleted(invoiceBeforeDelete);
    invalidateInvoicesCache();
    emitEvent(EVENTS.INVOICES_UPDATED, null);
    // ✅ إعادة احتساب أرقام العميل بدون هذه الفاتورة
    await refreshCustomerStatsAfterDelete(cloudInvoice.customer_id);
  }

  return success;
};

export interface RefundResult {
  success: boolean;
  alreadyRefunded?: boolean;
  error?: string;
  restoredItemsCount: number;
  restoredUnitsCount: number;
  deletedDebtAmount: number;
  customerBalanceBefore: number;
  customerBalanceAfter: number;
  customerName: string | null;
  invoiceTotal: number;
  invoiceCurrency: string | null;
  debtPaidAmount?: number;
  cashToRefund?: number;
}

const failedRefund = (error: string): RefundResult => ({
  success: false,
  error,
  restoredItemsCount: 0,
  restoredUnitsCount: 0,
  deletedDebtAmount: 0,
  customerBalanceBefore: 0,
  customerBalanceAfter: 0,
  customerName: null,
  invoiceTotal: 0,
  invoiceCurrency: null,
  debtPaidAmount: 0,
  cashToRefund: 0,
});


// ✅ In-flight mutex: blocks concurrent refund calls for the same invoice
// (protects against double-click race even before the network round-trip)
const refundInFlight = new Set<string>();

// Refund invoice - marks as refunded, restores stock, settles debts, reverses customer stats
export const refundInvoiceCloud = async (id: string, source: 'online' | 'offline-sync' = 'online'): Promise<RefundResult | boolean> => {
  // ✅ Client-side mutex - reject duplicate concurrent calls immediately
  if (refundInFlight.has(id)) {
    console.warn('[refundInvoiceCloud] Refund already in-flight for:', id);
    return failedRefund('عملية استرداد لهذه الفاتورة قيد التنفيذ بالفعل');
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
  if (!userId) return failedRefund('تعذّر تحديد المستخدم الحالي');

  // جلب الفاتورة الحالية لمعرفة طريقة السداد والدفعات السابقة
  const existingInvoices = await loadInvoicesCloud();
  const targetInvoice = existingInvoices.find(inv => inv.id === id);
  const targetDebtPaid = targetInvoice ? (Number(targetInvoice.debtPaid) || 0) : 0;
  const isTargetCash = targetInvoice ? targetInvoice.paymentType === 'cash' : false;
  const isTargetDebt = targetInvoice ? targetInvoice.paymentType === 'debt' : false;

  // Stock, debt, customer totals, and invoice status are committed in one locked
  // database transaction. Only the first caller can receive success=true.
  const { data, error } = await supabase.rpc('refund_invoice_atomic', { _invoice_number: id, _source: source });
  if (error) {
    console.error('[refundInvoiceCloud] Atomic refund failed:', error);
    return failedRefund(error.message || 'فشل تنفيذ الاسترداد على الخادم');
  }

  const atomic = data?.[0];
  if (!atomic) return failedRefund('لم يرد الخادم بأي نتيجة للاسترداد');


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
      debtPaidAmount: 0,
      cashToRefund: 0,
    };
  }

  // تحديث فوري لكميات المنتجات في الكاش المحلي (ذاكرة و IndexedDB ومستودع)
  try {
    const { data: invItems } = await sb
      .from('invoice_items')
      .select('product_id, quantity, unit, conversion_factor')
      .eq('invoice_id', atomic.invoice_id || id);
    if (invItems && invItems.length > 0) {
      const validItems = invItems.filter(it => it.product_id).map(it => {
        const qty = Number(it.quantity) || 0;
        const conv = Number(it.conversion_factor) || 1;
        const isBulk = it.unit === 'bulk';
        const finalQty = isBulk ? qty * conv : qty;
        return {
          productId: it.product_id,
          quantity: finalQty,
          deltaQuantity: finalQty
        };
      });

      const { updateProductsQuantitiesInCache } = await import('./products-cloud');
      updateProductsQuantitiesInCache(validItems);

      // ✅ إعادة الكميات للمستودع المحدد في الفاتورة
      if (targetInvoice?.warehouseId) {
        try {
          const { adjustWarehouseStockLocalCache } = await import('./warehouses-cloud');
          adjustWarehouseStockLocalCache(targetInvoice.warehouseId, validItems, 'restore');
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    console.warn('[refundInvoiceCloud] Error updating cache for refunded items:', err);
  }

  if (!atomic.success) return failedRefund('تعذّر إتمام الاسترداد — لم يتم العثور على الفاتورة أو رفض الخادم العملية');

  // حساب النقدية الواجب إرجاعها (كاش كامل أو دفعة دين سابقة)
  const cashToRefund = isTargetCash
    ? (Number(atomic.invoice_total) || Number(targetInvoice?.total) || 0)
    : (isTargetDebt ? targetDebtPaid : 0);

  // ✅ الخصم الفوري من الوردية النشطة وصندوق النقدية لمنع العجز الوهمي في درج الكاشير
  if (cashToRefund > 0) {
    try {
      const { recordRefundInShift } = await import('../cashbox-store');
      recordRefundInShift(
        cashToRefund,
        Number(targetInvoice?.profit) || 0,
        Math.max(0, (Number(targetInvoice?.total) || 0) - (Number(targetInvoice?.profit) || 0)),
        id
      );
    } catch (shiftErr) {
      console.warn('[refundInvoiceCloud] Failed to record refund in shift:', shiftErr);
    }
  }

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
  const { invalidateProductsCache, refreshProductsFromCloud } = await import('./products-cloud');
  invalidateProductsCache();
  refreshProductsFromCloud().catch(() => {});
  const { invalidateDebtsCache } = await import('./debts-cloud');
  invalidateDebtsCache();
  const { invalidateCustomersCache } = await import('./customers-cloud');
  invalidateCustomersCache();
  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.DEBTS_UPDATED, null);
  emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
  emitEvent(EVENTS.PRODUCTS_UPDATED, null);

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
    debtPaidAmount: targetDebtPaid,
    cashToRefund: cashToRefund,
  };
};

export interface PartialRefundItem {
  productId?: string;
  productName: string;
  quantityToRefund?: number;
  quantity?: number;
  unitPrice: number;
  costPrice?: number;
  profit?: number;
  warehouseId?: string;
}

export interface PartialRefundResult {
  success: boolean;
  error?: string;
  refundedAmount: number;
  cashToRefund: number;
  debtReduced: number;
  restoredItemsCount: number;
  restoredUnitsCount: number;
  isFullyRefunded: boolean;
  newInvoiceTotal: number;
}

/**
 * ✅ استرداد جزئي لأصناف محددة من الفاتورة
 * يعيد كميات الأصناف المحددة فقط للمخزون، ويعدل إجمالي الفاتورة، وأرباحها، والدين أو النقدية
 */
export const refundInvoicePartialCloud = async (
  invoiceNumber: string,
  itemsToRefund: PartialRefundItem[],
  operationId?: string
): Promise<PartialRefundResult> => {
  const fail = (error: string): PartialRefundResult => ({ success: false, error, refundedAmount: 0, cashToRefund: 0, debtReduced: 0, restoredItemsCount: 0, restoredUnitsCount: 0, isFullyRefunded: false, newInvoiceTotal: 0 });

  const items = itemsToRefund
    .map(item => ({
      product_id: item.productId || null,
      product_name: item.productName,
      quantity: Math.round((Number(item.quantityToRefund ?? item.quantity) || 0) * 1000) / 1000,
    }))
    .filter(item => item.quantity > 0);
  if (items.length === 0) return fail('يرجى تحديد كمية للإرجاع أكبر من الصفر');

  const opId = operationId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const { data, error } = await sb.rpc('refund_invoice_partial_atomic', {
    _invoice_number: invoiceNumber,
    _items: items,
    _operation_id: opId,
  });
  if (error) return fail(error.message || 'فشل الاسترداد الجزئي');

  const r = (data || {}) as Record<string, unknown>;
  const refundedAmount = Number(r.refunded_amount) || 0;
  const cashToRefund = Number(r.cash_to_refund) || 0;
  const debtReduced = Number(r.debt_reduced) || 0;
  const refundedProfit = Number(r.refunded_profit) || 0;
  const refundedCogs = Number(r.refunded_cogs) || 0;
  const alreadyProcessed = r.already_processed === true;

  // خصم النقدية من الوردية النشطة (مرة واحدة فقط)
  if (!alreadyProcessed && cashToRefund > 0) {
    try {
      const { recordRefundInShift } = await import('../cashbox-store');
      recordRefundInShift(cashToRefund, refundedProfit, refundedCogs, invoiceNumber);
    } catch (e) {
      console.warn('[refundInvoicePartialCloud] Failed to record refund in shift:', e);
    }
  }

  invalidateInvoicesCache();
  const { invalidateProductsCache, refreshProductsFromCloud } = await import('./products-cloud');
  invalidateProductsCache();
  refreshProductsFromCloud().catch(() => {});
  const { invalidateDebtsCache } = await import('./debts-cloud');
  invalidateDebtsCache();
  const { invalidateCustomersCache } = await import('./customers-cloud');
  invalidateCustomersCache();

  // تحديث كميات المنتجات فوراً في الكاش المحلي (ذاكرة و IndexedDB)
  const itemsWithProduct = itemsToRefund.filter(it => it.productId);
  if (itemsWithProduct.length > 0) {
    try {
      const { updateProductsQuantitiesInCache } = await import('./products-cloud');
      updateProductsQuantitiesInCache(
        itemsWithProduct.map(it => ({
          productId: it.productId!,
          deltaQuantity: Number(it.quantityToRefund ?? it.quantity) || 0
        }))
      );

      // ✅ إعادة الكميات للمستودع المحدد
      const warehouseId = itemsToRefund.find(it => it.warehouseId)?.warehouseId;
      if (warehouseId) {
        try {
          const { adjustWarehouseStockLocalCache } = await import('./warehouses-cloud');
          adjustWarehouseStockLocalCache(
            warehouseId,
            itemsWithProduct.map(it => ({
              productId: it.productId!,
              quantity: Number(it.quantityToRefund ?? it.quantity) || 0
            })),
            'restore'
          );
        } catch { /* ignore */ }
      }
    } catch { /* silent */ }
  }

  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  emitEvent(EVENTS.DEBTS_UPDATED, null);
  emitEvent(EVENTS.CUSTOMERS_UPDATED, null);

  return {
    success: true,
    refundedAmount,
    cashToRefund,
    debtReduced,
    restoredItemsCount: Number(r.restored_items) || 0,
    restoredUnitsCount: Number(r.restored_units) || 0,
    isFullyRefunded: r.is_full_refund === true || r.is_fully_refunded === true,
    newInvoiceTotal: Number(r.new_total) || 0,
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

function mergeSyncQueueInvoices(invoices: Invoice[]): Invoice[] {
  try {
    const pending = getPendingOperations();
    const persistedSymbols = (() => {
      try {
        const s = localStorage.getItem('hyperpos_settings_v1');
        if (s) {
          const parsed = JSON.parse(s);
          return parsed.currencySymbols as Record<string, string> | undefined;
        }
      } catch {}
      return undefined;
    })();
    const queueInvoices: Invoice[] = [];
    for (const op of pending) {
      if (op.type === 'invoice_create' || op.type === 'debt_sale_bundle') {
        const data = op.data as Record<string, any>;
        const bundle = (data?.bundle || {}) as Record<string, any>;
        const isFailed = op.status === 'failed';
        const rawCurr = (bundle.currency || 'USD').toUpperCase();
        const sym = (bundle.currencySymbol && bundle.currencySymbol !== '$')
          ? bundle.currencySymbol
          : (rawCurr === 'USD' ? (persistedSymbols?.USD || '$') : (persistedSymbols?.[rawCurr] || (rawCurr === 'TRY' ? '₺' : rawCurr === 'SYP' ? 'ل.س' : rawCurr)));

        const items = (bundle.items || []).map((it: any) => ({
          id: it.id,
          name: it.name,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          total: Number(it.total) || (Number(it.price) || 0) * (Number(it.quantity) || 1),
          costPrice: Number(it.costPrice) || 0,
          profit: typeof it.profit === 'number' ? it.profit : ((Number(it.price) || 0) - (Number(it.costPrice) || 0)) * (Number(it.quantity) || 1),
          category: it.category || 'عام',
        }));

        const discount = Number(bundle.discount) || 0;
        const totalDiscountedProfit = items.reduce((sum: number, it: any) => sum + (it.profit || 0), 0) - discount;
        const computedProfit = typeof bundle.profit === 'number' ? bundle.profit : totalDiscountedProfit;
        const computedPartsCost = typeof bundle.cogs === 'number'
          ? bundle.cogs
          : items.reduce((sum: number, it: any) => sum + ((it.costPrice || 0) * (it.quantity || 1)), 0);

        const invId = bundle.invoiceNumber || data?.invoiceNumber || data?.operationId || data?.localId || op.id;

        queueInvoices.push({
          id: invId,
          type: (bundle.type as InvoiceType) || 'sale',
          customerName: bundle.customerName || 'عميل نقدي',
          customerPhone: bundle.customerPhone || undefined,
          items,
          subtotal: Number(bundle.subtotal) || 0,
          subtotalInCurrency: Number(bundle.totalInCurrency) || Number(bundle.subtotal) || 0,
          discount,
          discountPercentage: Number(bundle.discountPercentage) || 0,
          taxRate: Number(bundle.taxRate) || 0,
          taxAmount: Number(bundle.taxAmount) || 0,
          total: Number(bundle.total) || 0,
          totalInCurrency: Number(bundle.totalInCurrency) || Number(bundle.total) || 0,
          currency: rawCurr,
          currencySymbol: sym,
          exchangeRate: Number(bundle.exchangeRate) || 1,
          profit: computedProfit,
          partsCost: computedPartsCost,
          paymentType: op.type === 'debt_sale_bundle' ? ((Number(bundle.downPayment) || 0) > 0 ? 'split' : 'debt') : (bundle.paymentType || 'cash'),
          status: op.type === 'debt_sale_bundle' ? ((Number(bundle.downPayment) || 0) >= (Number(bundle.total) || 0) ? 'paid' : 'pending') : (bundle.status as InvoiceStatus || 'paid'),
          serviceDescription: bundle.notes || undefined,
          createdAt: op.timestamp || op.createdAt || new Date().toISOString(),
          updatedAt: op.timestamp || op.createdAt || new Date().toISOString(),
          pending_sync: true,
          sync_failed: isFailed,
          cashierId: bundle.cashierId,
          cashierName: bundle.cashierName,
          debtPaid: Number(bundle.downPayment) || 0,
          debtRemaining: (Number(bundle.total) || 0) - (Number(bundle.downPayment) || 0)
        });
      }
    }
    const existingIds = new Set(invoices.map(i => i.id));
    const uniqueQueue = queueInvoices.filter(qi => !existingIds.has(qi.id));
    return [...uniqueQueue, ...invoices];
  } catch {
    return invoices;
  }
}
