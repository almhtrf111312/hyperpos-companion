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

  // If no categories exist, create defaults
  if (cloudCategories.length === 0) {
    await createDefaultCategories();
    return loadCategoriesCloud(); // Reload after creating defaults
  }

  categoriesCache = cloudCategories.map(toCategory);
  cacheTimestamp = Date.now();
  
  return categoriesCache;
};

// Create default categories for new users
const createDefaultCategories = async (): Promise<void> => {
  for (const name of defaultCategoryNames) {
    await insertToSupabase('categories', { name });
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

// Get category names
export const getCategoryNamesCloud = async (): Promise<string[]> => {
  const categories = await loadCategoriesCloud();
  return categories.map(c => c.name);
};
