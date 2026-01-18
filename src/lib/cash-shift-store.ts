import { emitEvent, EVENTS } from './events';
import { loadInvoices } from './invoices-store';
import { loadExpenses, addExpense } from './expenses-store';

const CASH_SHIFTS_STORAGE_KEY = 'hyperpos_cash_shifts_v1';

export interface CashShift {
  id: string;
  userId: string;
  userName: string;
  openingTime: string;
  closingTime?: string;
  openingCash: number;
  closingCash?: number;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
  actualCash?: number;
  discrepancy?: number;
  adjustmentExpenseId?: string;
  notes?: string;
  status: 'open' | 'closed';
}

export interface ShiftStatus {
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
}

// Load shifts from localStorage
export const loadShifts = (): CashShift[] => {
  try {
    const stored = localStorage.getItem(CASH_SHIFTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load cash shifts:', error);
  }
  return [];
};

// Save shifts to localStorage
export const saveShifts = (shifts: CashShift[]) => {
  try {
    localStorage.setItem(CASH_SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
    emitEvent(EVENTS.CASH_SHIFTS_UPDATED, shifts);
  } catch (error) {
    console.error('Failed to save cash shifts:', error);
  }
};

// Get currently open shift
export const getOpenShift = (): CashShift | null => {
  const shifts = loadShifts();
  return shifts.find(s => s.status === 'open') || null;
};

// Get shifts by user ID
export const getShiftsByUserId = (userId: string): CashShift[] => {
  const shifts = loadShifts();
  return shifts.filter(s => s.userId === userId);
};

// Start a new shift
export const startShift = (userId: string, userName: string, openingCash: number): CashShift => {
  const shifts = loadShifts();
  
  // Close any existing open shifts first
  const openShift = shifts.find(s => s.status === 'open');
  if (openShift) {
    openShift.status = 'closed';
    openShift.closingTime = new Date().toISOString();
    openShift.notes = 'تم الإغلاق تلقائياً عند فتح وردية جديدة';
  }
  
  const newShift: CashShift = {
    id: `SHIFT-${Date.now()}`,
    userId,
    userName,
    openingTime: new Date().toISOString(),
    openingCash,
    cashSales: 0,
    cashExpenses: 0,
    expectedCash: openingCash,
    status: 'open',
  };
  
  shifts.unshift(newShift);
  saveShifts(shifts);
  
  return newShift;
};

// Calculate real-time shift status from invoices and expenses
export const calculateShiftStatus = (shift: CashShift): ShiftStatus => {
  const invoices = loadInvoices();
  const expenses = loadExpenses();
  
  // Filter invoices during this shift (cash only)
  const shiftInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.createdAt);
    const shiftStart = new Date(shift.openingTime);
    const shiftEnd = shift.closingTime ? new Date(shift.closingTime) : new Date();
    
    return inv.paymentType === 'cash' && 
           invDate >= shiftStart && 
           invDate <= shiftEnd;
  });
  
  // Filter expenses during this shift (exclude cash adjustments from this shift)
  const shiftExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.createdAt);
    const shiftStart = new Date(shift.openingTime);
    const shiftEnd = shift.closingTime ? new Date(shift.closingTime) : new Date();
    
    // Exclude adjustment expenses linked to this shift
    if (exp.id === shift.adjustmentExpenseId) return false;
    
    return expDate >= shiftStart && expDate <= shiftEnd;
  });
  
  const cashSales = shiftInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const cashExpenses = shiftExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expectedCash = shift.openingCash + cashSales - cashExpenses;
  
  return {
    cashSales,
    cashExpenses,
    expectedCash,
  };
};

// Close a shift
export const closeShift = (
  shiftId: string, 
  closingCash: number, 
  createAdjustmentExpense: boolean = false
): CashShift | null => {
  const shifts = loadShifts();
  const shiftIndex = shifts.findIndex(s => s.id === shiftId);
  
  if (shiftIndex === -1) return null;
  
  const shift = shifts[shiftIndex];
  
  // Calculate final status
  const status = calculateShiftStatus(shift);
  const discrepancy = closingCash - status.expectedCash;
  
  // Update shift
  shift.closingTime = new Date().toISOString();
  shift.closingCash = closingCash;
  shift.cashSales = status.cashSales;
  shift.cashExpenses = status.cashExpenses;
  shift.expectedCash = status.expectedCash;
  shift.actualCash = closingCash;
  shift.discrepancy = discrepancy;
  shift.status = 'closed';
  
  // Create adjustment expense if there's a discrepancy and user requested it
  if (createAdjustmentExpense && discrepancy !== 0) {
    const adjustmentType = discrepancy > 0 ? 'فائض' : 'عجز';
    const expense = addExpense({
      type: 'cash_adjustment',
      customType: `تسوية صندوق - ${adjustmentType}`,
      amount: Math.abs(discrepancy),
      notes: `تسوية تلقائية للوردية ${shift.id} - ${adjustmentType}: ${Math.abs(discrepancy).toFixed(2)}`,
      date: new Date().toISOString().split('T')[0],
    });
    shift.adjustmentExpenseId = expense.id;
  }
  
  shifts[shiftIndex] = shift;
  saveShifts(shifts);
  
  return shift;
};

// Get shift statistics
export const getShiftStats = () => {
  const shifts = loadShifts();
  const today = new Date().toDateString();
  const todayShifts = shifts.filter(s => new Date(s.openingTime).toDateString() === today);
  const openShift = shifts.find(s => s.status === 'open');
  
  const totalDiscrepancy = shifts
    .filter(s => s.status === 'closed' && s.discrepancy !== undefined)
    .reduce((sum, s) => sum + (s.discrepancy || 0), 0);
  
  return {
    totalShifts: shifts.length,
    todayShifts: todayShifts.length,
    openShift,
    totalDiscrepancy,
  };
};

// Get shifts by date range
export const getShiftsByDateRange = (startDate: Date, endDate: Date): CashShift[] => {
  const shifts = loadShifts();
  return shifts.filter(s => {
    const shiftDate = new Date(s.openingTime);
    return shiftDate >= startDate && shiftDate <= endDate;
  });
};
