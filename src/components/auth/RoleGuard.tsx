import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole, AppRole } from '@/hooks/use-user-role';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
  fallback?: ReactNode;
}

export function RoleGuard({
  children,
  allowedRoles,
  redirectTo = '/',
  fallback
}: RoleGuardProps) {
  const { role, isLoading, error } = useUserRole();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => setShowError(true), 5000); // 5 sec timeout
    } else {
      setShowError(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    if (showError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-lg font-medium">مشكلة في تحميل الصلاحيات</p>
          <p className="text-sm text-muted-foreground">استغرق التحقق وقتاً طويلاً. يرجى التحقق من الانترنت.</p>
          <Button onClick={() => window.location.reload()}>إعادة تحميل الصفحة</Button>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    // If there was a hard error fetching roles, maybe we shouldn't block access if we have broad permissions?
    // But for security, better to fail safe or redirect home.
    console.error("RoleGuard blocked due to error:", error);
    return <Navigate to={redirectTo} replace />;
  }

  // Check based on the hierarchy flags we set in use-user-role would be better, 
  // but keeping array check for compatibility with props.
  // HOWEVER, we need to ensure "allowedRoles" accounts for hierarchy if passed explicitly.
  // Ideally, pages should use "canAccessX" flags, but for routing we use roles.
  // We'll trust the caller provided the list of ALL allowed roles (e.g. ['boss', 'owner']).

  if (!role || !allowedRoles.includes(role)) {
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
