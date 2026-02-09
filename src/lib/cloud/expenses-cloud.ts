// Cloud Expenses Store - Supabase-backed expenses management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  deleteFromSupabase,
  getCurrentUserId,
  isCashierUser
} from '../supabase-store';
import { supabase } from '@/integrations/supabase/client';
import { emitEvent, EVENTS } from '../events';
import { loadPartnersCloud, updatePartnerCloud } from './partners-cloud';
import { saveToOfflineCache, loadFromOfflineCache } from '../offline-cache';

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

// Cache
let expensesCache: Expense[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

// Load expenses - cashiers see only their expenses, owners see all
export const loadExpensesCloud = async (): Promise<Expense[]> => {
  const userId = getCurrentUserId();
  if (!userId) {
    const cached = loadFromOfflineCache<Expense[]>('expenses');
    if (cached) return cached;
    return [];
  }

  if (expensesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return expensesCache;
  }

  try {
    const isCashier = await isCashierUser();
    
    let cloudExpenses: (CloudExpense & { cashier_name?: string })[];
    
    if (isCashier) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
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
      cloudExpenses = await fetchFromSupabase<CloudExpense>('expenses', {
        column: 'created_at',
        ascending: false,
      });
    }

    // Fetch cashier names
    const cashierIds = [...new Set(cloudExpenses.filter(e => e.cashier_id).map(e => e.cashier_id!))];
    if (cashierIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = await (supabase as any)
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
    
    saveToOfflineCache('expenses', expensesCache);
    
    return expensesCache;
  } catch (error) {
    console.error('[ExpensesCloud] Failed to fetch:', error);
    const cached = loadFromOfflineCache<Expense[]>('expenses');
    if (cached) return cached;
    if (expensesCache) return expensesCache;
    return [];
  }
};

export const invalidateExpensesCache = () => {
  expensesCache = null;
  cacheTimestamp = 0;
};

// Add expense
export const addExpenseCloud = async (expenseData: {
  type: ExpenseType;
  customType?: string;
  amount: number;
  notes?: string;
  date: string;
}): Promise<Expense | null> => {
  const partners = await loadPartnersCloud();
  const distributions: ExpenseDistribution[] = [];
  
  // Get partners who share expenses
  const expensePartners = partners.filter(p => p.sharesExpenses);
  
  if (expensePartners.length > 0) {
    const totalExpenseShare = expensePartners.reduce((sum, p) => 
      sum + (p.expenseSharePercentage ?? p.sharePercentage), 0);
    
    for (const partner of expensePartners) {
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
        await updatePartnerCloud(partner.id, {
          currentBalance: partner.currentBalance - partnerAmount,
          expenseHistory: [...partner.expenseHistory, {
            expenseId: `EXP-${Date.now()}`,
            type: getExpenseTypeLabel(expenseData.type),
            amount: partnerAmount,
            date: expenseData.date,
            notes: expenseData.notes,
            createdAt: new Date().toISOString(),
          }],
        });
      }
    }
  }
  
  const userId = getCurrentUserId();
  
  const inserted = await insertToSupabase<CloudExpense>('expenses', {
    expense_type: expenseData.type,
    amount: expenseData.amount,
    description: expenseData.customType || null,
    date: expenseData.date,
    notes: expenseData.notes || null,
    distributions,
    cashier_id: userId, // ✅ Track which user created this expense
  });
  
  if (inserted) {
    invalidateExpensesCache();
    emitEvent(EVENTS.EXPENSES_UPDATED, null);
    return toExpense(inserted);
  }
  
  return null;
};

// Delete expense
export const deleteExpenseCloud = async (id: string): Promise<boolean> => {
  const expenses = await loadExpensesCloud();
  const expense = expenses.find(e => e.id === id);
  
  if (!expense) return false;

  // حفظ نسخة في سلة المحذوفات
  try {
    const { addToTrash } = await import('../trash-store');
    addToTrash('expense', `${expense.typeLabel} - ${expense.amount}`, expense as unknown as Record<string, unknown>);
  } catch (e) {
    console.warn('[deleteExpenseCloud] Failed to save to trash:', e);
  }
  
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
