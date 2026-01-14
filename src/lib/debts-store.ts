// Debts store for managing all debts data
import { loadCustomers, saveCustomers } from './customers-store';

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
    // Dispatch storage event for cross-component updates
    window.dispatchEvent(new Event('debtsUpdated'));
  } catch {
    // ignore
  }
};

export const addDebt = (debt: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'totalPaid' | 'remainingDebt' | 'status'>): Debt => {
  const debts = loadDebts();
  const newDebt: Debt = {
    ...debt,
    id: `DEBT-${Date.now()}`,
    totalPaid: 0,
    remainingDebt: debt.totalDebt,
    status: 'due',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  debts.unshift(newDebt);
  saveDebts(debts);
  return newDebt;
};

export const addDebtFromInvoice = (invoiceId: string, customerName: string, customerPhone: string, amount: number): Debt => {
  // Set due date to 30 days from now
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  
  return addDebt({
    invoiceId,
    customerName,
    customerPhone,
    totalDebt: amount,
    dueDate: dueDate.toISOString().split('T')[0],
    isCashDebt: false,
  });
};

export const updateDebt = (id: string, updates: Partial<Debt>): Debt | null => {
  const debts = loadDebts();
  const index = debts.findIndex(d => d.id === id);
  if (index === -1) return null;
  
  debts[index] = {
    ...debts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveDebts(debts);
  return debts[index];
};

export const recordPayment = (id: string, amount: number): Debt | null => {
  const debts = loadDebts();
  const index = debts.findIndex(d => d.id === id);
  if (index === -1) return null;
  
  const debt = debts[index];
  const newTotalPaid = debt.totalPaid + amount;
  const newRemainingDebt = debt.totalDebt - newTotalPaid;
  const newStatus: DebtStatus = newRemainingDebt <= 0 ? 'fully_paid' : 'partially_paid';
  
  debts[index] = {
    ...debt,
    totalPaid: newTotalPaid,
    remainingDebt: Math.max(0, newRemainingDebt),
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  saveDebts(debts);
  
  // Update customer debt stats
  updateCustomerDebtOnPayment(debt.customerPhone, debt.customerName, amount, newStatus === 'fully_paid');
  
  return debts[index];
};

// Update customer debt when payment is made
const updateCustomerDebtOnPayment = (phone: string, name: string, paidAmount: number, isFullyPaid: boolean) => {
  const customers = loadCustomers();
  const customerIndex = customers.findIndex(c => 
    c.phone === phone || c.name.toLowerCase() === name.toLowerCase()
  );
  
  if (customerIndex !== -1) {
    customers[customerIndex] = {
      ...customers[customerIndex],
      totalDebt: Math.max(0, customers[customerIndex].totalDebt - paidAmount),
      updatedAt: new Date().toISOString(),
    };
    saveCustomers(customers);
  }
};

export const deleteDebt = (id: string): boolean => {
  const debts = loadDebts();
  const filtered = debts.filter(d => d.id !== id);
  if (filtered.length === debts.length) return false;
  saveDebts(filtered);
  return true;
};

export const getDebtById = (id: string): Debt | null => {
  const debts = loadDebts();
  return debts.find(d => d.id === id) || null;
};

export const getDebtsByCustomer = (customerName: string): Debt[] => {
  return loadDebts().filter(d => d.customerName === customerName);
};

export const getDebtsStats = () => {
  const debts = loadDebts();
  return {
    total: debts.reduce((sum, d) => sum + d.totalDebt, 0),
    remaining: debts.reduce((sum, d) => sum + d.remainingDebt, 0),
    paid: debts.reduce((sum, d) => sum + d.totalPaid, 0),
    overdue: debts.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.remainingDebt, 0),
    overdueCount: debts.filter(d => d.status === 'overdue').length,
    pendingCount: debts.filter(d => d.status !== 'fully_paid').length,
  };
};
