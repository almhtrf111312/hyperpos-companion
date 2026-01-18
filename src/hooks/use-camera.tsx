import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface UseCameraOptions {
  maxSize?: number;
  quality?: number;
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
        // Use Capacitor Camera plugin on native platforms
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          quality,
          width: maxSize,
          height: maxSize,
          correctOrientation: true,
        });
        
        if (photo.base64String) {
          const base64 = `data:image/jpeg;base64,${photo.base64String}`;
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
        // Use Capacitor Camera plugin on native platforms
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Photos,
          quality,
          width: maxSize,
          height: maxSize,
          correctOrientation: true,
        });
        
        if (photo.base64String) {
          const base64 = `data:image/jpeg;base64,${photo.base64String}`;
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

  return {
    takePhoto,
    pickFromGallery,
    isLoading,
    isNative,
    error,
  };
}
