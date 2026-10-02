import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { getSignedImageUrl } from '@/lib/image-upload';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  imageUrl?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}

// كاش في الذاكرة لتفادي إعادة طلب روابط الصور المُوقعة أكثر من مرة
const signedUrlCache = new Map<string, string>();

/**
 * مكون مشترك لعرض صور المنتجات
 * - يعرض أيقونة بديلة رمادية خفيفة (Placeholder) فوراً لفصل عرض البيانات عن الصور
 * - تفعيل التحميل الكسول الحقيقي (Lazy Loading) عبر IntersectionObserver
 * - لا يتم طلب أو فك تشفير رابط الصورة إلا عند ظهور البطاقة في إطار الرؤية (Viewport)
 * - مهلة زمنية قصيرة (أقصاها ثانيتان) لتجنب تعليق الواجهة
 */
export function ProductImage({ imageUrl, alt, className, iconClassName }: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (!imageUrl) return null;
    if (signedUrlCache.has(imageUrl)) return signedUrlCache.get(imageUrl)!;
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:')) {
      return imageUrl;
    }
    return null;
  });
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. مراقبة ظهور العنصر داخل إطار الرؤية عبر IntersectionObserver
  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setError(false);
      return;
    }

    // إذا كانت الصورة مسبقة الكاش أو رابطاً مباشراً، لا نحتاج للانتظار
    if (signedUrlCache.has(imageUrl)) {
      setResolvedUrl(signedUrlCache.get(imageUrl)!);
      return;
    }

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:')) {
      setResolvedUrl(imageUrl);
      signedUrlCache.set(imageUrl, imageUrl);
      return;
    }

    // فحص دعم المتصفح
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
        rootMargin: '100px', // التحميل المسبق الخفيف قبل الظهور التام
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [imageUrl]);

  // 2. طلب رابط الصورة فقط بعد تأكيد ظهور العنصر في إطار الرؤية
  useEffect(() => {
    if (!imageUrl || !isVisible || resolvedUrl) return;

    if (signedUrlCache.has(imageUrl)) {
      setResolvedUrl(signedUrlCache.get(imageUrl)!);
      return;
    }

    let cancelled = false;

    // مهلة زمنية قصيرة (ثانيتان فقط) لتفادي أي بطء في الواجهة
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Image load timeout')), 2000)
    );

    Promise.race([getSignedImageUrl(imageUrl), timeoutPromise])
      .then((url) => {
        if (!cancelled) {
          if (url) {
            signedUrlCache.set(imageUrl, url);
            setResolvedUrl(url);
            setError(false);
          } else {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });

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
      onError={() => setError(true)}
    />
  );
}
