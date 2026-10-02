// Cloud Expenses Store - Supabase-backed expenses management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  deleteFromSupabase,
  getCurrentUserId,
  isCashierUser
} from '../supabase-store';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;
import { emitEvent, EVENTS } from '../events';
import { addToQueue } from '../sync-queue';
import { triggerAutoBackup } from '../local-auto-backup';
import { loadPartnersCloud, updatePartnerCloud } from './partners-cloud';

export type ExpenseCategory = 'operational' | 'payroll' | 'utilities' | 'maintenance' | 'marketing' | 'other';
export type ExpenseType = 'rent' | 'utilities' | 'wages' | 'equipment' | 'internet' | 'electricity' | 'water' | 'gas' | 'phone' | 'insurance' | 'taxes' | 'supplies' | 'marketing' | 'transport' | 'maintenance' | 'cash_adjustment' | 'other';

export interface ExpenseDistribution {
  partnerId: string;
  partnerName: string;
  amount: number;
  percentage: number;
}

export interface CloudExpense {
  id: string;
  user_id: string;
  cashier_id: string | null; // ✅ Track which cashier created this
  expense_type: string;
  amount: number;
  description: string | null;
  date: string;
  notes: string | null;
  distributions: ExpenseDistribution[];
  created_at: string;
}

export interface Expense {
  id: string;
  type: ExpenseType;
  typeLabel: string;
  category: ExpenseCategory;
  customType?: string;
  amount: number;
  notes?: string;
  date: string;
  month: string;
  distributions: ExpenseDistribution[];
  createdAt: string;
  cashierId?: string;
  cashierName?: string;
}

// Expense types with labels
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

// Cache for cashier names
const cashierNamesCache: Record<string, string> = {};

// Transform cloud to legacy
function toExpense(cloud: CloudExpense & { cashier_name?: string }): Expense {
  const type = cloud.expense_type as ExpenseType;
  return {
    id: cloud.id,
    type,
    typeLabel: getExpenseTypeLabel(type),
    category: getExpenseCategory(type),
    amount: Number(cloud.amount) || 0,
    notes: cloud.notes || undefined,
    date: cloud.date,
    month: cloud.date.substring(0, 7),
    distributions: cloud.distributions || [],
    createdAt: cloud.created_at,
    cashierId: cloud.cashier_id || undefined,
    cashierName: cloud.cashier_name || cashierNamesCache[cloud.cashier_id || ''] || undefined,
  };
}

// Local storage cache helpers
const LOCAL_CACHE_KEY = 'hyperpos_expenses_cache';

const saveExpensesLocally = (expenses: Expense[]) => {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(expenses));
  } catch { /* ignore */ }
};

const loadExpensesLocally = (): Expense[] | null => {
  try {
    const data = localStorage.getItem(LOCAL_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

// Cache
let expensesCache: Expense[] | null = null;
let cacheTimestamp = 0;
let cacheUserId: string | null = null; // Track which user this cache belongs to
const CACHE_TTL = 30000;

// Load expenses - cashiers see only their expenses, owners see all
const fetchFresh_loadExpensesCloud = async (): Promise<Expense[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // Verify cache belongs to current user and is still fresh
  if (expensesCache && cacheUserId === userId && Date.now() - cacheTimestamp < CACHE_TTL) {
    return expensesCache;
  }

  // Offline: return local cache
  if (!navigator.onLine) {
    const local = loadExpensesLocally();
    if (local) {
      expensesCache = local;
      cacheTimestamp = Date.now();
      cacheUserId = userId;
      return local;
    }
    return [];
  }

  // Check if user is cashier for filtering
  const isCashier = await isCashierUser();
  
  let cloudExpenses: (CloudExpense & { cashier_name?: string })[];
  
  if (isCashier) {
    // Cashiers see only their own expenses
    const { data, error } = await sb
      .from('expenses')
      .select('*')
      .eq('cashier_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching cashier expenses:', error);
      cloudExpenses = [];
    } else {
      cloudExpenses = data || [];
    }
  } else {
    // Owners see all expenses (via RLS)
    cloudExpenses = await fetchFromSupabase<CloudExpense>('expenses', {
      column: 'created_at',
      ascending: false,
    });
  }

  // Fetch cashier names for expenses with cashier_id
  const cashierIds = [...new Set(cloudExpenses.filter(e => e.cashier_id).map(e => e.cashier_id!))];
  if (cashierIds.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', cashierIds);
    
    if (profiles) {
      const nameMap: Record<string, string> = {};
      profiles.forEach((p: { user_id: string; full_name: string }) => {
        nameMap[p.user_id] = p.full_name;
        cashierNamesCache[p.user_id] = p.full_name;
      });
      
      cloudExpenses = cloudExpenses.map(e => ({
        ...e,
        cashier_name: e.cashier_id ? nameMap[e.cashier_id] : undefined,
      }));
    }
  }

  expensesCache = cloudExpenses.map(toExpense);
  cacheTimestamp = Date.now();
  cacheUserId = userId;
  saveExpensesLocally(expensesCache);
  
  return expensesCache;
};


// Local-first boot: first load after app start shows the saved copy instantly, refreshes silently
let bootServed_loadExpensesCloud = false;
export const loadExpensesCloud = async (): Promise<Expense[]> => {
  const userId = getCurrentUserId();
  
  if (!bootServed_loadExpensesCloud) {
    bootServed_loadExpensesCloud = true;
    const local = loadExpensesLocally();
    if (local && local.length > 0 && userId) {
      expensesCache = local; 
      cacheTimestamp = Date.now();
      cacheUserId = userId;
      if (navigator.onLine) {
        setTimeout(() => {
          expensesCache = null; 
          cacheTimestamp = 0;
          cacheUserId = null;
          fetchFresh_loadExpensesCloud().then(() => emitEvent(EVENTS.EXPENSES_UPDATED, null)).catch(() => {});
        }, 0);
      }
      return local;
    }
  }
  return fetchFresh_loadExpensesCloud();
};

export const invalidateExpensesCache = () => {
  expensesCache = null;
  cacheTimestamp = 0;
  cacheUserId = null;
  bootServed_loadExpensesCloud = false;
};

// Add expense
export const addExpenseCloud = async (expenseData: {
  type: ExpenseType;
  customType?: string;
  amount: number;
  notes?: string;
  date: string;
}): Promise<Expense | null> => {
  // Server does expense + partner shares together, idempotent by operation UUID.
  const operationId = crypto.randomUUID();
  const payload = {
    _operation_id: operationId,
    _expense_type: expenseData.type,
    _amount: Math.round(expenseData.amount * 100) / 100,
    _description: expenseData.customType || null,
    _date: expenseData.date,
    _notes: expenseData.notes || null,
  };
  const nowIso = new Date().toISOString();
  const localExpense = toExpense({
    id: operationId, user_id: '', expense_type: expenseData.type, amount: payload._amount,
    description: payload._description, date: expenseData.date, notes: payload._notes,
    distributions: [], created_at: nowIso, cashier_id: getCurrentUserId(),
  } as unknown as CloudExpense);

  const queueIt = () => {
    addToQueue('expense_atomic', payload, 10);
    const list = [localExpense, ...(expensesCache || loadExpensesLocally() || [])];
    expensesCache = list; 
    cacheTimestamp = Date.now(); 
    cacheUserId = getCurrentUserId();
    saveExpensesLocally(list);
    emitEvent(EVENTS.EXPENSES_UPDATED, null);
    return localExpense;
  };

  if (!navigator.onLine) return queueIt();

  const { error } = await sb.rpc('add_expense_atomic', payload);
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('fetch') || msg.includes('network')) return queueIt();
    console.error('[addExpenseCloud] failed:', error);
    return null;
  }
  invalidateExpensesCache();
  emitEvent(EVENTS.EXPENSES_UPDATED, null);
  emitEvent(EVENTS.PARTNERS_UPDATED, null);
  triggerAutoBackup(`مصروف جديد: ${expenseData.type}`);
  return localExpense;
};

// Delete expense
export const deleteExpenseCloud = async (id: string): Promise<boolean> => {
  const expenses = await loadExpensesCloud();
  const expense = expenses.find(e => e.id === id);
  
  if (!expense) return false;
  
  // Refund partners
  if (expense.distributions.length > 0) {
    const partners = await loadPartnersCloud();
    
    for (const dist of expense.distributions) {
      const partner = partners.find(p => p.id === dist.partnerId);
      if (partner) {
        await updatePartnerCloud(partner.id, {
          currentBalance: partner.currentBalance + dist.amount,
          expenseHistory: partner.expenseHistory.filter(e => e.expenseId !== id),
        });
      }
    }
  }
  
  const success = await deleteFromSupabase('expenses', id);
  
  if (success) {
    invalidateExpensesCache();
    emitEvent(EVENTS.EXPENSES_UPDATED, null);
  }
  
  return success;
};

// Get expense stats
export const getExpenseStatsCloud = async () => {
  const expenses = await loadExpensesCloud();
  const currentMonth = new Date().toISOString().substring(0, 7);
  
  const monthlyExpenses = expenses.filter(e => e.month === currentMonth);
  const totalThisMonth = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  
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
