/**
 * Profits Store - FlowPOS Pro
 * ===========================
 * سجل الأرباح المركزي - يتتبع الربح الإجمالي وتكلفة البضاعة المباعة
 * 
 * الصيغة الصحيحة للربح:
 * صافي الربح = إجمالي الأرباح (Gross Profit) - المصروفات التشغيلية
 * حيث: الربح الإجمالي = المبيعات - تكلفة البضاعة المباعة (COGS)
 */

import { emitEvent, EVENTS } from './events';
import { roundCurrency, addCurrency, subtractCurrency } from './utils';

// Storage keys
const PROFIT_RECORDS_KEY = 'hyperpos_profit_records_v1';
const EXPENSE_RECORDS_KEY = 'hyperpos_expense_records_v1';

// ============= Types =============

export interface ProfitRecord {
  id: string;
  saleId: string;
  date: string;
  grossProfit: number;      // الربح الإجمالي (المبيعات - التكلفة)
  cogs: number;             // تكلفة البضاعة المباعة
  saleTotal: number;        // إجمالي المبيعات
  createdAt: string;
}

export interface OperatingExpenseRecord {
  id: string;
  expenseId: string;
  date: string;
  amount: number;
  expenseType: string;
  createdAt: string;
}

export interface ProfitSummary {
  totalSales: number;           // إجمالي المبيعات
  totalCOGS: number;            // إجمالي تكلفة البضاعة المباعة
  totalGrossProfit: number;     // إجمالي الربح الإجمالي
  totalOperatingExpenses: number; // إجمالي المصروفات التشغيلية
  netProfit: number;            // صافي الربح
  profitMargin: number;         // هامش الربح (%)
}

// ============= Load/Save Functions =============

export const loadProfitRecords = (): ProfitRecord[] => {
  try {
    const stored = localStorage.getItem(PROFIT_RECORDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveProfitRecords = (records: ProfitRecord[]): void => {
  try {
    localStorage.setItem(PROFIT_RECORDS_KEY, JSON.stringify(records));
    emitEvent(EVENTS.PROFITS_UPDATED, records);
  } catch {
    // ignore
  }
};

export const loadExpenseRecords = (): OperatingExpenseRecord[] => {
  try {
    const stored = localStorage.getItem(EXPENSE_RECORDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveExpenseRecords = (records: OperatingExpenseRecord[]): void => {
  try {
    localStorage.setItem(EXPENSE_RECORDS_KEY, JSON.stringify(records));
    emitEvent(EVENTS.PROFITS_UPDATED, records);
  } catch {
    // ignore
  }
};

// ============= Core Functions =============

/**
 * تسجيل الربح الإجمالي لعملية بيع
 * يتم استدعاؤها من processCashSale و processDebtSale
 */
export const addGrossProfit = (
  saleId: string,
  grossProfit: number,
  cogs: number,
  saleTotal: number
): ProfitRecord => {
  const records = loadProfitRecords();
  
  const newRecord: ProfitRecord = {
    id: `profit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    saleId,
    date: new Date().toISOString().split('T')[0],
    grossProfit: roundCurrency(grossProfit),
    cogs: roundCurrency(cogs),
    saleTotal: roundCurrency(saleTotal),
    createdAt: new Date().toISOString(),
  };
  
  records.unshift(newRecord);
  saveProfitRecords(records);
  
  return newRecord;
};

/**
 * تسجيل مصروف تشغيلي
 * يتم استدعاؤها من processExpense
 */
export const addOperatingExpense = (
  expenseId: string,
  amount: number,
  expenseType: string = 'general'
): OperatingExpenseRecord => {
  const records = loadExpenseRecords();
  
  const newRecord: OperatingExpenseRecord = {
    id: `opex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    expenseId,
    date: new Date().toISOString().split('T')[0],
    amount: roundCurrency(amount),
    expenseType,
    createdAt: new Date().toISOString(),
  };
  
  records.unshift(newRecord);
  saveExpenseRecords(records);
  
  return newRecord;
};

/**
 * حذف سجل ربح (للمرتجعات)
 */
export const removeGrossProfit = (saleId: string): boolean => {
  const records = loadProfitRecords();
  const index = records.findIndex(r => r.saleId === saleId);
  
  if (index !== -1) {
    records.splice(index, 1);
    saveProfitRecords(records);
    return true;
  }
  
  return false;
};

/**
 * حذف سجل مصروف (لحذف المصروفات)
 */
export const removeOperatingExpense = (expenseId: string): boolean => {
  const records = loadExpenseRecords();
  const index = records.findIndex(r => r.expenseId === expenseId);
  
  if (index !== -1) {
    records.splice(index, 1);
    saveExpenseRecords(records);
    return true;
  }
  
  return false;
};

// ============= Calculation Functions =============

/**
 * حساب صافي الربح لفترة محددة
 * صافي الربح = إجمالي الربح الإجمالي - إجمالي المصروفات التشغيلية
 */
export const getNetProfit = (startDate?: Date, endDate?: Date): ProfitSummary => {
  const profitRecords = loadProfitRecords();
  const expenseRecords = loadExpenseRecords();
  
  // تصفية السجلات حسب الفترة
  const filteredProfits = startDate && endDate
    ? profitRecords.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= startDate && recordDate <= endDate;
      })
    : profitRecords;
  
  const filteredExpenses = startDate && endDate
    ? expenseRecords.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= startDate && recordDate <= endDate;
      })
    : expenseRecords;
  
  // حساب الإجماليات
  const totalSales = filteredProfits.reduce((sum, r) => addCurrency(sum, r.saleTotal), 0);
  const totalCOGS = filteredProfits.reduce((sum, r) => addCurrency(sum, r.cogs), 0);
  const totalGrossProfit = filteredProfits.reduce((sum, r) => addCurrency(sum, r.grossProfit), 0);
  const totalOperatingExpenses = filteredExpenses.reduce((sum, r) => addCurrency(sum, r.amount), 0);
  
  const netProfit = subtractCurrency(totalGrossProfit, totalOperatingExpenses);
  const profitMargin = totalSales > 0 ? roundCurrency((netProfit / totalSales) * 100) : 0;
  
  return {
    totalSales: roundCurrency(totalSales),
    totalCOGS: roundCurrency(totalCOGS),
    totalGrossProfit: roundCurrency(totalGrossProfit),
    totalOperatingExpenses: roundCurrency(totalOperatingExpenses),
    netProfit: roundCurrency(netProfit),
    profitMargin,
  };
};

/**
 * حساب أرباح اليوم
 */
export const getTodayProfit = (): ProfitSummary => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return getNetProfit(today, tomorrow);
};

/**
 * حساب أرباح الشهر الحالي
 */
export const getCurrentMonthProfit = (): ProfitSummary => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  return getNetProfit(startOfMonth, endOfMonth);
};

/**
 * الحصول على سجلات الأرباح لفترة محددة
 */
export const getProfitRecordsByDateRange = (startDate: Date, endDate: Date): ProfitRecord[] => {
  const records = loadProfitRecords();
  return records.filter(r => {
    const recordDate = new Date(r.date);
    return recordDate >= startDate && recordDate <= endDate;
  });
};

/**
 * الحصول على سجلات المصروفات لفترة محددة
 */
export const getExpenseRecordsByDateRange = (startDate: Date, endDate: Date): OperatingExpenseRecord[] => {
  const records = loadExpenseRecords();
  return records.filter(r => {
    const recordDate = new Date(r.date);
    return recordDate >= startDate && recordDate <= endDate;
  });
};

/**
 * إحصائيات الأرباح اليومية
 */
export const getDailyProfitStats = (days: number = 30): Array<{
  date: string;
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}> => {
  const profitRecords = loadProfitRecords();
  const expenseRecords = loadExpenseRecords();
  
  const stats: Record<string, {
    sales: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
  }> = {};
  
  // تجميع الأرباح
  profitRecords.forEach(r => {
    if (!stats[r.date]) {
      stats[r.date] = { sales: 0, cogs: 0, grossProfit: 0, expenses: 0 };
    }
    stats[r.date].sales = addCurrency(stats[r.date].sales, r.saleTotal);
    stats[r.date].cogs = addCurrency(stats[r.date].cogs, r.cogs);
    stats[r.date].grossProfit = addCurrency(stats[r.date].grossProfit, r.grossProfit);
  });
  
  // تجميع المصروفات
  expenseRecords.forEach(r => {
    if (!stats[r.date]) {
      stats[r.date] = { sales: 0, cogs: 0, grossProfit: 0, expenses: 0 };
    }
    stats[r.date].expenses = addCurrency(stats[r.date].expenses, r.amount);
  });
  
  // تحويل لمصفوفة وترتيب
  return Object.entries(stats)
    .map(([date, data]) => ({
      date,
      sales: roundCurrency(data.sales),
      cogs: roundCurrency(data.cogs),
      grossProfit: roundCurrency(data.grossProfit),
      expenses: roundCurrency(data.expenses),
      netProfit: roundCurrency(subtractCurrency(data.grossProfit, data.expenses)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);
};

/**
 * مسح جميع سجلات الأرباح (للتصفير)
 */
export const clearAllProfitRecords = (): void => {
  localStorage.removeItem(PROFIT_RECORDS_KEY);
  localStorage.removeItem(EXPENSE_RECORDS_KEY);
  emitEvent(EVENTS.PROFITS_UPDATED, []);
};
