import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
  ownerNeedsActivation: boolean;
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

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const lastCheckedUserId = useRef<string | null>(null);
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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await supabase.functions.invoke('check-license', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        clearTimeout(timeout);

        if (response.error) {
          throw new Error(response.error.message);
        }

        const data = response.data;

        if (data.userNotFound) {
          console.log('[License] User not found, signing out...');
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

        lastCheckedUserId.current = user.id;
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
      } catch (edgeFnError) {
        clearTimeout(timeout);
        console.warn('[License] Edge function unavailable, allowing access:', edgeFnError);
        lastCheckedUserId.current = user.id;
        setState(prev => ({
          ...prev,
          isLoading: false,
          isValid: true,
          hasLicense: true,
          needsActivation: false,
          error: 'وضع غير متصل',
        }));
      }
    } catch (error) {
      console.error('[License] Error:', error);
      lastCheckedUserId.current = user.id;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isValid: true,
        hasLicense: true,
        needsActivation: false,
        error: 'وضع غير متصل',
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

      await checkLicense();
      return { success: true, expiresAt: data.expiresAt };
    } catch (error) {
      console.error('[License] Activation error:', error);
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

      const response = await supabase.functions.invoke('start-trial', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        return { success: false, error: response.error.message || 'حدث خطأ أثناء بدء الفترة التجريبية' };
      }

      const data = response.data;

      if (!data.success) {
        return { success: false, error: data.error || 'حدث خطأ أثناء بدء الفترة التجريبية' };
      }

      await checkLicense();
      return { success: true };
    } catch (error) {
      console.error('[License] Trial error:', error);
      return { success: false, error: 'حدث خطأ أثناء بدء الفترة التجريبية' };
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      if (lastCheckedUserId.current !== user.id) {
        checkLicense();
      }
    } else if (!authLoading && !user) {
      lastCheckedUserId.current = null;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isValid: false,
        hasLicense: false,
        needsActivation: false,
      }));
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
