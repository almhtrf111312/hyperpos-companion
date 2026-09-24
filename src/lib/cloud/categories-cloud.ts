// Cloud Categories Store - Supabase-backed categories management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  updateInSupabase, 
  deleteFromSupabase,
  getCurrentUserId 
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';

export interface CloudCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

// Transform cloud to legacy format
function toCategory(cloud: CloudCategory): Category {
  return {
    id: cloud.id,
    name: cloud.name,
    createdAt: cloud.created_at,
  };
}

import { getDefaultCategories, getCurrentStoreType } from '../store-type-config';

// Default categories for new users - dynamic based on store type
const getDefaultCategoryNames = (): string[] => {
  return getDefaultCategories(getCurrentStoreType());
};

// Local storage cache helpers
const LOCAL_CACHE_KEY = 'hyperpos_categories_cache';

const saveCategoriesLocally = (categories: Category[]) => {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(categories));
  } catch { /* ignore */ }
};

const loadCategoriesLocally = (): Category[] | null => {
  try {
    const data = localStorage.getItem(LOCAL_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

// Cache
let categoriesCache: Category[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

// ✅ Promise singleton to prevent multiple attempts to create defaults
let defaultCreationPromise: Promise<void> | null = null;

// Load categories from cloud
export const loadCategoriesCloud = async (): Promise<Category[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // Check cache
  if (categoriesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return categoriesCache;
  }

  // Deduplicate helper
  const deduplicate = (cats: Category[]): { unique: Category[]; duplicateIds: string[] } => {
    const unique: Category[] = [];
    const seen = new Set<string>();
    const duplicateIds: string[] = [];
    for (const c of cats) {
      const norm = c.name.trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        unique.push(c);
      } else {
        duplicateIds.push(c.id);
      }
    }
    return { unique, duplicateIds };
  };

  // Offline: return local cache (deduplicated)
  if (!navigator.onLine) {
    const local = loadCategoriesLocally();
    if (local) {
      const { unique } = deduplicate(local);
      categoriesCache = unique;
      cacheTimestamp = Date.now();
      return unique;
    }
    return [];
  }

  const cloudCategories = await fetchFromSupabase<CloudCategory>('categories', {
    column: 'created_at',
    ascending: true,
  });

  // If no categories exist and we haven't started creating defaults
  if (cloudCategories.length === 0 && !defaultCreationPromise) {
    defaultCreationPromise = createDefaultCategories();
    await defaultCreationPromise;
    const reloadedCategories = await fetchFromSupabase<CloudCategory>('categories', {
      column: 'created_at',
      ascending: true,
    });
    const mapped = reloadedCategories.map(toCategory);
    const { unique, duplicateIds } = deduplicate(mapped);
    if (duplicateIds.length > 0) {
      Promise.allSettled(duplicateIds.map(id => deleteFromSupabase('categories', id))).catch(() => {});
    }
    categoriesCache = unique;
    cacheTimestamp = Date.now();
    saveCategoriesLocally(categoriesCache);
    return categoriesCache;
  }

  const mapped = cloudCategories.map(toCategory);
  const { unique, duplicateIds } = deduplicate(mapped);

  // ✅ تنظيف فوري لأي سجلات مكررة في سحابة Supabase في الخلفية
  if (duplicateIds.length > 0) {
    Promise.allSettled(
      duplicateIds.map(id => deleteFromSupabase('categories', id))
    ).then(() => {
      console.log(`[Categories] Cleaned up ${duplicateIds.length} duplicate categories from cloud`);
    }).catch(() => {});
  }

  categoriesCache = unique;
  cacheTimestamp = Date.now();
  saveCategoriesLocally(categoriesCache);
  
  return categoriesCache;
};

// Create default categories for new users
// ✅ Silently fails if RLS blocks (cashier shouldn't create defaults)
const createDefaultCategories = async (): Promise<void> => {
  try {
    const categoryNames = getDefaultCategoryNames();
    const existing = await fetchFromSupabase<CloudCategory>('categories', { column: 'created_at' });
    const existingNorm = new Set((existing || []).map(c => c.name.trim().toLowerCase()));

    const toInsert = categoryNames.filter(name => !existingNorm.has(name.trim().toLowerCase()));
    if (toInsert.length === 0) return;

    // Try to create the first category to test permissions
    const testInsert = await insertToSupabase('categories', 
      { name: toInsert[0] }, 
      { silent: true }
    );
    
    // If successful, create the rest
    if (testInsert && toInsert.length > 1) {
      await Promise.allSettled(
        toInsert.slice(1).map(name => 
          insertToSupabase('categories', { name }, { silent: true })
        )
      );
      console.log('[Categories] Default categories created successfully');
    }
  } catch {
    console.log('[Categories] Default creation failed silently');
  }
};

// Invalidate cache
export const invalidateCategoriesCache = () => {
  categoriesCache = null;
  cacheTimestamp = 0;
};

// ✅ دالة مخصصة لتنظيف وفحص التكرارات سحابياً ومحلياً
export const deduplicateCategoriesCloud = async (): Promise<{ removed: number; remaining: number }> => {
  invalidateCategoriesCache();
  const cloudCategories = await fetchFromSupabase<CloudCategory>('categories', {
    column: 'created_at',
    ascending: true,
  });

  const unique: Category[] = [];
  const seen = new Set<string>();
  const duplicateIds: string[] = [];

  for (const raw of cloudCategories) {
    const cat = toCategory(raw);
    const norm = cat.name.trim().toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(cat);
    } else {
      duplicateIds.push(cat.id);
    }
  }

  if (duplicateIds.length > 0) {
    await Promise.allSettled(
      duplicateIds.map(id => deleteFromSupabase('categories', id))
    );
  }

  categoriesCache = unique;
  cacheTimestamp = Date.now();
  saveCategoriesLocally(categoriesCache);
  emitEvent(EVENTS.CATEGORIES_UPDATED, null);

  return { removed: duplicateIds.length, remaining: unique.length };
};

// Add category
export const addCategoryCloud = async (name: string): Promise<Category | null> => {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  // ✅ فحص صارم لمنع التكرار قبل أي إدراج في قاعدة البيانات
  const existing = await loadCategoriesCloud();
  const duplicate = existing.find(c => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
  if (duplicate) {
    return duplicate;
  }

  const inserted = await insertToSupabase<CloudCategory>('categories', { name: trimmedName });
  
  if (inserted) {
    const newCat = toCategory(inserted);
    const current = categoriesCache || loadCategoriesLocally() || [];
    categoriesCache = [...current.filter(c => c.id !== newCat.id), newCat];
    cacheTimestamp = Date.now();
    saveCategoriesLocally(categoriesCache);

    emitEvent(EVENTS.CATEGORIES_UPDATED, null);
    return newCat;
  }
  
  return null;
};

// Update category
export const updateCategoryCloud = async (id: string, name: string): Promise<boolean> => {
  const trimmedName = name.trim();
  if (!trimmedName) return false;

  // ✅ فحص عدم تكرار الاسم مع تصنيف آخر
  const existing = await loadCategoriesCloud();
  const duplicate = existing.find(c => c.id !== id && c.name.trim().toLowerCase() === trimmedName.toLowerCase());
  if (duplicate) {
    return false;
  }

  const success = await updateInSupabase('categories', id, { name: trimmedName });
  
  if (success) {
    const current = categoriesCache || loadCategoriesLocally() || [];
    categoriesCache = current.map(c => c.id === id ? { ...c, name: trimmedName } : c);
    cacheTimestamp = Date.now();
    saveCategoriesLocally(categoriesCache);

    emitEvent(EVENTS.CATEGORIES_UPDATED, null);
  }
  
  return success;
};

// Delete category
export const deleteCategoryCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('categories', id);
  
  if (success) {
    const current = categoriesCache || loadCategoriesLocally() || [];
    categoriesCache = current.filter(c => c.id !== id);
    cacheTimestamp = Date.now();
    saveCategoriesLocally(categoriesCache);

    emitEvent(EVENTS.CATEGORIES_UPDATED, null);
  }
  
  return success;
};

// Get local categories immediately (0ms, no network)
export const getCategoryNamesLocalFirst = (): string[] => {
  const local = categoriesCache || loadCategoriesLocally();
  if (local && local.length > 0) {
    return Array.from(new Set(local.map(c => c.name.trim()).filter(Boolean)));
  }
  return getDefaultCategories(getCurrentStoreType());
};

// Get category names (deduplicated, including categories from products)
export const getCategoryNamesCloud = async (): Promise<string[]> => {
  const categories = await loadCategoriesCloud();
  const categoryNames = categories.map(c => c.name.trim());
  const normalizedExisting = new Set(categoryNames.map(n => n.toLowerCase()));

  // Fast return if offline - do NOT query supabase
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Array.from(new Set(categoryNames.filter(Boolean)));
  }

  // ✅ Also include categories that exist on products but not in categories table
  // This ensures products are always visible even if their category was deleted and re-created
  try {
    const userId = getCurrentUserId();
    if (userId) {
      const { supabase } = await import('@/integrations/supabase/client');
      const { withTimeout } = await import('../supabase-store');
      
      const query = supabase
        .from('products')
        .select('category')
        .eq('user_id', userId)
        .not('category', 'is', null)
        .not('archived', 'eq', true);

      const { data } = await withTimeout(
        Promise.resolve(query),
        2500,
        { data: null, error: null }
      );
      
      if (data) {
        const productCategories = [...new Set(data.map(p => (p.category || '').trim()).filter(Boolean))];
        for (const cat of productCategories) {
          const lower = cat.toLowerCase();
          if (!normalizedExisting.has(lower)) {
            normalizedExisting.add(lower);
            categoryNames.push(cat);
            // ✅ Auto-create using addCategoryCloud which validates and prevents race duplicates
            addCategoryCloud(cat).catch(() => {});
          }
        }
      }
    }
  } catch { /* ignore */ }

  // Deduplicate results
  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  for (const name of categoryNames) {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueNames.push(name);
    }
  }

  return uniqueNames;
};
