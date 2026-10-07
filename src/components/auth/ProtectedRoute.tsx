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
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Safety net: limit loading screen to max 1.5s so user is NEVER stuck on "جاري التحميل..."
  useEffect(() => {
    if (!user && (isLoading || isAutoLoginChecking)) {
      const timer = setTimeout(() => {
        setHasTimedOut(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, isAutoLoginChecking]);

  // Background check of user account status - completely silent and non-blocking
  useEffect(() => {
    if (!user) return;
    let isCancelled = false;

    checkUserAccountStatus(user.id, 1500).then(async (res) => {
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
    }).catch(() => {
      // Ignore background network errors
    });

    return () => {
      isCancelled = true;
    };
  }, [user, signOut]);

  // 1. If local user exists and account is not blocked: render children IMMEDIATELY in 0ms!
  if (user && !isAccountBlocked) {
    return <>{children}</>;
  }

  // 2. If account is confirmed blocked, redirect to login
  if (isAccountBlocked) {
    return <Navigate to="/login" state={{ error: 'تم تعطيل هذا الحساب أو إلغاء ترخيصه، يرجى التواصل مع الإدارة' }} replace />;
  }

  // 3. If loading timed out and still no user, redirect to login immediately without getting stuck
  if (hasTimedOut && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. Show loading while checking session (only if no user yet and within timeout)
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

  // 5. Show checking device status while attempting auto-login (only if no user yet and within timeout)
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

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
