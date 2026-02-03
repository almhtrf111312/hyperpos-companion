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
      // Check if cache is less than 1 hour old and not expired
      const cacheAge = Date.now() - data.cached_at;
      const isExpired = data.expires_at && Date.now() / 1000 > data.expires_at;
      if (cacheAge < 3600000 && !isExpired) {
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
    // Immediately restore from cache for faster UI
    const cachedData = getCachedSession();
    if (cachedData && getStayLoggedInPreference()) {
      setUser(cachedData.user);
    }

    // Set up auth state listener BEFORE checking for existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Cache session if stay logged in is enabled
        if (getStayLoggedInPreference()) {
          cacheSession(currentSession);
        }

        if (currentSession?.user) {
          // Use setTimeout to avoid potential deadlocks
          setTimeout(async () => {
            const profileData = await fetchProfile(currentSession.user.id);
            setProfile(profileData);
            setIsLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setIsLoading(false);
        }

        // Handle token refresh events
        if (event === 'TOKEN_REFRESHED' && currentSession) {
          cacheSession(currentSession);
        }

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          cacheSession(null);
        }
      }
    );

    // Attempt device auto-login function
    const attemptDeviceAutoLogin = async () => {
      try {
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

        const { data, error } = await supabase.functions.invoke('device-auto-login', {
          body: { device_id: deviceId }
        });

        if (error) {
          console.error('[AutoLogin] Edge function error:', error);
          return false;
        }

        console.log('[AutoLogin] Response:', data);

        if (data?.success && data?.action_link) {
          // Extract token from action link and verify with OTP
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

        return false;
      } catch (err) {
        console.error('[AutoLogin] Exception:', err);
        return false;
      } finally {
        setIsAutoLoginChecking(false);
        // Mark that we attempted auto-login this session
        sessionStorage.setItem(AUTO_LOGIN_ATTEMPTED_KEY, 'true');
      }
    };

    // Check for existing session and verify user still exists
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!existingSession) {
        // No session - try device auto-login
        const autoLoginSuccess = await attemptDeviceAutoLogin();
        if (!autoLoginSuccess) {
          setIsLoading(false);
          cacheSession(null);
        }
        return;
      }
      
      // Verify the user still exists in the database
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        // User doesn't exist anymore, clear session
        console.log('User from session does not exist, signing out...');
        await supabase.auth.signOut();
        
        // Try device auto-login as fallback
        const autoLoginSuccess = await attemptDeviceAutoLogin();
        if (!autoLoginSuccess) {
          setIsLoading(false);
          cacheSession(null);
        }
        return;
      }
      // The onAuthStateChange will handle setting the session
    });

    // Periodic session refresh for Android background
    const refreshInterval = setInterval(async () => {
      if (getStayLoggedInPreference()) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          // Try to refresh if expiring soon (within 10 minutes)
          const expiresAt = currentSession.expires_at;
          if (expiresAt && (expiresAt - Date.now() / 1000) < 600) {
            await supabase.auth.refreshSession();
          }
        }
      }
    }, 60000); // Check every minute

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
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
