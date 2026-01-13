import { ReactNode, useState } from 'react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';
import { RefreshCw } from 'lucide-react';

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
      
      {/* Mobile menu trigger */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={toggleSidebar} />
      )}

      {/* Top bar with notifications */}
      <div className={`fixed top-0 left-0 z-30 transition-all duration-300 ${isMobile ? 'right-0' : 'right-64'}`}>
        <div className="flex items-center justify-end gap-2 p-4">
          <NotificationBell />
          <button className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
      
      <main className={`min-h-screen transition-all duration-300 pt-16 ${isMobile ? 'mr-0' : 'mr-64'}`}>
        {children}
      </main>
    </div>
  );
}
