import { useEffect, useState, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { showToast } from '@/lib/toast-config';

// Extend Navigator interface for Cordova compatibility
declare global {
  interface Navigator {
    app?: {
      exitApp: () => void;
    };
  }
}

export function ExitConfirmDialog() {
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [backPressCount, setBackPressCount] = useState(0);
  const location = useLocation();
  const isMobile = useIsMobile();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isMainRoute = location.pathname === '/' || location.pathname === '/pos';

    // Handle browser back button (popstate event)
    const handlePopState = (event: PopStateEvent) => {
      if (!isMainRoute) return;
      
      event.preventDefault();
      window.history.pushState(null, '', window.location.href);
      
      if (backPressCount === 0) {
        setBackPressCount(1);
        showToast.warning('اضغط مرة أخرى للخروج من التطبيق');
        
        // Reset counter after 2 seconds
        timerRef.current = setTimeout(() => {
          setBackPressCount(0);
        }, 2000);
      } else {
        setShowExitDialog(true);
        setBackPressCount(0);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };

    // Handle Cordova back button (for mobile apps)
    const handleBackButton = (event: Event) => {
      if (!isMainRoute) return;
      
      event.preventDefault();
      
      if (backPressCount === 0) {
        setBackPressCount(1);
        showToast.warning('اضغط مرة أخرى للخروج من التطبيق');
        
        timerRef.current = setTimeout(() => {
          setBackPressCount(0);
        }, 2000);
      } else {
        setShowExitDialog(true);
        setBackPressCount(0);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };

    // Push initial state to enable popstate handling
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('backbutton', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleBackButton);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname, backPressCount]);

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    
    // Try Cordova exit first (for native mobile apps)
    if (navigator.app?.exitApp) {
      navigator.app.exitApp();
      return;
    }
    
    // Fallback for web browsers
    window.close();
    
    // If window.close() doesn't work, go back in history
    window.history.go(-2);
  };

  return (
    <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد الخروج</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من رغبتك في الخروج من التطبيق؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmExit} className="bg-destructive hover:bg-destructive/90">
            خروج
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
