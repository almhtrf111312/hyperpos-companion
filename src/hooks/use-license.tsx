import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

interface LicenseState {
  isLoading: boolean;
  isValid: boolean;
  hasLicense: boolean;
  isTrial: boolean;
  isExpired: boolean;
  needsActivation: boolean;
  expiresAt: string | null;
  remainingDays: number | null;
  error: string | null;
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
    needsActivation: false,
    expiresAt: null,
    remainingDays: null,
    error: null,
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

      setState({
        isLoading: false,
        isValid: data.valid,
        hasLicense: data.hasLicense,
        isTrial: data.isTrial || false,
        isExpired: data.isExpired || false,
        needsActivation: data.needsActivation,
        expiresAt: data.expiresAt || null,
        remainingDays: data.remainingDays || null,
        error: null,
      });
    } catch (error) {
      console.error('Error checking license:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'فشل في التحقق من الترخيص',
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
      // Calculate trial expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

      // Insert trial license
      const { error } = await supabase
        .from('app_licenses')
        .insert({
          user_id: user.id,
          expires_at: expiresAt.toISOString(),
          is_trial: true,
        });

      if (error) {
        // Check if license already exists
        if (error.code === '23505') {
          // Unique violation - license already exists
          await checkLicense();
          return { success: true };
        }
        throw error;
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
