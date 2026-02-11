import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

const STAY_LOGGED_IN_KEY = 'hyperpos_stay_logged_in';

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
  stayLoggedIn: boolean;
  signIn: (email: string, password: string, stayLoggedIn?: boolean) => Promise<{ error: Error | null; data?: { user: User; session: Session } }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setStayLoggedIn: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStayLoggedInPreference = (): boolean => {
  try {
    return localStorage.getItem(STAY_LOGGED_IN_KEY) === 'true';
  } catch {
    return false;
  }
};

function clearAllAuthStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('hyperpos_') ||
        key.startsWith('sb-') ||
        key === 'supabase.auth.token'
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
  } catch {
    // Ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stayLoggedIn, setStayLoggedInState] = useState(getStayLoggedInPreference);
  const isSigningOut = useRef(false);
  const lastProcessedUserId = useRef<string | null>(null);
  const initDone = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.error('[Auth] Error in fetchProfile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  const setStayLoggedIn = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STAY_LOGGED_IN_KEY, value.toString());
      setStayLoggedInState(value);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleSession = async (currentSession: Session | null, event: string) => {
      if (!mounted || isSigningOut.current) return;

      if (currentSession?.user) {
        if (lastProcessedUserId.current === currentSession.user.id && !isLoading) {
          return;
        }
        lastProcessedUserId.current = currentSession.user.id;

        setSession(currentSession);
        setUser(currentSession.user);
        setIsLoading(false);

        try {
          const profileData = await fetchProfile(currentSession.user.id);
          if (mounted && !isSigningOut.current) {
            setProfile(profileData);
          }
        } catch (err) {
          console.error('[Auth] Profile fetch failed:', err);
        }
      } else {
        lastProcessedUserId.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        console.log('[Auth] State change:', event, !!currentSession);

        if (event === 'SIGNED_OUT') {
          lastProcessedUserId.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && currentSession) {
          setSession(currentSession);
          return;
        }

        await handleSession(currentSession, event);
      }
    );

    const initializeAuth = async () => {
      if (initDone.current) return;
      initDone.current = true;

      try {
        console.log('[Auth] Initializing...');
        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (existingSession?.user) {
          console.log('[Auth] Found session for:', existingSession.user.email);
          await handleSession(existingSession, 'INITIAL_SESSION');
        } else {
          console.log('[Auth] No session found');
          if (mounted) {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    const safetyTimeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('[Auth] Safety timeout - finishing loading');
        setIsLoading(false);
      }
    }, 4000);

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string, rememberMe: boolean = false): Promise<{ error: Error | null; data?: { user: User; session: Session } }> => {
    try {
      isSigningOut.current = false;
      lastProcessedUserId.current = null;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      setStayLoggedIn(rememberMe);

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        lastProcessedUserId.current = data.user.id;

        try {
          const profileData = await fetchProfile(data.user.id);
          setProfile(profileData);
        } catch {}

        try {
          const { addActivityLog } = await import('@/lib/activity-log');
          addActivityLog(
            'login',
            data.user.id,
            data.user.email || 'مستخدم',
            'تم تسجيل الدخول بنجاح',
            { email, stayLoggedIn: rememberMe }
          );
        } catch {}
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
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
    isSigningOut.current = true;
    lastProcessedUserId.current = null;

    if (user) {
      try {
        const { addActivityLog } = await import('@/lib/activity-log');
        addActivityLog('logout', user.id, user.email || 'مستخدم', 'تم تسجيل الخروج', {});
      } catch {}
    }

    setUser(null);
    setSession(null);
    setProfile(null);

    clearAllAuthStorage();

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('[Auth] SignOut API error (non-critical):', err);
    }

    isSigningOut.current = false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isLoading,
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
