import { useState, useEffect, useCallback } from 'react';
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
  const [state, setState] = useState<DeviceBindingState>({
    isChecking: true,
    isDeviceBlocked: false,
    deviceId: null,
    registeredDeviceId: null,
  });

  const checkDeviceBinding = useCallback(async () => {
    if (!user) {
      setState({
        isChecking: false,
        isDeviceBlocked: false,
        deviceId: null,
        registeredDeviceId: null,
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isChecking: true }));
      
      // Get current device ID
      const currentDeviceId = await getDeviceId();
      
      // Check if user is Boss - Boss has unlimited device access
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // If user is Boss, skip device binding entirely
      if (roleData?.role === 'boss') {
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: null, // Boss doesn't need device registration
        });
        return;
      }
      
      // Get user's license with device info
      const { data: license, error } = await supabase
        .from('app_licenses')
        .select('device_id, is_revoked, allow_multi_device')
        .eq('user_id', user.id)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking device binding:', error);
        // On error, allow access to prevent lockout
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: null,
        });
        return;
      }

      // If no license found, allow access (license guard will handle this)
      if (!license) {
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: null,
        });
        return;
      }

      const registeredDeviceId = license.device_id;

      // If multi-device is allowed, skip device binding check
      if (license.allow_multi_device === true) {
        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: registeredDeviceId || currentDeviceId,
        });
        return;
      }

      // If no device registered yet, register this device
      if (!registeredDeviceId) {
        const { error: updateError } = await supabase
          .from('app_licenses')
          .update({ device_id: currentDeviceId })
          .eq('user_id', user.id)
          .eq('is_revoked', false);

        if (updateError) {
          console.error('Error registering device:', updateError);
        }

        setState({
          isChecking: false,
          isDeviceBlocked: false,
          deviceId: currentDeviceId,
          registeredDeviceId: currentDeviceId,
        });
        return;
      }

      // Check if device matches
      const isBlocked = registeredDeviceId !== currentDeviceId;

      setState({
        isChecking: false,
        isDeviceBlocked: isBlocked,
        deviceId: currentDeviceId,
        registeredDeviceId,
      });
    } catch (error) {
      console.error('Device binding check error:', error);
      // On error, allow access
      setState({
        isChecking: false,
        isDeviceBlocked: false,
        deviceId: null,
        registeredDeviceId: null,
      });
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
