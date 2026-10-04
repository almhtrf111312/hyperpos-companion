import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, checkUserAccountStatus } from '@/hooks/use-auth';
import { Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isAutoLoginChecking, signOut } = useAuth();
  const location = useLocation();
  const [isAccountBlocked, setIsAccountBlocked] = useState(false);

  useEffect(() => {
    if (!user) return;
    let isCancelled = false;

    checkUserAccountStatus(user.id).then(async (res) => {
      if (isCancelled) return;
      if (res.blocked) {
        setIsAccountBlocked(true);
        toast.error('تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة');
        try {
          await signOut();
        } catch (e) {
          console.error('[ProtectedRoute] Error signing out blocked user:', e);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [user, signOut]);

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground" style={{ color: '#a1a1aa' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Show checking device status while attempting auto-login
  if (isAutoLoginChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Smartphone className="w-10 h-10 text-primary" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full animate-ping" />
          </div>
          <p className="text-muted-foreground" style={{ color: '#a1a1aa' }}>جاري التحقق من الجهاز...</p>
          <p className="text-xs text-muted-foreground/60" style={{ color: '#71717a' }}>تسجيل دخول تلقائي</p>
        </div>
      </div>
    );
  }

  if (isAccountBlocked) {
    return <Navigate to="/login" state={{ error: 'تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة' }} replace />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
