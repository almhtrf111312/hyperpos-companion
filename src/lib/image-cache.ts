/**
 * Image Cache - FlowPOS Pro
 * =========================
 * نظام Cache-First لصور المنتجات
 * يحفظ الصور محلياً في Cache API عند تحميلها لأول مرة
 * ويعرضها من الكاش عند انقطاع الإنترنت
 */

const IMAGE_CACHE_NAME = 'hyperpos-product-images-v1';
const MAX_CACHE_SIZE = 200; // الحد الأقصى لعدد الصور المخزنة

/**
 * فتح كاش الصور
 */
async function openImageCache(): Promise<Cache | null> {
  try {
    if (!('caches' in window)) {
      console.warn('[ImageCache] Cache API not available');
      return null;
    }
    return await caches.open(IMAGE_CACHE_NAME);
  } catch (error) {
    console.warn('[ImageCache] Failed to open cache:', error);
    return null;
  }
}

/**
 * حفظ صورة في الكاش المحلي
 */
export async function cacheImage(url: string, blob: Blob): Promise<void> {
  try {
    const cache = await openImageCache();
    if (!cache) return;

    // إنشاء Response من الـ Blob وحفظه
    const response = new Response(blob, {
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'X-Cached-At': new Date().toISOString(),
      },
    });
    await cache.put(url, response);
  } catch (error) {
    console.warn('[ImageCache] Failed to cache image:', error);
  }
}

/**
 * جلب صورة من الكاش المحلي
 * @returns Blob URL للصورة المخزنة أو null
 */
export async function getCachedImage(url: string): Promise<string | null> {
  try {
    const cache = await openImageCache();
    if (!cache) return null;

    const response = await cache.match(url);
    if (!response) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('[ImageCache] Failed to get cached image:', error);
    return null;
  }
}

/**
 * التحقق من وجود صورة في الكاش
 */
export async function isImageCached(url: string): Promise<boolean> {
  try {
    const cache = await openImageCache();
    if (!cache) return false;
    const response = await cache.match(url);
    return !!response;
  } catch {
    return false;
  }
}

/**
 * جلب صورة مع تخزينها تلقائياً (Cache-First Strategy)
 * 1. يبحث أولاً في الكاش المحلي
 * 2. إذا لم يجدها وكان متصلاً بالإنترنت — يجلبها ويخزنها
 * 3. إذا لم يجدها وكان أوفلاين — يعيد null
 * 
 * @returns Blob URL للصورة أو null
 */
export async function fetchWithCache(url: string): Promise<string | null> {
  if (!url) return null;

  // ✅ الصور المحلية (data URL / blob URL) لا تحتاج كاش
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // 1. البحث في الكاش أولاً
  const cached = await getCachedImage(url);
  if (cached) {
    return cached;
  }

  // 2. محاولة الجلب من الشبكة
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-cache',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[ImageCache] Fetch failed:', response.status, url);
      return null;
    }

    const blob = await response.blob();
    
    // حفظ في الكاش للاستخدام لاحقاً
    await cacheImage(url, blob);
    
    // إرجاع blob URL
    return URL.createObjectURL(blob);
  } catch (error) {
    // فشل الجلب (أوفلاين على الأرجح)
    console.warn('[ImageCache] Network fetch failed, image not cached:', url);
    return null;
  }
}

/**
 * تنظيف الكاش القديم — يحذف الصور الأقدم إذا تجاوز العدد الحد الأقصى
 */
export async function pruneImageCache(): Promise<void> {
  try {
    const cache = await openImageCache();
    if (!cache) return;

    const keys = await cache.keys();
    if (keys.length <= MAX_CACHE_SIZE) return;

    // حذف الصور الأقدم (الأولى في القائمة)
    const toDelete = keys.length - MAX_CACHE_SIZE;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[ImageCache] Pruned ${toDelete} old images from cache`);
  } catch (error) {
    console.warn('[ImageCache] Failed to prune cache:', error);
  }
}

/**
 * مسح كاش الصور بالكامل
 */
export async function clearImageCache(): Promise<void> {
  try {
    if ('caches' in window) {
      await caches.delete(IMAGE_CACHE_NAME);
      console.log('[ImageCache] Cache cleared');
    }
  } catch (error) {
    console.warn('[ImageCache] Failed to clear cache:', error);
  }
}
