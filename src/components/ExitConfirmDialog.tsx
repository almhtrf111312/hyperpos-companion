import { useEffect, useState } from 'react';
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

export function ExitConfirmDialog() {
  const [showExitDialog, setShowExitDialog] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Disable on mobile - uses native back button/gestures
    // This prevents invisible overlay issues during screen rotation
    if (isMobile) return;

    // Handle browser back button and gesture navigation
    const handlePopState = (event: PopStateEvent) => {
      // Only show dialog on main routes
      if (location.pathname === '/' || location.pathname === '/pos') {
        event.preventDefault();
        // Push state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
        setShowExitDialog(true);
      }
    };

    // Push initial state to enable popstate handling
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, isMobile]);

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    // Close the window/tab
    window.close();
    // If window.close() doesn't work (common in browsers), go back
    window.history.go(-2);
  };

  // Don't render anything on mobile to prevent overlay issues
  if (isMobile) return null;

  return (
    <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>هل تريد الخروج من التطبيق؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيتم إغلاق التطبيق. هل أنت متأكد؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>لا</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmExit} className="bg-destructive hover:bg-destructive/90">
            نعم
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
