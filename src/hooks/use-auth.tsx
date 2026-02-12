import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
      // Check if cache is less than 7 days old
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
  
  // ✅ FIX: Use ref to prevent finishLoading from being called multiple times
  const hasFinishedLoading = useRef(false);

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
    let mounted = true;
    hasFinishedLoading.current = false;

    // ✅ FIX: Single finishLoading guard using ref
    const finishLoading = () => {
      if (!hasFinishedLoading.current && mounted) {
        hasFinishedLoading.current = true;
        setIsLoading(false);
      }
    };

    // Show login page (clear all state, NO reload)
    const showLoginPage = () => {
      console.log('[AuthProvider] No valid session, showing login page');
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

    // ✅ FIX: Reduced safety timeout from 8s to 5s
    const safetyTimeout = setTimeout(() => {
      if (!hasFinishedLoading.current) {
        console.warn('[AuthProvider] ⚠️ SAFETY TIMEOUT (5s) - finishing loading with current state');
        // ✅ FIX: Don't clear the user if we have a cached session - just finish loading
        // The onAuthStateChange listener will update the state when ready
        finishLoading();
      }
    }, 5000);

    // ✅ FIX: Let onAuthStateChange be the PRIMARY source of truth
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
          }, 0);
          finishLoading();
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          cacheSession(null);
          finishLoading();
        }
        // ✅ FIX: For INITIAL_SESSION with no session, don't immediately show login
        // Wait for initializeAuth to attempt auto-login first
        if (event === 'INITIAL_SESSION' && !currentSession) {
          // Will be handled by initializeAuth below
        }

        if (event === 'TOKEN_REFRESHED' && currentSession) {
          cacheSession(currentSession);
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

        const autoLoginTimeout = setTimeout(() => {}, 5000);

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

    // ✅ FIX: Simplified initializeAuth - rely on onAuthStateChange for session state
    // Only use getSession() to check if we need auto-login, and refreshSession() 
    // is handled automatically by the Supabase client
    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Starting auth initialization...');

        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (!existingSession) {
          console.log('[AuthProvider] No existing session found');
          const autoLoginSuccess = await attemptDeviceAutoLogin();
          if (!autoLoginSuccess) {
            showLoginPage();
          }
          return;
        }

        console.log('[AuthProvider] Found existing session, user:', existingSession.user?.email);

        // ✅ FIX: Instead of calling refreshSession() which can fail and clear everything,
        // just use the existing session. The Supabase client will auto-refresh the token
        // via onAuthStateChange when needed. This prevents the race condition.
        if (mounted && !hasFinishedLoading.current) {
          setSession(existingSession);
          setUser(existingSession.user);
          cacheSession(existingSession);

          // Fetch profile (non-blocking)
          if (existingSession.user) {
            try {
              const profileData = await fetchProfile(existingSession.user.id);
              if (mounted) setProfile(profileData);
            } catch (err) {
              console.error('[AuthProvider] Profile fetch failed, continuing:', err);
            }
          }

          finishLoading();
        }

        // ✅ Attempt refresh in background (non-blocking, won't clear session on failure)
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session && mounted) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
            cacheSession(refreshData.session);
            console.log('[AuthProvider] ✅ Background session refresh successful');
          }
        } catch (refreshErr) {
          // ✅ FIX: Don't clear auth on refresh failure - session is still valid until it expires
          console.warn('[AuthProvider] Background refresh failed (non-critical):', refreshErr);
        }

      } catch (err) {
        console.error('[AuthProvider] Auth initialization error:', err);
        // On any error, if we have cached user, keep it - just finish loading
        if (!hasFinishedLoading.current) {
          finishLoading();
        }
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
