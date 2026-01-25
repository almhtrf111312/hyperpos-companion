/**
 * Early App Permissions Hook
 * ===========================
 * طلب أذونات الكاميرا والتخزين عند بدء تشغيل التطبيق
 * يُستدعى في App.tsx لضمان طلب الأذونات مبكراً
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  storage: 'granted' | 'denied' | 'prompt' | 'unknown';
  requested: boolean;
}

export function useAppPermissions() {
  const [status, setStatus] = useState<PermissionStatus>({
    camera: 'unknown',
    storage: 'unknown',
    requested: false,
  });

  useEffect(() => {
    // Only request on native platforms
    if (!Capacitor.isNativePlatform()) {
      setStatus({ camera: 'granted', storage: 'granted', requested: true });
      return;
    }

    const requestPermissions = async () => {
      try {
        // Request camera permission via ML Kit Barcode Scanner
        const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
        const cameraResult = await BarcodeScanner.requestPermissions();
        
        const cameraStatus = cameraResult.camera === 'granted' ? 'granted' : 
                            cameraResult.camera === 'denied' ? 'denied' : 'prompt';

        // Request storage permission via Filesystem
        const { Filesystem } = await import('@capacitor/filesystem');
        let storageStatus: 'granted' | 'denied' | 'prompt' = 'unknown' as any;
        
        try {
          const storageResult = await Filesystem.requestPermissions();
          storageStatus = storageResult.publicStorage === 'granted' ? 'granted' : 
                         storageResult.publicStorage === 'denied' ? 'denied' : 'prompt';
        } catch (storageError) {
          console.warn('[Permissions] Storage permission request failed:', storageError);
          storageStatus = 'prompt';
        }

        setStatus({
          camera: cameraStatus,
          storage: storageStatus,
          requested: true,
        });

        console.log('[Permissions] Camera:', cameraStatus, '| Storage:', storageStatus);
      } catch (error) {
        console.warn('[Permissions] Failed to request permissions:', error);
        setStatus(prev => ({ ...prev, requested: true }));
      }
    };

    // Small delay to let the app initialize first
    const timer = setTimeout(requestPermissions, 500);
    return () => clearTimeout(timer);
  }, []);

  return status;
}

/**
 * Hook to open app settings for manual permission grant
 */
export function useOpenAppSettings() {
  const openSettings = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.openSettings();
    } catch (error) {
      console.error('[Permissions] Failed to open settings:', error);
    }
  };

  return { openSettings };
}
