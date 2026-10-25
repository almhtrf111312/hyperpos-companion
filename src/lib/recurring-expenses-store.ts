import { emitEvent, EVENTS } from './events';
import { addExpenseCloud, ExpenseType } from './cloud/expenses-cloud';
import { processExpense } from './unified-transactions';
import { toLocalDateString } from './date-utils';
import {
  RECURRING_EXPENSES_KEY,
  loadRecurringExpensesLocally,
  saveRecurringExpensesLocally,
  loadRecurringExpensesCloud,
  addRecurringExpenseCloud,
  updateRecurringExpenseCloud,
  deleteRecurringExpenseCloud,
  invalidateRecurringExpensesCache,
} from './cloud/recurring-expenses-cloud';

export {
  loadRecurringExpensesCloud,
  addRecurringExpenseCloud,
  updateRecurringExpenseCloud,
  deleteRecurringExpenseCloud,
  invalidateRecurringExpensesCache,
};

export type RecurringInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly';

export interface RecurringExpense {
  id: string;
  name: string;
  type: ExpenseType;
  customType?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  notes?: string;
  interval: RecurringInterval;
  intervalDays: number;
  nextDueDate: string;
  lastPaidDate?: string;
  autoPay?: boolean;
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
  return loadRecurringExpensesLocally();
}

export function saveRecurringExpenses(expenses: RecurringExpense[]) {
  saveRecurringExpensesLocally(expenses);
  emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, expenses);
}

export function addRecurringExpense(data: {
  name: string;
  type: ExpenseType;
  customType?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  notes?: string;
  intervalDays: number;
  startDate: string;
  autoPay?: boolean;
}): RecurringExpense {
  const intervalInfo = recurringIntervals.find(i => i.value === data.intervalDays) || recurringIntervals[1];
  const newId = crypto.randomUUID();
  
  const newExpense: RecurringExpense = {
    id: newId,
    name: data.name,
    type: data.type,
    customType: data.customType,
    amount: data.amount,
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    notes: data.notes,
    interval: intervalInfo.interval,
    intervalDays: data.intervalDays,
    nextDueDate: data.startDate,
    autoPay: data.autoPay ?? false,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  
  const expenses = loadRecurringExpenses();
  expenses.unshift(newExpense);
  saveRecurringExpenses(expenses);

  // Trigger cloud sync
  addRecurringExpenseCloud(data).catch(console.error);
  
  return newExpense;
}

export function updateRecurringExpense(id: string, updates: Partial<RecurringExpense>): boolean {
  const expenses = loadRecurringExpenses();
  const index = expenses.findIndex(e => e.id === id);
  
  if (index === -1) return false;
  
  expenses[index] = { ...expenses[index], ...updates };
  saveRecurringExpenses(expenses);

  // Trigger cloud sync
  updateRecurringExpenseCloud(id, updates).catch(console.error);

  return true;
}

export function deleteRecurringExpense(id: string): boolean {
  const expenses = loadRecurringExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  
  if (filtered.length === expenses.length) return false;
  
  saveRecurringExpenses(filtered);

  // Trigger cloud sync
  deleteRecurringExpenseCloud(id).catch(console.error);

  return true;
}

const payingLocks = new Set<string>();

export function getDueExpenses(): RecurringExpense[] {
  const expenses = loadRecurringExpenses();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(new Date());
  
  return expenses.filter(expense => {
    if (!expense.isActive) return false;
    
    // Strict Idempotency: If already paid today, NOT due today!
    if (expense.lastPaidDate === todayStr) return false;
    
    const dueDate = new Date(expense.nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    return dueDate <= today;
  });
}

export async function payRecurringExpense(id: string): Promise<boolean> {
  if (payingLocks.has(id)) {
    console.warn(`[payRecurringExpense] Payment already in progress for ${id}`);
    return false;
  }
  payingLocks.add(id);

  try {
    const expenses = loadRecurringExpenses();
    const expense = expenses.find(e => e.id === id);
    
    if (!expense) return false;
    
    const todayStr = toLocalDateString(new Date());

    // Strict Idempotency check: Don't double pay if already paid today!
    if (expense.lastPaidDate === todayStr) {
      console.warn(`[payRecurringExpense] Expense ${id} was already paid today (${todayStr})`);
      return false;
    }

    // 1. Add as regular cloud expense
    await addExpenseCloud({
      type: expense.type,
      customType: expense.customType || expense.name,
      amount: expense.amount,
      notes: `${expense.name} - مصروف ثابت متكرر`,
      date: todayStr,
    });

    // 2. خصم المبلغ من الصندوق وتسجيله كمصروف تشغيلي
    processExpense(expense.amount, expense.type);
    
    // 3. Calculate next due date strictly into the future
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const currentDueDate = new Date(expense.nextDueDate || todayStr);
    currentDueDate.setHours(0, 0, 0, 0);

    const baseTime = Math.max(currentDueDate.getTime(), todayDate.getTime());
    const nextDate = new Date(baseTime);
    nextDate.setDate(nextDate.getDate() + (expense.intervalDays || 30));
    const nextDueDateStr = toLocalDateString(nextDate);
    
    // 4. Update the recurring expense in Supabase and local cache
    await updateRecurringExpenseCloud(id, {
      lastPaidDate: todayStr,
      nextDueDate: nextDueDateStr,
    });
    
    // 5. إطلاق حدث التحديث الآن فقط بعد أن أصبح الكاش يحمل تاريخ اليوم الجديد
    emitEvent(EVENTS.EXPENSES_UPDATED, null);
    
    return true;
  } finally {
    // Release lock after debounce delay to prevent rapid double-clicks
    setTimeout(() => {
      payingLocks.delete(id);
    }, 1000);
  }
}

export function skipRecurringExpense(id: string): boolean {
  const expenses = loadRecurringExpenses();
  const expense = expenses.find(e => e.id === id);
  
  if (!expense) return false;
  
  // Calculate next due date without paying
  const baseDate = new Date(expense.nextDueDate || toLocalDateString(new Date()));
  baseDate.setDate(baseDate.getDate() + (expense.intervalDays || 30));
  const nextDueDateStr = toLocalDateString(baseDate);
  
  updateRecurringExpenseCloud(id, {
    nextDueDate: nextDueDateStr,
  }).catch(console.error);
  
  return true;
}

export function toggleRecurringExpense(id: string, isActive: boolean): boolean {
  return updateRecurringExpense(id, { isActive });
}

export async function executeAutoPayRecurringExpenses(): Promise<number> {
  const expenses = loadRecurringExpenses();
  const todayStr = toLocalDateString(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let paidCount = 0;

  for (const item of expenses) {
    if (!item.isActive || !item.autoPay) continue;

    const dueDate = new Date(item.nextDueDate);
    dueDate.setHours(0, 0, 0, 0);

    // التحقق من عدم التكرار (Idempotency): لا يتم السداد إذا كان قد سُدد اليوم مسبقاً
    if (dueDate <= today && item.lastPaidDate !== todayStr) {
      try {
        const success = await payRecurringExpense(item.id);
        if (success) {
          paidCount++;
        }
      } catch (err) {
        console.error(`[AutoPay] Failed to auto-pay expense ${item.id}:`, err);
      }
    }
  }

  return paidCount;
}
