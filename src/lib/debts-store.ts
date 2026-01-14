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
