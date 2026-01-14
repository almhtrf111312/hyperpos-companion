import { ReactNode, useState } from 'react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      {/* Mobile menu trigger - positioned to not overlap with notification bar */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={toggleSidebar} />
      )}

      {/* Top bar with notifications - positioned on the left side */}
      <div className={`fixed top-0 z-30 transition-all duration-300 ${isMobile ? 'left-4' : 'left-4'}`}>
        <div className="flex items-center gap-2 py-4">
          <NotificationBell />
        </div>
      </div>
      
      <main className={`min-h-screen transition-all duration-300 pt-16 ${isMobile ? 'mr-0' : 'mr-64'}`}>
        {children}
      </main>
    </div>
  );
}
