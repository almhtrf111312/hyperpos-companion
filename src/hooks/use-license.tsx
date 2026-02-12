import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

interface LicenseState {
  isLoading: boolean;
  isValid: boolean;
  hasLicense: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isRevoked: boolean;
  needsActivation: boolean;
  ownerNeedsActivation: boolean; // For cashiers when their owner hasn't activated
  expiresAt: string | null;
  remainingDays: number | null;
  error: string | null;
  role: string | null;
  maxCashiers: number | null;
  licenseTier: string | null;
  expiringWarning: boolean;
}

interface LicenseContextType extends LicenseState {
  checkLicense: () => Promise<void>;
  activateCode: (code: string) => Promise<{ success: boolean; error?: string; expiresAt?: string }>;
  startTrial: () => Promise<{ success: boolean; error?: string }>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

const TRIAL_DAYS = 30;

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<LicenseState>({
    isLoading: true,
    isValid: false,
    hasLicense: false,
    isTrial: false,
    isExpired: false,
    isRevoked: false,
    needsActivation: false,
    ownerNeedsActivation: false,
    expiresAt: null,
    remainingDays: null,
    error: null,
    role: null,
    maxCashiers: null,
    licenseTier: null,
    expiringWarning: false,
  });

  const checkLicense = useCallback(async () => {
    if (!user) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isValid: false,
        hasLicense: false,
        needsActivation: false,
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isValid: false,
          needsActivation: false,
        }));
        return;
      }

      const response = await supabase.functions.invoke('check-license', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      // Check if user was deleted from database
      if (data.userNotFound) {
        console.log('User not found in database, signing out...');
        await supabase.auth.signOut();
        setState(prev => ({
          ...prev,
          isLoading: false,
          isValid: false,
          hasLicense: false,
          needsActivation: false,
        }));
        return;
      }

      setState({
        isLoading: false,
        isValid: data.valid,
        hasLicense: data.hasLicense,
        isTrial: data.isTrial || false,
        isExpired: data.isExpired || false,
        isRevoked: data.isRevoked || false,
        needsActivation: data.needsActivation,
        ownerNeedsActivation: data.ownerNeedsActivation || false,
        expiresAt: data.expiresAt || null,
        remainingDays: data.remainingDays || null,
        error: null,
        role: data.role || null,
        maxCashiers: data.maxCashiers || null,
        licenseTier: data.licenseTier || null,
        expiringWarning: data.expiringWarning || false,
      });
    } catch (error) {
      console.error('Error checking license:', error);
      // On network error, allow the user to proceed (graceful degradation)
      // They're already authenticated, so don't block them
      setState(prev => ({
        ...prev,
        isLoading: false,
        isValid: true, // Allow access on network failure
        hasLicense: true, // Assume they have a license
        needsActivation: false,
        error: 'فشل في التحقق من الترخيص - وضع غير متصل',
      }));
    }
  }, [user]);

  const activateCode = async (code: string): Promise<{ success: boolean; error?: string; expiresAt?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'يجب تسجيل الدخول أولاً' };
      }

      const response = await supabase.functions.invoke('validate-activation-code', {
        body: { code },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      const data = response.data;

      if (!data.success) {
        return { success: false, error: data.error };
      }

      // Refresh license state
      await checkLicense();

      return { success: true, expiresAt: data.expiresAt };
    } catch (error) {
      console.error('Error activating code:', error);
      return { success: false, error: 'حدث خطأ أثناء تفعيل الكود' };
    }
  };

  const startTrial = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'يجب تسجيل الدخول أولاً' };
      }

      // Use secure Edge Function to start trial
      // This prevents client-side manipulation of trial parameters
      const response = await supabase.functions.invoke('start-trial', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Error starting trial:', response.error);
        return { success: false, error: response.error.message || 'حدث خطأ أثناء بدء الفترة التجريبية' };
      }

      const data = response.data;

      if (!data.success) {
        return { success: false, error: data.error || 'حدث خطأ أثناء بدء الفترة التجريبية' };
      }

      // Refresh license state
      await checkLicense();

      return { success: true };
    } catch (error) {
      console.error('Error starting trial:', error);
      return { success: false, error: 'حدث خطأ أثناء بدء الفترة التجريبية' };
    }
  };

  useEffect(() => {
    if (!authLoading) {
      checkLicense();
    }
  }, [user, authLoading, checkLicense]);

  return (
    <LicenseContext.Provider value={{ ...state, checkLicense, activateCode, startTrial }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
