import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard, 
  Wrench, 
  UserCheck, 
  BarChart3, 
  Settings, 
  ChevronRight,
  LogOut,
  Zap,
  Menu,
  X,
  User,
  FileText,
  Receipt,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';
import { toast } from 'sonner';
import { TranslationKey } from '@/lib/i18n';
import { NotificationBell } from './NotificationBell';
import { NetworkStatusIndicator } from './NetworkStatusIndicator';
import { SyncQueueIndicator } from './SyncQueueIndicator';

interface NavItem {
  icon: React.ElementType;
  translationKey: TranslationKey;
  path: string;
  badge?: number;
  adminOnly?: boolean; // Only visible to admin and boss
}

const navItems: NavItem[] = [
  { icon: ShoppingCart, translationKey: 'nav.pos', path: '/' },
  { icon: LayoutDashboard, translationKey: 'nav.dashboard', path: '/dashboard' },
  { icon: FileText, translationKey: 'nav.invoices', path: '/invoices' },
  { icon: Package, translationKey: 'nav.products', path: '/products' },
  { icon: Users, translationKey: 'nav.customers', path: '/customers' },
  { icon: CreditCard, translationKey: 'nav.debts', path: '/debts' },
  { icon: Wrench, translationKey: 'nav.services', path: '/services' },
  { icon: UserCheck, translationKey: 'nav.partners', path: '/partners', adminOnly: true },
  { icon: Receipt, translationKey: 'nav.expenses', path: '/expenses' },
  { icon: Wallet, translationKey: 'nav.cashShifts', path: '/cash-shifts' },
  { icon: BarChart3, translationKey: 'nav.reports', path: '/reports', adminOnly: true },
  { icon: Settings, translationKey: 'nav.settings', path: '/settings', adminOnly: true },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  defaultCollapsed?: boolean;
}

export function Sidebar({ isOpen, onToggle, defaultCollapsed = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { user, profile, signOut } = useAuth();
  const { t, isRTL } = useLanguage();
  const { isBoss, isAdmin } = useUserRole();

  // Close sidebar on mobile, collapse on tablet when navigating
  useEffect(() => {
    // تأخير بسيط لضمان انسيابية الحركة على جميع الصفحات
    const timer = setTimeout(() => {
      // على iPad: طي القائمة (العودة للأيقونات فقط)
      if (isTablet && !collapsed) {
        setCollapsed(true);
      }
      // على الموبايل: إغلاق القائمة بالكامل
      if (isMobile && isOpen) {
        onToggle();
      }
    }, 100); // 100ms delay للانسيابية
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close sidebar on orientation change to prevent stuck overlay
  useEffect(() => {
    const handleOrientationChange = () => {
      // Close sidebar when orientation changes to prevent UI blocking
      if (isMobile && isOpen) {
        onToggle();
      }
    };

    // Support both old and new orientation APIs
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Also listen to resize as fallback for orientation detection
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      // Detect significant width change (likely rotation)
      if (Math.abs(currentWidth - lastWidth) > 100 && isMobile && isOpen) {
        onToggle();
      }
      lastWidth = currentWidth;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile, isOpen, onToggle]);

  // On mobile, always show full sidebar (not collapsed)
  const effectiveCollapsed = isMobile ? false : collapsed;

  // Filter nav items based on role - adminOnly items only visible to admin/boss
  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return isBoss || isAdmin;
    }
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    toast.success(t('auth.logoutSuccess'));
    navigate('/login');
  };

  // Get user display info
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onToggle}
        />
      )}

      <aside 
        className={cn(
          "fixed top-0 h-screen bg-sidebar z-50 transition-all duration-300 flex flex-col",
          // RTL: sidebar on right, LTR: sidebar on left
          isRTL ? "right-0 border-l border-sidebar-border" : "left-0 border-r border-sidebar-border",
          isMobile 
            ? cn("w-64", isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full")
            : cn(effectiveCollapsed ? "w-20" : "w-64")
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-3", effectiveCollapsed && !isMobile && "justify-center w-full")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center glow">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
          {(!effectiveCollapsed || isMobile) && (
              <div>
                <h1 className="font-bold text-lg text-foreground">FlowPOS Pro</h1>
                <p className="text-xs text-muted-foreground">{t('sidebar.systemDesc')}</p>
              </div>
            )}
          </div>
          
          {/* أزرار التحكم - المزامنة + الحالة + الجرس + زر الطي/الإغلاق */}
          <div className="flex items-center gap-1">
            {/* حالة طابور المزامنة */}
            <SyncQueueIndicator />
            
            {/* حالة الاتصال */}
            <NetworkStatusIndicator compact={effectiveCollapsed} />
            
            {/* جرس الإشعارات */}
            <NotificationBell compact={true} />
            
            {isMobile ? (
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors"
              >
                <X className="w-4 h-4 text-sidebar-foreground" />
              </button>
            ) : (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                  "w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors",
                  effectiveCollapsed && (isRTL ? "absolute -left-4 top-6" : "absolute -right-4 top-6"),
                  effectiveCollapsed && "bg-primary hover:bg-primary/90"
                )}
              >
                <ChevronRight className={cn(
                  "w-4 h-4 transition-transform duration-300",
                  // Flip arrow direction based on RTL and collapsed state
                  effectiveCollapsed 
                    ? isRTL ? "rotate-180 text-primary-foreground" : "text-primary-foreground"
                    : isRTL ? "text-sidebar-foreground" : "rotate-180 text-sidebar-foreground"
                )} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-lg glow" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      effectiveCollapsed && !isMobile && "justify-center px-0"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "animate-pulse")} />
                    {(!effectiveCollapsed || isMobile) && (
                      <>
                        <span className="font-medium">{t(item.translationKey)}</span>
                        {item.badge && (
                          <span className="mr-auto bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {effectiveCollapsed && !isMobile && (
                      <div className={cn(
                        "absolute px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50",
                        // Position tooltip on opposite side based on RTL
                        isRTL ? "right-full mr-2" : "left-full ml-2"
                      )}>
                        {t(item.translationKey)}
                      </div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className={cn(
          "p-3 border-t border-sidebar-border",
          effectiveCollapsed && !isMobile && "flex justify-center"
        )}>
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent",
            effectiveCollapsed && !isMobile && "p-2"
          )}>
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold">{userInitial}</span>
            </div>
            {(!effectiveCollapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-sidebar-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            )}
            {(!effectiveCollapsed || isMobile) && (
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-sidebar-border transition-colors text-muted-foreground hover:text-destructive"
                title={t('auth.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// Mobile menu trigger button component
export function MobileMenuTrigger({ onClick }: { onClick: () => void }) {
  // Get RTL state from document direction
  const isRTL = document.documentElement.dir === 'rtl';
  
  return (
    <button
      onClick={onClick}
      className={`fixed top-4 z-30 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow md:hidden ${
        isRTL ? 'right-4' : 'left-4'
      }`}
    >
      <Menu className="w-6 h-6" />
    </button>
  );
}
