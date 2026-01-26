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

// Default categories for new users
const defaultCategoryNames = [
  'هواتف',
  'أكسسوارات',
  'سماعات',
  'شواحن',
  'قطع غيار',
  'أجهزة لوحية',
  'ساعات',
  'صيانة',
];

// Cache
let categoriesCache: Category[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

// ✅ Flag to prevent multiple attempts to create defaults
let isCreatingDefaults = false;
let defaultsCreationAttempted = false;

// Load categories from cloud
export const loadCategoriesCloud = async (): Promise<Category[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // Check cache
  if (categoriesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return categoriesCache;
  }

  const cloudCategories = await fetchFromSupabase<CloudCategory>('categories', {
    column: 'created_at',
    ascending: true,
  });

  // If no categories exist and we haven't tried creating defaults yet
  if (cloudCategories.length === 0 && !isCreatingDefaults && !defaultsCreationAttempted) {
    await createDefaultCategories();
    // Reload after creating defaults (but mark as attempted to prevent infinite loop)
    const reloadedCategories = await fetchFromSupabase<CloudCategory>('categories', {
      column: 'created_at',
      ascending: true,
    });
    categoriesCache = reloadedCategories.map(toCategory);
    cacheTimestamp = Date.now();
    return categoriesCache;
  }

  categoriesCache = cloudCategories.map(toCategory);
  cacheTimestamp = Date.now();
  
  return categoriesCache;
};

// Create default categories for new users
// ✅ Silently fails if RLS blocks (cashier shouldn't create defaults)
const createDefaultCategories = async (): Promise<void> => {
  if (isCreatingDefaults || defaultsCreationAttempted) return;
  
  isCreatingDefaults = true;
  defaultsCreationAttempted = true;
  
  try {
    // Use Promise.allSettled to not fail on individual errors
    // ✅ Use silent mode to prevent toast spam
    await Promise.allSettled(
      defaultCategoryNames.map(name => 
        insertToSupabase('categories', { name }, { silent: true }).catch(() => null)
      )
    );
  } catch {
    // Silently ignore - cashiers can't create categories and that's OK
    console.log('[Categories] Default creation skipped (likely cashier role)');
  } finally {
    isCreatingDefaults = false;
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
