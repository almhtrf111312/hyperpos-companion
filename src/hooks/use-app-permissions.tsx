import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermissionNative } from '@/lib/native-notifications';

interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  storage: 'granted' | 'denied' | 'prompt' | 'unknown';
  notifications: 'granted' | 'denied' | 'prompt' | 'unknown';
  requested: boolean;
}

export function useAppPermissions() {
  const [status, setStatus] = useState<PermissionStatus>({
    camera: 'unknown',
    storage: 'unknown',
    notifications: 'unknown',
    requested: false,
  });

  useEffect(() => {
    // Request notification permission (web / PWA path only)
    const requestWebNotificationPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') return 'granted';
          if (Notification.permission === 'denied') return 'denied';
          const res = await Notification.requestPermission();
          return res === 'granted' ? 'granted' : res === 'denied' ? 'denied' : 'prompt';
        }
      } catch (err) {
        console.warn('[Permissions] Notification request error:', err);
      }
      return 'prompt';
    };

    if (!Capacitor.isNativePlatform()) {
      requestWebNotificationPermission().then(notifStatus => {
        setStatus({ camera: 'granted', storage: 'granted', notifications: notifStatus, requested: true });
      });
      return;
    }

    const requestPermissions = async () => {
      try {
        // Request camera permission via Camera plugin (Capacitor 8)
        const { Camera } = await import('@capacitor/camera');
        const cameraResult = await Camera.requestPermissions({ permissions: ['camera'] });

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

        // On Android, use @capacitor/local-notifications to show the real
        // POST_NOTIFICATIONS system dialog (Android 13+). The web Notification API
        // is NOT supported inside Android WebView and shows nothing.
        const notifResult = await requestNotificationPermissionNative();
        const notifStatus: 'granted' | 'denied' | 'prompt' =
          notifResult === 'granted' ? 'granted' : 'denied';

        setStatus({
          camera: cameraStatus,
          storage: storageStatus,
          notifications: notifStatus,
          requested: true,
        });

        console.log('[Permissions] Camera:', cameraStatus, '| Storage:', storageStatus, '| Notifications:', notifStatus);
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
      // Use App plugin to open settings (Capacitor 8)
      const { App } = await import('@capacitor/app');
      // Note: App plugin doesn't have openAppSettings, use native approach
      console.warn('[Permissions] Opening app settings is not directly supported in Cap 8 barcode scanner');
    } catch (error) {
      console.error('[Permissions] Failed to open settings:', error);
    }
  };

  return { openSettings };
}
