/**
 * Cashbox Cloud Store - FlowPOS Pro
 * ==================================
 * مزامنة الورديات وحركات الصندوق إلى Supabase.
 * يعمل بشكل تكاملي مع cashbox-store المحلي (cache).
 */
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId, setCurrentUserId } from '../supabase-store';
import { addToSyncQueue } from '../sync-queue';
import { roundCurrency } from '../utils';

export type ShiftTxType =
  | 'sale'
  | 'deposit_capital'
  | 'deposit_revenue'
  | 'deposit_purchase_cover'
  | 'debt_payment'
  | 'expense'
  | 'refund'
  | 'writeoff'
  | 'withdrawal';

const ensureUserId = async (): Promise<string | null> => {
  let userId = getCurrentUserId();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
    if (userId) setCurrentUserId(userId);
  }
  return userId;
};

export interface CloudShift {
  id: string;
  user_id: string;
  cashier_id: string | null;
  cashier_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_balance: number;
  actual_balance: number | null;
  variance: number | null;
  variance_reason: string | null;
  reconciliation_status: 'open' | 'matched' | 'unmatched' | 'pending';
  notes: string | null;
}

export const openShiftCloud = async (params: {
  cashierId?: string | null;
  cashierName?: string | null;
  openingBalance: number;
}): Promise<string | null> => {
  const userId = await ensureUserId();
  if (!userId) return null;

  const payload = {
    user_id: userId,
    cashier_id: params.cashierId || null,
    cashier_name: params.cashierName || null,
    opening_balance: roundCurrency(params.openingBalance),
    expected_balance: roundCurrency(params.openingBalance),
    reconciliation_status: 'open' as const,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('cash_shifts')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (e) {
    console.warn('[cashbox-cloud] open shift failed, queued:', e);
    try { addToSyncQueue('shift_open', payload); } catch { /* noop */ }
    return null;
  }
};

export const closeShiftCloud = async (params: {
  shiftId: string;
  expectedBalance: number;
  actualBalance: number;
  varianceReason?: string;
}): Promise<boolean> => {
  const userId = await ensureUserId();
  if (!userId) return false;

  const variance = roundCurrency(params.actualBalance - params.expectedBalance);
  const status: CloudShift['reconciliation_status'] =
    Math.abs(variance) < 0.01 ? 'matched' : (params.varianceReason ? 'matched' : 'unmatched');

  const payload = {
    closed_at: new Date().toISOString(),
    expected_balance: roundCurrency(params.expectedBalance),
    actual_balance: roundCurrency(params.actualBalance),
    variance,
    variance_reason: params.varianceReason || null,
    reconciliation_status: status,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('cash_shifts')
      .update(payload)
      .eq('id', params.shiftId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[cashbox-cloud] close shift failed, queued:', e);
    try { addToSyncQueue('shift_close', { shiftId: params.shiftId, ...payload, userId }); } catch { /* noop */ }
    return false;
  }
};

export const addShiftTransactionCloud = async (params: {
  shiftId: string;
  type: ShiftTxType;
  amount: number;
  referenceId?: string;
  notes?: string;
}): Promise<boolean> => {
  const userId = await ensureUserId();
  if (!userId) return false;

  const payload = {
    shift_id: params.shiftId,
    user_id: userId,
    type: params.type,
    amount: roundCurrency(params.amount),
    reference_id: params.referenceId || null,
    notes: params.notes || null,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('shift_transactions').insert(payload);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[cashbox-cloud] tx insert failed, queued:', e);
    try { addToSyncQueue('shift_transaction', payload); } catch { /* noop */ }
    return false;
  }
};

export const loadCloudShifts = async (limit = 50): Promise<CloudShift[]> => {
  const userId = await ensureUserId();
  if (!userId) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('cash_shifts')
      .select('*')
      .eq('user_id', userId)
      .order('opened_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as CloudShift[];
  } catch {
    return [];
  }
};
