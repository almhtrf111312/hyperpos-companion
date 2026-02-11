import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device-fingerprint';
import { useAuth } from './use-auth';

interface DeviceBindingState {
  isChecking: boolean;
  isDeviceBlocked: boolean;
  deviceId: string | null;
  registeredDeviceId: string | null;
}

export function useDeviceBinding() {
  const { user } = useAuth();
  const lastCheckedUserId = useRef<string | null>(null);
  const [state, setState] = useState<DeviceBindingState>({
    isChecking: true,
    isDeviceBlocked: false,
    deviceId: null,
    registeredDeviceId: null,
  });

  const checkDeviceBinding = useCallback(async () => {
    if (!user) {
      lastCheckedUserId.current = null;
      setState({
        isChecking: false,
        isDeviceBlocked: false,
        deviceId: null,
        registeredDeviceId: null,
      });
      return;
    }

    if (lastCheckedUserId.current === user.id) {
      return;
    }

    const safetyTimeout = setTimeout(() => {
      console.warn('[DeviceBinding] Timeout - allowing access');
      lastCheckedUserId.current = user.id;
      setState(prev => ({
        ...prev,
        isChecking: false,
        isDeviceBlocked: false,
      }));
    }, 3000);

    try {
      setState(prev => ({ ...prev, isChecking: true }));

      const currentDeviceId = await getDeviceId();

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role === 'boss') {
        clearTimeout(safetyTimeout);
        lastCheckedUserId.current = user.id;
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: null,
        });
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

      clearTimeout(safetyTimeout);
      lastCheckedUserId.current = user.id;

      if (error || !license) {
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: null,
        });
        return;
      }

      if (license.allow_multi_device === true) {
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: license.device_id || currentDeviceId,
        });
        return;
      }

      if (!license.device_id) {
        await supabase
          .from('app_licenses')
          .update({ device_id: currentDeviceId })
          .eq('user_id', user.id)
          .eq('is_revoked', false);

        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: currentDeviceId,
        });
        return;
      }

      const isBlocked = license.device_id !== currentDeviceId;
      setState({
        isChecking: false,
        isDeviceBlocked: isBlocked,
        deviceId: currentDeviceId,
        registeredDeviceId: license.device_id,
      });
    } catch (error) {
      clearTimeout(safetyTimeout);
      lastCheckedUserId.current = user.id;
      console.error('[DeviceBinding] Error:', error);
      setState({
        isChecking: false,
        isDeviceBlocked: false,
        deviceId: null,
        registeredDeviceId: null,
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (lastCheckedUserId.current !== user.id) {
        checkDeviceBinding();
      }
    } else {
      lastCheckedUserId.current = null;
      setState({
        isChecking: false,
        isDeviceBlocked: false,
        deviceId: null,
        registeredDeviceId: null,
      });
    }
  }, [user, checkDeviceBinding]);

  return {
    ...state,
    refreshDeviceBinding: checkDeviceBinding,
  };
}
