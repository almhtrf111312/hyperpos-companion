import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;
import { logActivity } from '@/lib/activity-log';

export interface StockDamage {
  id: string;
  user_id: string;
  product_id: string;
  product_name?: string | null;
  warehouse_id?: string | null;
  quantity: number;
  unit_cost: number;
  cost_value: number;
  reason?: string | null;
  notes?: string | null;
  damaged_at: string;
  recorded_by?: string | null;
  recorded_by_name?: string | null;
  source?: string | null;
  source_ref?: string | null;
  created_at: string;
}

export async function listStockDamages(opts?: { from?: string; to?: string; productId?: string }): Promise<StockDamage[]> {
  let q = sb.from('stock_damages').select('*').order('damaged_at', { ascending: false }).limit(500);
  if (opts?.from) q = q.gte('damaged_at', opts.from);
  if (opts?.to) q = q.lte('damaged_at', opts.to);
  if (opts?.productId) q = q.eq('product_id', opts.productId);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return (data || []) as StockDamage[];
}

export async function recordDamage(params: {
  product_id: string;
  product_name?: string;
  warehouse_id?: string | null;
  quantity: number;
  unit_cost: number;
  reason?: string;
  notes?: string;
  applyToStock?: boolean;
}): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: roleRow } = await sb
    .from('user_roles').select('owner_id').eq('user_id', user.id).maybeSingle();
  const owner = roleRow?.owner_id || user.id;

  const cost_value = params.quantity * params.unit_cost;

  const { error } = await sb.from('stock_damages').insert({
    user_id: owner,
    product_id: params.product_id,
    product_name: params.product_name || null,
    warehouse_id: params.warehouse_id || null,
    quantity: params.quantity,
    unit_cost: params.unit_cost,
    cost_value,
    reason: params.reason || null,
    notes: params.notes || null,
    recorded_by: user.id,
    recorded_by_name: user.email || null,
    source: 'manual',
  });
  if (error) { console.error(error); return false; }

  if (params.applyToStock) {
    await sb.rpc('deduct_product_quantity', {
      _product_id: params.product_id,
      _amount: params.quantity,
    });
  }

  logActivity('product_updated' as never, `إتلاف ${params.quantity} من ${params.product_name || ''}`, {
    entityType: 'stock_damage', entityId: params.product_id, quantity: params.quantity, cost_value
  });

  return true;
}
