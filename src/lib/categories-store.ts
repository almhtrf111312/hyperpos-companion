import { emitEvent, EVENTS } from './events';

const CATEGORIES_STORAGE_KEY = 'hyperpos_categories_v1';

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

const defaultCategories: Category[] = [
  { id: '1', name: 'هواتف', createdAt: new Date().toISOString() },
  { id: '2', name: 'أكسسوارات', createdAt: new Date().toISOString() },
  { id: '3', name: 'سماعات', createdAt: new Date().toISOString() },
  { id: '4', name: 'شواحن', createdAt: new Date().toISOString() },
  { id: '5', name: 'قطع غيار', createdAt: new Date().toISOString() },
  { id: '6', name: 'أجهزة لوحية', createdAt: new Date().toISOString() },
  { id: '7', name: 'ساعات', createdAt: new Date().toISOString() },
  { id: '8', name: 'صيانة', createdAt: new Date().toISOString() },
];

export const loadCategories = (): Category[] => {
  try {
    const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return defaultCategories;
};

export const saveCategories = (categories: Category[]) => {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    emitEvent(EVENTS.CATEGORIES_UPDATED, categories);
  } catch {
    // ignore
  }
};

export const addCategory = (name: string): Category => {
  const categories = loadCategories();
  const newCategory: Category = {
    id: Date.now().toString(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  categories.push(newCategory);
  saveCategories(categories);
  return newCategory;
};

export const updateCategory = (id: string, name: string): boolean => {
  const categories = loadCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) return false;
  categories[index].name = name.trim();
  saveCategories(categories);
  return true;
};

export const deleteCategory = (id: string): boolean => {
  const categories = loadCategories();
  const filtered = categories.filter(c => c.id !== id);
  if (filtered.length === categories.length) return false;
  saveCategories(filtered);
  return true;
};
