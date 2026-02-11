import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

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

const ROLE_CACHE_KEY = 'hyperpos_role_cache';

function cacheRole(userId: string, role: AppRole, ownerId: string) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role, ownerId, ts: Date.now() }));
  } catch {}
}

function getCachedRole(userId: string): { role: AppRole; ownerId: string } | null {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.userId === userId && Date.now() - cached.ts < 3600000) {
      return { role: cached.role, ownerId: cached.ownerId };
    }
  } catch {}
  return null;
}

function buildState(role: AppRole, ownerId: string): UserRoleState {
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

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const lastFetchedUserId = useRef<string | null>(null);
  const fetchedRoleRef = useRef<AppRole | null>(null);
  const [state, setState] = useState<UserRoleState>({
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
  });

  const fetchRole = useCallback(async (force = false) => {
    if (!user) {
      lastFetchedUserId.current = null;
      fetchedRoleRef.current = null;
      localStorage.removeItem(ROLE_CACHE_KEY);
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
      return;
    }

    if (!force && lastFetchedUserId.current === user.id && fetchedRoleRef.current !== null) {
      return;
    }

    if (!force) {
      const cached = getCachedRole(user.id);
      if (cached) {
        lastFetchedUserId.current = user.id;
        fetchedRoleRef.current = cached.role;
        setState(buildState(cached.role, cached.ownerId));
        return;
      }
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const { data, error } = await supabase
        .from('user_roles')
        .select('role, owner_id, is_active')
        .eq('user_id', user.id)
        .order('is_active', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
        const cached = getCachedRole(user.id);
        if (cached) {
          lastFetchedUserId.current = user.id;
          fetchedRoleRef.current = cached.role;
          setState(buildState(cached.role, cached.ownerId));
        } else {
          setState(prev => ({ ...prev, isLoading: false, role: null }));
        }
        return;
      }

      if (!data) {
        console.warn('[UserRole] No role found for user:', user.id);
        setState(prev => ({ ...prev, isLoading: false, role: null }));
        return;
      }

      const role = data.role as AppRole;
      const ownerId = data.owner_id || user.id;

      lastFetchedUserId.current = user.id;
      fetchedRoleRef.current = role;
      cacheRole(user.id, role, ownerId);
      setState(buildState(role, ownerId));
    } catch (err) {
      console.error('Error in fetchRole:', err);
      const cached = getCachedRole(user.id);
      if (cached) {
        lastFetchedUserId.current = user.id;
        fetchedRoleRef.current = cached.role;
        setState(buildState(cached.role, cached.ownerId));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [user]);

  const refreshRole = useCallback(async () => {
    await fetchRole(true);
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
