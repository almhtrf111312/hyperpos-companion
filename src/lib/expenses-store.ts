import { emitEvent, EVENTS } from './events';
import { loadPartners, savePartners, ExpenseRecord } from './partners-store';

const EXPENSES_STORAGE_KEY = 'hyperpos_expenses_v1';

// Fix #17: Enhanced expense types with categories
export type ExpenseCategory = 'operational' | 'payroll' | 'utilities' | 'maintenance' | 'marketing' | 'other';
export type ExpenseType = 'rent' | 'utilities' | 'wages' | 'equipment' | 'internet' | 'electricity' | 'water' | 'gas' | 'phone' | 'insurance' | 'taxes' | 'supplies' | 'marketing' | 'transport' | 'maintenance' | 'cash_adjustment' | 'other';

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
  category: ExpenseCategory; // Fix #17: Added category field
  customType?: string;
  amount: number;
  notes?: string;
  date: string;
  month: string; // YYYY-MM
  distributions: ExpenseDistribution[];
  createdAt: string;
}

// Fix #17: Category definitions with Arabic labels
export const expenseCategories: { value: ExpenseCategory; label: string }[] = [
  { value: 'operational', label: 'تشغيلية' },
  { value: 'payroll', label: 'رواتب وأجور' },
  { value: 'utilities', label: 'مرافق وخدمات' },
  { value: 'maintenance', label: 'صيانة' },
  { value: 'marketing', label: 'تسويق وإعلان' },
  { value: 'other', label: 'أخرى' },
];

// Enhanced expense types with category mapping
export const expenseTypes: { value: ExpenseType; label: string; category: ExpenseCategory }[] = [
  { value: 'rent', label: 'إيجار', category: 'operational' },
  { value: 'utilities', label: 'مرافق', category: 'utilities' },
  { value: 'wages', label: 'أجور', category: 'payroll' },
  { value: 'equipment', label: 'معدات', category: 'operational' },
  { value: 'internet', label: 'إنترنت', category: 'utilities' },
  { value: 'electricity', label: 'كهرباء', category: 'utilities' },
  { value: 'water', label: 'مياه', category: 'utilities' },
  { value: 'gas', label: 'غاز', category: 'utilities' },
  { value: 'phone', label: 'هاتف', category: 'utilities' },
  { value: 'insurance', label: 'تأمين', category: 'operational' },
  { value: 'taxes', label: 'ضرائب', category: 'operational' },
  { value: 'supplies', label: 'مستلزمات', category: 'operational' },
  { value: 'marketing', label: 'تسويق', category: 'marketing' },
  { value: 'transport', label: 'نقل', category: 'operational' },
  { value: 'maintenance', label: 'صيانة', category: 'maintenance' },
  { value: 'cash_adjustment', label: 'تسوية صندوق', category: 'other' },
  { value: 'other', label: 'أخرى', category: 'other' },
];

export const getExpenseTypeLabel = (type: ExpenseType): string => {
  return expenseTypes.find(t => t.value === type)?.label || type;
};

export const getExpenseCategory = (type: ExpenseType): ExpenseCategory => {
  return expenseTypes.find(t => t.value === type)?.category || 'other';
};

export const getCategoryLabel = (category: ExpenseCategory): string => {
  return expenseCategories.find(c => c.value === category)?.label || category;
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
  const expenseId = `EXP-${Date.now()}`;
  const expenseTypeLabel = expenseData.type === 'other' && expenseData.customType 
    ? expenseData.customType 
    : getExpenseTypeLabel(expenseData.type);
  
  // Get partners who share expenses
  const expensePartners = partners.filter(p => p.sharesExpenses);
  
  if (expensePartners.length > 0) {
    // Calculate total share percentage of expense partners
    // Use expenseSharePercentage if available, otherwise fallback to sharePercentage
    const totalExpenseShare = expensePartners.reduce((sum, p) => 
      sum + (p.expenseSharePercentage ?? p.sharePercentage), 0);
    
    expensePartners.forEach(partner => {
      // Calculate this partner's ratio of the expense
      const partnerExpenseShare = partner.expenseSharePercentage ?? partner.sharePercentage;
      const partnerRatio = totalExpenseShare > 0 ? partnerExpenseShare / totalExpenseShare : 0;
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
        
        // Add to expense history for tracking
        const expenseRecord: ExpenseRecord = {
          expenseId,
          type: expenseTypeLabel,
          amount: partnerAmount,
          date: expenseData.date,
          notes: expenseData.notes,
          createdAt: new Date().toISOString(),
        };
        partner.expenseHistory = partner.expenseHistory || [];
        partner.expenseHistory.unshift(expenseRecord);
      }
    });
    
    savePartners(partners);
  }
  
  const newExpense: Expense = {
    id: expenseId,
    type: expenseData.type,
    typeLabel: expenseTypeLabel,
    category: getExpenseCategory(expenseData.type), // Fix #17: Add category
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
  const expense = expenses.find(e => e.id === id);
  
  if (!expense) return false;
  
  // Refund partners
  if (expense.distributions.length > 0) {
    const partners = loadPartners();
    
    expense.distributions.forEach(dist => {
      const partner = partners.find(p => p.id === dist.partnerId);
      if (partner) {
        // Refund the amount
        partner.totalExpensesPaid = Math.max(0, (partner.totalExpensesPaid || 0) - dist.amount);
        partner.currentBalance += dist.amount;
        
        // Remove from expense history
        partner.expenseHistory = (partner.expenseHistory || []).filter(
          eh => eh.expenseId !== id
        );
      }
    });
    
    savePartners(partners);
  }
  
  const filtered = expenses.filter(e => e.id !== id);
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
