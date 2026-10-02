// ✅ مفاتيح التخزين المحلي مرتبطة بـ userId لمنع تداخل بيانات الورديات
// عند تبديل الكاشير على نفس الجهاز — كل مستخدم لديه قسم عزل خاص به.
// SECURITY FIX: الثابتة القديمة كانت hyperpos_cashbox_v1 / hyperpos_shifts_v1
// ولم تتضمن userId مما يتسبب في مسح ورديات الكاشير الأول عند تسجيل دخول آخر.
import { getCurrentUserId } from './supabase-store';
import { emitEvent, EVENTS } from './events';
import { roundCurrency, addCurrency, subtractCurrency } from './utils';

// المفاتيح القديمة (للتوافق مع البيانات المخزنة سابقاً — تُقرأ كـ fallback)
const LEGACY_CASHBOX_KEY = 'hyperpos_cashbox_v1';
const LEGACY_SHIFTS_KEY = 'hyperpos_shifts_v1';

// مفاتيح ديناميكية مرتبطة بـ userId
const getCashboxKey = () => {
  const uid = getCurrentUserId();
  return uid ? `hyperpos_cashbox_u_${uid}` : LEGACY_CASHBOX_KEY;
};
const getShiftsKey = () => {
  const uid = getCurrentUserId();
  return uid ? `hyperpos_shifts_u_${uid}` : LEGACY_SHIFTS_KEY;
};

export type AdjustmentType = 'surplus' | 'shortage';

export interface CashboxAdjustment {
  id: string;
  type: AdjustmentType;
  amount: number;
  notes?: string;
  createdAt: string;
}

export type ShiftAdjustmentType = 'expense_added' | 'income_added';

export interface ShiftAdjustment {
  id: string;
  type: ShiftAdjustmentType;
  amount: number;
  reason: string;
  createdAt: string;
}

export type ShiftCurrency = 'USD' | 'TRY' | 'SYP';

export interface CurrencyShiftTotals {
  opening: number;
  sales: number;
  expenses: number;
  deposits: number;
  withdrawals: number;
  closing?: number;
  expected?: number;
  discrepancy?: number;
}

export type ShiftCurrenciesMap = Record<ShiftCurrency, CurrencyShiftTotals>;

export interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  discrepancy?: number;
  adjustment?: CashboxAdjustment;
  adjustments?: ShiftAdjustment[];
  userId: string;
  userName: string;
  status: 'open' | 'closed';
  salesTotal: number;
  expensesTotal: number;
  depositsTotal: number;
  withdrawalsTotal: number;
  // ✅ حقول جديدة لتتبع COGS والربح الإجمالي
  cogsTotal: number;             // إجمالي تكلفة البضاعة المباعة
  grossProfitTotal: number;      // إجمالي الربح الإجمالي (المبيعات - التكلفة)
  // ✅ تفصيل النقدية بالوردية حسب العملة
  currencies?: ShiftCurrenciesMap;
}

export interface CashboxState {
  currentBalance: number;
  activeShiftId?: string;
  lastUpdated: string;
}


// Load cashbox state — tries user-scoped key first, then legacy key (backwards compat)
export const loadCashboxState = (): CashboxState => {
  try {
    const userKey = getCashboxKey();
    const stored = localStorage.getItem(userKey)
      || (userKey !== LEGACY_CASHBOX_KEY ? localStorage.getItem(LEGACY_CASHBOX_KEY) : null);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {
    currentBalance: 0,
    lastUpdated: new Date().toISOString(),
  };
};

// Save cashbox state — always writes to user-scoped key
export const saveCashboxState = (state: CashboxState): void => {
  try {
    localStorage.setItem(getCashboxKey(), JSON.stringify(state));
    emitEvent(EVENTS.CASHBOX_UPDATED, state);
  } catch {
    // ignore
  }
};

// Load all shifts — tries user-scoped key first, then legacy key (backwards compat)
export const loadShifts = (): Shift[] => {
  try {
    const userKey = getShiftsKey();
    const stored = localStorage.getItem(userKey)
      || (userKey !== LEGACY_SHIFTS_KEY ? localStorage.getItem(LEGACY_SHIFTS_KEY) : null);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return [];
};

// Save shifts — always writes to user-scoped key
export const saveShifts = (shifts: Shift[]): void => {
  try {
    localStorage.setItem(getShiftsKey(), JSON.stringify(shifts));
    emitEvent(EVENTS.SHIFTS_UPDATED, shifts);
  } catch {
    // ignore
  }
};

// Get active shift
export const getActiveShift = (): Shift | null => {
  const shifts = loadShifts();
  return shifts.find(s => s.status === 'open') || null;
};

// Helper to initialize multi-currency shift totals
export const initShiftCurrencies = (
  openingUSD: number = 0,
  currencyOpenings?: { USD?: number; TRY?: number; SYP?: number }
): ShiftCurrenciesMap => ({
  USD: {
    opening: roundCurrency(currencyOpenings?.USD ?? openingUSD),
    sales: 0,
    expenses: 0,
    deposits: 0,
    withdrawals: 0,
  },
  TRY: {
    opening: roundCurrency(currencyOpenings?.TRY ?? 0),
    sales: 0,
    expenses: 0,
    deposits: 0,
    withdrawals: 0,
  },
  SYP: {
    opening: roundCurrency(currencyOpenings?.SYP ?? 0),
    sales: 0,
    expenses: 0,
    deposits: 0,
    withdrawals: 0,
  },
});

// Open a new shift
export const openShift = (
  openingCash: number,
  userId: string,
  userName: string,
  currencyOpenings?: { USD?: number; TRY?: number; SYP?: number }
): Shift => {
  const shifts = loadShifts();

  // Close any existing open shifts first
  const openShifts = shifts.filter(s => s.status === 'open');
  openShifts.forEach(shift => {
    shift.status = 'closed';
    shift.closedAt = new Date().toISOString();
  });

  const newShift: Shift = {
    id: Date.now().toString(),
    openedAt: new Date().toISOString(),
    openingCash: roundCurrency(openingCash),
    userId,
    userName,
    status: 'open',
    salesTotal: 0,
    expensesTotal: 0,
    depositsTotal: 0,
    withdrawalsTotal: 0,
    cogsTotal: 0,           // ✅ جديد
    grossProfitTotal: 0,    // ✅ جديد
    currencies: initShiftCurrencies(openingCash, currencyOpenings),
  };

  shifts.unshift(newShift);
  saveShifts(shifts);

  // Update cashbox state
  const state = loadCashboxState();
  state.activeShiftId = newShift.id;
  state.currentBalance = roundCurrency(openingCash);
  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);

  return newShift;
};

// Close the current shift
export const closeShift = (
  closingCash: number,
  notes?: string,
  currencyCounts?: { USD?: number; TRY?: number; SYP?: number }
): { shift: Shift; discrepancy: number } | null => {
  const shifts = loadShifts();
  const activeIndex = shifts.findIndex(s => s.status === 'open');

  if (activeIndex === -1) return null;

  const shift = shifts[activeIndex];
  const expectedCash = roundCurrency(
    addCurrency(
      shift.openingCash,
      shift.salesTotal,
      shift.depositsTotal
    ) - addCurrency(shift.expensesTotal, shift.withdrawalsTotal)
  );

  const discrepancy = roundCurrency(closingCash - expectedCash);

  // Multi-currency calculation on shift close
  if (!shift.currencies) {
    shift.currencies = initShiftCurrencies(shift.openingCash);
  }

  (['USD', 'TRY', 'SYP'] as const).forEach(code => {
    const c = shift.currencies![code];
    if (c) {
      c.expected = roundCurrency(c.opening + c.sales + c.deposits - c.expenses - c.withdrawals);
      if (currencyCounts && currencyCounts[code] !== undefined) {
        c.closing = roundCurrency(currencyCounts[code]!);
        c.discrepancy = roundCurrency(c.closing - c.expected);
      }
    }
  });

  shift.closedAt = new Date().toISOString();
  shift.closingCash = roundCurrency(closingCash);
  shift.expectedCash = expectedCash;
  shift.discrepancy = discrepancy;
  shift.status = 'closed';

  // Create adjustment if there's a discrepancy
  if (discrepancy !== 0) {
    shift.adjustment = {
      id: Date.now().toString(),
      type: discrepancy > 0 ? 'surplus' : 'shortage',
      amount: Math.abs(discrepancy),
      notes,
      createdAt: new Date().toISOString(),
    };
  }

  shifts[activeIndex] = shift;
  saveShifts(shifts);

  // Update cashbox state
  const state = loadCashboxState();
  state.activeShiftId = undefined;
  state.currentBalance = roundCurrency(closingCash);
  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);

  return { shift, discrepancy };
};

/**
 * ✅ دالة جديدة: تحديث رصيد الصندوق بغض النظر عن الوردية
 * هذه الدالة تعمل دائماً حتى بدون وردية مفتوحة
 */
export const updateCashboxBalance = (
  amount: number,
  type: 'deposit' | 'withdrawal' | 'sale' | 'expense' | 'refund',
  currency: ShiftCurrency = 'USD',
  currencyAmount?: number
): void => {
  const roundedAmount = roundCurrency(amount);
  const roundedCurrAmount = currencyAmount !== undefined ? roundCurrency(currencyAmount) : roundedAmount;
  const state = loadCashboxState();

  // تحديث رصيد الصندوق (بالدولار الأساسي)
  if (type === 'deposit' || type === 'sale') {
    state.currentBalance = addCurrency(state.currentBalance, roundedAmount);
  } else {
    // withdrawal, expense, refund
    state.currentBalance = subtractCurrency(state.currentBalance, roundedAmount);
  }

  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);

  // إذا كانت هناك وردية نشطة، حدّثها أيضاً
  const shifts = loadShifts();
  const activeIndex = shifts.findIndex(s => s.status === 'open');
  if (activeIndex !== -1) {
    const shift = shifts[activeIndex];
    if (!shift.currencies) {
      shift.currencies = initShiftCurrencies(shift.openingCash);
    }
    const currMap = shift.currencies[currency] || { opening: 0, sales: 0, expenses: 0, deposits: 0, withdrawals: 0 };

    switch (type) {
      case 'sale':
        shift.salesTotal = addCurrency(shift.salesTotal, roundedAmount);
        currMap.sales = addCurrency(currMap.sales, roundedCurrAmount);
        break;
      case 'refund':
        shift.salesTotal = Math.max(0, subtractCurrency(shift.salesTotal, roundedAmount));
        currMap.sales = Math.max(0, subtractCurrency(currMap.sales, roundedCurrAmount));
        break;
      case 'expense':
        shift.expensesTotal = addCurrency(shift.expensesTotal, roundedAmount);
        currMap.expenses = addCurrency(currMap.expenses, roundedCurrAmount);
        break;
      case 'deposit':
        shift.depositsTotal = addCurrency(shift.depositsTotal, roundedAmount);
        currMap.deposits = addCurrency(currMap.deposits, roundedCurrAmount);
        break;
      case 'withdrawal':
        shift.withdrawalsTotal = addCurrency(shift.withdrawalsTotal, roundedAmount);
        currMap.withdrawals = addCurrency(currMap.withdrawals, roundedCurrAmount);
        break;
    }
    shift.currencies[currency] = currMap;
    saveShifts(shifts);
    emitEvent(EVENTS.CASH_SHIFTS_UPDATED, shifts);
  }
};

/**
 * Add sales to current shift مع بيانات الربح والعملة
 * ✅ يعمل بدون وردية الآن، ويسجل COGS والربح الإجمالي وتفصيل العملات
 */
export const addSalesToShift = (
  amount: number,
  grossProfit: number = 0,
  cogs: number = 0,
  currency: ShiftCurrency = 'USD',
  currencyAmount?: number
): void => {
  const roundedAmount = roundCurrency(amount);
  const roundedProfit = roundCurrency(grossProfit);
  const roundedCogs = roundCurrency(cogs);
  const roundedCurrAmount = currencyAmount !== undefined ? roundCurrency(currencyAmount) : roundedAmount;

  const state = loadCashboxState();

  // تحديث رصيد الصندوق
  state.currentBalance = addCurrency(state.currentBalance, roundedAmount);
  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);

  // إذا كانت هناك وردية نشطة، حدّثها أيضاً
  const shifts = loadShifts();
  const activeIndex = shifts.findIndex(s => s.status === 'open');
  if (activeIndex !== -1) {
    const shift = shifts[activeIndex];
    if (!shift.currencies) {
      shift.currencies = initShiftCurrencies(shift.openingCash);
    }
    const currMap = shift.currencies[currency] || { opening: 0, sales: 0, expenses: 0, deposits: 0, withdrawals: 0 };
    currMap.sales = addCurrency(currMap.sales, roundedCurrAmount);
    shift.currencies[currency] = currMap;

    shift.salesTotal = addCurrency(shift.salesTotal, roundedAmount);
    shift.grossProfitTotal = addCurrency(shift.grossProfitTotal || 0, roundedProfit);
    shift.cogsTotal = addCurrency(shift.cogsTotal || 0, roundedCogs);
    saveShifts(shifts);
    emitEvent(EVENTS.CASH_SHIFTS_UPDATED, shifts);
  }
};

/**
 * ✅ تسجيل مرتجع نقدي وخصمه من الوردية النشطة ورصيد الصندوق
 * يمنع العجز الوهمي في درج الكاشير عند تسليم أموال المرتجع للعميل
 */
export const recordRefundInShift = (
  amount: number,
  grossProfit: number = 0,
  cogs: number = 0,
  invoiceNumber?: string,
  currency: ShiftCurrency = 'USD',
  currencyAmount?: number
): void => {
  if (amount <= 0) return;
  const roundedAmount = roundCurrency(amount);
  const roundedProfit = roundCurrency(grossProfit);
  const roundedCogs = roundCurrency(cogs);
  const roundedCurrAmount = currencyAmount !== undefined ? roundCurrency(currencyAmount) : roundedAmount;

  const state = loadCashboxState();
  state.currentBalance = subtractCurrency(state.currentBalance, roundedAmount);
  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);

  const shifts = loadShifts();
  const activeIndex = shifts.findIndex(s => s.status === 'open');
  if (activeIndex !== -1) {
    const shift = shifts[activeIndex];
    if (!shift.currencies) {
      shift.currencies = initShiftCurrencies(shift.openingCash);
    }
    const currMap = shift.currencies[currency] || { opening: 0, sales: 0, expenses: 0, deposits: 0, withdrawals: 0 };
    currMap.sales = Math.max(0, subtractCurrency(currMap.sales, roundedCurrAmount));
    shift.currencies[currency] = currMap;

    shifts[activeIndex].salesTotal = Math.max(0, subtractCurrency(shifts[activeIndex].salesTotal, roundedAmount));
    shifts[activeIndex].grossProfitTotal = Math.max(0, subtractCurrency(shifts[activeIndex].grossProfitTotal || 0, roundedProfit));
    shifts[activeIndex].cogsTotal = Math.max(0, subtractCurrency(shifts[activeIndex].cogsTotal || 0, roundedCogs));
    saveShifts(shifts);
    emitEvent(EVENTS.CASH_SHIFTS_UPDATED, shifts);

    // تسجيل حركة الوردية سحابياً إن أمكن
    try {
      import('./cloud/cashbox-cloud').then(({ addShiftTransactionCloud }) => {
        addShiftTransactionCloud({
          shiftId: shifts[activeIndex].id,
          type: 'refund',
          amount: roundedAmount,
          referenceId: invoiceNumber,
          notes: invoiceNumber ? `مرتجع فاتورة ${invoiceNumber}` : 'مرتجع نقدي',
        }).catch(() => {});
      }).catch(() => {});
    } catch { /* noop */ }
  }
};

// Add expenses to current shift (يعمل بدون وردية الآن)
export const addExpensesToShift = (amount: number, currency: ShiftCurrency = 'USD', currencyAmount?: number): void => {
  updateCashboxBalance(amount, 'expense', currency, currencyAmount);
};

// Add deposit to current shift (partner capital, etc.) - يعمل بدون وردية الآن
export const addDepositToShift = (amount: number, currency: ShiftCurrency = 'USD', currencyAmount?: number): void => {
  updateCashboxBalance(amount, 'deposit', currency, currencyAmount);
};

// Add withdrawal from current shift (يعمل بدون وردية الآن)
export const addWithdrawalFromShift = (amount: number, currency: ShiftCurrency = 'USD', currencyAmount?: number): void => {
  updateCashboxBalance(amount, 'withdrawal', currency, currencyAmount);
};

// Get shift statistics
export const getShiftStats = () => {
  const shifts = loadShifts();
  const today = new Date().toDateString();
  const todayShifts = shifts.filter(s => new Date(s.openedAt).toDateString() === today);

  return {
    totalShifts: shifts.length,
    todayShifts: todayShifts.length,
    activeShift: getActiveShift(),
    totalSurplus: shifts.reduce((sum, s) =>
      s.adjustment?.type === 'surplus' ? addCurrency(sum, s.adjustment.amount) : sum, 0),
    totalShortage: shifts.reduce((sum, s) =>
      s.adjustment?.type === 'shortage' ? addCurrency(sum, s.adjustment.amount) : sum, 0),
  };
};

// Get shifts by date range
export const getShiftsByDateRange = (startDate: Date, endDate: Date): Shift[] => {
  const shifts = loadShifts();
  return shifts.filter(s => {
    const shiftDate = new Date(s.openedAt);
    return shiftDate >= startDate && shiftDate <= endDate;
  });
};

/**
 * Calculate real-time shift status from invoices and expenses
 * Migrated from cash-shift-store.ts
 */
export const calculateShiftStatus = (shift: Shift): {
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
} => {
  return {
    cashSales: shift.salesTotal || 0,
    cashExpenses: shift.expensesTotal || 0,
    expectedCash: shift.openingCash + (shift.salesTotal || 0) - (shift.expensesTotal || 0)
  };
};

/**
 * تسجيل تعديل على الوردية النشطة لتسوية الفارق
 * expense_added = عجز → يُضاف كمصروف
 * income_added = فائض → يُضاف كإيراد
 */
export const addShiftAdjustment = (
  type: ShiftAdjustmentType,
  amount: number,
  reason: string
): boolean => {
  const shifts = loadShifts();
  const activeIndex = shifts.findIndex(s => s.status === 'open');
  if (activeIndex === -1) return false;

  const roundedAmount = roundCurrency(amount);
  const shift = shifts[activeIndex];

  // إنشاء سجل التعديل
  const adjustment: ShiftAdjustment = {
    id: Date.now().toString(),
    type,
    amount: roundedAmount,
    reason,
    createdAt: new Date().toISOString(),
  };

  // إضافة للمصفوفة
  if (!shift.adjustments) shift.adjustments = [];
  shift.adjustments.push(adjustment);

  // تعديل المجاميع
  if (type === 'expense_added') {
    // عجز → نضيف للمصاريف حتى ينخفض المتوقع
    shift.expensesTotal = addCurrency(shift.expensesTotal, roundedAmount);
  } else {
    // فائض → نضيف للمبيعات/إيداعات حتى يرتفع المتوقع
    shift.depositsTotal = addCurrency(shift.depositsTotal, roundedAmount);
  }

  shifts[activeIndex] = shift;
  saveShifts(shifts);

  // تحديث رصيد الصندوق أيضاً
  const state = loadCashboxState();
  if (type === 'expense_added') {
    state.currentBalance = subtractCurrency(state.currentBalance, roundedAmount);
  } else {
    state.currentBalance = addCurrency(state.currentBalance, roundedAmount);
  }
  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);

  return true;
};
