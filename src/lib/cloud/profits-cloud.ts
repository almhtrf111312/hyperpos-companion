/**
 * Profits Cloud Store - FlowPOS Pro
 * ==================================
 * مزامنة سجلات الأرباح إلى Supabase مع fallback لـ sync-queue عند انقطاع الاتصال.
 * يعمل بشكل تكاملي مع profits-store المحلي (cache).
 */
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId, setCurrentUserId } from '../supabase-store';
import { addToQueue } from '../sync-queue';
import { roundCurrency } from '../utils';

const ensureUserId = async (): Promise<string | null> => {
  let userId = getCurrentUserId();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
    if (userId) setCurrentUserId(userId);
  }
  return userId;
};

export interface CloudProfitInput {
  invoiceId: string;
  grossProfit: number;
  cogs: number;
  revenue: number;
  currency?: string;
}

/** تسجيل ربح إجمالي في السحابة. يفشل بصمت ويُضاف إلى الطابور إذا offline. */
export const addGrossProfitCloud = async (input: CloudProfitInput): Promise<boolean> => {
  const userId = await ensureUserId();
  if (!userId) return false;

  const payload = {
    user_id: userId,
    invoice_id: input.invoiceId,
    gross_profit: roundCurrency(input.grossProfit),
    cogs: roundCurrency(input.cogs),
    revenue: roundCurrency(input.revenue),
    currency: input.currency || 'USD',
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('profit_records').insert(payload);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[profits-cloud] insert failed, queued:', e);
    try { addToQueue('profit_record', payload); } catch { /* noop */ }
    return false;
  }
};

/** عكس ربح الفاتورة (للمرتجع/الحذف) - يضع is_reversed=true */
export const reverseProfitCloud = async (invoiceId: string): Promise<boolean> => {
  const userId = await ensureUserId();
  if (!userId) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profit_records')
      .update({ is_reversed: true, reversed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('invoice_id', invoiceId)
      .eq('is_reversed', false);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[profits-cloud] reverse failed, queued:', e);
    try { addToQueue('profit_reverse', { invoiceId, userId }); } catch { /* noop */ }
    return false;
  }
};
