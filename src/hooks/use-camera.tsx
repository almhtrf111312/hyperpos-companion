import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface UseCameraOptions {
  maxSize?: number;
  quality?: number;
  onPhotoRestored?: (base64: string) => void;
  fallbackToInline?: boolean;
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
 * Custom hook for camera functionality using Capacitor Camera plugin.
 * Uses webPath + fetch(Blob) to avoid OOM on low-end Android devices.
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { maxSize = 640, quality = 70, fallbackToInline = true } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  const inlineCaptureResolveRef = useRef<((value: string | null) => void) | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const isNative = Capacitor.isNativePlatform();

  /**
   * Compress a Blob via Canvas and return a base64 data URL.
   * Works entirely with Blob/ImageBitmap to minimize peak memory.
   */
  const compressBlob = useCallback(async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
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
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }, [maxSize, quality]);

  /**
   * Compress a base64 string (fallback for web file input)
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
   * Ensure camera permissions are granted (native only)
   */
  const ensurePermissions = useCallback(async () => {
    if (!isNative) return true;
    try {
      const status = await Camera.checkPermissions();
      if (status.camera === 'granted') return true;
      const req = await Camera.requestPermissions({ permissions: ['camera'] });
      return req.camera === 'granted';
    } catch (e) {
      console.warn('[Camera] Permission check failed:', e);
      return true; // proceed anyway, Camera plugin will prompt
    }
  }, [isNative]);

  /**
   * Process native photo result: fetch webPath as Blob, compress, return base64
   */
  const processNativePhoto = useCallback(async (webPath: string | undefined): Promise<string | null> => {
    if (!webPath) return null;
    try {
      const response = await fetch(webPath);
      const blob = await response.blob();
      return await compressBlob(blob);
    } catch (e) {
      console.error('[Camera] Failed to process photo:', e);
      return null;
    }
  }, [compressBlob]);

  /**
   * Take a photo using the device camera
   *
   * On Android, launching the native camera can cause the WebView Activity to be
   * killed (Memory Pressure / Process Death). The result is delivered later via
   * the `appRestoredResult` event (handled below).  Any persistent form state
   * should be saved BEFORE calling this method — Products.tsx does this synchronously.
   */
  const takePhoto = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isNative) {
        await ensurePermissions();

        try {
          const photo = await Camera.getPhoto({
            resultType: CameraResultType.Uri,  // Uri → Blob avoids OOM on low-end devices
            source: CameraSource.Camera,
            quality: 70,
            width: 800,
            correctOrientation: true,
            saveToGallery: false,
            // allowEditing: false ensures we return directly after capture
          });

          const result = await processNativePhoto(photo.webPath);
          setIsLoading(false);
          return result;
        } catch (nativeErr: unknown) {
          const errMsg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
          // User cancelled — not a real error
          const cancelled = errMsg.includes('cancelled') || errMsg.includes('User cancelled') ||
            errMsg.includes('No image picked') || errMsg.includes('dismissed');
          if (!cancelled) {
            console.warn('[Camera] Native camera failed, checking inline fallback:', nativeErr);
          }

          // If fallbackToInline is enabled, open inline camera instead of failing
          if (fallbackToInline && !cancelled) {
            setIsLoading(false);
            return new Promise<string | null>((resolve) => {
              inlineCaptureResolveRef.current = resolve;
              setShowInlineCamera(true);
            });
          }
          setIsLoading(false);
          return null;
        }
      } else {
        // Web fallback
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
          fileInputRef.current.setAttribute('capture', 'environment');
          fileInputRef.current.click();
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'فشل في التقاط الصورة';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Camera error:', err);
      return null;
    }
  }, [isNative, compressBase64, ensurePermissions, processNativePhoto, fallbackToInline]);

  /**
   * Pick an image from the device gallery
   */
  const pickFromGallery = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isNative) {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
          quality: 70,
          width: 800,
          correctOrientation: true,
        });

        const result = await processNativePhoto(photo.webPath);
        setIsLoading(false);
        return result;
      } else {
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
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'فشل في اختيار الصورة';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Gallery error:', err);
      return null;
    }
  }, [isNative, compressBase64, processNativePhoto]);

  /**
   * Keep a stable ref to onPhotoRestored so the listener is never re-registered
   * on every render (avoids missing the event on Android Process Death).
   */
  const onPhotoRestoredRef = useRef(options.onPhotoRestored);
  useEffect(() => {
    onPhotoRestoredRef.current = options.onPhotoRestored;
  }, [options.onPhotoRestored]);

  /**
   * Handle Android Process Death / Activity Restoration
   */
  useEffect(() => {
    if (!isNative) return;

    let listener: any;

    const setupListener = async () => {
      listener = await App.addListener('appRestoredResult', async (restoreResult) => {
        if (restoreResult.pluginId === 'Camera' && restoreResult.methodName === 'getPhoto' && restoreResult.success) {
          console.log('App restored from Camera activity', restoreResult);

          const webPath = restoreResult.data?.webPath;
          if (webPath) {
            try {
              const compressed = await processNativePhoto(webPath);
              if (compressed && onPhotoRestoredRef.current) {
                onPhotoRestoredRef.current(compressed);
              }
            } catch (e) {
              console.error('Failed to process restored photo', e);
              setError('فشل في استعادة الصورة بعد إعادة تشغيل التطبيق');
            }
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listener) listener.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, processNativePhoto]); // intentionally omit options — using ref instead

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
