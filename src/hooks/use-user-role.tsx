import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { secureSet, secureGet, secureRemove } from '@/lib/secure-storage';
import { isGuestDemoMode } from '@/lib/demo-data';

export type AppRole = 'boss' | 'admin' | 'cashier';

interface UserRoleState {
  role: AppRole | null;
  ownerId: string | null;
  isLoading: boolean;
  isBoss: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isOwner: boolean;
  canAccessSettings: boolean;
  canAccessReports: boolean;
  canAccessPartners: boolean;
  canManageLicenses: boolean;
  canManageUsers: boolean;
  canEditPrice: boolean;
}

interface UserRoleContextType extends UserRoleState {
  refreshRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

// Encrypted storage key — data is XOR-encrypted with device key via secure-storage
const ROLE_CACHE_KEY = 'user_role_cache';
const ROLE_NS = 'hp_rc'; // short namespace to avoid plain-text key exposure

function buildStateFromRole(role: AppRole, ownerId: string, isDemo = false): UserRoleState {
  const isBoss = role === 'boss';
  const isAdmin = role === 'admin';
  const isCashier = role === 'cashier';
  const demoActive = isDemo || (typeof window !== 'undefined' && isGuestDemoMode());
  return {
    role,
    ownerId,
    isLoading: false,
    isBoss,
    isAdmin,
    isCashier,
    isOwner: isAdmin || isBoss,
    canAccessSettings: isBoss || isAdmin,
    canAccessReports: isBoss || isAdmin,
    canAccessPartners: isBoss || isAdmin,
    canManageLicenses: !demoActive && isBoss,
    canManageUsers: !demoActive && (isBoss || isAdmin),
    canEditPrice: isBoss || isAdmin,
  };
}

function getCachedRole(userId: string): { role: AppRole; ownerId: string } | null {
  try {
    // Remove any legacy plain-text entry
    localStorage.removeItem('hyperpos_user_role_cache');

    const parsed = secureGet<{ userId: string; role: AppRole; ownerId: string }>(
      ROLE_CACHE_KEY,
      { namespace: ROLE_NS }
    );
    if (parsed && parsed.userId === userId && parsed.role) {
      return { role: parsed.role, ownerId: parsed.ownerId || userId };
    }
  } catch { /* ignore */ }
  return null;
}

function setCachedRole(userId: string, role: AppRole, ownerId: string) {
  try {
    secureSet(ROLE_CACHE_KEY, { userId, role, ownerId }, { namespace: ROLE_NS });
  } catch { /* ignore */ }
}

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<UserRoleState>(() => {
    // In Guest Demo Mode, immediately return full admin rights (with canManageUsers = false)
    if (typeof window !== 'undefined' && isGuestDemoMode()) {
      return buildStateFromRole('admin', 'guest-demo-user', true);
    }

    // Try to load encrypted cached role immediately for instant offline UI
    if (typeof window !== 'undefined') {
      try {
        const parsed = secureGet<{ userId: string; role: AppRole; ownerId: string }>(
          ROLE_CACHE_KEY,
          { namespace: ROLE_NS }
        );
        if (parsed?.role) {
          return { ...buildStateFromRole(parsed.role, parsed.ownerId || ''), isLoading: false };
        }
      } catch { /* ignore */ }
    }
    return {
      role: null,
      ownerId: null,
      isLoading: true,
      isBoss: false,
      isAdmin: false,
      isCashier: false,
      isOwner: false,
      canAccessSettings: false,
      canAccessReports: false,
      canAccessPartners: false,
      canManageLicenses: false,
      canManageUsers: false,
      canEditPrice: false,
    };
  });

  const fetchRole = useCallback(async () => {
    // If in demo mode, lock to admin without network calls
    if (isGuestDemoMode() || user?.id === 'guest-demo-user') {
      setState(buildStateFromRole('admin', 'guest-demo-user', true));
      return;
    }

    if (!user) {
      setState({
        role: null,
        ownerId: null,
        isLoading: false,
        isBoss: false,
        isAdmin: false,
        isCashier: false,
        isOwner: false,
        canAccessSettings: false,
        canAccessReports: false,
        canAccessPartners: false,
        canManageLicenses: false,
        canManageUsers: false,
        canEditPrice: false,
      });
      try { secureRemove(ROLE_CACHE_KEY, { namespace: ROLE_NS }); } catch { /* ignore */ }
      return;
    }

    // Load from encrypted cache first for instant UI
    const cached = getCachedRole(user.id);
    if (cached) {
      setState(buildStateFromRole(cached.role, cached.ownerId));
    } else {
      setState(prev => ({ ...prev, isLoading: true }));
    }

    try {
      const roleQuery = supabase
        .from('user_roles')
        .select('role, owner_id, is_active')
        .eq('user_id', user.id)
        .single();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2500)
      );

      const { data, error } = await Promise.race([roleQuery, timeoutPromise]);

      if (error || !data) {
        console.warn('[UserRole] Could not fetch remote role, falling back to local cache');
        if (!cached) {
          setState(prev => ({ ...prev, isLoading: false, role: null }));
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
        return;
      }

      if (data.is_active === false && data.role !== 'boss') {
        console.warn('[UserRole] User account is inactive, signing out...');
        const { toast } = await import('sonner');
        toast.error('تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة');
        await supabase.auth.signOut();
        setState(prev => ({ ...prev, isLoading: false, role: null }));
        return;
      }

      const role = data.role as AppRole;
      const ownerId = data.owner_id || user.id;

      // Update encrypted cache
      setCachedRole(user.id, role, ownerId);
      setState(buildStateFromRole(role, ownerId));
    } catch (err) {
      console.error('Error in fetchRole:', err);
      if (!cached) {
        setState(prev => ({ ...prev, isLoading: false }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [user]);

  const refreshRole = useCallback(async () => {
    await fetchRole();
  }, [fetchRole]);

  useEffect(() => {
    if (!authLoading) {
      fetchRole();
    }
  }, [user, authLoading, fetchRole]);

  // Synchronize state immediately whenever guest demo mode is activated or ended
  useEffect(() => {
    const handleDemoSync = () => {
      if (isGuestDemoMode()) {
        setState(buildStateFromRole('admin', 'guest-demo-user', true));
      } else {
        fetchRole();
      }
    };
    window.addEventListener('guest-demo-started', handleDemoSync);
    window.addEventListener('guest-demo-ended', handleDemoSync);
    window.addEventListener('storage', handleDemoSync);
    return () => {
      window.removeEventListener('guest-demo-started', handleDemoSync);
      window.removeEventListener('guest-demo-ended', handleDemoSync);
      window.removeEventListener('storage', handleDemoSync);
    };
  }, [fetchRole]);

  return (
    <UserRoleContext.Provider value={{ ...state, refreshRole }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }

  // In Guest Demo Mode, guarantee admin privileges locally for smooth navigation
  if (typeof window !== 'undefined' && isGuestDemoMode()) {
    if (!context.role || context.role !== 'admin') {
      return {
        ...context,
        role: 'admin' as AppRole,
        ownerId: 'guest-demo-user',
        isLoading: false,
        isBoss: false,
        isAdmin: true,
        isCashier: false,
        isOwner: true,
        canAccessSettings: true,
        canAccessReports: true,
        canAccessPartners: true,
        canManageLicenses: false,
        canManageUsers: false,
        canEditPrice: true,
      };
    }
  }

  return context;
}
