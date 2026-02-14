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

  // Offline: return local cache
  if (!navigator.onLine) {
    const local = loadCategoriesLocally();
    if (local) {
      categoriesCache = local;
      cacheTimestamp = Date.now();
      return local;
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
    categoriesCache = reloadedCategories.map(toCategory);
    cacheTimestamp = Date.now();
    saveCategoriesLocally(categoriesCache);
    return categoriesCache;
  }

  categoriesCache = cloudCategories.map(toCategory);
  cacheTimestamp = Date.now();
  saveCategoriesLocally(categoriesCache);
  
  return categoriesCache;
};

// Create default categories for new users
// ✅ Silently fails if RLS blocks (cashier shouldn't create defaults)
const createDefaultCategories = async (): Promise<void> => {
  try {
    const categoryNames = getDefaultCategoryNames();
    // Try to create the first category to test permissions
    const testInsert = await insertToSupabase('categories', 
      { name: categoryNames[0] }, 
      { silent: true }
    );
    
    // If successful, create the rest
    if (testInsert) {
      await Promise.allSettled(
        categoryNames.slice(1).map(name => 
          insertToSupabase('categories', { name }, { silent: true })
        )
      );
      console.log('[Categories] Default categories created successfully');
    } else {
      console.log('[Categories] Default creation skipped (insufficient permissions)');
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

// Add category
export const addCategoryCloud = async (name: string): Promise<Category | null> => {
  const inserted = await insertToSupabase<CloudCategory>('categories', { name: name.trim() });
  
  if (inserted) {
    invalidateCategoriesCache();
    emitEvent(EVENTS.CATEGORIES_UPDATED, null);
    return toCategory(inserted);
  }
  
  return null;
};

// Update category
export const updateCategoryCloud = async (id: string, name: string): Promise<boolean> => {
  const success = await updateInSupabase('categories', id, { name: name.trim() });
  
  if (success) {
    invalidateCategoriesCache();
    emitEvent(EVENTS.CATEGORIES_UPDATED, null);
  }
  
  return success;
};

// Delete category
export const deleteCategoryCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('categories', id);
  
  if (success) {
    invalidateCategoriesCache();
    emitEvent(EVENTS.CATEGORIES_UPDATED, null);
  }
  
  return success;
};

// Get category names (deduplicated)
export const getCategoryNamesCloud = async (): Promise<string[]> => {
  const categories = await loadCategoriesCloud();
  // ✅ Remove duplicates using Set
  const uniqueNames = [...new Set(categories.map(c => c.name))];
  return uniqueNames;
};
