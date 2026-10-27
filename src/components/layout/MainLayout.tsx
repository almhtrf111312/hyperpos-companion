import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Sidebar, MobileMenuTrigger } from './Sidebar';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { useOrientationChange } from '@/hooks/use-app-lifecycle';
import { useLanguage } from '@/hooks/use-language';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { isRTL, t } = useLanguage();
  const { syncNow: triggerPullToRefreshSync } = useCloudSyncContext();
  
  // Pull-to-refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const canPullRef = useRef(false);

  const toggleSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sidebar-state', { detail: sidebarOpen }));
  }, [sidebarOpen]);

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

  // Touch handlers for Pull-to-Refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing || sidebarOpen) return;

    // 1. فحص أن التمرير في أعلى الصفحة تماماً
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop > 5) return;

    // 2. فحص عدم وجود أي نافذة منبثقة أو درج مفتوح
    const hasOpenModal = Boolean(document.querySelector('[role="dialog"], [data-state="open"]'));
    if (hasOpenModal) return;

    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    canPullRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canPullRef.current || startYRef.current === null || startXRef.current === null || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // فقط إذا كان السحب للأسفل ومساره عمودي أكبر من الأفقي
    if (deltaY > 0 && deltaY > Math.abs(deltaX)) {
      setIsPulling(true);
      // معامل مقاومة ناعم 0.45 بحد أقصى 95px
      const distance = Math.min(deltaY * 0.45, 95);
      setPullDistance(distance);
    } else if (deltaY < 0) {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = async () => {
    if (!canPullRef.current) return;
    canPullRef.current = false;
    startYRef.current = null;
    startXRef.current = null;
    setIsPulling(false);

    if (pullDistance >= 65 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(68); // يثبت المؤشر في الأعلى أثناء المزامنة
      try {
        await triggerPullToRefreshSync();
      } catch (err) {
        console.warn('Pull to refresh sync failed:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden max-w-full relative">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} defaultCollapsed={isTablet} />
      
      {/* Mobile menu trigger - positioned to not overlap with notification bar */}
      {isMobile && !sidebarOpen && (
        <MobileMenuTrigger onClick={openSidebar} />
      )}

      {/* مؤشر السحب للتحديث العائم مع السهم الدوار */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            transform: `translate3d(-50%, ${isRefreshing ? 68 : pullDistance}px, 0)`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 35, 1),
            transition: isPulling ? 'none' : 'transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.25s ease-out',
          }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[80] pointer-events-none flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 dark:bg-zinc-800/95 shadow-xl border border-zinc-200/80 dark:border-zinc-700/80 backdrop-blur-md"
        >
          <RefreshCw
            className={cn(
              "w-4 h-4 text-primary shrink-0 transition-transform",
              isRefreshing && "animate-spin"
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
            }}
          />
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 select-none whitespace-nowrap">
            {isRefreshing
              ? (t('refreshingData') || 'جاري المزامنة وتحديث البيانات...')
              : pullDistance >= 65
              ? (t('releaseToRefresh') || 'أفلت لبدء المزامنة والتحديث')
              : (t('pullToRefresh') || 'اسحب للأسفل للتحديث')}
          </span>
        </div>
      )}

      {/* Main content - explicit physical margin based on RTL/LTR with pull touch listeners */}
      <main
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "min-h-screen overflow-x-hidden max-w-full transition-all duration-300 pt-4",
          isMobile 
            ? "m-0" 
            : isTablet 
              ? (isRTL ? "mr-[calc(72px+16px)] ml-0" : "ml-[calc(72px+16px)] mr-0") 
              : (isRTL ? "mr-[calc(14rem+16px)] ml-0" : "ml-[calc(14rem+16px)] mr-0")
        )}
      >
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
