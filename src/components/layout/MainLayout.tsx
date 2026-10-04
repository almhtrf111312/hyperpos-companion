import { ReactNode, useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { useOrientationChange } from '@/hooks/use-app-lifecycle';
import { useLanguage } from '@/hooks/use-language';

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { isRTL } = useLanguage();
  
  // Sidebar is collapsed by default on tablet
  const sidebarCollapsed = isTablet;

  const toggleSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  // Close sidebar on orientation change to prevent stuck overlay
  useOrientationChange(useCallback(() => {
    if (sidebarOpen && isMobile) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen, isMobile]));

  // Edge Swipe to open sidebar
  useEffect(() => {
    if (!isMobile || sidebarOpen) return;

    let startX = 0;
    const EDGE_THRESHOLD = 30; // pixels from edge

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startX;

      // In RTL, swipe from right edge (startX near window.innerWidth, diffX negative)
      // In LTR, swipe from left edge (startX near 0, diffX positive)
      if (isRTL) {
        if (window.innerWidth - startX < EDGE_THRESHOLD && diffX < -50) {
          openSidebar();
        }
      } else {
        if (startX < EDGE_THRESHOLD && diffX > 50) {
          openSidebar();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, sidebarOpen, isRTL, openSidebar]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden max-w-full">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} defaultCollapsed={isTablet} />
      
      {/* Mobile menu trigger - positioned to not overlap with notification bar */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={openSidebar} />
      )}

      {/* Main content - margin based on RTL/LTR using inline-start */}
      <main className={`min-h-screen overflow-x-hidden max-w-full transition-all duration-300 pt-4 ${
        isMobile ? 'ms-0' : isTablet ? 'ms-[calc(72px+16px)]' : 'ms-[calc(14rem+16px)]'
      }`}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
