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
const PROBE_CACHE_TTL = 4000; // 4 seconds positive cache
const NEGATIVE_PROBE_CACHE_TTL = 1500; // 1.5 seconds negative cache for immediate recovery

/**
 * Hook to track network connectivity status
 * Uses Capacitor Network plugin on mobile for reliable detection
 * Falls back to browser events on web
 * Triggers callback when coming back online
 * Proactively verifies WAN connectivity with optimistic online fallback
 */
export function useNetworkStatus(onReconnect?: () => void) {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    const rawOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (globalProbeResult && Date.now() - globalProbeResult.timestamp < (globalProbeResult.isOnline ? PROBE_CACHE_TTL : NEGATIVE_PROBE_CACHE_TTL)) {
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
    // Optimistic Online: طالما أن نظام أندرويد/Capacitor يؤكد الاتصال، لا نجبر التطبيق على وضع offline فوراً
    const hasRealInternet = await checkRealInternetAccess(6000);
    const systemConnected = await getNetworkStatus();

    if (!hasRealInternet && !systemConnected) {
      console.warn('[Network] ⚠️ Network disconnected. Staying offline.');
      wasOfflineRef.current = true;
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        wasOffline: true,
      }));
      return;
    }

    if (!hasRealInternet && systemConnected) {
      console.warn('[Network] ⚠️ Probe was slow or failed, but system network is connected. Keeping optimistic online.');
      // لا نحظر واجهة المستخدم أو نظهر شريط عدم الاتصال ما دام اتصال النظام قائماً
      // نكرر المحاولة بهدوء في الخلفية
      setTimeout(() => {
        checkRealInternetAccess(6000).then(retryOk => {
          if (retryOk) {
            console.log('[Network] ✅ Background retry confirmed real internet');
          }
        }).catch(() => {});
      }, 3000);
    }

    console.log('[Network] ✅ Connection confirmed (Optimistic or verified)');
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
    const appResumeListener: { remove: () => void } | null = null;

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
  if (globalProbeResult && !globalProbeResult.isOnline && (Date.now() - globalProbeResult.timestamp < NEGATIVE_PROBE_CACHE_TTL)) {
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
 * فحص فوري وفعلي للاتصال بالإنترنت (متوافق مع شبكات VPN والمسارات المحولة)
 * ينفذ فحصاً متوازياً: الأولوية لخادم التطبيق (Supabase REST ping) ومسارات بديلة خفيفة
 * @param timeoutMs مهلة الفحص بالمللي ثانية (الافتراضي: 6000 مللي ثانية لمنح الـ VPN مهلة كافية)
 */
export async function checkRealInternetAccess(timeoutMs: number = 6000): Promise<boolean> {
  // 1. تحقق فوري من واجهة النظام
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    return false;
  }

  // 2. استخدام الكاش اللحظي: الكاش الإيجابي 4 ثوانٍ، والسلبي 1.5 ثانية للتعافي السريع
  if (globalProbeResult) {
    const ttl = globalProbeResult.isOnline ? PROBE_CACHE_TTL : NEGATIVE_PROBE_CACHE_TTL;
    if (Date.now() - globalProbeResult.timestamp < ttl) {
      return globalProbeResult.isOnline;
    }
  }

  const networkOnline = await getNetworkStatus();
  if (!networkOnline) {
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    return false;
  }

  // 3. فحص متوازي: خادم التطبيق أولاً (يعمل عبر VPN)، ثم مسارات بديلة خفيفة وموثوقة
  const effectiveTimeout = Math.max(timeoutMs, 6000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  const fetchProbe = async (url: string, init?: RequestInit) => {
    return fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
      ...init,
    });
  };

  const probes: Promise<unknown>[] = [];
  const backendUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (backendUrl) {
    // أي استجابة من خادم التطبيق (حتى 401 أو 404 أو 200) دليل قاطع على اتصال حقيقي وفعّال
    probes.push(
      fetch(`${backendUrl}/auth/v1/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: anonKey ? { apikey: anonKey } : undefined,
      }).then(res => {
        if (res.status >= 200 && res.status < 600) return true;
        throw new Error(`HTTP ${res.status}`);
      })
    );
  }

  // روابط بديلة خفيفة تعمل في معظم الدول ولا تحجبها شبكات الـ VPN
  probes.push(
    fetchProbe('https://1.1.1.1/cdn-cgi/trace'),
    fetchProbe('https://msftconnecttest.com/connecttest.txt'),
    fetchProbe('https://captive.apple.com/hotspot-detect.html'),
  );

  try {
    await (Promise as unknown as { any: <T>(p: Promise<T>[]) => Promise<T> }).any(probes);
    clearTimeout(timer);
    globalProbeResult = { isOnline: true, timestamp: Date.now() };
    return true;
  } catch {
    clearTimeout(timer);
    console.warn(`[Network] ⚠️ No server reachable within ${effectiveTimeout}ms.`);
    globalProbeResult = { isOnline: false, timestamp: Date.now() };
    return false;
  }
}
