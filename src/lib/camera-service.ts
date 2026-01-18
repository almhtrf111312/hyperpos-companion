// Camera Service using Capacitor Camera Plugin
// Provides native camera access with memory-efficient image capture
// Falls back to web file input when not on native platform

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface CameraServiceResult {
  success: boolean;
  image?: string; // Base64 data URL
  error?: string;
}

/**
 * Check if native camera is available
 */
export function isNativeCameraAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Capture photo using native camera with memory-optimized settings
 * Returns compressed Base64 image ready for storage
 */
export async function capturePhoto(): Promise<CameraServiceResult> {
  try {
    // Check camera permissions first
    const permissions = await Camera.checkPermissions();
    
    if (permissions.camera !== 'granted') {
      const requested = await Camera.requestPermissions();
      if (requested.camera !== 'granted') {
        return {
          success: false,
          error: 'لم يتم منح إذن الكاميرا'
        };
      }
    }

    // Capture photo with memory-optimized settings
    const photo: Photo = await Camera.getPhoto({
      quality: 50, // Lower quality to reduce memory usage
      allowEditing: false,
      resultType: CameraResultType.Base64, // Get Base64 directly to avoid file I/O
      source: CameraSource.Camera,
      width: 640, // Max width
      height: 640, // Max height
      correctOrientation: true,
      saveToGallery: false, // Don't save to gallery to reduce memory
    });

    if (!photo.base64String) {
      return {
        success: false,
        error: 'فشل في الحصول على الصورة'
      };
    }

    // Convert to data URL format
    const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${photo.base64String}`;

    return {
      success: true,
      image: dataUrl
    };
  } catch (error: any) {
    console.error('Camera capture error:', error);
    
    // Handle user cancellation
    if (error.message?.includes('User cancelled') || error.message?.includes('canceled')) {
      return {
        success: false,
        error: 'cancelled'
      };
    }
    
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء التقاط الصورة'
    };
  }
}

/**
 * Pick photo from gallery using native picker
 */
export async function pickFromGallery(): Promise<CameraServiceResult> {
  try {
    const permissions = await Camera.checkPermissions();
    
    if (permissions.photos !== 'granted') {
      const requested = await Camera.requestPermissions();
      if (requested.photos !== 'granted') {
        return {
          success: false,
          error: 'لم يتم منح إذن الوصول للصور'
        };
      }
    }

    const photo: Photo = await Camera.getPhoto({
      quality: 60,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      width: 640,
      height: 640,
      correctOrientation: true,
    });

    if (!photo.base64String) {
      return {
        success: false,
        error: 'فشل في الحصول على الصورة'
      };
    }

    const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${photo.base64String}`;

    return {
      success: true,
      image: dataUrl
    };
  } catch (error: any) {
    console.error('Gallery pick error:', error);
    
    if (error.message?.includes('User cancelled') || error.message?.includes('canceled')) {
      return {
        success: false,
        error: 'cancelled'
      };
    }
    
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء اختيار الصورة'
    };
  }
}

/**
 * Compress an existing base64 image to reduce size
 * Useful for images from web input fallback
 */
export function compressBase64Image(
  base64: string, 
  maxSize: number = 480, 
  quality: number = 0.5
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions
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
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}
