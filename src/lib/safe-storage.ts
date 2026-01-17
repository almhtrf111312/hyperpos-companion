/**
 * Safe Storage Module
 * Provides validation and error handling for localStorage operations
 */

export interface SafeSaveResult {
  success: boolean;
  error?: string;
}

/**
 * Safely save data to localStorage with validation
 */
export const safeSave = <T>(key: string, data: T): SafeSaveResult => {
  // Validation 1: Data is not null or undefined
  if (data === null || data === undefined) {
    console.error(`safeSave: Attempted to save null/undefined data for key: ${key}`);
    return { success: false, error: 'Data is null or undefined' };
  }
  
  // Validation 2: If array, ensure it's valid and doesn't contain null items
  if (Array.isArray(data)) {
    if (data.some(item => item === null || item === undefined)) {
      console.warn(`safeSave: Array contains null/undefined items for key: ${key}`);
      // Filter out null/undefined items instead of failing
      const cleanData = data.filter(item => item !== null && item !== undefined);
      try {
        const serialized = JSON.stringify(cleanData);
        localStorage.setItem(key, serialized);
        return { success: true };
      } catch (error) {
        return handleStorageError(key, error);
      }
    }
  }
  
  try {
    const serialized = JSON.stringify(data);
    
    // Validation 3: Ensure proper serialization
    if (!serialized || serialized === 'null' || serialized === 'undefined') {
      console.error(`safeSave: Serialization failed for key: ${key}`);
      return { success: false, error: 'Serialization failed' };
    }
    
    localStorage.setItem(key, serialized);
    return { success: true };
    
  } catch (error) {
    return handleStorageError(key, error);
  }
};

/**
 * Handle storage errors with specific error types
 */
const handleStorageError = (key: string, error: unknown): SafeSaveResult => {
  // Validation 4: Handle quota exceeded error
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    console.error(`safeSave: Storage quota exceeded for key: ${key}`);
    return { success: false, error: 'Storage quota exceeded - try clearing old data' };
  }
  
  console.error(`safeSave: Failed to save ${key}:`, error);
  return { success: false, error: String(error) };
};

/**
 * Safely load data from localStorage with validation
 */
export const safeLoad = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    
    const parsed = JSON.parse(raw);
    
    // Type check: if default is array, ensure parsed is also array
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
      console.warn(`safeLoad: Expected array for ${key}, got ${typeof parsed}`);
      return defaultValue;
    }
    
    // Type check: if default is object (not array), ensure parsed is also object
    if (
      typeof defaultValue === 'object' && 
      defaultValue !== null && 
      !Array.isArray(defaultValue) &&
      (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    ) {
      console.warn(`safeLoad: Expected object for ${key}, got ${typeof parsed}`);
      return defaultValue;
    }
    
    return parsed as T;
  } catch (error) {
    console.error(`safeLoad: Failed to load ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Check if localStorage has enough space for data
 */
export const hasStorageSpace = (data: unknown): boolean => {
  try {
    const serialized = JSON.stringify(data);
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, serialized);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get approximate localStorage usage
 */
export const getStorageUsage = (): { used: number; total: number; percentage: number } => {
  let used = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        used += key.length + value.length;
      }
    }
  }
  
  // Approximate total (5MB is typical limit)
  const total = 5 * 1024 * 1024;
  const percentage = Math.round((used / total) * 100);
  
  return { used, total, percentage };
};
