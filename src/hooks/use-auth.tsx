import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { getDeviceId } from '@/lib/device-fingerprint';

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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAutoLoginChecking: boolean;
  stayLoggedIn: boolean;
  signIn: (email: string, password: string, stayLoggedIn?: boolean) => Promise<{ error: Error | null; data?: { user: User; session: Session } }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
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

// Get cached session for immediate UI restore
const getCachedSession = () => {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is less than 7 days old (much longer for Android reopens)
      const cacheAge = Date.now() - data.cached_at;
      const isExpired = data.expires_at && Date.now() / 1000 > data.expires_at;
      if (cacheAge < 604800000 && !isExpired) { // 7 days
        return data;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    let isLoadingRef = true;
    let mounted = true;

    // Helper to safely stop loading
    const finishLoading = () => {
      if (isLoadingRef && mounted) {
        isLoadingRef = false;
        setIsLoading(false);
      }
    };

    // Helper to clear all auth state and redirect to login
    const clearAuthAndFinish = () => {
      console.log('[AuthProvider] Clearing auth state, redirecting to login');
      setUser(null);
      setSession(null);
      setProfile(null);
      cacheSession(null);
      finishLoading();
    };

    // Immediately restore from cache for faster UI (temporary until verified)
    const cachedData = getCachedSession();
    if (cachedData && getStayLoggedInPreference()) {
      setUser(cachedData.user);
    }

    // ===== SAFETY TIMEOUT =====
    // Absolute maximum time before forcing loading to complete
    const safetyTimeout = setTimeout(() => {
      if (isLoadingRef) {
        console.warn('[AuthProvider] ⚠️ SAFETY TIMEOUT (4s) - forcing loading completion');
        // Don't keep a potentially invalid cached user - clear everything
        clearAuthAndFinish();
      }
    }, 4000);

    // ===== AUTH STATE LISTENER =====
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        console.log('[AuthProvider] Auth state change:', event, !!currentSession);

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (getStayLoggedInPreference()) {
          cacheSession(currentSession);
        }

        if (currentSession?.user) {
          // Fetch profile in background - don't block loading
          setTimeout(async () => {
            if (!mounted) return;
            try {
              const profileData = await fetchProfile(currentSession.user.id);
              if (mounted) setProfile(profileData);
            } catch (err) {
              console.error('[AuthProvider] Profile fetch failed:', err);
            }
            finishLoading();
          }, 0);
        } else {
          setProfile(null);
          finishLoading();
        }

        if (event === 'TOKEN_REFRESHED' && currentSession) {
          cacheSession(currentSession);
        }
        if (event === 'SIGNED_OUT') {
          cacheSession(null);
          setProfile(null);
        }
      }
    );

    // ===== DEVICE AUTO-LOGIN =====
    const attemptDeviceAutoLogin = async () => {
      try {
        const alreadyAttempted = sessionStorage.getItem(AUTO_LOGIN_ATTEMPTED_KEY);
        if (alreadyAttempted) {
          console.log('[AutoLogin] Already attempted, skipping');
          return false;
        }

        console.log('[AutoLogin] Starting device auto-login...');
        setIsAutoLoginChecking(true);

        const deviceId = await getDeviceId();

        // Timeout for auto-login edge function
        const controller = new AbortController();
        const autoLoginTimeout = setTimeout(() => controller.abort(), 5000);

        try {
          const { data, error } = await supabase.functions.invoke('device-auto-login', {
            body: { device_id: deviceId }
          });

          clearTimeout(autoLoginTimeout);

          if (error) {
            console.error('[AutoLogin] Edge function error:', error);
            return false;
          }

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
                console.log('[AutoLogin] Session restored successfully!');
                cacheSession(otpData.session);
                return true;
              }
            } catch (otpErr) {
              console.error('[AutoLogin] OTP exception:', otpErr);
            }
          }
        } catch (fetchErr) {
          clearTimeout(autoLoginTimeout);
          console.error('[AutoLogin] Fetch error:', fetchErr);
        }

        return false;
      } catch (err) {
        console.error('[AutoLogin] Exception:', err);
        return false;
      } finally {
        if (mounted) setIsAutoLoginChecking(false);
        sessionStorage.setItem(AUTO_LOGIN_ATTEMPTED_KEY, 'true');
      }
    };

    // ===== MAIN SESSION CHECK =====
    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Starting auth initialization...');

        // Step 1: Get the locally stored session
        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (!existingSession) {
          console.log('[AuthProvider] No existing session found');
          // Try auto-login, then finish
          const autoLoginSuccess = await attemptDeviceAutoLogin();
          if (!autoLoginSuccess) {
            clearAuthAndFinish();
          }
          return;
        }

        console.log('[AuthProvider] Found existing session, verifying...');

        // Step 2: Try to refresh the session (this validates the token with the server)
        // This is the KEY fix - refreshSession will fail if the token is truly expired
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError || !refreshData.session) {
            // ❌ Token is invalid/expired and cannot be refreshed
            console.warn('[AuthProvider] ❌ Session refresh failed:', refreshError?.message);

            // Force sign out to clear invalid tokens
            try { await supabase.auth.signOut(); } catch { /* ignore */ }

            // Try auto-login as fallback
            const autoLoginSuccess = await attemptDeviceAutoLogin();
            if (!autoLoginSuccess) {
              clearAuthAndFinish();
            }
            return;
          }

          // ✅ Session refreshed successfully
          console.log('[AuthProvider] ✅ Session refreshed successfully');

          if (mounted) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
            cacheSession(refreshData.session);
          }

          // Step 3: Verify the user still exists (with timeout)
          try {
            const userCheckPromise = supabase.auth.getUser();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('getUser timeout')), 3000)
            );

            const { data: { user: currentUser }, error: userError } = await Promise.race([
              userCheckPromise,
              timeoutPromise
            ]) as any;

            if (userError || !currentUser) {
              console.warn('[AuthProvider] ❌ User verification failed:', userError?.message);
              try { await supabase.auth.signOut(); } catch { /* ignore */ }
              clearAuthAndFinish();
              return;
            }

            console.log('[AuthProvider] ✅ User verified:', currentUser.email);
          } catch (err) {
            // Timeout or error on getUser - session was already refreshed, proceed anyway
            console.warn('[AuthProvider] getUser check timed out, proceeding with refreshed session');
          }

          // Step 4: Fetch profile (non-blocking)
          if (mounted && refreshData.session?.user) {
            try {
              const profileData = await fetchProfile(refreshData.session.user.id);
              if (mounted) setProfile(profileData);
            } catch (err) {
              console.error('[AuthProvider] Profile fetch failed, continuing:', err);
            }
          }

          finishLoading();

        } catch (refreshErr) {
          console.error('[AuthProvider] Unexpected refresh error:', refreshErr);
          // If refresh throws unexpectedly, clear auth
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          clearAuthAndFinish();
        }

      } catch (err) {
        console.error('[AuthProvider] Auth initialization error:', err);
        clearAuthAndFinish();
      }
    };

    initializeAuth();

    // Periodic session refresh for background/mobile
    const refreshInterval = setInterval(async () => {
      if (getStayLoggedInPreference()) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            const expiresAt = currentSession.expires_at;
            if (expiresAt && (expiresAt - Date.now() / 1000) < 600) {
              await supabase.auth.refreshSession();
            }
          }
        } catch (err) {
          console.error('[AuthProvider] Periodic refresh error:', err);
        }
      }
    }, 60000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      clearTimeout(safetyTimeout);
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string, rememberMe: boolean = false): Promise<{ error: Error | null; data?: { user: User; session: Session } }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Set stay logged in preference
      if (!error && data.session) {
        setStayLoggedIn(rememberMe);
        if (rememberMe) {
          cacheSession(data.session);
        }
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

      return {
        error: null,
        data: data.user && data.session ? { user: data.user, session: data.session } : undefined
      };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
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

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'https://www.googleapis.com/auth/drive.file'
          }
        }
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
    }

    // Clear auto-login attempt flag so next app open can try again
    try {
      sessionStorage.removeItem(AUTO_LOGIN_ATTEMPTED_KEY);
      // Clear session cache
      cacheSession(null);
    } catch {
      // Ignore storage errors
    }

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
      signInWithGoogle,
      signOut,
      refreshProfile,
      setStayLoggedIn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
