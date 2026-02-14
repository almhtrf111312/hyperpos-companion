import { ReactNode, useState, useCallback } from 'react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
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
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} defaultCollapsed={isTablet} />
      
      {/* Mobile menu trigger - positioned to not overlap with notification bar */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={toggleSidebar} />
      )}

      {/* Main content - margin based on RTL/LTR */}
      <main className={`min-h-screen transition-all duration-300 pt-4 ${
        isRTL 
          ? (isMobile ? 'mr-0' : isTablet ? 'mr-[72px]' : 'mr-56') 
          : (isMobile ? 'ml-0' : isTablet ? 'ml-[72px]' : 'ml-56')
      }`}>
        {children}
      </main>
    </div>
  );
}
