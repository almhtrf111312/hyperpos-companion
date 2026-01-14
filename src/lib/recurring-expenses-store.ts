import { emitEvent, EVENTS } from './events';
import { addExpense, ExpenseType } from './expenses-store';

const RECURRING_EXPENSES_KEY = 'hyperpos_recurring_expenses_v1';

export type RecurringInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly';

export interface RecurringExpense {
  id: string;
  name: string;
  type: ExpenseType;
  customType?: string;
  amount: number;
  notes?: string;
  interval: RecurringInterval;
  intervalDays: number;
  nextDueDate: string;
  lastPaidDate?: string;
  isActive: boolean;
  createdAt: string;
}

export const recurringIntervals: { value: number; label: string; interval: RecurringInterval }[] = [
  { value: 1, label: 'يومياً', interval: 'daily' },
  { value: 7, label: 'أسبوعياً (7 أيام)', interval: 'weekly' },
  { value: 10, label: 'كل 10 أيام', interval: 'biweekly' },
  { value: 14, label: 'كل أسبوعين (14 يوم)', interval: 'biweekly' },
  { value: 30, label: 'شهرياً (30 يوم)', interval: 'monthly' },
  { value: 60, label: 'كل شهرين (60 يوم)', interval: 'bimonthly' },
  { value: 90, label: 'كل 3 أشهر (90 يوم)', interval: 'quarterly' },
];

export function loadRecurringExpenses(): RecurringExpense[] {
  try {
    const stored = localStorage.getItem(RECURRING_EXPENSES_KEY);
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
}

export function saveRecurringExpenses(expenses: RecurringExpense[]) {
  try {
    localStorage.setItem(RECURRING_EXPENSES_KEY, JSON.stringify(expenses));
    emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, expenses);
  } catch {
    // ignore
  }
}

export function addRecurringExpense(data: {
  name: string;
  type: ExpenseType;
  customType?: string;
  amount: number;
  notes?: string;
  intervalDays: number;
  startDate: string;
}): RecurringExpense {
  const intervalInfo = recurringIntervals.find(i => i.value === data.intervalDays) || recurringIntervals[1];
  
  const newExpense: RecurringExpense = {
    id: `REC-${Date.now()}`,
    name: data.name,
    type: data.type,
    customType: data.customType,
    amount: data.amount,
    notes: data.notes,
    interval: intervalInfo.interval,
    intervalDays: data.intervalDays,
    nextDueDate: data.startDate,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  
  const expenses = loadRecurringExpenses();
  expenses.unshift(newExpense);
  saveRecurringExpenses(expenses);
  
  return newExpense;
}

export function updateRecurringExpense(id: string, updates: Partial<RecurringExpense>): boolean {
  const expenses = loadRecurringExpenses();
  const index = expenses.findIndex(e => e.id === id);
  
  if (index === -1) return false;
  
  expenses[index] = { ...expenses[index], ...updates };
  saveRecurringExpenses(expenses);
  return true;
}

export function deleteRecurringExpense(id: string): boolean {
  const expenses = loadRecurringExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  
  if (filtered.length === expenses.length) return false;
  
  saveRecurringExpenses(filtered);
  return true;
}

export function getDueExpenses(): RecurringExpense[] {
  const expenses = loadRecurringExpenses();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return expenses.filter(expense => {
    if (!expense.isActive) return false;
    
    const dueDate = new Date(expense.nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    return dueDate <= today;
  });
}

export function payRecurringExpense(id: string): boolean {
  const expenses = loadRecurringExpenses();
  const expense = expenses.find(e => e.id === id);
  
  if (!expense) return false;
  
  // Add as regular expense
  addExpense({
    type: expense.type,
    customType: expense.customType || expense.name,
    amount: expense.amount,
    notes: `${expense.name} - مصروف ثابت متكرر`,
    date: new Date().toISOString().split('T')[0],
  });
  
  // Calculate next due date
  const nextDate = new Date(expense.nextDueDate);
  nextDate.setDate(nextDate.getDate() + expense.intervalDays);
  
  // Update the recurring expense
  expense.lastPaidDate = new Date().toISOString().split('T')[0];
  expense.nextDueDate = nextDate.toISOString().split('T')[0];
  
  saveRecurringExpenses(expenses);
  return true;
}

export function skipRecurringExpense(id: string): boolean {
  const expenses = loadRecurringExpenses();
  const expense = expenses.find(e => e.id === id);
  
  if (!expense) return false;
  
  // Calculate next due date without paying
  const nextDate = new Date(expense.nextDueDate);
  nextDate.setDate(nextDate.getDate() + expense.intervalDays);
  
  expense.nextDueDate = nextDate.toISOString().split('T')[0];
  
  saveRecurringExpenses(expenses);
  return true;
}

export function toggleRecurringExpense(id: string, isActive: boolean): boolean {
  return updateRecurringExpense(id, { isActive });
}
