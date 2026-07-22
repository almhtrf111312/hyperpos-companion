import { supabase } from '@/integrations/supabase/client';

export interface StockDiscrepancy {
  product_id: string;
  product_name: string;
  warehouse_id: string | null;
  warehouse_name: string | null;
  expected_quantity: number;
  actual_quantity: number;
  variance: number;
  unit_cost: number;
  variance_value: number;
  last_movement_at: string | null;
}

export async function listStockDiscrepancies(): Promise<StockDiscrepancy[]> {
  const { data, error } = await supabase.rpc('get_stock_discrepancies');
  if (error) throw error;

  return (data || []).map(row => ({
    ...row,
    warehouse_id: row.warehouse_id || null,
    warehouse_name: row.warehouse_name || null,
    expected_quantity: Number(row.expected_quantity) || 0,
    actual_quantity: Number(row.actual_quantity) || 0,
    variance: Number(row.variance) || 0,
    unit_cost: Number(row.unit_cost) || 0,
    variance_value: Number(row.variance_value) || 0,
    last_movement_at: row.last_movement_at || null,
  }));
}