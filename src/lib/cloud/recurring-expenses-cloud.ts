// Cloud Recurring Expenses Store - Supabase-backed recurring expenses management
import { 
  fetchFromSupabase, 
  getOwnerIdForInsert,
  getCurrentUserId 
} from '../supabase-store';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitEvent, EVENTS } from '../events';
import { addToQueue } from '../sync-queue';
import { toLocalDateString } from '../date-utils';
import type { ExpenseType } from './expenses-cloud';
import { 
  type RecurringInterval, 
  type RecurringExpense, 
  recurringIntervals 
} from '../recurring-expenses-store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;

export const RECURRING_EXPENSES_KEY = 'hyperpos_recurring_expenses_v1';

// Local storage cache helpers
export const saveRecurringExpensesLocally = (expenses: RecurringExpense[]) => {
  try {
    localStorage.setItem(RECURRING_EXPENSES_KEY, JSON.stringify(expenses));
  } catch { /* ignore */ }
};

export const loadRecurringExpensesLocally = (): RecurringExpense[] => {
  try {
    const stored = localStorage.getItem(RECURRING_EXPENSES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return [];
};

// Transform Supabase row to RecurringExpense
export function toRecurringExpense(row: any): RecurringExpense {
  return {
    id: row.id,
    name: row.name || row.description || 'مصروف ثابت',
    type: (row.expense_type as ExpenseType) || 'other',
    customType: row.custom_type || undefined,
    amount: Number(row.amount) || 0,
    currency: row.currency || (typeof row.notes === 'string' ? row.notes.match(/\[CURRENCY:([A-Za-z]+)(?::([0-9.]+))?\]/)?.[1] : undefined),
    exchangeRate: row.exchange_rate ? Number(row.exchange_rate) : (typeof row.notes === 'string' && row.notes.match(/\[CURRENCY:([A-Za-z]+)(?::([0-9.]+))?\]/)?.[2] ? Number(row.notes.match(/\[CURRENCY:([A-Za-z]+)(?::([0-9.]+))?\]/)[2]) : undefined),
    notes: row.notes || undefined,
    interval: (row.interval as RecurringInterval) || 'monthly',
    intervalDays: Number(row.interval_days) || 30,
    nextDueDate: row.next_due_date ? String(row.next_due_date).split('T')[0] : new Date().toISOString().split('T')[0],
    lastPaidDate: row.last_paid_date ? String(row.last_paid_date).split('T')[0] : undefined,
    autoPay: !!row.auto_pay,
    isActive: row.is_active !== false,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// Memory Cache
let recurringCache: RecurringExpense[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

export const invalidateRecurringExpensesCache = () => {
  recurringCache = null;
  cacheTimestamp = 0;
};

// Fresh fetch from Supabase
const fetchFresh_loadRecurringExpensesCloud = async (): Promise<RecurringExpense[]> => {
  const ownerId = await getOwnerIdForInsert();
  const currentUid = getCurrentUserId();
  if (!ownerId && !currentUid) return loadRecurringExpensesLocally();

  if (recurringCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return recurringCache;
  }

  // Offline: return local cache
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const local = loadRecurringExpensesLocally();
    recurringCache = local;
    cacheTimestamp = Date.now();
    return local;
  }

  let cloudRows: any[] = [];
  try {
    const effectiveOwner = ownerId || currentUid;
    // Query directly with user_id filter
    const { data, error } = await sb
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', effectiveOwner)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[RecurringExpenses] Filtered select error, falling back to RLS fetch:', error);
      cloudRows = await fetchFromSupabase('recurring_expenses', { column: 'created_at', ascending: false });
    } else {
      cloudRows = data || [];
    }
  } catch (err) {
    console.warn('[RecurringExpenses] Exception fetching from cloud, falling back to RLS:', err);
    cloudRows = await fetchFromSupabase('recurring_expenses', { column: 'created_at', ascending: false });
  }

  // If cloud returns rows, map and cache
  if (cloudRows && cloudRows.length > 0) {
    const mapped = cloudRows.map(toRecurringExpense);
    const local = loadRecurringExpensesLocally();
    const todayStr = new Date().toISOString().split('T')[0];
    const localTodayStr = toLocalDateString(new Date());

    // حماية: إذا كان السجل المحلي مدفوعاً اليوم والسحابة لم تلحق بالتحديث بعد، نحافظ على السداد المحلي
    const merged = mapped.map(cloudItem => {
      const localItem = local.find(l => l.id === cloudItem.id);
      const isPaidTodayLocally = !!(localItem && (localItem.lastPaidDate === todayStr || localItem.lastPaidDate === localTodayStr));
      const isPaidTodayCloud = cloudItem.lastPaidDate === todayStr || cloudItem.lastPaidDate === localTodayStr;
      if (isPaidTodayLocally && !isPaidTodayCloud) {
        return {
          ...cloudItem,
          lastPaidDate: localItem.lastPaidDate,
          nextDueDate: localItem.nextDueDate,
        };
      }
      return cloudItem;
    });

    recurringCache = merged;
    cacheTimestamp = Date.now();
    saveRecurringExpensesLocally(merged);
    return merged;
  }

  // If cloud is empty, check if we have local unmigrated rows
  const local = loadRecurringExpensesLocally();
  if (local.length > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
    // If cloud had 0 rows but local has rows, migrate them to cloud!
    console.log('[RecurringExpenses] Local cache has unmigrated items, syncing to cloud...');
    const effectiveOwner = ownerId || currentUid;
    for (const item of local) {
      const payload = {
        id: item.id.startsWith('REC-') ? crypto.randomUUID() : item.id,
        user_id: effectiveOwner,
        name: item.name,
        description: item.name,
        expense_type: item.type,
        custom_type: item.customType || null,
        amount: item.amount,
        interval: item.interval,
        interval_days: item.intervalDays,
        next_due_date: item.nextDueDate,
        last_paid_date: item.lastPaidDate || null,
        auto_pay: item.autoPay ?? false,
        notes: item.notes || null,
        is_active: item.isActive,
        created_at: item.createdAt || new Date().toISOString(),
      };
      sb.from('recurring_expenses').upsert(payload, { onConflict: 'id', ignoreDuplicates: true }).then(() => {});
    }
    recurringCache = local;
    cacheTimestamp = Date.now();
    return local;
  }

  recurringCache = [];
  cacheTimestamp = Date.now();
  saveRecurringExpensesLocally([]);
  return [];
};

// Local-first boot: returns saved copy instantly on first load, then refreshes in background
let bootServed_loadRecurringExpensesCloud = false;
export const loadRecurringExpensesCloud = async (): Promise<RecurringExpense[]> => {
  if (!bootServed_loadRecurringExpensesCloud) {
    bootServed_loadRecurringExpensesCloud = true;
    const local = loadRecurringExpensesLocally();
    if (local && local.length > 0 && getCurrentUserId()) {
      recurringCache = local;
      cacheTimestamp = Date.now();
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setTimeout(() => {
          recurringCache = null;
          cacheTimestamp = 0;
          fetchFresh_loadRecurringExpensesCloud()
            .then(data => emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, data))
            .catch(() => {});
        }, 0);
      }
      return local;
    }
  }
  return fetchFresh_loadRecurringExpensesCloud();
};

// Add recurring expense
export const addRecurringExpenseCloud = async (data: {
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
}): Promise<RecurringExpense> => {
  const ownerId = await getOwnerIdForInsert();
  const currentUid = getCurrentUserId() || ownerId || '';
  const nowIso = new Date().toISOString();
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
    createdAt: nowIso,
  };

  let cloudNotes = data.notes || null;
  if (data.currency && data.currency !== 'USD') {
    const tag = `[CURRENCY:${data.currency}:${data.exchangeRate || 1}]`;
    if (!cloudNotes?.includes('[CURRENCY:')) {
      cloudNotes = cloudNotes ? `${cloudNotes} ${tag}` : tag;
    }
  }

  const payload = {
    id: newId,
    user_id: ownerId || currentUid,
    name: data.name,
    description: data.name,
    expense_type: data.type,
    custom_type: data.customType || null,
    amount: data.amount,
    interval: intervalInfo.interval,
    interval_days: data.intervalDays,
    next_due_date: data.startDate,
    auto_pay: data.autoPay ?? false,
    notes: cloudNotes,
    is_active: true,
    created_at: nowIso,
  };

  // 1. Local update
  const localList = loadRecurringExpensesLocally();
  const updatedList = [newExpense, ...localList.filter(e => e.id !== newId)];
  recurringCache = updatedList;
  cacheTimestamp = Date.now();
  saveRecurringExpensesLocally(updatedList);
  emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, updatedList);

  // 2. Offline fallback
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addToQueue('recurring_expense_create', payload, 10);
    return newExpense;
  }

  // 3. Cloud insert
  try {
    const { error } = await sb.from('recurring_expenses').insert(payload);
    if (error) {
      console.warn('[addRecurringExpenseCloud] Supabase insert failed, queueing offline:', error);
      addToQueue('recurring_expense_create', payload, 10);
    }
  } catch (err) {
    console.warn('[addRecurringExpenseCloud] Exception, queueing offline:', err);
    addToQueue('recurring_expense_create', payload, 10);
  }

  return newExpense;
};

// Update recurring expense
export const updateRecurringExpenseCloud = async (
  id: string,
  updates: Partial<RecurringExpense>
): Promise<boolean> => {
  const localList = loadRecurringExpensesLocally();
  const index = localList.findIndex(e => e.id === id);
  if (index === -1) return false;

  const existing = localList[index];
  const updatedItem: RecurringExpense = { ...existing, ...updates };
  localList[index] = updatedItem;
  recurringCache = localList;
  cacheTimestamp = Date.now();
  saveRecurringExpensesLocally(localList);
  emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, localList);

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) {
    payload.name = updates.name;
    payload.description = updates.name;
  }
  if (updates.type !== undefined) payload.expense_type = updates.type;
  if (updates.customType !== undefined) payload.custom_type = updates.customType;
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.interval !== undefined) payload.interval = updates.interval;
  if (updates.intervalDays !== undefined) payload.interval_days = updates.intervalDays;
  if (updates.nextDueDate !== undefined) payload.next_due_date = updates.nextDueDate;
  if (updates.lastPaidDate !== undefined) payload.last_paid_date = updates.lastPaidDate;
  if (updates.autoPay !== undefined) payload.auto_pay = updates.autoPay;
  if (updates.notes !== undefined || updates.currency !== undefined || updates.exchangeRate !== undefined) {
    let baseNotes = updates.notes !== undefined ? updates.notes : (existing.notes || '');
    baseNotes = baseNotes?.replace(/\s*\[CURRENCY:[^\]]+\]/g, '').trim() || '';
    const effectiveCurr = updates.currency || existing.currency;
    const effectiveRate = updates.exchangeRate || existing.exchangeRate || 1;
    if (effectiveCurr && effectiveCurr !== 'USD') {
      payload.notes = baseNotes ? `${baseNotes} [CURRENCY:${effectiveCurr}:${effectiveRate}]` : `[CURRENCY:${effectiveCurr}:${effectiveRate}]`;
    } else {
      payload.notes = baseNotes || null;
    }
  }
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  payload.updated_at = new Date().toISOString();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addToQueue('recurring_expense_update', { id, ...payload }, 10);
    return true;
  }

  try {
    const { error } = await sb.from('recurring_expenses').update(payload).eq('id', id);
    if (error) {
      console.warn('[updateRecurringExpenseCloud] Supabase update failed, queueing offline:', error);
      addToQueue('recurring_expense_update', { id, ...payload }, 10);
    }
  } catch (err) {
    console.warn('[updateRecurringExpenseCloud] Exception, queueing offline:', err);
    addToQueue('recurring_expense_update', { id, ...payload }, 10);
  }

  return true;
};

// Delete recurring expense
export const deleteRecurringExpenseCloud = async (id: string): Promise<boolean> => {
  const localList = loadRecurringExpensesLocally();
  const filtered = localList.filter(e => e.id !== id);
  if (filtered.length === localList.length) return false;

  recurringCache = filtered;
  cacheTimestamp = Date.now();
  saveRecurringExpensesLocally(filtered);
  emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, filtered);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addToQueue('recurring_expense_delete', { id }, 10);
    return true;
  }

  try {
    const { error } = await sb.from('recurring_expenses').delete().eq('id', id);
    if (error) {
      console.warn('[deleteRecurringExpenseCloud] Supabase delete failed, queueing offline:', error);
      addToQueue('recurring_expense_delete', { id }, 10);
    }
  } catch (err) {
    console.warn('[deleteRecurringExpenseCloud] Exception, queueing offline:', err);
    addToQueue('recurring_expense_delete', { id }, 10);
  }

  return true;
};
