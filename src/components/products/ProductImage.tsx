import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { getSignedImageUrl } from '@/lib/image-upload';
import { fetchWithCache } from '@/lib/image-cache';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  imageUrl?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}

/**
 * مكون مشترك لعرض صور المنتجات
 * يتعامل مع المسارات القصيرة و signed URLs القديمة
 * ✅ يدعم التخزين المؤقت المحلي (Cache-First) للعمل أوفلاين
 */
export function ProductImage({ imageUrl, alt, className, iconClassName }: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // تنظيف blob URLs عند unmount أو تغيير الصورة
  useEffect(() => {
    return () => {
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setError(false);
      return;
    }

    // إذا كانت data URL (base64 مضغوطة) أو blob — عرضها مباشرة
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      setResolvedUrl(imageUrl);
      setError(false);
      return;
    }

    let cancelled = false;

    const resolveImage = async () => {
      try {
        let finalUrl: string;

        if (imageUrl.startsWith('http')) {
          // رابط كامل — جلبه مباشرة مع كاش
          finalUrl = imageUrl;
        } else {
          // مسار تخزين قصير — نحتاج signed URL أولاً
          const signed = await getSignedImageUrl(imageUrl);
          if (!signed || cancelled) return;
          finalUrl = signed;
        }

        // ✅ استخدام Cache-First: يبحث محلياً أولاً، ثم يجلب ويحفظ
        const cachedBlobUrl = await fetchWithCache(finalUrl);
        if (cancelled) return;

        if (cachedBlobUrl) {
          // تنظيف blob URL السابق
          if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          blobUrlRef.current = cachedBlobUrl;
          setResolvedUrl(cachedBlobUrl);
          setError(false);
        } else {
          // لم يتمكن من الجلب أو الكاش — عرض أيقونة المنتج
          setResolvedUrl(null);
          setError(true);
        }
      } catch {
        if (!cancelled) {
          setResolvedUrl(null);
          setError(true);
        }
      }
    };

    resolveImage();

    return () => { cancelled = true; };
  }, [imageUrl]);

  if (!imageUrl || error || !resolvedUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <Package className={cn("text-muted-foreground/50", iconClassName || "w-6 h-6")} />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={cn("object-cover", className)}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
