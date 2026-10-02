import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { getSignedImageUrl } from '@/lib/image-upload';
import { getCachedProductImage } from '@/lib/offline-image-store';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  imageUrl?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}

// كاش في الذاكرة الحية لتسريع العرض الفوري للأصناف أثناء التنقل في الجلسة الحالية
const memoryCache = new Map<string, string>();

/**
 * مكون مشترك لعرض صور المنتجات باستراتيجية Offline-First:
 * 1. إذا كانت الصورة Base64 (data:) أو Blob محلي أو رابط http مباشر → تُعرض فوراً.
 * 2. إذا كانت في كاش الذاكرة الحية (memoryCache) → تُعرض فوراً دون أي طلب.
 * 3. إذا كانت مسار تخزين (storage path):
 *    - يُفحص IndexedDB أولاً → إذا وُجدت تُعرض فوراً حتى بدون إنترنت.
 *    - إذا لم توجد، ينتظر ظهور العنصر في الشاشة (IntersectionObserver).
 *    - يطلب رابطاً موقّعاً من السحابة بمهلة زمنية قصيرة ويعرضه فوراً.
 * 4. عند فشل أي رابط خارجي، يُراجع IndexedDB كـ fallback قبل إظهار أيقونة الخطأ.
 *
 * ملاحظة: حفظ الصور في IndexedDB يتم فقط عند رفعها (image-upload.ts)،
 * وليس عند كل عرض، لتجنب طلبات HTTP و setState مضاعفة.
 */
export function ProductImage({ imageUrl, alt, className, iconClassName }: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (!imageUrl) return null;
    // 1. فحص كاش الذاكرة الحية أولاً
    if (memoryCache.has(imageUrl)) return memoryCache.get(imageUrl)!;
    // 2. الروابط المباشرة وملفات البيانات تُعرض فوراً
    if (
      imageUrl.startsWith('data:') ||
      imageUrl.startsWith('blob:') ||
      imageUrl.startsWith('http')
    ) {
      memoryCache.set(imageUrl, imageUrl);
      return imageUrl;
    }
    return null;
  });

  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // الخطوة 1: فحص IndexedDB للمسارات السحابية فقط (قبل أي طلب شبكة)
  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setError(false);
      return;
    }

    // الروابط المباشرة وملفات البيانات لا تحتاج لفحص IndexedDB
    if (
      imageUrl.startsWith('data:') ||
      imageUrl.startsWith('blob:') ||
      imageUrl.startsWith('http')
    ) {
      memoryCache.set(imageUrl, imageUrl);
      setResolvedUrl(imageUrl);
      setError(false);
      return;
    }

    // فحص كاش الذاكرة الحية
    if (memoryCache.has(imageUrl)) {
      setResolvedUrl(memoryCache.get(imageUrl)!);
      setError(false);
      return;
    }

    // مسار تخزين سحابي: نفحص IndexedDB مرة واحدة فقط
    let isMounted = true;
    getCachedProductImage(imageUrl).then((cached) => {
      if (!isMounted) return;
      if (cached) {
        memoryCache.set(imageUrl, cached);
        setResolvedUrl(cached);
        setError(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // الخطوة 2: مراقبة ظهور العنصر في الشاشة للصور غير المخزنة محلياً
  useEffect(() => {
    if (!imageUrl || resolvedUrl) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px',
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [imageUrl, resolvedUrl]);

  // الخطوة 3: جلب الرابط الموقّع من السحابة بعد ظهور العنصر في الشاشة
  useEffect(() => {
    if (!imageUrl || !isVisible || resolvedUrl) return;

    let cancelled = false;

    // الجهاز غير متصل ولا توجد نسخة محلية
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(true);
      return;
    }

    const loadImage = async () => {
      try {
        // مهلة زمنية قصيرة (ثانيتان) لتفادي تعليق الواجهة
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Image sign timeout')), 2000)
        );

        const targetUrl = await Promise.race([
          getSignedImageUrl(imageUrl),
          timeoutPromise,
        ]);

        if (cancelled) return;

        if (targetUrl) {
          memoryCache.set(imageUrl, targetUrl);
          setResolvedUrl(targetUrl);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, isVisible, resolvedUrl]);

  if (!imageUrl || error || !resolvedUrl) {
    return (
      <div
        ref={containerRef}
        className={cn('flex items-center justify-center bg-muted/50 transition-colors', className)}
      >
        <Package className={cn('text-muted-foreground/40', iconClassName || 'w-6 h-6')} />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('object-cover', className)}
      onError={() => {
        // إذا انتهت صلاحية الرابط الموقّع، نُراجع IndexedDB كـ fallback
        getCachedProductImage(imageUrl).then((fallback) => {
          if (fallback) {
            memoryCache.set(imageUrl, fallback);
            setResolvedUrl(fallback);
          } else {
            setError(true);
          }
        }).catch(() => setError(true));
      }}
    />
  );
}
