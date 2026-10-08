import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device-fingerprint';
import { useAuth } from './use-auth';
import { secureSet, secureGet, secureRemove, getDeviceKey } from '@/lib/secure-storage';

// Encrypted storage key — data is XOR-encrypted with device key via secure-storage
const DEVICE_CACHE_KEY = 'device_binding_cache';
const DEVICE_NS = 'hp_db'; // short namespace

interface DeviceBindingState {
  isChecking: boolean;
  isDeviceBlocked: boolean;
  deviceId: string | null;
  registeredDeviceId: string | null;
}

interface DeviceCacheData {
  isDeviceBlocked: boolean;
  deviceId: string | null;
  registeredDeviceId: string | null;
  _ts: number;
}

function saveDeviceCache(data: { isDeviceBlocked: boolean; deviceId: string | null; registeredDeviceId: string | null }) {
  try {
    // Remove any legacy plain-text entry
    localStorage.removeItem('hyperpos_device_binding_cache_v1');
    sessionStorage.removeItem('hyperpos_device_binding_cache_v1');

    secureSet(
      DEVICE_CACHE_KEY,
      { ...data, _ts: Date.now() } as DeviceCacheData,
      {
        namespace: DEVICE_NS,
        expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
      }
    );
  } catch { /* */ }
}

function loadDeviceCache(): { isDeviceBlocked: boolean; deviceId: string | null; registeredDeviceId: string | null } | null {
  try {
    const parsed = secureGet<DeviceCacheData>(DEVICE_CACHE_KEY, { namespace: DEVICE_NS });
    if (!parsed) return null;
    return {
      isDeviceBlocked: parsed.isDeviceBlocked,
      deviceId: parsed.deviceId,
      registeredDeviceId: parsed.registeredDeviceId,
    };
  } catch { return null; }
}

export function useDeviceBinding() {
  const { user } = useAuth();
  const cached = loadDeviceCache();
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  const [state, setState] = useState<DeviceBindingState>({
    isChecking: cached ? false : true,
    isDeviceBlocked: cached?.isDeviceBlocked ?? false,
    deviceId: cached?.deviceId ?? null,
    registeredDeviceId: cached?.registeredDeviceId ?? null,
  });

  const checkDeviceBinding = useCallback(async () => {
    if (!user) {
      setState({ isChecking: false, isDeviceBlocked: false, deviceId: null, registeredDeviceId: null });
      return;
    }

    try {
      const currentDeviceId = await getDeviceId();
      const currentDeviceKey = getDeviceKey();

      // Check if Boss or Admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role === 'boss' || roleData?.role === 'admin') {
        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: null };
        setState({ isChecking: false, ...result });
        saveDeviceCache(result);
        return;
      }

      const { data: license, error } = await supabase
        .from('app_licenses')
        .select('device_id, is_revoked, allow_multi_device')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !license) {
        // Transient network error or no license -> do not block active session
        setState(prev => ({ ...prev, isChecking: false }));
        return;
      }

      // Check if explicitly revoked
      if (license.is_revoked === true) {
        const result = { isDeviceBlocked: true, deviceId: currentDeviceId, registeredDeviceId: license.device_id };
        setState({ isChecking: false, ...result });
        saveDeviceCache(result);
        return;
      }

      if (license.allow_multi_device === true) {
        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: license.device_id || currentDeviceId };
        setState({ isChecking: false, ...result });
        saveDeviceCache(result);
        return;
      }

      // If !license.device_id is empty on cloud record, update with currentDeviceId
      if (!license.device_id) {
        await supabase
          .from('app_licenses')
          .update({ device_id: currentDeviceId })
          .eq('user_id', user.id)
          .eq('is_revoked', false);

        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: currentDeviceId };
        setState({ isChecking: false, ...result });
        saveDeviceCache(result);
        return;
      }

      // Check if license.device_id matches EITHER currentDeviceId OR currentDeviceKey
      const isMatch = license.device_id === currentDeviceId || license.device_id === currentDeviceKey;
      
      if (isMatch) {
        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: license.device_id };
        setState({ isChecking: false, ...result });
        saveDeviceCache(result);
        return;
      }

      // If user already had a valid authenticated session running locally:
      // Background network reconnects must NOT abruptly interrupt or lock the screen
      // unless the license is explicitly revoked (is_revoked === true).
      const cachedData = loadDeviceCache();
      const hadActiveUnblockedSession = cachedData && cachedData.isDeviceBlocked === false;

      if (hadActiveUnblockedSession) {
        console.warn('[DeviceBinding] Active unblocked session running during reconnect. Preserving session.');
        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: license.device_id };
        setState({ isChecking: false, ...result });
        return;
      }

      // Genuine block confirmed against both IDs
      const result = { isDeviceBlocked: true, deviceId: currentDeviceId, registeredDeviceId: license.device_id };
      setState({ isChecking: false, ...result });
      saveDeviceCache(result);
    } catch (error) {
      console.error('Device binding check error:', error);
      setState(prev => ({ ...prev, isChecking: false }));
    }
  }, [user]);

  useEffect(() => {
    checkDeviceBinding();

    const handleOnline = () => {
      checkDeviceBinding();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [checkDeviceBinding]);

  // Safety timeout: release loading screen after 1.5s even if server hasn't responded.
  // The device check must be 100% asynchronous and non-blocking for active sessions.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setState(prev => {
        if (prev.isChecking) {
          console.warn('[DeviceBinding] Safety timeout reached, releasing loading screen');
          return { ...prev, isChecking: false };
        }
        return prev;
      });
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, []);

  return {
    ...state,
    refreshDeviceBinding: checkDeviceBinding,
  };
}

// Cleanup helper for logout
export function clearDeviceBindingCache() {
  try {
    secureRemove(DEVICE_CACHE_KEY, { namespace: DEVICE_NS });
    localStorage.removeItem('hyperpos_device_binding_cache_v1');
    sessionStorage.removeItem('hyperpos_device_binding_cache_v1');
  } catch { /* */ }
}
