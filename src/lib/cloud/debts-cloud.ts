// Cloud Debts Store - Supabase-backed debts management
import {
  fetchFromSupabase,
  insertToSupabase,
  updateInSupabase,
  deleteFromSupabase,
  getCurrentUserId,
  setCurrentUserId,
  isCashierUser
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';
import { updateInvoiceCloud } from './invoices-cloud';
import { supabase } from '@/integrations/supabase/client';

export type DebtStatus = 'due' | 'partially_paid' | 'overdue' | 'fully_paid';

export interface CloudDebt {
  id: string;
  user_id: string;
  invoice_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  total_debt: number;
  total_paid: number;
  remaining_debt: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  is_cash_debt: boolean;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  invoiceId: string;
  customerName: string;
  customerPhone: string;
  totalDebt: number;
  totalPaid: number;
  remainingDebt: number;
  dueDate: string;
  status: DebtStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  isCashDebt?: boolean;
  cashierId?: string;
  cashierName?: string;
}

// Cache for cashier names
const cashierNamesCache: Record<string, string> = {};

// Transform cloud to legacy
function toDebt(cloud: CloudDebt & { cashier_name?: string }): Debt {
  const today = new Date().toISOString().split('T')[0];
  let status = cloud.status as DebtStatus;

  // Update status if overdue
  if (status !== 'fully_paid' && cloud.due_date && cloud.due_date < today) {
    status = 'overdue';
  }

  return {
    id: cloud.id,
    invoiceId: cloud.invoice_id || '',
    customerName: cloud.customer_name,
    customerPhone: cloud.customer_phone || '',
    totalDebt: Number(cloud.total_debt) || 0,
    totalPaid: Number(cloud.total_paid) || 0,
    remainingDebt: Number(cloud.remaining_debt) || 0,
    dueDate: cloud.due_date || '',
    status,
    notes: cloud.notes || undefined,
    isCashDebt: cloud.is_cash_debt,
    createdAt: cloud.created_at,
    updatedAt: cloud.updated_at,
    cashierId: (cloud as { cashier_id?: string }).cashier_id || undefined,
    cashierName: cloud.cashier_name || cashierNamesCache[(cloud as { cashier_id?: string }).cashier_id || ''] || undefined,
  };
}

// Local storage cache helpers
const LOCAL_CACHE_KEY = 'hyperpos_debts_cache';

const saveDebtsLocally = (debts: Debt[]) => {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(debts));
  } catch { /* ignore */ }
};

const loadDebtsLocally = (): Debt[] | null => {
  try {
    const data = localStorage.getItem(LOCAL_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

// Cache
let debtsCache: Debt[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

// Generate manual debt ID
export const getNextManualDebtId = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const datePrefix = `DBT-${year}${month}${day}`;

  const debts = await loadDebtsCloud();

  // Count manual debts from today
  const todayDebts = debts.filter(d =>
    d.invoiceId && d.invoiceId.startsWith(datePrefix)
  );

  const nextNumber = todayDebts.length + 1;
  return `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;
};

// Load debts
// ✅ Owners see all debts, cashiers see only their own
export const loadDebtsCloud = async (): Promise<Debt[]> => {
  let userId = getCurrentUserId();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      userId = user.id;
      setCurrentUserId(user.id);
    }
  }
  if (!userId) return [];

  if (debtsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return debtsCache;
  }

  // Offline: return local cache
  if (!navigator.onLine) {
    const local = loadDebtsLocally();
    if (local) {
      debtsCache = local;
      cacheTimestamp = Date.now();
      return local;
    }
    return [];
  }

  // Check if current user is a cashier
  const isCashier = await isCashierUser();

  let cloudDebts = await fetchFromSupabase<CloudDebt & { cashier_id?: string }>('debts', {
    column: 'created_at',
    ascending: false,
  });

  // ✅ If cashier, filter to only show their own debts
  if (isCashier) {
    cloudDebts = cloudDebts.filter(d => d.cashier_id === userId);
  }

  // Fetch cashier names for debts with cashier_id
  const cashierIds = [...new Set(cloudDebts.filter(d => (d as { cashier_id?: string }).cashier_id).map(d => (d as { cashier_id: string }).cashier_id))];
  if (cashierIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', cashierIds);

    if (profiles) {
      const nameMap: Record<string, string> = {};
      profiles.forEach((p: { user_id: string; full_name: string }) => {
        nameMap[p.user_id] = p.full_name;
        cashierNamesCache[p.user_id] = p.full_name;
      });

      cloudDebts = cloudDebts.map(d => ({
        ...d,
        cashier_name: (d as { cashier_id?: string }).cashier_id ? nameMap[(d as { cashier_id: string }).cashier_id] : undefined,
      }));
    }
  }

  debtsCache = cloudDebts.map(d => toDebt(d as CloudDebt & { cashier_name?: string }));
  cacheTimestamp = Date.now();
  saveDebtsLocally(debtsCache);

  return debtsCache;
};

export const invalidateDebtsCache = () => {
  debtsCache = null;
  cacheTimestamp = 0;
};

// Add debt
export const addDebtCloud = async (
  debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'totalPaid' | 'remainingDebt' | 'status'>
): Promise<Debt | null> => {
  const today = new Date().toISOString().split('T')[0];

  // ✅ جلب معرف المستخدم من المتغير أو مباشرة من supabase
  let cashierId = getCurrentUserId();
  if (!cashierId) {
    const { data: { user } } = await supabase.auth.getUser();
    cashierId = user?.id || null;
    console.log('[addDebtCloud] Fallback to supabase.auth.getUser:', cashierId);
  }

  const inserted = await insertToSupabase<CloudDebt>('debts', {
    invoice_id: debtData.invoiceId || null,
    customer_name: debtData.customerName,
    customer_phone: debtData.customerPhone || null,
    total_debt: debtData.totalDebt,
    total_paid: 0,
    remaining_debt: debtData.totalDebt,
    due_date: debtData.dueDate || null,
    status: debtData.dueDate && debtData.dueDate < today ? 'overdue' : 'due',
    notes: debtData.notes || null,
    is_cash_debt: debtData.isCashDebt || false,
    cashier_id: cashierId, // ✅ Track who created the debt
  });

  if (inserted) {
    invalidateDebtsCache();
    emitEvent(EVENTS.DEBTS_UPDATED, null);
    return toDebt(inserted);
  }

  return null;
};

// Add debt from invoice
export const addDebtFromInvoiceCloud = async (
  invoiceId: string,
  customerName: string,
  customerPhone: string,
  amount: number,
  dueDate?: string
): Promise<Debt | null> => {
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  return addDebtCloud({
    invoiceId,
    customerName,
    customerPhone,
    totalDebt: amount,
    dueDate: dueDate || defaultDueDate.toISOString().split('T')[0],
    isCashDebt: false,
  });
};

// Record payment
export const recordPaymentCloud = async (
  debtId: string,
  amount: number
): Promise<Debt | null> => {
  const debts = await loadDebtsCloud();
  const debt = debts.find(d => d.id === debtId);

  if (!debt) return null;

  const newTotalPaid = debt.totalPaid + amount;
  const newRemainingDebt = debt.totalDebt - newTotalPaid;

  let newStatus: DebtStatus = debt.status;
  if (newRemainingDebt <= 0) {
    newStatus = 'fully_paid';
  } else if (newTotalPaid > 0) {
    newStatus = 'partially_paid';
  }

  const success = await updateInSupabase('debts', debtId, {
    total_paid: newTotalPaid,
    remaining_debt: Math.max(0, newRemainingDebt),
    status: newStatus,
  });

  if (success) {
    invalidateDebtsCache();
    emitEvent(EVENTS.DEBTS_UPDATED, null);

    return {
      ...debt,
      totalPaid: newTotalPaid,
      remainingDebt: Math.max(0, newRemainingDebt),
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
};

// Record payment with invoice sync
export const recordPaymentWithInvoiceSyncCloud = async (
  debtId: string,
  amount: number
): Promise<Debt | null> => {
  const debt = await recordPaymentCloud(debtId, amount);
  if (!debt) return null;

  // Sync with invoice - استخدام invoice_number للتحديث
  if (!debt.isCashDebt && debt.invoiceId) {
    // البحث عن الفاتورة بـ invoice_number أو UUID
    const userId = getCurrentUserId();
    if (userId) {
      try {
        // تحديث الفاتورة مباشرة باستخدام invoice_number
        const updateData = debt.status === 'fully_paid'
          ? {
            status: 'paid',
            payment_type: 'cash',
            debt_paid: debt.totalDebt,
            debt_remaining: 0
          }
          : {
            debt_paid: debt.totalPaid,
            debt_remaining: debt.remainingDebt
          };

        // محاولة التحديث بـ invoice_number أولاً
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('invoices')
          .update(updateData)
          .or(`invoice_number.eq.${debt.invoiceId},id.eq.${debt.invoiceId}`)
          .eq('user_id', userId);

        if (!error) {
          emitEvent(EVENTS.INVOICES_UPDATED, null);
        }
      } catch (e) {
        console.error('[recordPaymentWithInvoiceSyncCloud] Failed to sync invoice:', e);
      }
    }
  }

  return debt;
};

// Delete debt by invoice ID - يدعم البحث بـ invoice_number أو UUID
export const deleteDebtByInvoiceIdCloud = async (invoiceId: string): Promise<boolean> => {
  const userId = getCurrentUserId();
  if (!userId) return false;

  try {
    // حذف مباشر باستخدام OR condition للبحث بـ invoice_id أو id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('debts')
      .delete()
      .or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`)
      .eq('user_id', userId);

    const success = !error;

    if (success) {
      invalidateDebtsCache();
      emitEvent(EVENTS.DEBTS_UPDATED, null);
    }

    return success;
  } catch (e) {
    console.error('[deleteDebtByInvoiceIdCloud] Error:', e);
    return false;
  }
};

// Delete debt by ID
export const deleteDebtCloud = async (debtId: string): Promise<boolean> => {
  const success = await deleteFromSupabase('debts', debtId);

  if (success) {
    invalidateDebtsCache();
    emitEvent(EVENTS.DEBTS_UPDATED, null);
  }

  return success;
};

// Get debts stats
export const getDebtsStatsCloud = async () => {
  const debts = await loadDebtsCloud();
  return {
    total: debts.reduce((sum, d) => sum + d.totalDebt, 0),
    remaining: debts.reduce((sum, d) => sum + d.remainingDebt, 0),
    paid: debts.reduce((sum, d) => sum + d.totalPaid, 0),
    overdue: debts.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.remainingDebt, 0),
    count: debts.length,
    activeCount: debts.filter(d => d.status !== 'fully_paid').length,
  };
};
