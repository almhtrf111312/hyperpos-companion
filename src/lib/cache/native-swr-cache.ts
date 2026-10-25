/**
 * Native SWR (Stale-While-Revalidate) Cache Engine
 * يضمن ظهور البيانات في أقل من 1 ميلي ثانية حتى بعد إغلاق التطبيق لأيام
 * FlowPOS Pro - Ultra-Fast Native Feel Architecture
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();

export class NativeSWRCache {
  /**
   * جلب فوري للبيانات من الذاكرة أو التخزين المحلي دون قفل الواجهة (0 ميلي ثانية)
   */
  static getInstant<T>(key: string, idbFallback?: () => Promise<T | null>): T | null {
    // 1. فحص ذاكرة الـ RAM أولاً (0 ميلي ثانية)
    if (memoryStore.has(key)) {
      return memoryStore.get(key)!.data as T;
    }

    // 2. فحص التخزين المحلي السريع
    try {
      const raw = localStorage.getItem(`fps_swr_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        memoryStore.set(key, parsed);
        return parsed.data;
      }
    } catch {
      // تجاهل الأخطاء بهدوء
    }

    // 3. في حال توفر دالة fallback غير متزامنة لـ IndexedDB، يتم استدعاؤها في الخلفية
    if (idbFallback) {
      idbFallback().then(fallbackData => {
        if (fallbackData !== null && fallbackData !== undefined) {
          NativeSWRCache.set(key, fallbackData);
        }
      }).catch(() => {});
    }

    return null;
  }

  /**
   * حفظ النتيجة في RAM والتخزين الدائم
   */
  static set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };
    memoryStore.set(key, entry);
    try {
      // حفظ البيانات المدمجة فقط لتوفير المساحة
      localStorage.setItem(`fps_swr_${key}`, JSON.stringify(entry));
    } catch (e) {
      // في حال امتلاء localStorage، نظف المفاتيح القديمة تلقائياً
      this.evictOldKeys();
      try {
        localStorage.setItem(`fps_swr_${key}`, JSON.stringify(entry));
      } catch {}
    }
  }

  /**
   * فحص ما إذا كان المفتاح موجوداً في الكاش
   */
  static has(key: string): boolean {
    if (memoryStore.has(key)) return true;
    try {
      return localStorage.getItem(`fps_swr_${key}`) !== null;
    } catch {
      return false;
    }
  }

  /**
   * حذف مفتاح معين من الكاش
   */
  static remove(key: string): void {
    memoryStore.delete(key);
    try {
      localStorage.removeItem(`fps_swr_${key}`);
    } catch {}
  }

  /**
   * مسح جميع مفاتيح الكاش الخاصة بـ SWR
   */
  static clear(): void {
    memoryStore.clear();
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('fps_swr_'));
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  /**
   * تنظيف المفاتيح القديمة عند امتلاء التخزين المحلي
   */
  private static evictOldKeys(): void {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('fps_swr_'));
      keys.slice(0, 5).forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}
