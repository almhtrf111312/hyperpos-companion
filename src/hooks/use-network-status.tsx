// Network status hook - tracks online/offline state
// Uses Capacitor Network plugin for reliable mobile detection
import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { showToast } from '@/lib/toast-config';
import { toast } from 'sonner';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineTime: number | null;
}

/**
 * Hook to track network connectivity status
 * Uses Capacitor Network plugin on mobile for reliable detection
 * Falls back to browser events on web
 * Shows toast notifications on status changes
 * Triggers callback when coming back online
 */
export function useNetworkStatus(onReconnect?: () => void) {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineTime: null,
  });
  
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // Keep callback ref updated
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const handleOnline = useCallback(() => {
    console.log('[Network] Online');
    const wasOffline = wasOfflineRef.current;
    
    setStatus({
      isOnline: true,
      wasOffline: false,
      lastOnlineTime: Date.now(),
    });
    
    if (wasOffline) {
      // Dismiss all existing toasts first to prevent stale "disconnected" showing
      toast.dismiss();
      setTimeout(() => {
        showToast.success('عادت الاتصال بالإنترنت ✓');
      }, 100);
      // Trigger reconnect callback
      setTimeout(() => {
        onReconnectRef.current?.();
      }, 500);
    }
    
    wasOfflineRef.current = false;
  }, []);

  const handleOffline = useCallback(() => {
    console.log('[Network] Offline');
    wasOfflineRef.current = true;
    
    setStatus(prev => ({
      ...prev,
      isOnline: false,
      wasOffline: true,
    }));
    
    showToast.error('انقطع الاتصال بالإنترنت');
  }, []);

  useEffect(() => {
    if (isNativePlatform) {
      // Use Capacitor Network plugin for native platforms (more reliable)
      console.log('[Network] Using Capacitor Network plugin');
      
      // Check initial status
      Network.getStatus().then(networkStatus => {
        console.log('[Network] Initial status:', networkStatus);
        if (!networkStatus.connected) {
          handleOffline();
        } else {
          setStatus(prev => ({
            ...prev,
            isOnline: true,
            lastOnlineTime: Date.now(),
          }));
        }
      }).catch(err => {
        console.error('[Network] Failed to get initial status:', err);
      });

      // Listen for network status changes
      const listener = Network.addListener('networkStatusChange', (networkStatus) => {
        console.log('[Network] Status changed:', networkStatus);
        if (networkStatus.connected) {
          handleOnline();
        } else {
          handleOffline();
        }
      });

      return () => {
        listener.then(handle => handle.remove());
      };
    } else {
      // Use browser events for web platform
      console.log('[Network] Using browser events');
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [handleOnline, handleOffline, isNativePlatform]);

  return status;
}

/**
 * Helper to check if currently online
 * Uses Capacitor Network on native, navigator.onLine on web
 */
export function isNetworkOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Async version that uses Capacitor Network for accurate status on mobile
 */
export async function getNetworkStatus(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch (error) {
      console.error('[Network] Failed to get status:', error);
      return navigator.onLine;
    }
  }
  return navigator.onLine;
}

/**
 * فحص فعلي للاتصال بالإنترنت (وليس فقط الشبكة المحلية)
 * يحاول الاتصال بخادم حقيقي للتأكد من وجود إنترنت فعلي
 * @param timeoutMs مهلة الفحص بالمللي ثانية (افتراضي 10 ثواني)
 */
export async function checkRealInternetAccess(timeoutMs: number = 10000): Promise<boolean> {
  // أولاً: تحقق سريع من حالة الشبكة
  const networkOnline = await getNetworkStatus();
  if (!networkOnline) return false;

  // ثانياً: فحص فعلي عبر fetch مع timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true; // إذا وصلنا هنا، الإنترنت يعمل
  } catch {
    clearTimeout(timeoutId);
    // محاولة ثانية مع سيرفر آخر
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
    try {
      await fetch('https://connectivitycheck.gstatic.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller2.signal,
      });
      clearTimeout(timeoutId2);
      return true;
    } catch {
      clearTimeout(timeoutId2);
      console.log('[Network] Real internet check failed - no actual internet access');
      return false;
    }
  }
}
