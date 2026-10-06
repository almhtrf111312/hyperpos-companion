import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { getSignedImageUrl } from '@/lib/image-upload';
import { getCachedImage, cacheImage } from '@/lib/image-cache';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  imageUrl?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}

const signedUrlCache = new Map<string, string>();

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

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setError(false);
      return;
    }

    if (signedUrlCache.has(imageUrl)) {
      setResolvedUrl(signedUrlCache.get(imageUrl)!);
      return;
    }

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:')) {
      setResolvedUrl(imageUrl);
      signedUrlCache.set(imageUrl, imageUrl);
      return;
    }

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
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl || !isVisible || resolvedUrl) return;

    if (signedUrlCache.has(imageUrl)) {
      setResolvedUrl(signedUrlCache.get(imageUrl)!);
      return;
    }

    let cancelled = false;

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Image load timeout')), 5000) // Increased timeout for offline cache-first
    );

    Promise.race([
      (async () => {
        try {
          // 1. Cache-First: Try to get image from local cache immediately
          const cachedBlobUrl = await getCachedImage(imageUrl);
          if (cachedBlobUrl) {
            return cachedBlobUrl;
          }

          // 2. Fallback to network: get signed URL
          const signedUrl = await getSignedImageUrl(imageUrl);
          if (!signedUrl) return null;

          // 3. Fetch image and store in cache for future offline use
          try {
            const response = await fetch(signedUrl, { mode: 'cors', cache: 'no-cache' });
            if (response.ok) {
              const blob = await response.blob();
              await cacheImage(imageUrl, blob);
              const objectUrl = URL.createObjectURL(blob);
              return objectUrl;
            }
          } catch (fetchErr) {
            console.warn('[ProductImage] Failed to fetch and cache image for offline:', fetchErr);
          }

          return signedUrl;
        } catch (e) {
          return null;
        }
      })(),
      timeoutPromise
    ])
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
