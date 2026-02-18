import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { secureSet, secureGet, secureRemove } from '@/lib/secure-storage';

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

function buildStateFromRole(role: AppRole, ownerId: string): UserRoleState {
  const isBoss = role === 'boss';
  const isAdmin = role === 'admin';
  const isCashier = role === 'cashier';
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
    canManageLicenses: isBoss,
    canManageUsers: isBoss || isAdmin,
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
    // Try to load encrypted cached role immediately for instant offline UI
    if (typeof window !== 'undefined') {
      try {
        const parsed = secureGet<{ userId: string; role: AppRole; ownerId: string }>(
          ROLE_CACHE_KEY,
          { namespace: ROLE_NS }
        );
        if (parsed?.role) {
          return { ...buildStateFromRole(parsed.role, parsed.ownerId || ''), isLoading: true };
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
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, owner_id, is_active')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        console.error('Error fetching role:', error);
        // If we already have cached data, keep it (offline scenario)
        if (!cached) {
          setState(prev => ({ ...prev, isLoading: false, role: null }));
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
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
  return context;
}
