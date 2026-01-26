// Supabase Store - Cloud sync utilities for all data stores
import { supabase } from '@/integrations/supabase/client';
import { showToast } from './toast-config';

// Current user ID cache
let currentUserId: string | null = null;
// Owner ID cache (for cashiers who need to write to owner's data)
let currentOwnerId: string | null = null;
// Current user role cache
let currentUserRole: 'admin' | 'boss' | 'cashier' | null = null;

export const setCurrentUserId = (userId: string | null) => {
  currentUserId = userId;
  // Reset caches when user changes
  currentOwnerId = null;
  currentUserRole = null;
};

export const getCurrentUserId = (): string | null => {
  return currentUserId;
};

// Get user role (cached)
export const getCurrentUserRole = async (): Promise<'admin' | 'boss' | 'cashier' | null> => {
  if (currentUserRole) return currentUserRole;
  
  const userId = getCurrentUserId();
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error || !data) return null;
    
    currentUserRole = data.role as 'admin' | 'boss' | 'cashier';
    return currentUserRole;
  } catch {
    return null;
  }
};

// Check if current user is cashier
export const isCashierUser = async (): Promise<boolean> => {
  const role = await getCurrentUserRole();
  return role === 'cashier';
};

// Get owner ID (for cashiers, this returns their owner; for admins/boss, returns themselves)
export const getOwnerIdForInsert = async (): Promise<string | null> => {
  // If cached, return cached value
  if (currentOwnerId) return currentOwnerId;
  
  const userId = getCurrentUserId();
  if (!userId) return null;
  
  try {
    // Query user_roles to get owner_id
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, owner_id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error || !data) {
      console.warn('[getOwnerIdForInsert] Could not fetch role, using self as owner');
      return userId;
    }
    
    // Cache the role
    currentUserRole = data.role as 'admin' | 'boss' | 'cashier';
    
    // If admin or boss, they are their own owner
    if (data.role === 'admin' || data.role === 'boss') {
      currentOwnerId = userId;
      return userId;
    }
    
    // If cashier with owner_id, use owner_id
    if (data.role === 'cashier' && data.owner_id) {
      currentOwnerId = data.owner_id;
      console.log('[getOwnerIdForInsert] Cashier owner_id:', currentOwnerId);
      return data.owner_id;
    }
    
    // Fallback to self
    return userId;
  } catch (error) {
    console.error('[getOwnerIdForInsert] Error:', error);
    return userId;
  }
};

// Generic fetch function with error handling
// ✅ يعتمد على RLS (get_owner_id) لتصفية البيانات تلقائياً
// لا نضيف فلتر user_id يدوياً لأن الكاشير يجب أن يرى بيانات المالك
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchFromSupabase<T = any>(
  tableName: string,
  orderBy?: { column: string; ascending?: boolean }
): Promise<T[]> {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn(`fetchFromSupabase: No user ID for ${tableName}`);
    return [];
  }

  try {
    // ✅ الاستعلام بدون فلتر user_id - RLS ستتعامل مع التصفية
    // RLS تستخدم get_owner_id(auth.uid()) للسماح للكاشير برؤية بيانات المالك
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from(tableName).select('*');
    
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return [];
    }

    return (data || []) as T[];
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return [];
  }
}

// Generic insert function
// ✅ Uses getOwnerIdForInsert to properly set user_id for cashiers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertToSupabase<T = any>(
  tableName: string,
  data: Record<string, unknown>,
  options?: { silent?: boolean }
): Promise<T | null> {
  // Get owner ID (for cashiers this returns their owner's ID)
  const ownerId = await getOwnerIdForInsert();
  if (!ownerId) {
    console.warn(`insertToSupabase: No owner ID for ${tableName}`);
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabase as any)
      .from(tableName)
      .insert({ ...data, user_id: ownerId })
      .select()
      .single();

    if (error) {
      console.error(`Error inserting to ${tableName}:`, error);
      // ✅ Only show toast if not silent mode
      if (!options?.silent) {
        showToast.error('فشل في حفظ البيانات');
      }
      return null;
    }

    return inserted as T;
  } catch (error) {
    console.error(`Error inserting to ${tableName}:`, error);
    return null;
  }
}

// Generic update function
export async function updateInSupabase(
  tableName: string,
  id: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn(`updateInSupabase: No user ID for ${tableName}`);
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error(`Error updating ${tableName}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error updating ${tableName}:`, error);
    return false;
  }
}

// Generic delete function
export async function deleteFromSupabase(
  tableName: string,
  id: string
): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn(`deleteFromSupabase: No user ID for ${tableName}`);
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error(`Error deleting from ${tableName}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    return false;
  }
}

// Batch insert function for migration
// ✅ Uses getOwnerIdForInsert for proper user_id
export async function batchInsertToSupabase(
  tableName: string,
  items: Record<string, unknown>[]
): Promise<boolean> {
  const ownerId = await getOwnerIdForInsert();
  if (!ownerId || items.length === 0) return true;

  try {
    // Add user_id to all items using owner's ID
    const itemsWithUserId = items.map(item => ({
      ...item,
      user_id: ownerId,
    }));

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < itemsWithUserId.length; i += batchSize) {
      const batch = itemsWithUserId.slice(i, i + batchSize);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(tableName).insert(batch);
      
      if (error) {
        console.error(`Error batch inserting to ${tableName}:`, error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`Error batch inserting to ${tableName}:`, error);
    return false;
  }
}

// Upsert function (insert or update)
// ✅ Uses getOwnerIdForInsert for proper user_id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertToSupabase<T = any>(
  tableName: string,
  data: Record<string, unknown>,
  conflictColumn: string = 'id'
): Promise<T | null> {
  const ownerId = await getOwnerIdForInsert();
  if (!ownerId) {
    console.warn(`upsertToSupabase: No owner ID for ${tableName}`);
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upserted, error } = await (supabase as any)
      .from(tableName)
      .upsert({ ...data, user_id: ownerId }, { onConflict: conflictColumn })
      .select()
      .single();

    if (error) {
      console.error(`Error upserting to ${tableName}:`, error);
      return null;
    }

    return upserted as T;
  } catch (error) {
    console.error(`Error upserting to ${tableName}:`, error);
    return null;
  }
}

// Check if user has data in cloud
export async function hasCloudData(tableName: string): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error(`Error checking ${tableName}:`, error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    console.error(`Error checking ${tableName}:`, error);
    return false;
  }
}

// Fetch store settings
// ✅ Uses getOwnerIdForInsert to fetch owner's store settings for cashiers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchStoreSettings(): Promise<Record<string, any> | null> {
  // For reading, use owner ID so cashiers see their owner's settings
  const ownerId = await getOwnerIdForInsert();
  if (!ownerId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('stores')
      .select('*')
      .eq('user_id', ownerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching store settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching store settings:', error);
    return null;
  }
}

// Save store settings
// ✅ Uses getOwnerIdForInsert - cashiers should NOT save store settings
export async function saveStoreSettings(settings: Record<string, unknown>): Promise<boolean> {
  const ownerId = await getOwnerIdForInsert();
  if (!ownerId) return false;

  try {
    // Check if store exists using owner's ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('stores')
      .select('id')
      .eq('user_id', ownerId)
      .maybeSingle();

    if (existing) {
      // Update existing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('stores')
        .update(settings)
        .eq('user_id', ownerId);

      if (error) {
        console.error('Error updating store settings:', error);
        return false;
      }
    } else {
      // Insert new using owner's ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('stores')
        .insert({ ...settings, user_id: ownerId });

      if (error) {
        console.error('Error inserting store settings:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving store settings:', error);
    return false;
  }
}

// Delete all user data (for data reset)
export async function deleteAllUserData(): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) return false;

  // ✅ الترتيب مهم جداً - يجب حذف الجداول المرتبطة أولاً بسبب المفاتيح الأجنبية
  // المرحلة 1: حذف الجداول المرتبطة بالمنتجات والمخازن أولاً
  const phase1Tables = [
    'stock_transfer_items',  // مرتبط بـ products و stock_transfers
    'warehouse_stock',       // مرتبط بـ products و warehouses
    'invoice_items',         // مرتبط بـ invoices
  ];
  
  // المرحلة 2: حذف الجداول التي تعتمد عليها المرحلة 1
  const phase2Tables = [
    'stock_transfers',       // يعتمد على warehouses
    'invoices',
    'debts',
    'expenses',
    'recurring_expenses',
    'maintenance_services',
    'partners',
  ];
  
  // المرحلة 3: حذف الجداول الأساسية
  const phase3Tables = [
    'products',
    'categories',
    'customers',
    'warehouses',
  ];

  try {
    // حذف المرحلة 1
    for (const table of phase1Tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // حذف كل شيء
      
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
        // محاولة الحذف بطريقة بديلة للجداول المرتبطة
        if (table === 'stock_transfer_items' || table === 'warehouse_stock') {
          // جلب IDs المنتجات للمستخدم أولاً
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: products } = await (supabase as any)
            .from('products')
            .select('id')
            .eq('user_id', userId);
          
          if (products && products.length > 0) {
            const productIds = products.map((p: { id: string }) => p.id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from(table)
              .delete()
              .in('product_id', productIds);
          }
        }
      }
    }
    
    // حذف المرحلة 2
    for (const table of phase2Tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from(table)
        .delete()
        .eq('user_id', userId);
    }
    
    // حذف المرحلة 3
    for (const table of phase3Tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from(table)
        .delete()
        .eq('user_id', userId);
    }
    
    console.log('[deleteAllUserData] All user data deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting user data:', error);
    return false;
  }
}
