// Cloud Debts Store - Supabase-backed debts management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  updateInSupabase, 
  deleteFromSupabase,
  getCurrentUserId 
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';
import { updateInvoiceCloud } from './invoices-cloud';

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
}

// Transform cloud to legacy
function toDebt(cloud: CloudDebt): Debt {
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
  };
}

// Cache
let debtsCache: Debt[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

// Load debts
export const loadDebtsCloud = async (): Promise<Debt[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  if (debtsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return debtsCache;
  }

  const cloudDebts = await fetchFromSupabase<CloudDebt>('debts', {
    column: 'created_at',
    ascending: false,
  });

  debtsCache = cloudDebts.map(toDebt);
  cacheTimestamp = Date.now();
  
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
  
  // Sync with invoice
  if (!debt.isCashDebt && debt.invoiceId) {
    if (debt.status === 'fully_paid') {
      await updateInvoiceCloud(debt.invoiceId, { 
        status: 'paid', 
        paymentType: 'cash',
        debtPaid: debt.totalDebt,
        debtRemaining: 0
      });
    } else {
      await updateInvoiceCloud(debt.invoiceId, { 
        debtPaid: debt.totalPaid,
        debtRemaining: debt.remainingDebt
      });
    }
  }
  
  return debt;
};

// Delete debt by invoice ID
export const deleteDebtByInvoiceIdCloud = async (invoiceId: string): Promise<boolean> => {
  const debts = await loadDebtsCloud();
  const debt = debts.find(d => d.invoiceId === invoiceId);
  
  if (!debt) return false;
  
  const success = await deleteFromSupabase('debts', debt.id);
  
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
