// Cloud Customers Store - Supabase-backed customers management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  updateInSupabase, 
  deleteFromSupabase,
  getCurrentUserId 
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';
import { triggerAutoBackup } from '../local-auto-backup';
import { supabase } from '@/integrations/supabase/client';

export interface CloudCustomer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_purchases: number;
  total_debt: number;
  invoice_count: number;
  last_purchase: string | null;
  created_at: string;
  updated_at: string;
  cashier_id: string | null; // ✅ من أضاف العميل
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  totalDebt: number;
  invoiceCount: number;
  lastPurchase: string;
  createdAt: string;
  updatedAt: string;
  cashierId?: string; // ✅ معرف الكاشير
  cashierName?: string; // ✅ اسم الكاشير (يُحمّل لاحقاً)
}

// Transform cloud to legacy format
function toCustomer(cloud: CloudCustomer): Customer {
  return {
    id: cloud.id,
    name: cloud.name,
    phone: cloud.phone || '',
    email: cloud.email || undefined,
    address: cloud.address || undefined,
    totalPurchases: Number(cloud.total_purchases) || 0,
    totalDebt: Number(cloud.total_debt) || 0,
    invoiceCount: cloud.invoice_count || 0,
    lastPurchase: cloud.last_purchase || '',
    createdAt: cloud.created_at,
    updatedAt: cloud.updated_at,
    cashierId: cloud.cashier_id || undefined,
  };
}

// Local storage cache helpers
const LOCAL_CACHE_KEY = 'hyperpos_customers_cache';

const saveCustomersLocally = (customers: Customer[]) => {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(customers));
  } catch { /* ignore */ }
};

const loadCustomersLocally = (): Customer[] | null => {
  try {
    const data = localStorage.getItem(LOCAL_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

// Cache
let customersCache: Customer[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

// Background refresh control
let bgRefreshing = false;
const refreshCustomersInBackground = async () => {
  if (bgRefreshing || !navigator.onLine) return;
  bgRefreshing = true;
  try {
    const cloudCustomers = await fetchFromSupabase<CloudCustomer>('customers', {
      column: 'created_at',
      ascending: false,
    });
    customersCache = cloudCustomers.map(toCustomer);
    cacheTimestamp = Date.now();
    saveCustomersLocally(customersCache);
    try {
      const { emitEvent, EVENTS } = await import('../events');
      emitEvent(EVENTS.CUSTOMERS_UPDATED);
    } catch { /* noop */ }
  } catch (e) {
    console.warn('[customers-cloud] background refresh failed:', e);
  } finally {
    bgRefreshing = false;
  }
};

// Load customers — local-first: serve cache instantly, refresh in background
export const loadCustomersCloud = async (): Promise<Customer[]> => {
  const userId = getCurrentUserId();
  if (!userId) {
    const local = loadCustomersLocally();
    return local || [];
  }

  // Memory cache: instant
  if (customersCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return customersCache;
  }

  // localStorage cache: instant + trigger background refresh
  const local = loadCustomersLocally();
  if (local) {
    customersCache = local;
    cacheTimestamp = Date.now();
    if (navigator.onLine) refreshCustomersInBackground();
    return local;
  }

  // First load — must wait for network
  if (!navigator.onLine) return [];

  const cloudCustomers = await fetchFromSupabase<CloudCustomer>('customers', {
    column: 'created_at',
    ascending: false,
  });

  customersCache = cloudCustomers.map(toCustomer);
  cacheTimestamp = Date.now();
  saveCustomersLocally(customersCache);

  return customersCache;
};

// ✅ تحميل العملاء مع أسماء الكاشير
export const loadCustomersWithCashierNamesCloud = async (): Promise<Customer[]> => {
  const customers = await loadCustomersCloud();
  
  // جلب أسماء الكاشير من profiles
  const cashierIds = [...new Set(customers.filter(c => c.cashierId).map(c => c.cashierId!))];
  
  if (cashierIds.length === 0) return customers;
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', cashierIds);
  
  const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
  
  return customers.map(c => ({
    ...c,
    cashierName: c.cashierId ? profileMap.get(c.cashierId) || undefined : undefined,
  }));
};

export const invalidateCustomersCache = () => {
  customersCache = null;
  cacheTimestamp = 0;
};

// Add customer
export const addCustomerCloud = async (
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalPurchases' | 'totalDebt' | 'invoiceCount' | 'lastPurchase'>
): Promise<Customer | null> => {
  const normalizedName = customer.name.trim();

  // ✅ التحقق من عدم وجود عميل بنفس الاسم
  const existingCustomers = await loadCustomersCloud();
  const duplicate = existingCustomers.find(c => 
    c.name.toLowerCase().trim() === normalizedName.toLowerCase().trim()
  );
  
  if (duplicate) {
    // إرجاع null مع تسجيل التحذير (الواجهة ستتعامل مع هذا)
    console.warn('[addCustomerCloud] Customer with same name already exists:', customer.name);
    return null;
  }
  
  // ✅ جلب معرف الكاشير الحالي لحفظه مع العميل
  let cashierId = getCurrentUserId();
  if (!cashierId) {
    const { data: { user } } = await supabase.auth.getUser();
    cashierId = user?.id || null;
  }
  
  const inserted = await insertToSupabase<CloudCustomer>('customers', {
    name: normalizedName,
    phone: customer.phone || null,
    email: customer.email || null,
    address: customer.address || null,
    total_purchases: 0,
    total_debt: 0,
    invoice_count: 0,
    cashier_id: cashierId, // ✅ حفظ من أضاف العميل
  });
  
  if (inserted) {
    invalidateCustomersCache();
    emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
    triggerAutoBackup(`عميل جديد: ${normalizedName}`);
    return toCustomer(inserted);
  }
  
  return null;
};

// Update customer
export const updateCustomerCloud = async (
  id: string, 
  data: Partial<Omit<Customer, 'id' | 'createdAt'>>
): Promise<boolean> => {
  const updates: Record<string, unknown> = {};
  
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone || null;
  if (data.email !== undefined) updates.email = data.email || null;
  if (data.address !== undefined) updates.address = data.address || null;
  if (data.totalPurchases !== undefined) updates.total_purchases = data.totalPurchases;
  if (data.totalDebt !== undefined) updates.total_debt = data.totalDebt;
  if (data.invoiceCount !== undefined) updates.invoice_count = data.invoiceCount;
  if (data.lastPurchase !== undefined) updates.last_purchase = data.lastPurchase || null;

  const success = await updateInSupabase('customers', id, updates);
  
  if (success) {
    invalidateCustomersCache();
    emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
  }
  
  return success;
};

// Delete customer
export const deleteCustomerCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('customers', id);
  
  if (success) {
    invalidateCustomersCache();
    emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
  }
  
  return success;
};

// Find or create customer
export const findOrCreateCustomerCloud = async (name: string, phone?: string): Promise<Customer | null> => {
  const normalizedName = name.trim();
  const normalizedPhone = phone?.trim();
  const customers = await loadCustomersCloud();
  
  let customer = customers.find(c => 
    c.name.trim().toLowerCase() === normalizedName.toLowerCase() || 
    (normalizedPhone && c.phone === normalizedPhone)
  );

  // ✅ إذا كان العميل موجوداً وتم تمرير رقم هاتف جديد/مفقود: حدّث الهاتف حتى لا يُطلب مرة أخرى
  if (customer && normalizedPhone) {
    const currentPhone = (customer.phone || '').trim();
    if (!currentPhone || currentPhone !== normalizedPhone) {
      await updateCustomerCloud(customer.id, { phone: normalizedPhone });
      customer = { ...customer, phone: normalizedPhone };
    }
  }
  
  if (!customer) {
    customer = await addCustomerCloud({ name: normalizedName, phone: normalizedPhone || '' });
  }
  
  return customer;
};

/**
 * ✅ إعادة احتساب أرقام العميل من الفواتير النشطة (مصدر حقيقة واحد).
 * البارامترات القديمة تُتجاهل ويُحتفظ بها فقط لتوافق النداءات الحالية.
 */
export const updateCustomerStatsCloud = async (
  customerId: string,
  _legacyAmount?: number,
  _legacyIsDebt?: boolean
): Promise<void> => {
  if (!customerId) return;

  // نداءات قديمة كانت تمرّر الاسم بدل المعرّف — نحوّلها لمعرّف حقيقي
  let resolvedId = customerId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(customerId)) {
    const customers = await loadCustomersCloud();
    const match = customers.find(
      c => c.name.trim().toLowerCase() === customerId.trim().toLowerCase()
    );
    if (!match) return;
    resolvedId = match.id;
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('total, debt_remaining, payment_type, status, created_at')
    .eq('customer_id', resolvedId);

  if (error) {
    console.warn('[updateCustomerStatsCloud] failed to recompute:', error);
    return;
  }

  const active = (data || []).filter(
    inv => inv.status !== 'refunded' && inv.status !== 'cancelled'
  );

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalPurchases = round2(active.reduce((s, inv) => s + (Number(inv.total) || 0), 0));
  const totalDebt = round2(
    active
      .filter(inv => inv.payment_type === 'debt' && inv.status !== 'paid')
      .reduce((s, inv) => {
        const remaining = Number(inv.debt_remaining) || 0;
        return s + (remaining > 0 ? remaining : Number(inv.total) || 0);
      }, 0)
  );
  const lastPurchase = active
    .map(inv => inv.created_at)
    .filter(Boolean)
    .sort()
    .pop();

  await updateCustomerCloud(resolvedId, {
    totalPurchases,
    totalDebt,
    invoiceCount: active.length,
    ...(lastPurchase ? { lastPurchase } : {}),
  });
};

/** ربط الفاتورة بسجل العميل ثم إعادة احتساب أرقامه */
export const linkInvoiceToCustomerCloud = async (
  invoiceNumber: string,
  customerId: string
): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId || !invoiceNumber || !customerId) return;
  try {
    await supabase
      .from('invoices')
      .update({ customer_id: customerId })
      .eq('invoice_number', invoiceNumber)
      .eq('user_id', userId);
    const { invalidateInvoicesCache } = await import('./invoices-cloud');
    invalidateInvoicesCache();
  } catch (e) {
    console.warn('[linkInvoiceToCustomerCloud] failed:', e);
  }
  await updateCustomerStatsCloud(customerId);
};

// Get customers stats — محسوبة من الفواتير النشطة
export const getCustomersStatsCloud = async () => {
  const customers = await loadCustomersCloud();
  const { loadCustomersStatsMap, getCustomerStatsFrom } = await import('./customer-stats');

  let statsMap: Awaited<ReturnType<typeof loadCustomersStatsMap>> | null = null;
  try {
    statsMap = await loadCustomersStatsMap();
  } catch {
    statsMap = null;
  }

  const rows = customers.map(c =>
    statsMap
      ? getCustomerStatsFrom(statsMap, { id: c.id, name: c.name })
      : { invoiceCount: c.invoiceCount, totalPurchases: c.totalPurchases, totalDebt: c.totalDebt }
  );

  return {
    total: customers.length,
    withDebt: rows.filter(r => r.totalDebt > 0).length,
    totalDebt: rows.reduce((sum, r) => sum + r.totalDebt, 0),
    totalPurchases: rows.reduce((sum, r) => sum + r.totalPurchases, 0),
  };
};
