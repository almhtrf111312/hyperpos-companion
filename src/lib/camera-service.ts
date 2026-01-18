// Camera Service using Capacitor Camera Plugin
// Provides native camera access with memory-efficient image capture
// Falls back to web file input when not on native platform
// Handles Android process death by restoring camera results

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Storage keys for camera restoration
const PENDING_CAMERA_KEY = 'hyperpos_pending_camera';
const RESTORED_IMAGE_KEY = 'hyperpos_restored_image';
const FORM_STATE_KEY = 'hyperpos_camera_form_state';

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

// ==================== Camera Restoration Functions ====================

/**
 * Mark that a camera capture is pending (before opening camera)
 * This helps restore state if Android kills the app
 */
export function markPendingCameraCapture(formData: any, isEditing: boolean, selectedProductId?: string): void {
  const state = {
    formData,
    isEditing,
    selectedProductId,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(PENDING_CAMERA_KEY, 'true');
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(state));
    console.log('[CameraService] Marked pending camera capture, saved form state');
  } catch (e) {
    console.error('[CameraService] Failed to save form state:', e);
  }
}

/**
 * Clear pending camera capture flag
 */
export function clearPendingCameraCapture(): void {
  localStorage.removeItem(PENDING_CAMERA_KEY);
  console.log('[CameraService] Cleared pending camera capture');
}

/**
 * Check if there's a pending camera capture
 */
export function hasPendingCameraCapture(): boolean {
  const pending = localStorage.getItem(PENDING_CAMERA_KEY);
  // Only valid if less than 5 minutes old (camera session shouldn't take longer)
  if (pending) {
    const stateStr = localStorage.getItem(FORM_STATE_KEY);
    if (stateStr) {
      try {
        const state = JSON.parse(stateStr);
        const age = Date.now() - state.timestamp;
        if (age < 5 * 60 * 1000) {
          return true;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    // Cleanup stale data
    localStorage.removeItem(PENDING_CAMERA_KEY);
  }
  return false;
}

/**
 * Get restored camera result (image captured before app was killed)
 */
export function getRestoredCameraResult(): { image: string; formState: any } | null {
  const image = localStorage.getItem(RESTORED_IMAGE_KEY);
  const stateStr = localStorage.getItem(FORM_STATE_KEY);
  
  if (image && stateStr) {
    try {
      const formState = JSON.parse(stateStr);
      // Clean up after retrieval
      localStorage.removeItem(RESTORED_IMAGE_KEY);
      localStorage.removeItem(FORM_STATE_KEY);
      localStorage.removeItem(PENDING_CAMERA_KEY);
      console.log('[CameraService] Retrieved restored camera result');
      return { image, formState };
    } catch (e) {
      console.error('[CameraService] Failed to parse restored state:', e);
    }
  }
  
  return null;
}

/**
 * Save restored image from appRestoredResult event
 */
function saveRestoredImage(dataUrl: string): void {
  try {
    localStorage.setItem(RESTORED_IMAGE_KEY, dataUrl);
    console.log('[CameraService] Saved restored image from camera');
  } catch (e) {
    console.error('[CameraService] Failed to save restored image:', e);
  }
}

// Flag to prevent multiple listener registrations
let restorationListenerInitialized = false;

/**
 * Initialize camera restoration listener for handling Android process death
 * Call this once when the app starts
 */
export function initCameraRestoration(): void {
  if (restorationListenerInitialized) {
    console.log('[CameraService] Restoration listener already initialized');
    return;
  }
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[CameraService] Not on native platform, skipping restoration init');
    return;
  }
  
  console.log('[CameraService] Initializing camera restoration listener');
  
  App.addListener('appRestoredResult', (data) => {
    console.log('[CameraService] App restored result received:', data.pluginId, data.success);
    
    if (data.pluginId === 'Camera' && data.success && data.data) {
      const photo = data.data as Photo;
      
      if (photo.base64String) {
        const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${photo.base64String}`;
        saveRestoredImage(dataUrl);
        console.log('[CameraService] Camera result restored successfully');
      } else if (photo.webPath) {
        // If we got a webPath instead, we need to fetch and convert it
        console.log('[CameraService] Got webPath, attempting conversion');
        fetch(photo.webPath)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                saveRestoredImage(reader.result);
              }
            };
            reader.readAsDataURL(blob);
          })
          .catch(err => console.error('[CameraService] Failed to convert webPath:', err));
      }
    } else if (data.pluginId === 'Camera' && !data.success) {
      // Camera was cancelled or failed, clean up pending state
      clearPendingCameraCapture();
      localStorage.removeItem(FORM_STATE_KEY);
    }
  });
  
  restorationListenerInitialized = true;
  console.log('[CameraService] Restoration listener registered');
}
