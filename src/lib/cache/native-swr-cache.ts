/**
 * Native SWR (Stale-While-Revalidate) Cache Engine
 * يضمن ظهور البيانات في أقل من 1 ميلي ثانية حتى بعد إغلاق التطبيق لأيام
 * FlowPOS Pro - Ultra-Fast Native Feel Architecture
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId?: string;
}

export interface GetInstantOptions<T> {
  maxAgeMs?: number;
  idbFallback?: () => Promise<T | null>;
  userId?: string;
  strictTTL?: boolean;
}

const memoryStore = new Map<string, CacheEntry<any>>();
const MAX_SWR_LOCAL_STORAGE_ITEMS = 60;

export class NativeSWRCache {
  /**
   * جلب فوري للبيانات من الذاكرة أو التخزين المحلي دون قفل الواجهة (0 ميلي ثانية)
   */
  static getInstant<T>(
    key: string,
    idbFallbackOrOptions?: (() => Promise<T | null>) | GetInstantOptions<T>
  ): T | null {
    let options: GetInstantOptions<T> = {};
    if (typeof idbFallbackOrOptions === 'function') {
      options.idbFallback = idbFallbackOrOptions;
    } else if (idbFallbackOrOptions) {
      options = idbFallbackOrOptions;
    }

    const { maxAgeMs, idbFallback, userId, strictTTL } = options;

    // 1. فحص ذاكرة الـ RAM أولاً (0 ميلي ثانية)
    if (memoryStore.has(key)) {
      const entry = memoryStore.get(key)!;
      // عزل حسابات المستخدمين
      if (userId && entry.userId && entry.userId !== userId) {
        memoryStore.delete(key);
      } else {
        const isExpired = maxAgeMs ? Date.now() - entry.timestamp > maxAgeMs : false;
        if (isExpired && strictTTL) {
          // منتهي الصلاحية مع شرط الإلزام
          return null;
        }
        return entry.data as T;
      }
    }

    // 2. فحص التخزين المحلي السريع
    try {
      const raw = localStorage.getItem(`fps_swr_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        // عزل حسابات المستخدمين
        if (userId && parsed.userId && parsed.userId !== userId) {
          localStorage.removeItem(`fps_swr_${key}`);
        } else {
          memoryStore.set(key, parsed);
          const isExpired = maxAgeMs ? Date.now() - parsed.timestamp > maxAgeMs : false;
          if (isExpired && strictTTL) {
            return null;
          }
          return parsed.data;
        }
      }
    } catch {
      // تجاهل الأخطاء بهدوء
    }

    // 3. في حال توفر دالة fallback غير متزامنة لـ IndexedDB، يتم استدعاؤها في الخلفية
    if (idbFallback) {
      idbFallback()
        .then((fallbackData) => {
          if (fallbackData !== null && fallbackData !== undefined) {
            NativeSWRCache.set(key, fallbackData, userId);
          }
        })
        .catch(() => {});
    }

    return null;
  }

  /**
   * حفظ النتيجة في RAM والتخزين الدائم مع تحديد هوية المستخدم للتأمين
   */
  static set<T>(key: string, data: T, userId?: string): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      userId,
    };
    memoryStore.set(key, entry);

    try {
      // حفظ البيانات المدمجة مع إدارة حجم التخزين
      const serialized = JSON.stringify(entry);
      localStorage.setItem(`fps_swr_${key}`, serialized);
    } catch (e) {
      // في حال امتلاء localStorage، نظف المفاتيح القديمة بنمط LRU دقيق
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
   * فحص ما إذا كانت البيانات المحفوظة قد أصبحت قديمة مقارنة بفترة TTL
   */
  static isStale(key: string, maxAgeMs: number): boolean {
    if (memoryStore.has(key)) {
      return Date.now() - memoryStore.get(key)!.timestamp > maxAgeMs;
    }
    try {
      const raw = localStorage.getItem(`fps_swr_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Date.now() - parsed.timestamp > maxAgeMs;
      }
    } catch {}
    return true;
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
   * مسح جميع مفاتيح الكاش الخاصة بـ SWR أو مسح كاش مستخدم معين
   */
  static clear(targetUserId?: string): void {
    if (!targetUserId) {
      memoryStore.clear();
      try {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('fps_swr_'));
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {}
      return;
    }

    // مسح كاش مستخدم بعينه
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.userId === targetUserId) {
        memoryStore.delete(key);
      }
    }

    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('fps_swr_'));
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.userId === targetUserId) {
              localStorage.removeItem(k);
            }
          }
        } catch {}
      }
    } catch {}
  }

  /**
   * تنظيف المفاتيح الأقدم ترتيباً زمنياً بنمط LRU محكم بدلاً من الحذف العشوائي
   */
  private static evictOldKeys(): void {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('fps_swr_'));
      if (keys.length === 0) return;

      const entries: { key: string; timestamp: number }[] = [];
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            entries.push({ key: k, timestamp: parsed.timestamp || 0 });
          } else {
            entries.push({ key: k, timestamp: 0 });
          }
        } catch {
          entries.push({ key: k, timestamp: 0 });
        }
      }

      // فرز المفاتيح من الأقدم إلى الأحدث
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // إخلاء أقدم 25% من المفاتيح
      const evictCount = Math.max(1, Math.ceil(entries.length * 0.25));
      for (let i = 0; i < evictCount; i++) {
        localStorage.removeItem(entries[i].key);
        const memKey = entries[i].key.replace('fps_swr_', '');
        memoryStore.delete(memKey);
      }
    } catch {}
  }
}
