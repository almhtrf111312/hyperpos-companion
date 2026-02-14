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
  
  User,
  Palette,
  FileText,
  Receipt,
  Wallet,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';
import { toast } from 'sonner';
import { TranslationKey } from '@/lib/i18n';
import { NotificationBell } from './NotificationBell';
import { SyncStatusMenu } from './SyncStatusMenu';
import { getVisibleSections, isNoInventoryMode } from '@/lib/store-type-config';

interface NavItem {
  icon: React.ElementType;
  translationKey: TranslationKey;
  dynamicKey?: string; // If set, use tDynamic instead of t
  path: string;
  badge?: number;
  adminOnly?: boolean;
  requiresMaintenance?: boolean; // Only show if maintenance is visible for store type
  hideInNoInventory?: boolean; // Hide when store operates without inventory (e.g., bakery)
}

const navItems: NavItem[] = [
  { icon: ShoppingCart, translationKey: 'nav.pos', path: '/' },
  { icon: LayoutDashboard, translationKey: 'nav.dashboard', path: '/dashboard', adminOnly: true },
  { icon: FileText, translationKey: 'nav.invoices', path: '/invoices' },
  { icon: Package, translationKey: 'nav.products', path: '/products', adminOnly: true, dynamicKey: 'products' },
  { icon: Users, translationKey: 'nav.customers', path: '/customers' },
  { icon: CreditCard, translationKey: 'nav.debts', path: '/debts' },
  { icon: Wrench, translationKey: 'nav.services', path: '/services', requiresMaintenance: true },
  { icon: UserCheck, translationKey: 'nav.partners', path: '/partners', adminOnly: true },
  { icon: Receipt, translationKey: 'nav.expenses', path: '/expenses' },
  { icon: Wallet, translationKey: 'nav.cashShifts', path: '/cash-shifts' },
  { icon: Package, translationKey: 'nav.warehouses', path: '/warehouses', adminOnly: true, hideInNoInventory: true },
  { icon: Package, translationKey: 'nav.stockTransfer', path: '/stock-transfer', adminOnly: true, hideInNoInventory: true },
  { icon: BarChart3, translationKey: 'nav.reports', path: '/reports', adminOnly: true },
  { icon: Palette, translationKey: 'settings.theme', path: '/appearance' },
  { icon: HelpCircle, translationKey: 'nav.help', path: '/help' },
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
  const { t, tDynamic, storeType, isRTL } = useLanguage();
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
    }, 250); // 250ms delay for smooth transition
    
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

  const visibleSections = getVisibleSections(storeType);
  const noInventory = isNoInventoryMode(storeType);
  
  // Get allowed pages for cashier users
  const allowedPages = profile?.allowed_pages as string[] | null;
  
  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !(isBoss || isAdmin)) {
      // If cashier has explicit permission for this page, show it
      if (allowedPages && allowedPages.length > 0) {
        const pageKey = item.path.replace('/', '') || 'pos';
        if (allowedPages.includes(pageKey)) return true;
      }
      return false;
    }
    if (item.requiresMaintenance && !visibleSections.maintenance) return false;
    if (item.hideInNoInventory && noInventory) return false;
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
          "fixed top-0 h-screen bg-sidebar z-50 transition-all duration-300 flex flex-col pt-[env(safe-area-inset-top)]",
          // RTL: sidebar on right, LTR: sidebar on left
          isRTL ? "right-0 border-l border-sidebar-border" : "left-0 border-r border-sidebar-border",
          isMobile 
            ? cn("w-52", isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full")
            : cn(effectiveCollapsed ? "w-20" : "w-52")
        )}
      >
        {/* Logo */}
        <div className={cn(
          "border-b border-sidebar-border px-3 py-2",
          isMobile ? "flex flex-col gap-1" : "min-h-16 flex items-center justify-between px-4"
        )}>
          {isMobile ? (
            <>
              {/* Mobile: Row 1 - Logo + Title + Icons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center glow flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h1 className="font-bold text-base text-foreground whitespace-nowrap">FlowPOS Pro</h1>
                </div>
                <div className="flex items-center gap-1">
                  <SyncStatusMenu />
                  <NotificationBell compact={true} />
                </div>
              </div>
              {/* Mobile: Row 2 - Description */}
              <p className="text-xs text-muted-foreground px-1">{t('sidebar.systemDesc')}</p>
            </>
          ) : (
            <>
              <div className={cn("flex items-center gap-3", effectiveCollapsed && "justify-center w-full")}>
                <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center glow">
                  <Zap className="w-6 h-6 text-primary-foreground" />
                </div>
                {!effectiveCollapsed && (
                  <div>
                    <h1 className="font-bold text-lg text-foreground">FlowPOS Pro</h1>
                    <p className="text-xs text-muted-foreground">{t('sidebar.systemDesc')}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <SyncStatusMenu />
                <NotificationBell compact={true} />
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
                    effectiveCollapsed 
                      ? isRTL ? "rotate-180 text-primary-foreground" : "text-primary-foreground"
                      : isRTL ? "text-sidebar-foreground" : "rotate-180 text-sidebar-foreground"
                  )} />
                </button>
              </div>
            </>
          )}
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
                        <span className="font-medium">{item.dynamicKey ? tDynamic(item.dynamicKey as any) : t(item.translationKey)}</span>
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
      className={`fixed top-[calc(0.75rem+env(safe-area-inset-top))] z-30 w-9 h-9 rounded-lg bg-primary/80 backdrop-blur-sm text-primary-foreground flex items-center justify-center shadow-md md:hidden ${
        isRTL ? 'right-3' : 'left-3'
      }`}
    >
      <Menu className="w-4.5 h-4.5" />
    </button>
  );
}
