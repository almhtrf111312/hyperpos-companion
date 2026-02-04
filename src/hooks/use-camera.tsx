import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';

interface UseCameraOptions {
  maxSize?: number;
  quality?: number;
  onPhotoRestored?: (base64: string) => void;
}

interface UseCameraResult {
  takePhoto: () => Promise<string | null>;
  pickFromGallery: () => Promise<string | null>;
  isLoading: boolean;
  isNative: boolean;
  error: string | null;
}

/**
 * Custom hook for camera functionality using Capacitor Camera plugin.
 * Provides native camera access on Android/iOS and falls back to file input on web.
 * 
 * Solves the Android OOM (Out-of-Memory) issue that occurs when using 
 * <input type="file" capture="environment"> by using Capacitor's native camera API
 * which doesn't require killing the app process.
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { maxSize = 640, quality = 70 } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For web fallback
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const isNative = Capacitor.isNativePlatform();

  /**
   * Compress image to reduce size for localStorage storage
   */
  const compressImage = useCallback((base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if larger than maxSize
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality / 100);
        resolve(compressedBase64);
      };
      img.onerror = () => resolve(base64); // Return original if compression fails
      img.src = base64;
    });
  }, [maxSize, quality]);

  /**
   * Take a photo using the device camera
   */
  const takePhoto = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isNative) {
        // ✅ Use Uri to save memory (33% less than Base64)
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          quality: 70,  // Optimal quality for product photos
          width: 800,   // Better resolution than 640px
          correctOrientation: true,
        });

        if (photo.path) {
          // Read file from Uri
          const fileData = await Filesystem.readFile({
            path: photo.path,
          });

          // Convert to Base64 for storage
          const base64 = `data:image/jpeg;base64,${fileData.data}`;
          const compressed = await compressImage(base64);
          setIsLoading(false);
          return compressed;
        }
        setIsLoading(false);
        return null;
      } else {
        // Fallback for web - use file input with capture
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
                  const base64 = reader.result as string;
                  const compressed = await compressImage(base64);
                  resolveRef.current?.(compressed);
                  resolveRef.current = null;
                  setIsLoading(false);
                };
                reader.onerror = () => {
                  resolveRef.current?.(null);
                  resolveRef.current = null;
                  setIsLoading(false);
                };
                reader.readAsDataURL(file);
              } else {
                resolveRef.current?.(null);
                resolveRef.current = null;
                setIsLoading(false);
              }

              // Reset input for re-selection
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
  }, [isNative, maxSize, quality, compressImage]);

  /**
   * Pick an image from the device gallery
   */
  const pickFromGallery = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isNative) {
        // ✅ Use Uri for gallery selection too
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
          quality: 70,
          width: 800,
          correctOrientation: true,
        });

        if (photo.path) {
          // Read file from Uri
          const fileData = await Filesystem.readFile({
            path: photo.path,
          });

          // Convert to Base64 for storage
          const base64 = `data:image/jpeg;base64,${fileData.data}`;
          const compressed = await compressImage(base64);
          setIsLoading(false);
          return compressed;
        }
        setIsLoading(false);
        return null;
      } else {
        // Fallback for web - use file input without capture
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
                  const base64 = reader.result as string;
                  const compressed = await compressImage(base64);
                  resolveRef.current?.(compressed);
                  resolveRef.current = null;
                  setIsLoading(false);
                };
                reader.onerror = () => {
                  resolveRef.current?.(null);
                  resolveRef.current = null;
                  setIsLoading(false);
                };
                reader.readAsDataURL(file);
              } else {
                resolveRef.current?.(null);
                resolveRef.current = null;
                setIsLoading(false);
              }

              // Reset input for re-selection
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
  }, [isNative, maxSize, quality, compressImage]);

  /* 
   * Handle Android Process Death / Activity Restoration
   * When the camera activity finishes, the app might be restarted. 
   * We need to listen for the 'appRestoredResult' to get the photo data back.
   */
  useEffect(() => {
    if (!isNative) return;

    let listener: any;

    const setupListener = async () => {
      listener = await App.addListener('appRestoredResult', async (restoreResult) => {
        if (restoreResult.pluginId === 'Camera' && restoreResult.methodName === 'getPhoto' && restoreResult.success) {
          console.log('App restored from Camera activity', restoreResult);

          if (restoreResult.data && restoreResult.data.webPath) {
            const photoPath = restoreResult.data.webPath; // Or path, depending on resultType. using webPath for now as it's common
            // If we used CameraResultType.Uri, data might contain `path` or `webPath` appropriate for Filesystem

            try {
              // For Uri result type, we need to read the file
              const fileData = await Filesystem.readFile({
                path: restoreResult.data.path || restoreResult.data.webPath,
              });

              const base64 = `data:image/jpeg;base64,${fileData.data}`;
              const compressed = await compressImage(base64);

              if (options.onPhotoRestored) {
                options.onPhotoRestored(compressed);
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
      if (listener) {
        listener.remove();
      }
    };
  }, [isNative, compressImage, options]);

  return {
    takePhoto,
    pickFromGallery,
    isLoading,
    isNative,
    error,
  };
}
