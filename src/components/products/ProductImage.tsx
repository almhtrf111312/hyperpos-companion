import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { getSignedImageUrl } from '@/lib/image-upload';
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
 */
export function ProductImage({ imageUrl, alt, className, iconClassName }: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setError(false);
      return;
    }

    // إذا كانت data URL (base64 مضغوطة أو خارجية) — عرضها مباشرة بدون signed URL
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:')) {
      setResolvedUrl(imageUrl);
      setError(false);
      return;
    }

    // مسار تخزين قصير - نحتاج signed URL
    let cancelled = false;
    getSignedImageUrl(imageUrl).then(url => {
      if (!cancelled) {
        setResolvedUrl(url);
        setError(false);
      }
    });

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
    />
  );
}
