// Cloud Warehouses Store - Supabase-backed warehouse management
import {
  fetchFromSupabase,
  insertToSupabase,
  updateInSupabase,
  deleteFromSupabase,
  getCurrentUserId
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';

export interface Warehouse {
  id: string;
  user_id: string;
  name: string;
  type: 'main' | 'vehicle';
  assigned_cashier_id: string | null;
  address: string | null;
  phone: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseStock {
  id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  quantity_bulk: number;
  last_updated: string;
}

export interface StockTransfer {
  id: string;
  user_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_number: string;
  status: 'pending' | 'completed' | 'cancelled';
  transfer_type: 'outgoing' | 'return';
  notes: string | null;
  transferred_by: string | null;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  unit: 'piece' | 'bulk';
  quantity_in_pieces: number;
}

// Local storage cache helpers
const LOCAL_CACHE_KEY = 'hyperpos_warehouses_cache';

const saveWarehousesLocally = (warehouses: Warehouse[]) => {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(warehouses));
  } catch { /* ignore */ }
};

const loadWarehousesLocally = (): Warehouse[] | null => {
  try {
    const data = localStorage.getItem(LOCAL_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

const saveWarehouseStockLocally = (warehouseId: string, stock: WarehouseStock[]) => {
  try {
    localStorage.setItem(`hyperpos_warehouse_stock_cache_${warehouseId}`, JSON.stringify(stock));
  } catch { /* ignore */ }
};

const loadWarehouseStockLocally = (warehouseId: string): WarehouseStock[] | null => {
  try {
    const data = localStorage.getItem(`hyperpos_warehouse_stock_cache_${warehouseId}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

// Cache for warehouses
let warehousesCache: Warehouse[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

// Load all warehouses
export const loadWarehousesCloud = async (): Promise<Warehouse[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  if (warehousesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return warehousesCache;
  }

  // Offline: return local cache
  if (!navigator.onLine) {
    const local = loadWarehousesLocally();
    if (local) {
      warehousesCache = local;
      cacheTimestamp = Date.now();
      return local;
    }
    return [];
  }

  const warehouses = await fetchFromSupabase<Warehouse>('warehouses', {
    column: 'created_at',
    ascending: true
  });

  warehousesCache = warehouses;
  cacheTimestamp = Date.now();
  saveWarehousesLocally(warehouses);

  return warehousesCache;
};

// Invalidate cache
export const invalidateWarehousesCache = () => {
  warehousesCache = null;
  cacheTimestamp = 0;
};

// Get main warehouse
export const getMainWarehouseCloud = async (): Promise<Warehouse | null> => {
  const warehouses = await loadWarehousesCloud();
  return warehouses.find(w => w.type === 'main' && w.is_default) ||
    warehouses.find(w => w.type === 'main') ||
    null;
};

// Get warehouse for cashier
export const getWarehouseForCashierCloud = async (cashierId: string): Promise<Warehouse | null> => {
  const warehouses = await loadWarehousesCloud();
  return warehouses.find(w => w.assigned_cashier_id === cashierId) || null;
};

// Add warehouse
export const addWarehouseCloud = async (data: Omit<Warehouse, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Warehouse | null> => {
  const inserted = await insertToSupabase<Warehouse>('warehouses', data);

  if (inserted) {
    invalidateWarehousesCache();
    emitEvent(EVENTS.WAREHOUSES_UPDATED, null);
    return inserted;
  }

  return null;
};

// Update warehouse
export const updateWarehouseCloud = async (id: string, data: Partial<Warehouse>): Promise<boolean> => {
  const success = await updateInSupabase('warehouses', id, data);

  if (success) {
    invalidateWarehousesCache();
    emitEvent(EVENTS.WAREHOUSES_UPDATED, null);
  }

  return success;
};

// Delete warehouse
export const deleteWarehouseCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('warehouses', id);

  if (success) {
    invalidateWarehousesCache();
    emitEvent(EVENTS.WAREHOUSES_UPDATED, null);
  }

  return success;
};

// ==================== Warehouse Stock ====================

// Load stock for a warehouse
export const loadWarehouseStockCloud = async (warehouseId: string): Promise<WarehouseStock[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // Offline: return local cache
  if (!navigator.onLine) {
    const local = loadWarehouseStockLocally(warehouseId);
    if (local) return local;
    return [];
  }

  const { supabase } = await import('@/integrations/supabase/client');

  const { data, error } = await supabase
    .from('warehouse_stock')
    .select('*')
    .eq('warehouse_id', warehouseId);

  if (error) {
    console.error('[WarehouseStock] Load error:', error);
    return [];
  }

  const stock = (data || []) as WarehouseStock[];
  saveWarehouseStockLocally(warehouseId, stock);
  return stock;
};

// Update stock for a product in warehouse
export const updateWarehouseStockCloud = async (
  warehouseId: string,
  productId: string,
  quantity: number,
  quantityBulk: number = 0
): Promise<boolean> => {
  const { supabase } = await import('@/integrations/supabase/client');

  // Upsert stock record
  const { error } = await supabase
    .from('warehouse_stock')
    .upsert({
      warehouse_id: warehouseId,
      product_id: productId,
      quantity,
      quantity_bulk: quantityBulk,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'warehouse_id,product_id'
    });

  if (error) {
    console.error('[WarehouseStock] Update error:', error);
    return false;
  }

  return true;
};

// Deduct stock from warehouse with validation
export const deductWarehouseStockCloud = async (
  warehouseId: string,
  productId: string,
  quantity: number
): Promise<{ success: boolean; error?: string; available?: number }> => {
  const { supabase } = await import('@/integrations/supabase/client');

  // Get current stock
  const { data: currentStock, error: fetchError } = await supabase
    .from('warehouse_stock')
    .select('quantity')
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId)
    .maybeSingle();

  if (fetchError) {
    console.error('[WarehouseStock] Fetch error:', fetchError);
    return { success: false, error: 'خطأ في جلب المخزون' };
  }

  const available = currentStock?.quantity || 0;

  // ✅ التحقق من توفر الكمية الكافية - منع البيع بالسالب
  if (available < quantity) {
    console.warn(`[WarehouseStock] Insufficient stock: available=${available}, requested=${quantity}`);
    return {
      success: false,
      error: `الكمية المطلوبة (${quantity}) غير متوفرة - المتاح في المستودع: ${available}`,
      available
    };
  }

  const newQuantity = available - quantity;

  const { error: updateError } = await supabase
    .from('warehouse_stock')
    .upsert({
      warehouse_id: warehouseId,
      product_id: productId,
      quantity: newQuantity,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'warehouse_id,product_id'
    });

  if (updateError) {
    console.error('[WarehouseStock] Update error:', updateError);
    return { success: false, error: 'خطأ في تحديث المخزون' };
  }

  return { success: true };
};

// Batch deduct stock from warehouse (for POS sales) with validation
export const deductWarehouseStockBatchCloud = async (
  warehouseId: string,
  items: { productId: string; quantity: number; productName?: string }[]
): Promise<{
  success: boolean;
  deducted: number;
  failed: number;
  insufficientItems?: Array<{ productName: string; available: number; requested: number }>;
}> => {
  let deducted = 0;
  let failed = 0;
  const insufficientItems: Array<{ productName: string; available: number; requested: number }> = [];

  for (const item of items) {
    const result = await deductWarehouseStockCloud(warehouseId, item.productId, item.quantity);
    if (result.success) {
      deducted++;
    } else {
      failed++;
      if (result.available !== undefined) {
        insufficientItems.push({
          productName: item.productName || item.productId,
          available: result.available,
          requested: item.quantity
        });
      }
    }
  }

  return {
    success: failed === 0,
    deducted,
    failed,
    insufficientItems: insufficientItems.length > 0 ? insufficientItems : undefined
  };
};

// Check warehouse stock availability (for POS validation)
export const checkWarehouseStockAvailability = async (
  warehouseId: string,
  items: { productId: string; quantity: number; productName?: string }[]
): Promise<{
  success: boolean;
  insufficientItems: Array<{ productName: string; available: number; requested: number }>
}> => {
  const stock = await loadWarehouseStockCloud(warehouseId);
  const insufficientItems: Array<{ productName: string; available: number; requested: number }> = [];

  for (const item of items) {
    const stockItem = stock.find(s => s.product_id === item.productId);
    const available = stockItem?.quantity || 0;

    if (available < item.quantity) {
      insufficientItems.push({
        productName: item.productName || item.productId,
        available,
        requested: item.quantity
      });
    }
  }

  return { success: insufficientItems.length === 0, insufficientItems };
};

// ==================== Stock Transfers ====================

// Generate transfer number
const generateTransferNumber = (type: 'outgoing' | 'return' = 'outgoing'): string => {
  const prefix = type === 'return' ? 'RTN' : 'TRF';
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${dateStr}-${random}`;
};

// Load all transfers
export const loadStockTransfersCloud = async (): Promise<StockTransfer[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // Offline: return local cache
  if (!navigator.onLine) {
    try {
      const data = localStorage.getItem('hyperpos_stock_transfers_cache');
      if (data) return JSON.parse(data);
    } catch { /* ignore */ }
    return [];
  }

  const transfers = await fetchFromSupabase<StockTransfer>('stock_transfers', {
    column: 'created_at',
    ascending: false
  });

  try {
    localStorage.setItem('hyperpos_stock_transfers_cache', JSON.stringify(transfers));
  } catch { /* ignore */ }

  return transfers;
};

// Create stock transfer
export const createStockTransferCloud = async (
  fromWarehouseId: string,
  toWarehouseId: string,
  items: { productId: string; quantity: number; unit: 'piece' | 'bulk'; quantityInPieces: number }[],
  notes?: string
): Promise<StockTransfer | null> => {
  const { supabase } = await import('@/integrations/supabase/client');
  const userId = getCurrentUserId();
  if (!userId) return null;

  // Create transfer record
  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .insert({
      user_id: userId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      transfer_number: generateTransferNumber('outgoing'),
      transfer_type: 'outgoing' as string,
      status: 'pending',
      notes
    })
    .select()
    .single();

  if (transferError || !transfer) {
    console.error('[StockTransfer] Create error:', transferError);
    return null;
  }

  // Add transfer items
  const itemsToInsert = items.map(item => ({
    transfer_id: transfer.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit: item.unit,
    quantity_in_pieces: item.quantityInPieces
  }));

  const { error: itemsError } = await supabase
    .from('stock_transfer_items')
    .insert(itemsToInsert);

  if (itemsError) {
    console.error('[StockTransfer] Items error:', itemsError);
    // Rollback transfer
    await supabase.from('stock_transfers').delete().eq('id', transfer.id);
    return null;
  }

  return transfer as StockTransfer;
};

// Complete stock transfer
// ✅ يخصم من products.quantity (المخزون الرئيسي) ويضيف لمخزون المستودع الوجهة
export const completeStockTransferCloud = async (transferId: string): Promise<boolean> => {
  const { supabase } = await import('@/integrations/supabase/client');
  const userId = getCurrentUserId();
  if (!userId) return false;

  // Get transfer with items
  const { data: transfer, error: fetchError } = await supabase
    .from('stock_transfers')
    .select('*, stock_transfer_items(*)')
    .eq('id', transferId)
    .single();

  if (fetchError || !transfer) {
    console.error('[StockTransfer] Fetch error:', fetchError);
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (transfer as any).stock_transfer_items as StockTransferItem[];

  // ✅ معالجة كل منتج: خصم من المخزون الرئيسي وإضافة لمستودع الوجهة
  for (const item of items) {
    // 1. خصم من products.quantity (المخزون الرئيسي/العام) - عملية ذرية
    const { error: deductError } = await supabase
      .rpc('deduct_product_quantity', {
        _product_id: item.product_id,
        _amount: item.quantity_in_pieces
      });

    if (deductError) {
      console.error('[StockTransfer] Atomic deduct error:', deductError);
      continue;
    }

    // 2. إضافة للمستودع الوجهة (warehouse_stock)
    const { data: destStock } = await supabase
      .from('warehouse_stock')
      .select('quantity')
      .eq('warehouse_id', transfer.to_warehouse_id)
      .eq('product_id', item.product_id)
      .maybeSingle();

    await updateWarehouseStockCloud(
      transfer.to_warehouse_id,
      item.product_id,
      (destStock?.quantity || 0) + item.quantity_in_pieces
    );
  }

  // Update transfer status
  const { error: updateError } = await supabase
    .from('stock_transfers')
    .update({
      status: 'completed',
      transferred_by: userId,
      transferred_at: new Date().toISOString()
    })
    .eq('id', transferId);

  if (updateError) {
    console.error('[StockTransfer] Complete error:', updateError);
    return false;
  }

  // Invalidate products cache to reflect new quantities
  const { invalidateProductsCache } = await import('./products-cloud');
  invalidateProductsCache();
  
  emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  emitEvent(EVENTS.WAREHOUSES_UPDATED, null);
  return true;
};

// Get transfer items
export const getStockTransferItemsCloud = async (transferId: string): Promise<StockTransferItem[]> => {
  const { supabase } = await import('@/integrations/supabase/client');

  const { data, error } = await supabase
    .from('stock_transfer_items')
    .select('*')
    .eq('transfer_id', transferId);

  if (error) {
    console.error('[StockTransfer] Get items error:', error);
    return [];
  }

  return (data || []) as StockTransferItem[];
};

// Cancel transfer
export const cancelStockTransferCloud = async (transferId: string): Promise<boolean> => {
  const { supabase } = await import('@/integrations/supabase/client');

  const { error } = await supabase
    .from('stock_transfers')
    .update({ status: 'cancelled' })
    .eq('id', transferId);

  if (error) {
    console.error('[StockTransfer] Cancel error:', error);
    return false;
  }

  return true;
};

// Fetch all warehouse stocks (for backup)
export const fetchAllWarehouseStocksCloud = async (): Promise<WarehouseStock[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const { supabase } = await import('@/integrations/supabase/client');

  const { data, error } = await supabase
    .from('warehouse_stock')
    .select('*');

  if (error) {
    console.error('[WarehouseStock] Fetch all error:', error);
    return [];
  }

  return (data || []) as WarehouseStock[];
};

// ==================== Stock Return (استرداد العهدة) ====================

// Get products available in a distributor's warehouse
export const getDistributorAvailableProducts = async (warehouseId: string): Promise<WarehouseStock[]> => {
  const { supabase } = await import('@/integrations/supabase/client');

  const { data, error } = await supabase
    .from('warehouse_stock')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .gt('quantity', 0);

  if (error) {
    console.error('[WarehouseStock] Get available products error:', error);
    return [];
  }

  return (data || []) as WarehouseStock[];
};

// Create a return stock transfer
export const createReturnTransferCloud = async (
  fromWarehouseId: string,
  toWarehouseId: string,
  items: { productId: string; quantity: number; unit: 'piece' | 'bulk'; quantityInPieces: number }[],
  notes?: string
): Promise<StockTransfer | null> => {
  const { supabase } = await import('@/integrations/supabase/client');
  const userId = getCurrentUserId();
  if (!userId) return null;

  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .insert({
      user_id: userId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      transfer_number: generateTransferNumber('return'),
      transfer_type: 'return' as string,
      status: 'pending',
      notes
    })
    .select()
    .single();

  if (transferError || !transfer) {
    console.error('[StockReturn] Create error:', transferError);
    return null;
  }

  const itemsToInsert = items.map(item => ({
    transfer_id: transfer.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit: item.unit,
    quantity_in_pieces: item.quantityInPieces
  }));

  const { error: itemsError } = await supabase
    .from('stock_transfer_items')
    .insert(itemsToInsert);

  if (itemsError) {
    console.error('[StockReturn] Items error:', itemsError);
    await supabase.from('stock_transfers').delete().eq('id', transfer.id);
    return null;
  }

  return transfer as StockTransfer;
};

// Complete return transfer: deduct from distributor warehouse, add to main products.quantity
export const completeReturnTransferCloud = async (transferId: string): Promise<boolean> => {
  const { supabase } = await import('@/integrations/supabase/client');
  const userId = getCurrentUserId();
  if (!userId) return false;

  const { data: transfer, error: fetchError } = await supabase
    .from('stock_transfers')
    .select('*, stock_transfer_items(*)')
    .eq('id', transferId)
    .single();

  if (fetchError || !transfer) {
    console.error('[StockReturn] Fetch error:', fetchError);
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (transfer as any).stock_transfer_items as StockTransferItem[];

  for (const item of items) {
    // 1. Deduct from distributor's warehouse_stock
    const { data: warehouseStock } = await supabase
      .from('warehouse_stock')
      .select('quantity')
      .eq('warehouse_id', transfer.from_warehouse_id)
      .eq('product_id', item.product_id)
      .maybeSingle();

    const currentWarehouseQty = warehouseStock?.quantity || 0;
    const newWarehouseQty = Math.max(0, currentWarehouseQty - item.quantity_in_pieces);

    await supabase
      .from('warehouse_stock')
      .upsert({
        warehouse_id: transfer.from_warehouse_id,
        product_id: item.product_id,
        quantity: newWarehouseQty,
        last_updated: new Date().toISOString()
      }, { onConflict: 'warehouse_id,product_id' });

    // 2. Add back to products.quantity (main inventory) - عملية ذرية
    const { error: addError } = await supabase
      .rpc('add_product_quantity', {
        _product_id: item.product_id,
        _amount: item.quantity_in_pieces
      });

    if (addError) {
      console.error('[StockReturn] Atomic add error:', addError);
    }
  }

  // Update transfer status
  const { error: updateError } = await supabase
    .from('stock_transfers')
    .update({
      status: 'completed',
      transferred_by: userId,
      transferred_at: new Date().toISOString()
    })
    .eq('id', transferId);

  if (updateError) {
    console.error('[StockReturn] Complete error:', updateError);
    return false;
  }

  const { invalidateProductsCache } = await import('./products-cloud');
  invalidateProductsCache();

  emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  emitEvent(EVENTS.WAREHOUSES_UPDATED, null);
  return true;
};
