/**
 * Offline-First Persistent Image Store using IndexedDB
 * يحفظ صور المنتجات بصيغة Base64 Data URL في IndexedDB لضمان ظهورها بدون إنترنت
 */

const DB_NAME = 'flowpos_images_cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

// تطبيع المفتاح لضمان تطابق المسارات مثل '/products/1.jpg' مع 'products/1.jpg'
export function normalizeImageKey(key: string): string {
  if (!key) return '';
  return key.trim().replace(/^\/+/, '');
}

/**
 * فتح اتصال بقاعدة بيانات IndexedDB المخصصة لكاش الصور
 */
function openImagesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * استرجاع الصورة المخزنة محلياً بصيغة Data URL
 */
export async function getCachedProductImage(rawKey: string): Promise<string | null> {
  if (!rawKey) return null;
  const key = normalizeImageKey(rawKey);

  try {
    const db = await openImagesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result && typeof req.result.data === 'string') {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * حفظ الصورة محلياً في IndexedDB مع ختم زمني
 */
export async function saveProductImageToCache(rawKey: string, data: string): Promise<void> {
  if (!rawKey || !data) return;
  const key = normalizeImageKey(rawKey);

  try {
    const db = await openImagesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        key,
        data,
        updatedAt: Date.now(),
      });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[ImageStore] Failed to cache image:', err);
  }
}

/**
 * تحويل ملف Blob إلى Data URL (Base64)
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * جلب الصورة من الرابط السحابي كـ Blob وتحويلها إلى Base64 وحفظها محلياً في IndexedDB
 */
export async function fetchAndCacheProductImage(rawKey: string, url: string): Promise<string | null> {
  if (!rawKey || !url) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    // حفظ في IndexedDB
    await saveProductImageToCache(rawKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn('[ImageStore] fetchAndCacheProductImage error for', rawKey, err);
    return null;
  }
}
