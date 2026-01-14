import { loadCustomers, saveCustomers } from './customers-store';
import { emitEvent, EVENTS } from './events';

const DEBTS_STORAGE_KEY = 'hyperpos_debts_v1';

export type DebtStatus = 'due' | 'partially_paid' | 'overdue' | 'fully_paid';

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

export const loadDebts = (): Debt[] => {
  try {
    const stored = localStorage.getItem(DEBTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Update overdue status
        const today = new Date().toISOString().split('T')[0];
        return parsed.map(debt => {
          if (debt.status !== 'fully_paid' && debt.dueDate < today) {
            return { ...debt, status: 'overdue' as DebtStatus };
          }
          return debt;
        });
      }
    }
  } catch {
    // ignore
  }
  return [];
};

export const saveDebts = (debts: Debt[]) => {
  try {
    localStorage.setItem(DEBTS_STORAGE_KEY, JSON.stringify(debts));
    emitEvent(EVENTS.DEBTS_UPDATED, debts);
  } catch {
    // ignore
  }
};

export const addDebt = (debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'totalPaid' | 'remainingDebt' | 'status'>): Debt => {
  const debts = loadDebts();
  const today = new Date().toISOString().split('T')[0];
  const newDebt: Debt = {
    ...debtData,
    id: Date.now().toString(),
    totalPaid: 0,
    remainingDebt: debtData.totalDebt,
    status: debtData.dueDate < today ? 'overdue' : 'due',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  debts.push(newDebt);
  saveDebts(debts);
  return newDebt;
};

export const addDebtFromInvoice = (
  invoiceId: string,
  customerName: string,
  customerPhone: string,
  amount: number,
  dueDate?: string
): Debt => {
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);
  
  return addDebt({
    invoiceId,
    customerName,
    customerPhone,
    totalDebt: amount,
    dueDate: dueDate || defaultDueDate.toISOString().split('T')[0],
    isCashDebt: false,
  });
};

export const recordPayment = (debtId: string, amount: number): Debt | null => {
  const debts = loadDebts();
  const index = debts.findIndex(d => d.id === debtId);
  if (index === -1) return null;

  const debt = debts[index];
  const newTotalPaid = debt.totalPaid + amount;
  const newRemainingDebt = debt.totalDebt - newTotalPaid;
  
  let newStatus: DebtStatus = debt.status;
  if (newRemainingDebt <= 0) {
    newStatus = 'fully_paid';
  } else if (newTotalPaid > 0) {
    newStatus = 'partially_paid';
  }

  debts[index] = {
    ...debt,
    totalPaid: newTotalPaid,
    remainingDebt: Math.max(0, newRemainingDebt),
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  saveDebts(debts);
  return debts[index];
};

export const getDebtsStats = () => {
  const debts = loadDebts();
  return {
    total: debts.reduce((sum, d) => sum + d.totalDebt, 0),
    remaining: debts.reduce((sum, d) => sum + d.remainingDebt, 0),
    paid: debts.reduce((sum, d) => sum + d.totalPaid, 0),
    overdue: debts.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.remainingDebt, 0),
    count: debts.length,
    activeCount: debts.filter(d => d.status !== 'fully_paid').length,
  };
};

// Delete debt by invoice ID
export const deleteDebtByInvoiceId = (invoiceId: string): boolean => {
  const debts = loadDebts();
  const filtered = debts.filter(d => d.invoiceId !== invoiceId);
  if (filtered.length === debts.length) return false;
  saveDebts(filtered);
  return true;
};
