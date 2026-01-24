// Cash Box (الصندوق) Store - Daily Shift Management & Reconciliation
import { emitEvent, EVENTS } from './events';
import { roundCurrency, addCurrency, subtractCurrency } from './utils';

const CASHBOX_STORAGE_KEY = 'hyperpos_cashbox_v1';
const SHIFTS_STORAGE_KEY = 'hyperpos_shifts_v1';

export type AdjustmentType = 'surplus' | 'shortage';

export interface CashboxAdjustment {
  id: string;
  type: AdjustmentType;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  discrepancy?: number;
  adjustment?: CashboxAdjustment;
  userId: string;
  userName: string;
  status: 'open' | 'closed';
  salesTotal: number;
  expensesTotal: number;
  depositsTotal: number;
  withdrawalsTotal: number;
}

export interface CashboxState {
  currentBalance: number;
  activeShiftId?: string;
  lastUpdated: string;
}

// Load cashbox state
export const loadCashboxState = (): CashboxState => {
  try {
    const stored = localStorage.getItem(CASHBOX_STORAGE_KEY);
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

// Save cashbox state
export const saveCashboxState = (state: CashboxState): void => {
  try {
    localStorage.setItem(CASHBOX_STORAGE_KEY, JSON.stringify(state));
    emitEvent(EVENTS.CASHBOX_UPDATED, state);
  } catch {
    // ignore
  }
};

// Load all shifts
export const loadShifts = (): Shift[] => {
  try {
    const stored = localStorage.getItem(SHIFTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return [];
};

// Save shifts
export const saveShifts = (shifts: Shift[]): void => {
  try {
    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
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

// Open a new shift
export const openShift = (
  openingCash: number,
  userId: string,
  userName: string
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
  notes?: string
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
  type: 'deposit' | 'withdrawal' | 'sale' | 'expense'
): void => {
  const roundedAmount = roundCurrency(amount);
  const state = loadCashboxState();
  
  // تحديث رصيد الصندوق
  if (type === 'deposit' || type === 'sale') {
    state.currentBalance = addCurrency(state.currentBalance, roundedAmount);
  } else {
    state.currentBalance = subtractCurrency(state.currentBalance, roundedAmount);
  }
  
  state.lastUpdated = new Date().toISOString();
  saveCashboxState(state);
  
  // إذا كانت هناك وردية نشطة، حدّثها أيضاً
  const shifts = loadShifts();
  const activeIndex = shifts.findIndex(s => s.status === 'open');
  if (activeIndex !== -1) {
    switch (type) {
      case 'sale':
        shifts[activeIndex].salesTotal = addCurrency(shifts[activeIndex].salesTotal, roundedAmount);
        break;
      case 'expense':
        shifts[activeIndex].expensesTotal = addCurrency(shifts[activeIndex].expensesTotal, roundedAmount);
        break;
      case 'deposit':
        shifts[activeIndex].depositsTotal = addCurrency(shifts[activeIndex].depositsTotal, roundedAmount);
        break;
      case 'withdrawal':
        shifts[activeIndex].withdrawalsTotal = addCurrency(shifts[activeIndex].withdrawalsTotal, roundedAmount);
        break;
    }
    saveShifts(shifts);
  }
};

// Add sales to current shift (يعمل بدون وردية الآن)
export const addSalesToShift = (amount: number): void => {
  updateCashboxBalance(amount, 'sale');
};

// Add expenses to current shift (يعمل بدون وردية الآن)
export const addExpensesToShift = (amount: number): void => {
  updateCashboxBalance(amount, 'expense');
};

// Add deposit to current shift (partner capital, etc.) - يعمل بدون وردية الآن
export const addDepositToShift = (amount: number): void => {
  updateCashboxBalance(amount, 'deposit');
};

// Add withdrawal from current shift (يعمل بدون وردية الآن)
export const addWithdrawalFromShift = (amount: number): void => {
  updateCashboxBalance(amount, 'withdrawal');
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
