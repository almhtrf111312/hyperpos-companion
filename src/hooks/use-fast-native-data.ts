import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeSWRCache } from '@/lib/cache/native-swr-cache';
import { usePageActivity } from '@/contexts/PageActivityContext';
import { performanceMetrics } from '@/lib/performance-metrics';

export interface UseFastNativeDataOptions<T> {
  dependencies?: any[];
  ttlMs?: number;
  enabled?: boolean;
  userId?: string;
  idbFallback?: () => Promise<T | null>;
  onSuccess?: (data: T) => void;
  onError?: (err: any) => void;
}

/**
 * useFastNativeData
 * نمط Stale-While-Revalidate فائق السرعة:
 * 1) قراءة فورية 0ms من RAM أو localStorage أو IndexedDB.
 * 2) تحديث صامت في الخلفية عند توفر اتصال.
 * 3) تعليق التحديث عند إخفاء التبويب عبر PageActivityContext.
 */
export function useFastNativeData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  optionsOrDeps: any[] | UseFastNativeDataOptions<T> = {}
) {
  const options: UseFastNativeDataOptions<T> = Array.isArray(optionsOrDeps)
    ? { dependencies: optionsOrDeps }
    : optionsOrDeps;

  const {
    dependencies = [],
    ttlMs = 3 * 60 * 1000,
    enabled = true,
    userId,
    idbFallback,
    onSuccess,
    onError,
  } = options;

  let isActive = true;
  try {
    const activity = usePageActivity();
    isActive = activity.isActive;
  } catch {
    isActive = true;
  }

  // قراءة فورية من الذاكرة أو التخزين المحلي في 0 ميلي ثانية
  const [data, setData] = useState<T | null>(() => {
    const instant = NativeSWRCache.getInstant<T>(cacheKey, { idbFallback, userId });
    if (instant !== null) {
      performanceMetrics.markCacheReady(cacheKey);
    }
    return instant;
  });
  const [isSilentSyncing, setIsSilentSyncing] = useState(false);
  const isMountedRef = useRef(true);
  const lastFetchedRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    let isCancelled = false;

    if (!enabled) return;

    // إذا كانت الصفحة مخفية ويوجد كاش بالفعل، نعلّق الجلب حتى تصبح نشطة
    if (!isActive && data !== null) {
      return;
    }

    // التحقق مما إذا كانت البيانات حديثة مقارنة بفترة TTL
    const isStale = NativeSWRCache.isStale(cacheKey, ttlMs);
    const timeSinceLastFetch = Date.now() - lastFetchedRef.current;
    if (!isStale && timeSinceLastFetch < ttlMs && data !== null) {
      return;
    }

    async function revalidate() {
      if (!data) {
        setIsSilentSyncing(true);
      }

      try {
        const fresh = await fetcher();
        if (!isCancelled && isMountedRef.current) {
          setData(fresh);
          lastFetchedRef.current = Date.now();
          NativeSWRCache.set(cacheKey, fresh, userId);
          performanceMetrics.markFreshData(cacheKey);
          onSuccess?.(fresh);
        }
      } catch (err) {
        console.warn(`[FastNativeData] Silent refresh skipped for ${cacheKey}:`, err);
        onError?.(err);
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
  }, [cacheKey, enabled, isActive, ttlMs, userId, ...dependencies]);

  const forceRefresh = useCallback(async () => {
    setIsSilentSyncing(true);
    try {
      const fresh = await fetcher();
      if (isMountedRef.current) {
        setData(fresh);
        lastFetchedRef.current = Date.now();
        NativeSWRCache.set(cacheKey, fresh, userId);
        performanceMetrics.markFreshData(cacheKey);
        onSuccess?.(fresh);
      }
      return fresh;
    } catch (err) {
      onError?.(err);
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsSilentSyncing(false);
      }
    }
  }, [cacheKey, fetcher, onSuccess, onError, userId]);

  return {
    data,
    isSilentSyncing,
    forceRefresh,
  };
}
