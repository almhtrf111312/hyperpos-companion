// Capital & Investment Tracking Store
import { emitEvent, EVENTS } from './events';
import { roundCurrency, addCurrency, subtractCurrency } from './utils';
import { loadPartners, savePartners, addCapital as addPartnerCapital } from './partners-store';
import { addDepositToShift } from './cashbox-store';

const CAPITAL_STORAGE_KEY = 'hyperpos_capital_v1';

export type TransactionType = 'initial_capital' | 'partner_investment' | 'reinvestment' | 'withdrawal' | 'adjustment';

export interface CapitalTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  partnerId?: string;
  partnerName?: string;
  description: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
  createdBy: string;
}

export interface CapitalState {
  initialCapital: number;
  currentCapital: number;
  totalInvestments: number;
  totalWithdrawals: number;
  transactions: CapitalTransaction[];
  lastUpdated: string;
}

// Load capital state
export const loadCapitalState = (): CapitalState => {
  try {
    const stored = localStorage.getItem(CAPITAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {
    initialCapital: 0,
    currentCapital: 0,
    totalInvestments: 0,
    totalWithdrawals: 0,
    transactions: [],
    lastUpdated: new Date().toISOString(),
  };
};

// Save capital state
export const saveCapitalState = (state: CapitalState): void => {
  try {
    localStorage.setItem(CAPITAL_STORAGE_KEY, JSON.stringify(state));
    emitEvent(EVENTS.CAPITAL_UPDATED, state);
  } catch {
    // ignore
  }
};

// Set initial capital
export const setInitialCapital = (
  amount: number,
  createdBy: string
): CapitalTransaction => {
  const state = loadCapitalState();
  const previousBalance = state.currentCapital;
  const newBalance = roundCurrency(amount);
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    type: 'initial_capital',
    amount: newBalance,
    description: 'تعيين رأس المال الأولي',
    previousBalance,
    newBalance,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  
  state.initialCapital = newBalance;
  state.currentCapital = newBalance;
  state.transactions.unshift(transaction);
  state.lastUpdated = new Date().toISOString();
  
  saveCapitalState(state);
  return transaction;
};

// Add partner investment
export const addPartnerInvestment = (
  partnerId: string,
  partnerName: string,
  amount: number,
  description: string,
  createdBy: string,
  addToCashbox: boolean = true
): CapitalTransaction => {
  const state = loadCapitalState();
  const previousBalance = state.currentCapital;
  const investmentAmount = roundCurrency(amount);
  const newBalance = addCurrency(previousBalance, investmentAmount);
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    type: 'partner_investment',
    amount: investmentAmount,
    partnerId,
    partnerName,
    description: description || `استثمار من ${partnerName}`,
    previousBalance,
    newBalance,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  
  state.currentCapital = newBalance;
  state.totalInvestments = addCurrency(state.totalInvestments, investmentAmount);
  state.transactions.unshift(transaction);
  state.lastUpdated = new Date().toISOString();
  
  saveCapitalState(state);
  
  // Update partner's capital
  addPartnerCapital(partnerId, investmentAmount, description);
  
  // Add to cashbox if active shift exists
  if (addToCashbox) {
    addDepositToShift(investmentAmount);
  }
  
  return transaction;
};

// Add reinvestment (profit reinvested as capital)
export const addReinvestment = (
  amount: number,
  description: string,
  createdBy: string
): CapitalTransaction => {
  const state = loadCapitalState();
  const previousBalance = state.currentCapital;
  const reinvestmentAmount = roundCurrency(amount);
  const newBalance = addCurrency(previousBalance, reinvestmentAmount);
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    type: 'reinvestment',
    amount: reinvestmentAmount,
    description: description || 'إعادة استثمار الأرباح',
    previousBalance,
    newBalance,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  
  state.currentCapital = newBalance;
  state.totalInvestments = addCurrency(state.totalInvestments, reinvestmentAmount);
  state.transactions.unshift(transaction);
  state.lastUpdated = new Date().toISOString();
  
  saveCapitalState(state);
  return transaction;
};

// Withdraw capital
export const withdrawCapital = (
  amount: number,
  description: string,
  createdBy: string,
  partnerId?: string,
  partnerName?: string
): CapitalTransaction | null => {
  const state = loadCapitalState();
  const previousBalance = state.currentCapital;
  const withdrawalAmount = roundCurrency(amount);
  
  if (withdrawalAmount > previousBalance) {
    return null; // Insufficient capital
  }
  
  const newBalance = subtractCurrency(previousBalance, withdrawalAmount);
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    type: 'withdrawal',
    amount: withdrawalAmount,
    partnerId,
    partnerName,
    description: description || 'سحب رأس مال',
    previousBalance,
    newBalance,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  
  state.currentCapital = newBalance;
  state.totalWithdrawals = addCurrency(state.totalWithdrawals, withdrawalAmount);
  state.transactions.unshift(transaction);
  state.lastUpdated = new Date().toISOString();
  
  saveCapitalState(state);
  return transaction;
};

// Make capital adjustment (for corrections)
export const adjustCapital = (
  amount: number, // Can be negative for decrease
  description: string,
  createdBy: string
): CapitalTransaction => {
  const state = loadCapitalState();
  const previousBalance = state.currentCapital;
  const adjustmentAmount = roundCurrency(amount);
  const newBalance = addCurrency(previousBalance, adjustmentAmount);
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    type: 'adjustment',
    amount: adjustmentAmount,
    description: description || 'تعديل رأس المال',
    previousBalance,
    newBalance,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  
  state.currentCapital = newBalance;
  state.transactions.unshift(transaction);
  state.lastUpdated = new Date().toISOString();
  
  saveCapitalState(state);
  return transaction;
};

// Get capital statistics
export const getCapitalStats = () => {
  const state = loadCapitalState();
  const partners = loadPartners();
  
  const totalPartnerCapital = partners.reduce((sum, p) => addCurrency(sum, p.currentCapital || 0), 0);
  
  return {
    initialCapital: state.initialCapital,
    currentCapital: state.currentCapital,
    totalInvestments: state.totalInvestments,
    totalWithdrawals: state.totalWithdrawals,
    totalPartnerCapital,
    capitalGrowth: subtractCurrency(state.currentCapital, state.initialCapital),
    transactionCount: state.transactions.length,
  };
};

// Get transactions by date range
export const getTransactionsByDateRange = (startDate: Date, endDate: Date): CapitalTransaction[] => {
  const state = loadCapitalState();
  return state.transactions.filter(t => {
    const transactionDate = new Date(t.createdAt);
    return transactionDate >= startDate && transactionDate <= endDate;
  });
};

// Get transactions by partner
export const getTransactionsByPartner = (partnerId: string): CapitalTransaction[] => {
  const state = loadCapitalState();
  return state.transactions.filter(t => t.partnerId === partnerId);
};
