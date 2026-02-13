import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device-fingerprint';
import { useAuth } from './use-auth';

const DEVICE_CACHE_KEY = 'hyperpos_device_binding_cache_v1';

interface DeviceBindingState {
  isChecking: boolean;
  isDeviceBlocked: boolean;
  deviceId: string | null;
  registeredDeviceId: string | null;
}

function saveDeviceCache(data: { isDeviceBlocked: boolean; deviceId: string | null; registeredDeviceId: string | null }) {
  try { localStorage.setItem(DEVICE_CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() })); } catch { /* */ }
}

function loadDeviceCache(): { isDeviceBlocked: boolean; deviceId: string | null; registeredDeviceId: string | null } | null {
  try {
    const raw = localStorage.getItem(DEVICE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed._ts && Date.now() - parsed._ts > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

export function useDeviceBinding() {
  const { user } = useAuth();
  const cached = loadDeviceCache();

  const [state, setState] = useState<DeviceBindingState>({
    // ✅ If cache exists and device was not blocked, skip loading
    isChecking: !cached || cached.isDeviceBlocked,
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

      // Check if Boss
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role === 'boss') {
        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: null };
        setState({ isChecking: false, ...result });
        saveDeviceCache(result);
        return;
      }

      const { data: license, error } = await supabase
        .from('app_licenses')
        .select('device_id, is_revoked, allow_multi_device')
        .eq('user_id', user.id)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !license) {
        const result = { isDeviceBlocked: false, deviceId: currentDeviceId, registeredDeviceId: null };
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

      const isBlocked = license.device_id !== currentDeviceId;
      const result = { isDeviceBlocked: isBlocked, deviceId: currentDeviceId, registeredDeviceId: license.device_id };
      setState({ isChecking: false, ...result });
      saveDeviceCache(result);
    } catch (error) {
      console.error('Device binding check error:', error);
      setState({ isChecking: false, isDeviceBlocked: false, deviceId: null, registeredDeviceId: null });
    }
  }, [user]);

  useEffect(() => {
    checkDeviceBinding();
  }, [checkDeviceBinding]);

  return {
    ...state,
    refreshDeviceBinding: checkDeviceBinding,
  };
}
