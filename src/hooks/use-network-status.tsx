// Network status hook - tracks online/offline state
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineTime: number | null;
}

/**
 * Hook to track network connectivity status
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
      toast.success('عادت الاتصال بالإنترنت ✓', { duration: 2000 });
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
    
    toast.error('انقطع الاتصال بالإنترنت', { duration: 3000 });
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return status;
}

/**
 * Helper to check if currently online
 */
export function isNetworkOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
