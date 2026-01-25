import { useEffect, useState, useRef, useCallback } from 'react';
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
import { showToast } from '@/lib/toast-config';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function ExitConfirmDialog() {
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [backPressCount, setBackPressCount] = useState(0);
  const location = useLocation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backPressCountRef = useRef(0);

  // Keep ref in sync with state for use in listener callback
  useEffect(() => {
    backPressCountRef.current = backPressCount;
  }, [backPressCount]);

  const handleBackPress = useCallback(() => {
    if (backPressCountRef.current === 0) {
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
  }, []);

  useEffect(() => {
    const isMainRoute = location.pathname === '/' || location.pathname === '/pos';
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    // Setup Capacitor back button listener for native platforms
    const setupCapacitorBackButton = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          listenerHandle = await App.addListener('backButton', ({ canGoBack }) => {
            // If on main route and can't go back, handle exit
            if (isMainRoute || !canGoBack) {
              handleBackPress();
            } else {
              // Allow normal back navigation on other routes
              window.history.back();
            }
          });
        } catch (error) {
          console.error('Failed to setup Capacitor back button listener:', error);
        }
      }
    };

    setupCapacitorBackButton();

    // Handle browser back button (popstate event) for web
    const handlePopState = (event: PopStateEvent) => {
      if (!isMainRoute) return;
      
      event.preventDefault();
      window.history.pushState(null, '', window.location.href);
      handleBackPress();
    };

    // Push initial state to enable popstate handling (web only)
    if (!Capacitor.isNativePlatform()) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      if (!Capacitor.isNativePlatform()) {
        window.removeEventListener('popstate', handlePopState);
      }
      listenerHandle?.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname, handleBackPress]);

  const handleConfirmExit = async () => {
    setShowExitDialog(false);
    
    // Use Capacitor App.exitApp() for native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        await App.exitApp();
      } catch (error) {
        console.error('Failed to exit app:', error);
      }
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
