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
