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

// كاش في الذاكرة للروابط الموقعة لتجنب إعادة طلب التوقيع لنفس الصورة
const signedUrlMemo = new Map<string, { url: string; at: number }>();
const SIGNED_TTL = 50 * 60 * 1000;

async function resolveSigned(path: string): Promise<string | null> {
  const hit = signedUrlMemo.get(path);
  if (hit && Date.now() - hit.at < SIGNED_TTL) return hit.url;
  const signed = await getSignedImageUrl(path);
  if (signed) signedUrlMemo.set(path, { url: signed, at: Date.now() });
  return signed;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]);
}

/**
 * عرض صور المنتجات — لا يبدأ أي جلب إلا عند اقتراب البطاقة من الظهور على الشاشة.
 * أيقونة فورية كبديل، ومهلة قصيرة كي لا تتأخر الواجهة.
 */
export function ProductImage({ imageUrl, alt, className, iconClassName }: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // مراقبة الظهور
  useEffect(() => {
    if (visible) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(true);
        obs.disconnect();
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) { setResolvedUrl(null); setError(false); return; }
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      setResolvedUrl(imageUrl); setError(false); return;
    }
    if (!visible) return;

    let cancelled = false;
    (async () => {
      try {
        const finalUrl = imageUrl.startsWith('http') ? imageUrl : await withTimeout(resolveSigned(imageUrl), 4000);
        if (!finalUrl || cancelled) { if (!cancelled) setError(true); return; }
        const blobUrl = await fetchWithCache(finalUrl);
        if (cancelled) { if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl); return; }
        if (blobUrl) {
          if (blobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = blobUrl;
          setResolvedUrl(blobUrl);
          setError(false);
        } else {
          setResolvedUrl(null);
          setError(true);
        }
      } catch {
        if (!cancelled) { setResolvedUrl(null); setError(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl, visible]);

  if (!imageUrl || error || !resolvedUrl) {
    return (
      <div ref={containerRef} className={cn("flex items-center justify-center bg-muted", className)}>
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
      decoding="async"
    />
  );
}
