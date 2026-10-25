import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { checkNotificationPermissionNative } from '@/lib/native-notifications';

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
    // Check permission statuses passively (on-demand prompt when used)
    const checkPermissions = async () => {
      try {
        if (!Capacitor.isNativePlatform()) {
          const notif = typeof window !== 'undefined' && 'Notification' in window
            ? (Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt')
            : 'prompt';
          setStatus({ camera: 'granted', storage: 'granted', notifications: notif, requested: true });
          return;
        }

        // On native, check passively without prompting
        const { Camera } = await import('@capacitor/camera');
        const cameraResult = await Camera.checkPermissions();
        const cameraStatus = cameraResult.camera === 'granted' ? 'granted' :
          cameraResult.camera === 'denied' ? 'denied' : 'prompt';

        const { Filesystem } = await import('@capacitor/filesystem');
        let storageStatus: 'granted' | 'denied' | 'prompt' = 'prompt';
        try {
          const storageResult = await Filesystem.checkPermissions();
          storageStatus = storageResult.publicStorage === 'granted' ? 'granted' :
            storageResult.publicStorage === 'denied' ? 'denied' : 'prompt';
        } catch {
          storageStatus = 'prompt';
        }

        const notifStatus = await checkNotificationPermissionNative();

        setStatus({
          camera: cameraStatus,
          storage: storageStatus,
          notifications: notifStatus,
          requested: true,
        });

        console.log('[Permissions Status (On-Demand)] Camera:', cameraStatus, '| Storage:', storageStatus, '| Notifications:', notifStatus);
      } catch (error) {
        console.warn('[Permissions] Failed to check permissions:', error);
        setStatus(prev => ({ ...prev, requested: true }));
      }
    };

    checkPermissions();
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
      console.warn('[Permissions] Opening app settings is not directly supported in Cap 8 barcode scanner');
    } catch (error) {
      console.error('[Permissions] Failed to open settings:', error);
    }
  };

  return { openSettings };
}
