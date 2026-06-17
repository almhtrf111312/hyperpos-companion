import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;
import { logActivity } from '@/lib/activity-log';

export interface StockCountItem {
  id?: string;
  count_id?: string;
  product_id: string;
  product_name?: string;
  expected_qty: number;
  actual_qty: number;
  variance: number;
  unit_cost: number;
  variance_value: number;
  notes?: string;
}

export interface StockCount {
  id: string;
  user_id: string;
  warehouse_id?: string | null;
  count_date: string;
  status: 'draft' | 'completed' | 'cancelled';
  notes?: string | null;
  counted_by?: string | null;
  counted_by_name?: string | null;
  total_variance_value: number;
  items_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

const ownerId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from('user_roles').select('owner_id').eq('user_id', user.id).maybeSingle();
  return data?.owner_id || user.id;
};

export async function listStockCounts(): Promise<StockCount[]> {
  const { data, error } = await sb
    .from('stock_counts').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { console.error(error); return []; }
  return (data || []) as StockCount[];
}

export async function getStockCountWithItems(id: string): Promise<{ count: StockCount; items: StockCountItem[] } | null> {
  const { data: count } = await sb.from('stock_counts').select('*').eq('id', id).maybeSingle();
  if (!count) return null;
  const { data: items } = await sb.from('stock_count_items').select('*').eq('count_id', id);
  return { count, items: (items || []) as StockCountItem[] };
}

export async function saveStockCount(params: {
  id?: string;
  warehouse_id?: string | null;
  notes?: string;
  status: 'draft' | 'completed';
  items: StockCountItem[];
  applyAdjustments?: boolean;
}): Promise<string | null> {
  const owner = await ownerId();
  if (!owner) return null;
  const { data: { user } } = await supabase.auth.getUser();

  const totalVariance = params.items.reduce((s, i) => s + (i.variance_value || 0), 0);

  let countId = params.id;
  if (!countId) {
    const { data, error } = await sb.from('stock_counts').insert({
      user_id: owner,
      warehouse_id: params.warehouse_id || null,
      status: params.status,
      notes: params.notes || null,
      counted_by: user?.id || null,
      counted_by_name: user?.email || null,
      total_variance_value: totalVariance,
      items_count: params.items.length,
      completed_at: params.status === 'completed' ? new Date().toISOString() : null,
    }).select('id').single();
    if (error) { console.error(error); return null; }
    countId = data.id;
  } else {
    await sb.from('stock_counts').update({
      status: params.status,
      notes: params.notes || null,
      total_variance_value: totalVariance,
      items_count: params.items.length,
      completed_at: params.status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', countId);
    await sb.from('stock_count_items').delete().eq('count_id', countId);
  }

  if (params.items.length > 0) {
    await sb.from('stock_count_items').insert(
      params.items.map(i => ({
        count_id: countId,
        product_id: i.product_id,
        product_name: i.product_name || null,
        expected_qty: i.expected_qty,
        actual_qty: i.actual_qty,
        variance: i.variance,
        unit_cost: i.unit_cost,
        variance_value: i.variance_value,
        notes: i.notes || null,
      }))
    );
  }

  // Apply adjustments + create damage records for negative variance
  if (params.status === 'completed' && params.applyAdjustments) {
    for (const it of params.items) {
      if (it.variance === 0) continue;
      await sb.from('products').update({
        quantity: it.actual_qty
      }).eq('id', it.product_id);

      if (it.variance < 0) {
        const lostQty = Math.abs(it.variance);
        await sb.from('stock_damages').insert({
          user_id: owner,
          product_id: it.product_id,
          product_name: it.product_name || null,
          warehouse_id: params.warehouse_id || null,
          quantity: lostQty,
          unit_cost: it.unit_cost,
          cost_value: lostQty * it.unit_cost,
          reason: 'نقص جرد',
          source: 'stock_count',
          source_ref: countId,
          recorded_by: user?.id || null,
          recorded_by_name: user?.email || null,
        });
      }
    }
  }

  logActivity('settings_changed' as never, `جرد فعلي - ${params.items.length} صنف، فروقات: ${totalVariance.toFixed(2)}`, {
    entityType: 'stock_count', entityId: countId, totalVariance, status: params.status
  });

  return countId || null;
}

export async function deleteStockCount(id: string): Promise<boolean> {
  const { error } = await sb.from('stock_counts').delete().eq('id', id);
  return !error;
}
