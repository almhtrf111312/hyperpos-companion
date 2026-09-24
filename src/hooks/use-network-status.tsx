// Network status hook - tracks online/offline state
// Uses Capacitor Network plugin for reliable mobile detection + active multi-probe for dead VPN detection
import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineTime: number | null;
}

// Global cached probe result to prevent hammering probes while providing instant checks
let globalProbeResult: { isOnline: boolean; timestamp: number } | null = null;
const PROBE_CACHE_TTL = 4000; // 4 seconds cache

/**
 * Hook to track network connectivity status
 * Uses Capacitor Network plugin on mobile for reliable detection
 * Falls back to browser events on web
 * Triggers callback when coming back online
 * Proactively verifies WAN connectivity to detect dead VPN connections (tun0 ghost networks)
 */
export function useNetworkStatus(onReconnect?: () => void) {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    const rawOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (globalProbeResult && Date.now() - globalProbeResult.timestamp < PROBE_CACHE_TTL) {
      return {
        isOnline: globalProbeResult.isOnline,
        wasOffline: !globalProbeResult.isOnline,
        lastOnlineTime: globalProbeResult.isOnline ? Date.now() : null,
      };
    }
    return {
      isOnline: rawOnline,
      wasOffline: false,
      lastOnlineTime: rawOnline ? Date.now() : null,
    };
  });
  
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // Keep callback ref updated
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const verifyAndSetOnline = useCallback(async () => {
    // Check if network is connected, then verify real internet access (catches dead VPN)
    const hasRealInternet = await checkRealInternetAccess(2500);
    if (!hasRealInternet) {
      console.warn('[Network] ⚠️ Network reports connected, but dead VPN / no WAN detected. Staying offline.');
      wasOfflineRef.current = true;
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        wasOffline: true,
      }));
      return;
    }

    console.log('[Network] ✅ Real internet confirmed');
    const wasOffline = wasOfflineRef.current;
    
    setStatus({
      isOnline: true,
      wasOffline: false,
      lastOnlineTime: Date.now(),
    });
    
    if (wasOffline) {
      setTimeout(() => {
        onReconnectRef.current?.();
      }, 300);
    }
    
    wasOfflineRef.current = false;
  }, []);

  const handleOnline = useCallback(() => {
    console.log('[Network] Network interface reported connected - verifying WAN/VPN...');
    verifyAndSetOnline();
  }, [verifyAndSetOnline]);

  const handleOffline = useCallback(() => {
    console.log('[Network] Offline event');
    wasOfflineRef.current = true;
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    
    setStatus(prev => ({
      ...prev,
      isOnline: false,
      wasOffline: true,
    }));
  }, []);

  useEffect(() => {
    let appResumeListener: { remove: () => void } | null = null;

    if (isNativePlatform) {
      console.log('[Network] Using Capacitor Network plugin with dead VPN detection');
      
      // Check initial status
      Network.getStatus().then(networkStatus => {
        if (!networkStatus.connected) {
          handleOffline();
        } else {
          // Probe quickly to catch dead VPN on app open
          verifyAndSetOnline();
        }
      }).catch(err => {
        console.error('[Network] Failed to get initial status:', err);
      });

      // Listen for network status changes
      const listenerPromise = Network.addListener('networkStatusChange', (networkStatus) => {
        console.log('[Network] Status changed:', networkStatus);
        if (networkStatus.connected) {
          handleOnline();
        } else {
          handleOffline();
        }
      });

      return () => {
        listenerPromise.then(handle => handle.remove()).catch(() => {});
        if (appResumeListener) appResumeListener.remove();
      };
    } else {
      // Use browser events for web platform
      console.log('[Network] Using browser events with dead VPN detection');
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Initial check if browser claims online
      if (navigator.onLine) {
        verifyAndSetOnline();
      }

      let lastVisibilityProbe = 0;
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          const now = Date.now();
          if (now - lastVisibilityProbe < 10000) return; // Prevent excessive probe triggers on app switch
          lastVisibilityProbe = now;
          checkRealInternetAccess(2000).then(hasInternet => {
            if (!hasInternet && status.isOnline) {
              handleOffline();
            } else if (hasInternet && !status.isOnline) {
              verifyAndSetOnline();
            }
          });
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [handleOnline, handleOffline, verifyAndSetOnline, isNativePlatform, status.isOnline]);

  return status;
}

/**
 * Helper to check if currently online
 * Takes dead VPN status into account
 */
export function isNetworkOnline(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  if (globalProbeResult && !globalProbeResult.isOnline && (Date.now() - globalProbeResult.timestamp < 10000)) {
    return false;
  }
  return true;
}

/**
 * Async version that uses Capacitor Network for accurate status on mobile
 */
export async function getNetworkStatus(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
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
 * فحص فوري وفعلي للاتصال بالإنترنت (يكتشف فوراً الـ VPN المعطل والشبكات الوهمية)
 * ينفذ فحص متوازي وسريع (Parallel Race) لعدة مسارات خلال 2.5 ثانية كحد أقصى
 * @param timeoutMs مهلة الفحص بالمللي ثانية (الافتراضي: 2500 مللي ثانية)
 */
export async function checkRealInternetAccess(timeoutMs: number = 2500): Promise<boolean> {
  // 1. تحقق فوري من واجهة النظام
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    return false;
  }

  // 2. استخدام الكاش اللحظي إن كان حديثاً (< 4 ثواني) لتجنب حرق طلبات الشبكة
  if (globalProbeResult && (Date.now() - globalProbeResult.timestamp < PROBE_CACHE_TTL)) {
    return globalProbeResult.isOnline;
  }

  const networkOnline = await getNetworkStatus();
  if (!networkOnline) {
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    return false;
  }

  // 3. فحص متوازي فائق السرعة عبر سباق Promise.any
  // أي نقطة ترد بنجاح تؤكد وجود إنترنت حقيقي فوراً (خلال 100-300ms عادة)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchProbe = async (url: string) => {
    const res = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res;
  };

  try {
    await Promise.any([
      fetchProbe('https://connectivitycheck.gstatic.com/generate_204'),
      fetchProbe('https://www.cloudflare.com/cdn-cgi/trace'),
      fetchProbe('https://1.1.1.1/cdn-cgi/trace'),
    ]);
    clearTimeout(timer);
    globalProbeResult = { isOnline: true, timestamp: Date.now() };
    return true;
  } catch {
    clearTimeout(timer);
    // إذا فشلت جميع المحاولات أو انتهت المهلة (2.5 ثانية)، فهذا يعني أن الإنترنت مقطوع أو الـ VPN معطل
    console.warn(`[Network] ⚠️ Dead VPN / Ghost network detected! Probe failed within ${timeoutMs}ms.`);
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    return false;
  }
}
