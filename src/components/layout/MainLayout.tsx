import { ReactNode, useState, useCallback } from 'react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrientationChange } from '@/hooks/use-app-lifecycle';
import { useLanguage } from '@/hooks/use-language';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isRTL } = useLanguage();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Close sidebar on orientation change to prevent stuck overlay
  useOrientationChange(useCallback(() => {
    if (sidebarOpen && isMobile) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen, isMobile]));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      {/* Mobile menu trigger - positioned to not overlap with notification bar */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={toggleSidebar} />
      )}

      {/* Top bar with notifications - positioned based on RTL/LTR */}
      <div className={`fixed top-0 z-30 transition-all duration-300 ${isRTL ? 'right-4' : 'left-4'}`}>
        <div className="flex items-center gap-2 py-4">
          <NotificationBell />
        </div>
      </div>
      
      {/* Main content - margin based on RTL/LTR */}
      <main className={`min-h-screen transition-all duration-300 pt-16 ${
        isRTL 
          ? (isMobile ? 'ml-0' : 'ml-64') 
          : (isMobile ? 'mr-0' : 'mr-64')
      }`}>
        {children}
      </main>
    </div>
  );
}
