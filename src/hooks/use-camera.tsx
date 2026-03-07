import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

interface UseCameraOptions {
  maxSize?: number;
  quality?: number;
  onPhotoRestored?: (base64: string) => void;
  fallbackToInline?: boolean;
  preferInline?: boolean;
}

interface UseCameraResult {
  takePhoto: () => Promise<string | null>;
  pickFromGallery: () => Promise<string | null>;
  isLoading: boolean;
  isNative: boolean;
  error: string | null;
  showInlineCamera: boolean;
  onInlineCaptured: (base64: string) => void;
  closeInlineCamera: () => void;
}

/**
 * Custom hook for camera functionality.
 *
 * ── Native (Android/iOS) ──────────────────────────────────────────────────
 * Opens the NativeCameraPreview component which uses @capgo/camera-preview.
 * The camera renders as a native layer INSIDE the current Activity — no new
 * Activity is launched, so Android never kills the WebView (no app restart).
 *
 * ── Web ───────────────────────────────────────────────────────────────────
 * Falls back to a <file input> or the InlineCamera (getUserMedia).
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { maxSize = 400, quality = 40 } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // showInlineCamera controls NativeCameraPreview on native and
  // the old InlineCamera on web (re-used for both via the same state).
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  const inlineCaptureResolveRef = useRef<((value: string | null) => void) | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const isNative = Capacitor.isNativePlatform();

  /**
   * Compress a base64 string via Canvas.
   */
  const compressBase64 = useCallback((base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality / 100));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }, [maxSize, quality]);

  /**
   * Take a photo.
   *
   * On native → opens NativeCameraPreview (via showInlineCamera flag).
   *             @capgo/camera-preview is used inside the component.
   * On web    → opens <file input> with capture="environment".
   */
  const takePhoto = useCallback(async (): Promise<string | null> => {
    setIsLoading(false); // NativeCameraPreview handles its own loading state
    setError(null);

    // Native: use NativeCameraPreview (camera-preview plugin)
    if (isNative) {
      return new Promise<string | null>((resolve) => {
        inlineCaptureResolveRef.current = resolve;
        setShowInlineCamera(true);
      });
    }

    // Web: use InlineCamera (getUserMedia) — same flag, rendered differently
    // in Products.tsx based on isNative
    return new Promise<string | null>((resolve) => {
      inlineCaptureResolveRef.current = resolve;
      setShowInlineCamera(true);
    });
  }, [isNative]);

  /**
   * Pick from gallery (native uses file input; web uses file input too).
   */
  const pickFromGallery = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    // Use file input on ALL platforms (including native) to avoid
    // launching an external Activity that causes Android Process Death
    return new Promise((resolve) => {
      if (!fileInputRef.current) {
        fileInputRef.current = document.createElement('input');
        fileInputRef.current.type = 'file';
        fileInputRef.current.accept = 'image/*';
        fileInputRef.current.style.display = 'none';
        document.body.appendChild(fileInputRef.current);

        fileInputRef.current.addEventListener('change', async (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const compressed = await compressBase64(reader.result as string);
              resolveRef.current?.(compressed);
              resolveRef.current = null;
              setIsLoading(false);
            };
            reader.onerror = () => { resolveRef.current?.(null); resolveRef.current = null; setIsLoading(false); };
            reader.readAsDataURL(file);
          } else {
            resolveRef.current?.(null); resolveRef.current = null; setIsLoading(false);
          }
          target.value = '';
        });
      }
      resolveRef.current = resolve;
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    });
  }, [isNative, maxSize, quality, compressBase64]);

  /**
   * Keep a stable ref to onPhotoRestored.
   */
  const onPhotoRestoredRef = useRef(options.onPhotoRestored);
  useEffect(() => {
    onPhotoRestoredRef.current = options.onPhotoRestored;
  }, [options.onPhotoRestored]);

  /**
   * Handle Android Process Death (kept for safety — rarely triggered now
   * since we no longer launch a separate Camera Activity).
   */
  useEffect(() => {
    if (!isNative) return;
    let listener: { remove: () => void } | undefined;
    const setup = async () => {
      listener = await App.addListener('appRestoredResult', async (result) => {
        if (result.pluginId === 'Camera' && result.methodName === 'getPhoto' && result.success) {
          const webPath = result.data?.webPath;
          if (webPath && onPhotoRestoredRef.current) {
            try {
              const response = await fetch(webPath);
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
                else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                const base64 = canvas.toDataURL('image/jpeg', quality / 100);
                onPhotoRestoredRef.current?.(base64);
              };
              img.src = url;
            } catch (e) {
              console.error('Failed to restore photo', e);
            }
          }
        }
      });
    };
    setup();
    return () => { listener?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  const onInlineCaptured = useCallback((base64: string) => {
    setShowInlineCamera(false);
    if (inlineCaptureResolveRef.current) {
      inlineCaptureResolveRef.current(base64);
      inlineCaptureResolveRef.current = null;
    }
  }, []);

  const closeInlineCamera = useCallback(() => {
    setShowInlineCamera(false);
    if (inlineCaptureResolveRef.current) {
      inlineCaptureResolveRef.current(null);
      inlineCaptureResolveRef.current = null;
    }
  }, []);

  return { takePhoto, pickFromGallery, isLoading, isNative, error, showInlineCamera, onInlineCaptured, closeInlineCamera };
}
