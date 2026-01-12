import { ReactNode, useState } from 'react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
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
      
      {/* Mobile menu trigger */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={toggleSidebar} />
      )}
      
      <main className={`min-h-screen transition-all duration-300 ${isMobile ? 'mr-0' : 'mr-64'}`}>
        {children}
      </main>
    </div>
  );
}
