import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeSWRCache } from '@/lib/cache/native-swr-cache';

/**
 * هوك البيانات فائق السرعة useFastNativeData
 * يسترجع البيانات فوراً في 0 ميلي ثانية من الكاش الدائم (RAM + localStorage)
 * ويقوم بإجراء المزامنة التحديثية الصامتة في الخلفية دون تعطيل الواجهة أو إظهار سبينر التحميل
 */
export function useFastNativeData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  // استرجاع فوري للبيانات دون إظهار سبينر التحميل إطلاقاً إذا كانت البيانات متوفرة مسبقاً
  const [data, setData] = useState<T | null>(() => NativeSWRCache.getInstant<T>(cacheKey));
  const [isSilentSyncing, setIsSilentSyncing] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let isCancelled = false;

    async function revalidate() {
      // إذا لم يكن هناك كاش سابق فقط نُظهر مؤشر المزامنة، وإلا يتم التحديث صامتاً تماماً
      if (!data) {
        setIsSilentSyncing(true);
      }

      try {
        const fresh = await fetcher();
        if (!isCancelled && isMountedRef.current) {
          setData(fresh);
          NativeSWRCache.set(cacheKey, fresh);
        }
      } catch (err) {
        console.warn(`[FastNativeData] Silent refresh skipped for ${cacheKey}:`, err);
      } finally {
        if (!isCancelled && isMountedRef.current) {
          setIsSilentSyncing(false);
        }
      }
    }

    revalidate();

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
    };
  }, [cacheKey, ...dependencies]);

  /**
   * تحديث متفائل (Optimistic Update) في الكاش والواجهة مباشرة
   */
  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    setData((prev) => {
      const val = typeof newData === 'function' ? (newData as any)(prev) : newData;
      NativeSWRCache.set(cacheKey, val);
      return val;
    });
  }, [cacheKey]);

  return {
    data,
    isLoading: data === null, // يكون صحيحاً فقط في أول فتحة للتطبيق على جهاز جديد كلياً
    isSilentSyncing,
    mutate,
  };
}
