import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

// Define the role hierarchy
// Boss: Super admin, can see everything
// Owner: Shop owner, can manage everything in their shop (maps to old 'admin')
// Distributor: Can distribute licenses/balance (future use)
// Cashier: Standard employee
export type AppRole = 'boss' | 'owner' | 'admin' | 'distributor' | 'cashier';

interface UserRoleState {
  role: AppRole | null;
  ownerId: string | null;
  isLoading: boolean;

  // Hierarchy flags
  isBoss: boolean;       // Top level
  isOwner: boolean;      // Shop level (includes Boss)
  isDistributor: boolean; // Distributor level (includes Boss & Owner)
  isCashier: boolean;    // Employee level (includes all above)

  // Feature flags
  canAccessSettings: boolean;
  canAccessReports: boolean;
  canAccessPartners: boolean;
  canManageLicenses: boolean;
  canManageUsers: boolean;
  canEditPrice: boolean;

  error?: string | null;
}

interface UserRoleContextType extends UserRoleState {
  refreshRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

const ROLE_CACHE_KEY = 'hyperpos_role_cache';

function cacheRole(userId: string, role: AppRole, ownerId: string) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role, ownerId, ts: Date.now() }));
  } catch { }
}

function getCachedRole(userId: string): { role: AppRole; ownerId: string } | null {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.userId === userId && Date.now() - cached.ts < 3600000) { // 1 hour cache
      return { role: cached.role, ownerId: cached.ownerId };
    }
  } catch { }
  return null;
}

function buildState(role: AppRole, ownerId: string): UserRoleState {
  // 1. Determine base role boolean
  const isBossExactly = role === 'boss';
  const isOwnerExactly = role === 'owner' || role === 'admin'; // 'admin' treated as 'owner' for backward compatibility
  const isDistributorExactly = role === 'distributor';
  const isCashierExactly = role === 'cashier';

  // 2. Apply Hierarchy (Downward inheritance)
  // Boss has ALL permissions
  const isBoss = isBossExactly;

  // Owner is Boss OR Owner
  const isOwner = isBoss || isOwnerExactly;

  // Distributor is Boss OR Owner OR Distributor (Distributor usually needs Owner privileges too)
  const isDistributor = isBoss || isOwnerExactly || isDistributorExactly;

  // Cashier is anyone who can use the POS. usually everyone can use POS.
  const isCashier = isBoss || isOwner || isDistributor || isCashierExactly;

  return {
    role,
    ownerId,
    isLoading: false,

    isBoss,
    isOwner,
    isDistributor,
    isCashier,

    // Feature permissions based on hierarchy
    canAccessSettings: isOwner,    // Boss & Owner can access settings
    canAccessReports: isOwner,     // Boss & Owner can access reports
    canAccessPartners: isOwner,    // Boss & Owner can access partners
    canManageLicenses: isBoss,     // Only Boss can manage licenses
    canManageUsers: isOwner,       // Boss & Owner can manage users
    canEditPrice: isOwner,         // Boss & Owner can edit prices

    error: null
  };
}

const emptyState: UserRoleState = {
  role: null,
  ownerId: null,
  isLoading: false,
  isBoss: false,
  isOwner: false,
  isDistributor: false,
  isCashier: false,
  canAccessSettings: false,
  canAccessReports: false,
  canAccessPartners: false,
  canManageLicenses: false,
  canManageUsers: false,
  canEditPrice: false,
  error: null
};

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const lastFetchedUserId = useRef<string | null>(null);
  const [state, setState] = useState<UserRoleState>({ ...emptyState, isLoading: true });

  const fetchRole = useCallback(async (force = false) => {
    if (!user) {
      lastFetchedUserId.current = null;
      localStorage.removeItem(ROLE_CACHE_KEY);
      setState(prev => ({ ...emptyState, isLoading: false }));
      return;
    }

    if (!force && lastFetchedUserId.current === user.id) {
      // Already fetched for this user
      return;
    }

    // Try cache first
    const cached = getCachedRole(user.id);
    if (cached && !force) {
      setState(buildState(cached.role, cached.ownerId));
      // We can optionally refresh in background, but for now trust cache to start fast
      // If we want to refresh in background, simple calls without await here.
    } else {
      // Only show loading if no cache
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      console.log('[UserRole] Fetching role for:', user.id);

      // TIMEOUT PROTECTION: Force fail if request takes too long
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Role fetch timeout')), 8000)
      );

      const fetchPromise = supabase
        .from('user_roles')
        .select('role, owner_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.error('[UserRole] Error:', error);
        if (cached) {
          // Keep using cached version if offline/error
          console.log('[UserRole] Using cached role due to error');
          setState(prev => ({ ...buildState(cached.role, cached.ownerId), error: 'Offline mode' }));
        } else {
          // Real error and no cache
          setState(prev => ({ ...emptyState, isLoading: false, error: 'Failed to load role' }));
        }
        lastFetchedUserId.current = user.id; // Mark as fetched to stop loops
        return;
      }

      if (!data) {
        console.warn('[UserRole] No role found for user:', user.id);
        lastFetchedUserId.current = user.id;
        setState(prev => ({ ...emptyState, isLoading: false }));
        return;
      }

      const role = data.role as AppRole;
      const ownerId = data.owner_id || user.id;

      console.log('[UserRole] Got role:', role);
      lastFetchedUserId.current = user.id;
      cacheRole(user.id, role, ownerId);
      setState(buildState(role, ownerId));

    } catch (err) {
      console.error('[UserRole] Exception:', err);
      lastFetchedUserId.current = user.id;

      if (cached) {
        setState(prev => ({ ...buildState(cached.role, cached.ownerId), error: 'Offline mode' }));
      } else {
        setState(prev => ({ ...emptyState, isLoading: false, error: 'Connection error' }));
      }
    }
  }, [user]);

  const refreshRole = useCallback(async () => {
    lastFetchedUserId.current = null;
    await fetchRole(true);
  }, [fetchRole]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchRole();
      } else {
        lastFetchedUserId.current = null;
        localStorage.removeItem(ROLE_CACHE_KEY);
        setState({ ...emptyState, isLoading: false });
      }
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
