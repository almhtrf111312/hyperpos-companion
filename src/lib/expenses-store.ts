import { emitEvent, EVENTS } from './events';
import { loadPartners, savePartners } from './partners-store';

const EXPENSES_STORAGE_KEY = 'hyperpos_expenses_v1';

export type ExpenseType = 'rent' | 'utilities' | 'wages' | 'equipment' | 'internet' | 'electricity' | 'other';

export interface ExpenseDistribution {
  partnerId: string;
  partnerName: string;
  amount: number;
  percentage: number;
}

export interface Expense {
  id: string;
  type: ExpenseType;
  typeLabel: string;
  customType?: string;
  amount: number;
  notes?: string;
  date: string;
  month: string; // YYYY-MM
  distributions: ExpenseDistribution[];
  createdAt: string;
}

export const expenseTypes: { value: ExpenseType; label: string }[] = [
  { value: 'rent', label: 'إيجار' },
  { value: 'utilities', label: 'مرافق' },
  { value: 'wages', label: 'أجور' },
  { value: 'equipment', label: 'معدات' },
  { value: 'internet', label: 'إنترنت' },
  { value: 'electricity', label: 'كهرباء' },
  { value: 'other', label: 'أخرى' },
];

export const getExpenseTypeLabel = (type: ExpenseType): string => {
  return expenseTypes.find(t => t.value === type)?.label || type;
};

export const loadExpenses = (): Expense[] => {
  try {
    const stored = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
};

export const saveExpenses = (expenses: Expense[]) => {
  try {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    emitEvent(EVENTS.EXPENSES_UPDATED, expenses);
  } catch {
    // ignore
  }
};

export const addExpense = (expenseData: {
  type: ExpenseType;
  customType?: string;
  amount: number;
  notes?: string;
  date: string;
}): Expense => {
  const partners = loadPartners();
  const distributions: ExpenseDistribution[] = [];
  
  // Get partners who share expenses
  const expensePartners = partners.filter(p => p.sharesExpenses);
  
  if (expensePartners.length > 0) {
    // Calculate total share percentage of expense partners
    const totalExpenseShare = expensePartners.reduce((sum, p) => sum + p.sharePercentage, 0);
    
    expensePartners.forEach(partner => {
      // Calculate this partner's ratio of the expense
      const partnerRatio = totalExpenseShare > 0 ? partner.sharePercentage / totalExpenseShare : 0;
      const partnerAmount = expenseData.amount * partnerRatio;
      
      if (partnerAmount > 0) {
        distributions.push({
          partnerId: partner.id,
          partnerName: partner.name,
          amount: partnerAmount,
          percentage: partnerRatio * 100,
        });
        
        // Deduct from partner's balance
        partner.totalExpensesPaid = (partner.totalExpensesPaid || 0) + partnerAmount;
        partner.currentBalance -= partnerAmount;
      }
    });
    
    savePartners(partners);
  }
  
  const newExpense: Expense = {
    id: `EXP-${Date.now()}`,
    type: expenseData.type,
    typeLabel: expenseData.type === 'other' && expenseData.customType 
      ? expenseData.customType 
      : getExpenseTypeLabel(expenseData.type),
    customType: expenseData.customType,
    amount: expenseData.amount,
    notes: expenseData.notes,
    date: expenseData.date,
    month: expenseData.date.substring(0, 7),
    distributions,
    createdAt: new Date().toISOString(),
  };
  
  const expenses = loadExpenses();
  expenses.unshift(newExpense);
  saveExpenses(expenses);
  
  return newExpense;
};

export const deleteExpense = (id: string): boolean => {
  const expenses = loadExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  
  if (filtered.length === expenses.length) return false;
  
  saveExpenses(filtered);
  return true;
};

export const getExpenseStats = () => {
  const expenses = loadExpenses();
  const currentMonth = new Date().toISOString().substring(0, 7);
  
  const monthlyExpenses = expenses.filter(e => e.month === currentMonth);
  const totalThisMonth = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Group by type
  const byType: Record<string, number> = {};
  monthlyExpenses.forEach(e => {
    const label = e.typeLabel;
    byType[label] = (byType[label] || 0) + e.amount;
  });
  
  return {
    totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    totalThisMonth,
    expenseCount: expenses.length,
    monthlyCount: monthlyExpenses.length,
    byType,
  };
};

export const getMonthlyExpenses = (month: string): Expense[] => {
  const expenses = loadExpenses();
  return expenses.filter(e => e.month === month);
};
