import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { getDeviceId } from '@/lib/device-fingerprint';
import { toast } from 'sonner';

// Helper function to check if account is active and license is not revoked
export async function checkUserAccountStatus(userId: string, timeoutMs: number = 1500): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const statusPromise = (async (): Promise<{ blocked: boolean; reason?: string }> => {
      // 1. Check user_roles for is_active and role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, owner_id, is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.warn('[AccountCheck] Error querying user_roles:', roleError);
      }

      if (roleData) {
        // Boss accounts are superadmins, never blocked
        if (roleData.role === 'boss') {
          return { blocked: false };
        }

        // Check if user account is deactivated
        if (roleData.is_active === false) {
          return { blocked: true, reason: 'inactive' };
        }

        // If cashier, also check if owner is deactivated
        if (roleData.role === 'cashier' && roleData.owner_id) {
          const { data: ownerRole } = await supabase
            .from('user_roles')
            .select('is_active')
            .eq('user_id', roleData.owner_id)
            .maybeSingle();

          if (ownerRole?.is_active === false) {
            return { blocked: true, reason: 'owner_inactive' };
          }
        }

        // Check owner license if cashier, or own license
        const targetUserId = (roleData.role === 'cashier' && roleData.owner_id)
          ? roleData.owner_id
          : userId;

        const { data: licenseData, error: licenseError } = await supabase
          .from('app_licenses')
          .select('is_revoked')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (licenseError) {
          console.warn('[AccountCheck] Error querying app_licenses:', licenseError);
        }

        if (licenseData?.is_revoked === true) {
          return { blocked: true, reason: 'revoked' };
        }
      } else {
        // Fallback: check app_licenses directly if no user_role record found
        const { data: licenseData } = await supabase
          .from('app_licenses')
          .select('is_revoked')
          .eq('user_id', userId)
          .maybeSingle();

        if (licenseData?.is_revoked === true) {
          return { blocked: true, reason: 'revoked' };
        }
      }

      return { blocked: false };
    })();

    const timeoutPromise = new Promise<{ blocked: boolean; reason?: string }>((resolve) => {
      setTimeout(() => resolve({ blocked: false }), timeoutMs);
    });

    return await Promise.race([statusPromise, timeoutPromise]);
  } catch (err) {
    console.warn('[AccountCheck] Exception checking account status:', err);
    return { blocked: false };
  }
}

// Session persistence keys
const STAY_LOGGED_IN_KEY = 'hyperpos_stay_logged_in';
const SESSION_CACHE_KEY = 'hyperpos_session_cache';
const AUTO_LOGIN_ATTEMPTED_KEY = 'hyperpos_auto_login_attempted';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  user_type: 'cashier' | 'distributor' | 'pos' | null;
  allowed_pages: string[] | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAutoLoginChecking: boolean;
  stayLoggedIn: boolean;
  signIn: (email: string, password: string, stayLoggedIn?: boolean) => Promise<{ error: Error | null; data?: { user: User; session: Session } }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setStayLoggedIn: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to check if we should stay logged in
const getStayLoggedInPreference = (): boolean => {
  try {
    return localStorage.getItem(STAY_LOGGED_IN_KEY) === 'true';
  } catch {
    return false;
  }
};

// Helper to cache session for faster restore
const cacheSession = (session: Session | null) => {
  try {
    if (session) {
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
        user: session.user,
        session: session,
        expires_at: session.expires_at,
        cached_at: Date.now()
      }));
    } else {
      localStorage.removeItem(SESSION_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

// Get cached session for immediate UI restore (checks SESSION_CACHE_KEY and Supabase auth token keys)
const getCachedSession = (): { user: User | null; session: Session | null } => {
  try {
    // 1. Check custom hyperpos_session_cache
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data?.user) {
        return {
          user: data.user as User,
          session: (data.session || data) as unknown as Session,
        };
      }
    }

    // 2. Also check any Supabase auth token stored in localStorage (e.g. sb-*-auth-token)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed?.user) {
            return {
              user: parsed.user as User,
              session: parsed as unknown as Session,
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Auth] Error reading cached session:', e);
  }
  return { user: null, session: null };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cachedInitial] = useState(() => getCachedSession());
  const [user, setUser] = useState<User | null>(() => cachedInitial.user);
  const [session, setSession] = useState<Session | null>(() => cachedInitial.session);
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const p = localStorage.getItem('hyperpos_cached_profile');
      return p ? JSON.parse(p) : null;
    } catch { return null; }
  });
  // Instant boot: if cached user exists, isLoading is immediately false (0ms)!
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedInitial.user);
  const [isAutoLoginChecking, setIsAutoLoginChecking] = useState(false);
  const [stayLoggedIn, setStayLoggedInState] = useState(getStayLoggedInPreference);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      if (data) {
        try { localStorage.setItem('hyperpos_cached_profile', JSON.stringify(data)); } catch { /* ignore storage error */ }
      }
      return data as Profile | null;
    } catch (err) {
      console.error('Error in fetchProfile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  // Set stay logged in preference
  const setStayLoggedIn = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STAY_LOGGED_IN_KEY, value.toString());
      setStayLoggedInState(value);
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    // Immediately restore from cache if not already set
    const cachedData = getCachedSession();
    if (cachedData.user && !user) {
      setUser(cachedData.user);
      setSession(cachedData.session);
      setIsLoading(false);
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        // Strict Offline-First: If supabase reports no session but we have local cache, ignore empty event
        if (!currentSession?.user && getCachedSession().user && event !== 'SIGNED_OUT') {
          return;
        }

        // Skip unnecessary state updates on TOKEN_REFRESHED to prevent re-renders that close dialogs
        if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
          setSession(currentSession);
          setUser(prev => {
            if (prev?.id === currentSession.user.id) return prev;
            return currentSession.user;
          });
          cacheSession(currentSession);
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          cacheSession(currentSession);
          setIsLoading(false);

          // Fetch profile asynchronously in background
          setTimeout(async () => {
            const profileData = await fetchProfile(currentSession.user.id);
            if (profileData) setProfile(profileData);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Explicit sign out only
          setSession(null);
          setUser(null);
          setProfile(null);
          cacheSession(null);
          setIsLoading(false);
        }
      }
    );

    // Attempt device auto-login function - runs in background with strict 1.5s timeout
    const attemptDeviceAutoLogin = async () => {
      const AUTO_LOGIN_TIMEOUT_MS = 1500;

      try {
        // If we already have a user, do not auto-login
        if (user || cachedInitial.user) {
          return true;
        }

        // Check if we already attempted auto-login recently
        const alreadyAttempted = sessionStorage.getItem(AUTO_LOGIN_ATTEMPTED_KEY);
        if (alreadyAttempted) {
          console.log('[AutoLogin] Already attempted, skipping');
          return false;
        }

        console.log('[AutoLogin] Starting device auto-login...');
        setIsAutoLoginChecking(true);

        const deviceId = await getDeviceId();
        console.log('[AutoLogin] Device ID:', deviceId);

        const invokePromise = supabase.functions.invoke('device-auto-login', {
          body: { device_id: deviceId }
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AUTO_LOGIN_TIMEOUT')), AUTO_LOGIN_TIMEOUT_MS);
        });

        const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

        if (error) {
          console.error('[AutoLogin] Edge function error:', error);
          return false;
        }

        console.log('[AutoLogin] Response:', data);

        if (data?.success && data?.action_link) {
          try {
            const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
              email: data.email,
              token: data.verification_token,
              type: 'magiclink'
            });

            if (otpError) {
              console.error('[AutoLogin] OTP verification error:', otpError);
              return false;
            }

            if (otpData?.session) {
              const accountCheck = await checkUserAccountStatus(otpData.session.user.id, 1500);
              if (accountCheck.blocked) {
                console.log('[AutoLogin] User account disabled or license revoked, rejecting auto-login');
                await supabase.auth.signOut();
                cacheSession(null);
                return false;
              }
              console.log('[AutoLogin] Session restored successfully!');
              setUser(otpData.session.user);
              setSession(otpData.session);
              cacheSession(otpData.session);
              return true;
            }
          } catch (otpErr) {
            console.error('[AutoLogin] OTP exception:', otpErr);
          }
        }

        return false;
      } catch (err) {
        console.error('[AutoLogin] Exception / timeout:', err);
        return false;
      } finally {
        setIsAutoLoginChecking(false);
        sessionStorage.setItem(AUTO_LOGIN_ATTEMPTED_KEY, 'true');
      }
    };

    // Hard safety net: never keep the app stuck on the loading screen
    const loadingSafetyTimer = setTimeout(() => {
      setIsAutoLoginChecking(false);
      setIsLoading(false);
    }, 1500);

    // Check for existing session and verify user without blocking UI
    const sessionPromise = supabase.auth.getSession();
    const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 1500)
    );
    Promise.race([sessionPromise, sessionTimeout]).then(async ({ data: { session: existingSession } }) => {
      if (existingSession?.user) {
        // Active session retrieved from Supabase
        setUser(existingSession.user);
        setSession(existingSession);
        setIsLoading(false);
        cacheSession(existingSession);

        // Verify user in the background with a strict 1.5s timeout (prevents dead VPN hangs)
        try {
          const userPromise = supabase.auth.getUser();
          const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 1500)
          );

          const { data, error: userError } = await Promise.race([userPromise, timeoutPromise]);
          const currentUser = data?.user;

          if (userError || !currentUser) {
            console.log('[Auth] Network timeout or error verifying user, keeping existing session');
            return;
          }

          // Check if user account is deactivated or license is revoked on startup
          if (currentUser) {
            const accountCheck = await checkUserAccountStatus(currentUser.id, 1500);
            if (accountCheck.blocked) {
              console.log('[Auth] Account is disabled or license is revoked, signing out immediately...');
              toast.error('تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة');
              await supabase.auth.signOut();
              cacheSession(null);
              setUser(null);
              setSession(null);
              setProfile(null);
              return;
            }
          }
        } catch {
          // Network timeout / dead VPN / offline - trust existing local session!
          console.log('[Auth] Network probe timeout (e.g. dead VPN), trusting active session');
        }
        return;
      }

      // If no session from Supabase, but we already have a cached user from localStorage
      if (cachedInitial.user) {
        setIsLoading(false);
        // Verify account silently in background with timeout (1.5s) without blocking
        checkUserAccountStatus(cachedInitial.user.id, 1500).then(async (accountCheck) => {
          if (accountCheck.blocked) {
            toast.error('تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة');
            await supabase.auth.signOut();
            cacheSession(null);
            setUser(null);
            setSession(null);
            setProfile(null);
          }
        }).catch(() => {
          // Offline / network failure -> keep session
        });
        return;
      }

      // No session and no cached user: try device auto-login in background
      const autoLoginSuccess = await attemptDeviceAutoLogin();
      if (!autoLoginSuccess) {
        setIsLoading(false);
      }
    });

    // Periodic session refresh for background (every minute)
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          const expiresAt = currentSession.expires_at;
          if (expiresAt && (expiresAt - Date.now() / 1000) < 600) {
            await supabase.auth.refreshSession();
          }
        }
      } catch {
        // Offline / network issue
      }
    }, 60000);

    return () => {
      clearTimeout(loadingSafetyTimer);
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [fetchProfile, cachedInitial.user]);

  const signIn = async (email: string, password: string, rememberMe: boolean = false): Promise<{ error: Error | null; data?: { user: User; session: Session } }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // Set stay logged in preference and cache session
      if (!error && data.session) {
        setStayLoggedIn(rememberMe);
        cacheSession(data.session);
      }
      
      // Log successful login
      if (!error && data.user) {
        // Dynamically import to avoid circular dependencies
        import('@/lib/activity-log').then(({ addActivityLog }) => {
          addActivityLog(
            'login',
            data.user.id,
            data.user.email || 'مستخدم',
            `تم تسجيل الدخول بنجاح`,
            { email, stayLoggedIn: rememberMe }
          );
        });
      }
      
      if (error) {
        return { error: new Error(error.message) };
      }

      // Check if account is inactive or license revoked immediately upon sign in
      if (data?.user) {
        const accountCheck = await checkUserAccountStatus(data.user.id);
        if (accountCheck.blocked) {
          await supabase.auth.signOut();
          cacheSession(null);
          setUser(null);
          setSession(null);
          setProfile(null);
          toast.error('تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة');
          return { error: new Error('تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة') };
        }
      }
      
      // ✅ مسح شامل للبيانات المحلية لمنع تسرب بيانات الحساب السابق
      if (data.user) {
        // 1. مسح localStorage (ما عدا اللغة والثيم)
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('hyperpos_') && 
              key !== 'hyperpos_language' && 
              key !== 'hyperpos_theme' &&
              key !== 'hyperpos_stay_logged_in' &&
              key !== 'hyperpos_session_cache' &&
              key !== 'hyperpos_setup_complete' &&
              key !== 'hyperpos_privacy_accepted' &&
              key !== 'hyperpos_privacy_version') {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[Auth] Cleared ${keysToRemove.length} localStorage keys on sign-in`);

        // 2. مسح IndexedDB (كاش المنتجات)
        import('@/lib/indexeddb-cache').then(({ clearProductsIDB }) => {
          clearProductsIDB();
          console.log('[Auth] Cleared IndexedDB products cache on sign-in');
        });

        // 3. إبطال كاش الذاكرة للـ cloud stores
        import('@/lib/cloud').then(({ invalidateAllCaches }) => {
          invalidateAllCaches();
          console.log('[Auth] Invalidated all cloud caches on sign-in');
        });
      }
      
      return { 
        error: null, 
        data: data.user && data.session ? { user: data.user, session: data.session } : undefined 
      };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || undefined,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    // Log logout before signing out
    if (user) {
      import('@/lib/activity-log').then(({ addActivityLog }) => {
        addActivityLog(
          'logout',
          user.id,
          user.email || profile?.full_name || 'مستخدم',
          `تم تسجيل الخروج`,
          {}
        );
      });

      // Reset device_id on sign out (except boss) so user can login on another device
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleData?.role !== 'boss') {
          await supabase
            .from('app_licenses')
            .update({ device_id: null })
            .eq('user_id', user.id)
            .eq('is_revoked', false);
          
          // Clear local device binding cache (encrypted + legacy plain-text)
          try {
            const { clearDeviceBindingCache } = await import('./use-device-binding');
            clearDeviceBindingCache();
          } catch { /* */ }
        }
      } catch (err) {
        console.error('Failed to reset device on sign out:', err);
      }
    }
    
    // Clear auto-login attempt flag so next app open can try again
    try {
      sessionStorage.removeItem(AUTO_LOGIN_ATTEMPTED_KEY);
      // Clear session cache
      cacheSession(null);
    } catch {
      // Ignore storage errors
    }
    
    // Clear all user-specific localStorage data
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('hyperpos_') && 
          key !== 'hyperpos_language' && 
          key !== 'hyperpos_theme' &&
          key !== 'hyperpos_last_user_id' &&
          key !== 'hyperpos_setup_complete' &&
          key !== 'hyperpos_privacy_accepted' &&
          key !== 'hyperpos_privacy_version') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // ✅ مسح IndexedDB وكاش الذاكرة عند تسجيل الخروج
    try {
      const { clearProductsIDB } = await import('@/lib/indexeddb-cache');
      await clearProductsIDB();
      console.log('[Auth] Cleared IndexedDB on sign-out');
    } catch (e) { console.warn('[Auth] Failed to clear IDB:', e); }

    try {
      const { invalidateAllCaches } = await import('@/lib/cloud');
      invalidateAllCaches();
      console.log('[Auth] Invalidated cloud caches on sign-out');
    } catch (e) { console.warn('[Auth] Failed to invalidate caches:', e); }

    // Reset onboarding tour so it shows again on next login
    localStorage.removeItem('hp_onboarding_complete');

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isLoading,
      isAutoLoginChecking,
      stayLoggedIn,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      setStayLoggedIn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
