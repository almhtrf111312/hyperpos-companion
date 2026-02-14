import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole, AppRole } from '@/hooks/use-user-role';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
  fallback?: ReactNode;
}

// Map routes to page keys for allowed_pages check
const routeToPageKey: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/products': 'products',
  '/partners': 'partners',
  '/reports': 'reports',
  '/warehouses': 'warehouses',
  '/stock-transfer': 'stock-transfer',
  '/settings': 'settings',
};

export function RoleGuard({ 
  children, 
  allowedRoles, 
  redirectTo = '/', 
  fallback 
}: RoleGuardProps) {
  const { role, isLoading } = useUserRole();
  const { profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    // Check if cashier has explicit permission for this page
    if (role === 'cashier' && profile) {
      const allowedPages = (profile as any).allowed_pages as string[] | null;
      if (allowedPages && allowedPages.length > 0) {
        const currentPath = location.pathname;
        // Check exact match or prefix match for nested routes
        const pageKey = routeToPageKey[currentPath] || 
          Object.entries(routeToPageKey).find(([route]) => currentPath.startsWith(route))?.[1];
        if (pageKey && allowedPages.includes(pageKey)) {
          return <>{children}</>;
        }
      }
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

// HOC for pages that require specific roles
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: AppRole[],
  redirectTo?: string
) {
  return function GuardedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} redirectTo={redirectTo}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}
