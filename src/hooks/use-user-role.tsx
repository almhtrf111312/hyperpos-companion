import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  canEditPrice: boolean; // صلاحية تعديل الأسعار يدوياً
}

interface UserRoleContextType extends UserRoleState {
  refreshRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
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
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const { data, error } = await supabase
        .from('user_roles')
        .select('role, owner_id, is_active')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        console.error('Error fetching role:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          role: null,
        }));
        return;
      }

      const role = data.role as AppRole;
      const ownerId = data.owner_id || user.id;

      const isBoss = role === 'boss';
      const isAdmin = role === 'admin';
      const isCashier = role === 'cashier';
      
      setState({
        role,
        ownerId,
        isLoading: false,
        isBoss,
        isAdmin,
        isCashier,
        isOwner: isAdmin || isBoss,
        // Permissions
        canAccessSettings: isBoss || isAdmin,
        canAccessReports: isBoss || isAdmin,
        canAccessPartners: isBoss || isAdmin,
        canManageLicenses: isBoss,
        canManageUsers: isBoss || isAdmin,
        canEditPrice: isBoss || isAdmin, // فقط المدير والبوس يمكنهم تعديل الأسعار
      });
    } catch (err) {
      console.error('Error in fetchRole:', err);
      setState(prev => ({ ...prev, isLoading: false }));
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
