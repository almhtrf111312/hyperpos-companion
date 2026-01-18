import { ReactNode, useState, useCallback } from 'react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { useOrientationChange } from '@/hooks/use-app-lifecycle';
import { useLanguage } from '@/hooks/use-language';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { isRTL } = useLanguage();
  
  // Sidebar is collapsed by default on tablet
  const sidebarCollapsed = isTablet;

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

      {/* Top bar with notifications - centered position */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
        <NotificationBell />
      </div>
      
      {/* Main content - margin based on RTL/LTR with increased top padding */}
      <main className={`min-h-screen transition-all duration-300 pt-20 ${
        isRTL 
          ? (isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-64') 
          : (isMobile ? 'mr-0' : sidebarCollapsed ? 'mr-20' : 'mr-64')
      }`}>
        {children}
      </main>
    </div>
  );
}
