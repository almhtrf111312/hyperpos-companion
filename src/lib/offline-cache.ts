/**
 * Offline Cache - حفظ البيانات السحابية محلياً للعمل بدون إنترنت
 */

const CACHE_PREFIX = 'hyperpos_cache_';
const CACHE_TTL = 86400000; // 24 ساعة

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

export const saveToOfflineCache = <T>(key: string, data: T): void => {
  try {
    const cacheData: CachedData<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
  } catch (e) {
    console.warn(`[OfflineCache] Failed to save ${key}:`, e);
  }
};

export const loadFromOfflineCache = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const cached: CachedData<T> = JSON.parse(raw);
    // صلاحية 24 ساعة
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  } catch (e) {
    console.warn(`[OfflineCache] Failed to load ${key}:`, e);
  }
  return null;
};

export const clearOfflineCache = (key: string): void => {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
};
