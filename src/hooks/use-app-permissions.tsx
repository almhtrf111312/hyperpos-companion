import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermissionNative } from '@/lib/native-notifications';

export interface AppPermissionsStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  storage: 'granted' | 'denied' | 'prompt' | 'unknown';
  notifications: 'granted' | 'denied' | 'prompt' | 'unknown';
  requested: boolean;
}

/**
 * On-Demand App Permissions Hook
 * 
 * Strict architectural rule:
 * NO automatic useEffect or background timers soliciting permissions on app launch!
 * Permissions must be requested only when the user explicitly triggers an action
 * that requires them (e.g. scanning barcodes, taking product photos, enabling notifications).
 */
export function useAppPermissions() {
  const [status, setStatus] = useState<AppPermissionsStatus>({
    camera: 'unknown',
    storage: 'unknown',
    notifications: 'unknown',
    requested: false,
  });

  // طلب إذن الكاميرا فقط عند فتح ميزة تتطلبها (مثل قارئ الباركود أو التقاط صورة)
  const requestCameraPermission = useCallback(async (): Promise<'granted' | 'denied'> => {
    if (!Capacitor.isNativePlatform()) return 'granted';
    try {
      const { Camera } = await import('@capacitor/camera');
      const res = await Camera.requestPermissions({ permissions: ['camera'] });
      const perm: 'granted' | 'denied' = res.camera === 'granted' ? 'granted' : 'denied';
      setStatus(prev => ({ ...prev, camera: perm, requested: true }));
      return perm;
    } catch (e) {
      console.warn('[Permissions] Camera request error:', e);
      setStatus(prev => ({ ...prev, camera: 'denied', requested: true }));
      return 'denied';
    }
  }, []);

  // طلب إذن الإشعارات عند تفعيل خيار إشعارات أو الحاجة لها
  const requestNotificationPermission = useCallback(async (): Promise<'granted' | 'denied'> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await requestNotificationPermissionNative();
        const perm: 'granted' | 'denied' = res === 'granted' ? 'granted' : 'denied';
        setStatus(prev => ({ ...prev, notifications: perm, requested: true }));
        return perm;
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') return 'granted';
        const res = await Notification.requestPermission();
        const perm: 'granted' | 'denied' = res === 'granted' ? 'granted' : 'denied';
        setStatus(prev => ({ ...prev, notifications: perm, requested: true }));
        return perm;
      }
    } catch (e) {
      console.warn('[Permissions] Notification request error:', e);
    }
    setStatus(prev => ({ ...prev, notifications: 'denied', requested: true }));
    return 'denied';
  }, []);

  // لا يوجد هنا أي useEffect أو setTimeout يطلب الأذونات صامتاً عند الإقلاع!
  return {
    status,
    requestCameraPermission,
    requestNotificationPermission,
  };
}

/**
 * Hook to open app settings for manual permission grant if needed
 */
export function useOpenAppSettings() {
  const openSettings = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { App } = await import('@capacitor/app');
      console.warn('[Permissions] Opening app settings is managed natively or via system settings');
    } catch (error) {
      console.error('[Permissions] Failed to open settings:', error);
    }
  };

  return { openSettings };
}
