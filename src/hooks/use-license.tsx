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

const LICENSE_CACHE_KEY = 'hyperpos_license_cache_v1';

function saveLicenseCache(state: Omit<LicenseState, 'isLoading' | 'error'>) {
  try {
    localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify({ ...state, _ts: Date.now() }));
  } catch { /* ignore */ }
}

function loadLicenseCache(): (Omit<LicenseState, 'isLoading' | 'error'>) | null {
  try {
    const raw = localStorage.getItem(LICENSE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache valid for 7 days max
    if (parsed._ts && Date.now() - parsed._ts > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const initialCache = loadLicenseCache();
  
  const [state, setState] = useState<LicenseState>({
    // ✅ If cache exists, start with isLoading=false for instant UI
    isLoading: !initialCache,
    isValid: initialCache?.isValid ?? false,
    hasLicense: initialCache?.hasLicense ?? false,
    isTrial: initialCache?.isTrial ?? false,
    isExpired: initialCache?.isExpired ?? false,
    isRevoked: initialCache?.isRevoked ?? false,
    needsActivation: initialCache?.needsActivation ?? false,
    ownerNeedsActivation: initialCache?.ownerNeedsActivation ?? false,
    expiresAt: initialCache?.expiresAt ?? null,
    remainingDays: initialCache?.remainingDays ?? null,
    error: null,
    role: initialCache?.role ?? null,
    maxCashiers: initialCache?.maxCashiers ?? null,
    licenseTier: initialCache?.licenseTier ?? null,
    expiringWarning: initialCache?.expiringWarning ?? false,
  });

  const backgroundCheckRef = useRef(false);

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
      // Only show loading if no cache
      const cached = loadLicenseCache();
      if (!cached) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      }

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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;

      if (data.userNotFound) {
        console.log('User not found in database, signing out...');
        localStorage.removeItem(LICENSE_CACHE_KEY);
        await supabase.auth.signOut();
        setState(prev => ({
          ...prev, isLoading: false, isValid: false, hasLicense: false, needsActivation: false,
        }));
        return;
      }

      const newState: LicenseState = {
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
      };

      setState(newState);
      // Save successful result to cache
      const { isLoading: _, error: _e, ...cacheData } = newState;
      saveLicenseCache(cacheData);
    } catch (error) {
      console.error('Error checking license:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isValid: true,
        hasLicense: true,
        needsActivation: false,
        error: 'فشل في التحقق من الترخيص - وضع غير متصل',
      }));
    }
  }, [user]);

  const activateCode = async (code: string): Promise<{ success: boolean; error?: string; expiresAt?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

      const response = await supabase.functions.invoke('validate-activation-code', {
        body: { code },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) return { success: false, error: response.error.message };
      const data = response.data;
      if (!data.success) return { success: false, error: data.error };

      await checkLicense();
      return { success: true, expiresAt: data.expiresAt };
    } catch (error) {
      console.error('Error activating code:', error);
      return { success: false, error: 'حدث خطأ أثناء تفعيل الكود' };
    }
  };

  const startTrial = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

      const response = await supabase.functions.invoke('start-trial', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) return { success: false, error: response.error.message || 'حدث خطأ أثناء بدء الفترة التجريبية' };
      const data = response.data;
      if (!data.success) return { success: false, error: data.error || 'حدث خطأ أثناء بدء الفترة التجريبية' };

      await checkLicense();
      return { success: true };
    } catch (error) {
      console.error('Error starting trial:', error);
      return { success: false, error: 'حدث خطأ أثناء بدء الفترة التجريبية' };
    }
  };

  useEffect(() => {
    if (!authLoading && !backgroundCheckRef.current) {
      backgroundCheckRef.current = true;
      checkLicense().finally(() => { backgroundCheckRef.current = false; });
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
