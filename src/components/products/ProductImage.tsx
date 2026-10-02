import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { getSignedImageUrl } from '@/lib/image-upload';
import {
  getCachedProductImage,
  fetchAndCacheProductImage
} from '@/lib/offline-image-store';
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
 * مكون مشترك لعرض صور المنتجات باستراتيجية Offline-First Persistent Cache:
 * 1. إذا كانت الصورة Base64 (data:) أو Blob محلي، تُعرض فوراً.
 * 2. إذا كانت الصورة محفوظة مسبقاً في IndexedDB، تُعرض فوراً حتى لو كان الجهاز بدون إنترنت كلياً.
 * 3. إذا لم تكن مخزنة محلياً وكان الإنترنت متاحاً:
 *    - يتم التحميل الكسول (Lazy Loading) عند ظهور البطاقة في الشاشة عبر IntersectionObserver.
 *    - يتم طلب الرابط الموقع من السحابة وعرضه للمستخدم فوراً.
 *    - يتم تحميل الصورة في الخلفية وحفظها كـ Base64 في IndexedDB للاستخدام أوفلاين لاحقاً.
 * 4. في حال عدم وجود إنترنت وفشل جلب الصورة، يتم إظهار الأيقونة البديلة بنعومة دون تعطيل الواجهة.
 */
export function ProductImage({ imageUrl, alt, className, iconClassName }: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (!imageUrl) return null;
    if (memoryCache.has(imageUrl)) return memoryCache.get(imageUrl)!;
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      memoryCache.set(imageUrl, imageUrl);
      return imageUrl;
    }
    return null;
  });

  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // الخطوة 1: فحص الكاش الدائم (IndexedDB) أولاً قبل أي طلب شبكة
  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setError(false);
      return;
    }

    // إذا كانت الصورة أصلاً base64 أو blob، فهي محلية بالكامل
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
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

    let isMounted = true;

    // استرجاع الصورة من IndexedDB
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

  // الخطوة 2: مراقبة ظهور العنصر داخل إطار الرؤية (IntersectionObserver) للصور غير المخزنة
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
        rootMargin: '150px', // تحميل مسبق خفيف قبل الوصول للعنصر
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [imageUrl, resolvedUrl]);

  // الخطوة 3: طلب الصورة وتخزينها محلياً فقط بعد التأكد من عدم وجودها محلياً وظهورها في الشاشة
  useEffect(() => {
    if (!imageUrl || !isVisible || resolvedUrl) return;

    let cancelled = false;

    // إذا كان الجهاز غير متصل بالإنترنت ولم تكن الصورة في الكاش
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(true);
      return;
    }

    const loadImage = async () => {
      try {
        // فحص أخير في الكاش
        const cached = await getCachedProductImage(imageUrl);
        if (cancelled) return;
        if (cached) {
          memoryCache.set(imageUrl, cached);
          setResolvedUrl(cached);
          setError(false);
          return;
        }

        // جلب الرابط الموقع من السحابة أو استخدام الرابط المباشر
        let targetUrl: string | null = null;
        if (imageUrl.startsWith('http')) {
          targetUrl = imageUrl;
        } else {
          // مهلة زمنية قصيرة (ثانيتان ونصف) لتفادي تعليق الواجهة
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Image sign timeout')), 2500)
          );
          targetUrl = await Promise.race([getSignedImageUrl(imageUrl), timeoutPromise]);
        }

        if (cancelled) return;

        if (!targetUrl) {
          setError(true);
          return;
        }

        // عرض الرابط الموقع فوراً للمستخدم لعدم انتظار حفظ الـ Blob
        setResolvedUrl(targetUrl);
        memoryCache.set(imageUrl, targetUrl);
        setError(false);

        // تحميل الـ Blob وحفظه في IndexedDB بصيغة Base64 للاستخدام أوفلاين لاحقاً
        fetchAndCacheProductImage(imageUrl, targetUrl).then((base64Data) => {
          if (base64Data && !cancelled) {
            memoryCache.set(imageUrl, base64Data);
            setResolvedUrl(base64Data);
          }
        }).catch(() => {
          // في حال فشل حفظ الـ Blob، يبقى الرابط الموقع معروضاً للمستخدم
        });

      } catch (err) {
        if (!cancelled) {
          console.warn('[ProductImage] Failed to resolve image:', imageUrl, err);
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
        className={cn("flex items-center justify-center bg-muted/50 transition-colors", className)}
      >
        <Package className={cn("text-muted-foreground/40", iconClassName || "w-6 h-6")} />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("object-cover", className)}
      onError={() => {
        // إذا فشل رابط خارجي، نحاول فحص IndexedDB مرة ثانية قبل الاستسلام للخطأ
        getCachedProductImage(imageUrl).then((fallback) => {
          if (fallback) {
            setResolvedUrl(fallback);
          } else {
            setError(true);
          }
        }).catch(() => setError(true));
      }}
    />
  );
}
