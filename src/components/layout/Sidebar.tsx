import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Wrench, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
  Menu,
  X,
  Palette,
  FileText,
  Receipt,
  Wallet,
  HelpCircle,
  Truck,
  Smartphone,
  ShoppingBasket,
  Pill,
  Shirt,
  UtensilsCrossed,
  BookOpen,
  CookingPot,
  Store
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
  dynamicKey?: string;
  path: string;
  badge?: number;
  adminOnly?: boolean;
  requiresMaintenance?: boolean;
  hideInNoInventory?: boolean;
  requiresBakeryMode?: boolean;
  requiresBookstore?: boolean;
  tourId?: string;
  tooltipKey?: TranslationKey;
}

const navItems: NavItem[] = [
  { icon: ShoppingCart, translationKey: 'nav.pos', path: '/', tourId: 'pos', tooltipKey: 'tooltip.pos' as TranslationKey },
  { icon: LayoutDashboard, translationKey: 'nav.dashboard', path: '/dashboard', adminOnly: true, tourId: 'dashboard', tooltipKey: 'tooltip.dashboard' as TranslationKey },
  { icon: FileText, translationKey: 'nav.invoices', path: '/invoices', tourId: 'invoices', tooltipKey: 'tooltip.invoices' as TranslationKey },
  { icon: Package, translationKey: 'nav.products', path: '/products', adminOnly: true, dynamicKey: 'products', tourId: 'products', tooltipKey: 'tooltip.products' as TranslationKey },
  { icon: Truck, translationKey: 'nav.purchases' as TranslationKey, path: '/purchases', adminOnly: true, tooltipKey: 'tooltip.purchases' as TranslationKey },
  { icon: Users, translationKey: 'nav.customersAndDebts' as TranslationKey, path: '/customers', tourId: 'customers', tooltipKey: 'tooltip.customers' as TranslationKey },
  { icon: BookOpen, translationKey: 'nav.library' as TranslationKey, path: '/library', requiresBookstore: true, tooltipKey: 'tooltip.library' as TranslationKey },
  { icon: Wrench, translationKey: 'nav.services', path: '/services', requiresMaintenance: true, tooltipKey: 'tooltip.services' as TranslationKey },
  { icon: Receipt, translationKey: 'nav.expenses', path: '/expenses', tourId: 'expenses', tooltipKey: 'tooltip.expenses' as TranslationKey },
  { icon: Wallet, translationKey: 'nav.cashShifts', path: '/cash-shifts', tooltipKey: 'tooltip.cashShifts' as TranslationKey },
  { icon: Package, translationKey: 'nav.warehouses', path: '/warehouses', adminOnly: true, hideInNoInventory: true, tooltipKey: 'tooltip.warehouses' as TranslationKey },
  { icon: Package, translationKey: 'nav.stockTransfer', path: '/stock-transfer', adminOnly: true, hideInNoInventory: true, tooltipKey: 'tooltip.stockTransfer' as TranslationKey },
  { icon: BarChart3, translationKey: 'nav.reports', path: '/reports', adminOnly: true, tourId: 'reports', tooltipKey: 'tooltip.reports' as TranslationKey },
  { icon: Palette, translationKey: 'settings.theme', path: '/appearance', tooltipKey: 'tooltip.appearance' as TranslationKey },
  { icon: HelpCircle, translationKey: 'nav.help', path: '/help', tooltipKey: 'tooltip.help' as TranslationKey },
  { icon: Settings, translationKey: 'nav.settings', path: '/settings', adminOnly: true, tourId: 'settings', tooltipKey: 'tooltip.settings' as TranslationKey },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  defaultCollapsed?: boolean;
}

const storeTypeIcons: Record<string, React.ElementType> = {
  phones: Smartphone,
  grocery: ShoppingBasket,
  pharmacy: Pill,
  clothing: Shirt,
  restaurant: UtensilsCrossed,
  repair: Wrench,
  bookstore: BookOpen,
  bakery: CookingPot,
  general: Store,
  custom: Store,
};

function StoreTypeBadge({ storeType, t }: { storeType: string; t: (key: any) => string }) {
  const Icon = storeTypeIcons[storeType] || Store;
  const label = t(`settings.storeTypes.${storeType}` as any) || storeType;
  return (
    <div className="flex items-center gap-1 mb-0.5">
      <Icon className="w-3 h-3 text-primary" />
      <span className="text-[10px] font-medium text-primary leading-tight truncate">{label}</span>
    </div>
  );
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

  // On mobile, close sidebar first then navigate after animation
  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (isMobile && isOpen) {
      e.preventDefault();
      onToggle(); // close sidebar (triggers animation)
      setTimeout(() => {
        navigate(path);
      }, 300); // match transition duration
    }
  };

  // Force collapsed on tablet and close mobile overlay when switching to tablet
  useEffect(() => {
    if (isTablet) {
      if (!collapsed) setCollapsed(true);
      // If sidebar was open in mobile mode and device switched to tablet, close overlay
      if (isOpen) onToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, location.pathname]);

  useEffect(() => {
    const handleOrientationChange = () => {
      if (isMobile && isOpen) onToggle();
    };
    window.addEventListener('orientationchange', handleOrientationChange);
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (Math.abs(currentWidth - lastWidth) > 100 && isMobile && isOpen) onToggle();
      lastWidth = currentWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile, isOpen, onToggle]);

  const effectiveCollapsed = isMobile ? false : collapsed;

  const visibleSections = getVisibleSections(storeType);
  const noInventory = isNoInventoryMode(storeType);
  const allowedPages = profile?.allowed_pages as string[] | null;

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !(isBoss || isAdmin)) {
      if (allowedPages && allowedPages.length > 0) {
        const pageKey = item.path.replace('/', '') || 'pos';
        if (allowedPages.includes(pageKey)) return true;
      }
      return false;
    }
    if (item.requiresMaintenance && !visibleSections.maintenance) return false;
    if (item.hideInNoInventory && noInventory) return false;
    if (item.requiresBakeryMode && !noInventory) return false;
    if (item.requiresBookstore && storeType !== 'bookstore') return false;
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    toast.success(t('auth.logoutSuccess'));
    navigate('/login');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile overlay backdrop - ONLY on true mobile, never tablet */}
      {isMobile && !isTablet && (
        <div 
          className={cn(
            "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onToggle}
        />
      )}

      <aside 
        data-tour="sidebar"
        className={cn(
          "fixed top-0 h-screen z-50 transition-all duration-300 ease-in-out flex flex-col",
          "bg-sidebar border-sidebar-border pt-[env(safe-area-inset-top)]",
          isRTL ? "right-0 border-l" : "left-0 border-r",
          isMobile 
            ? cn("w-64", isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full")
            : cn(effectiveCollapsed ? "w-[72px]" : "w-56")
        )}
      >
        {/* Brand Header */}
        <div className={cn(
          "flex-shrink-0 border-b border-sidebar-border",
          effectiveCollapsed && !isMobile ? "px-2 py-3" : "px-4 py-3"
        )}>
          {effectiveCollapsed && !isMobile ? (
            /* Collapsed: icon only */
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <SyncStatusMenu />
                <NotificationBell compact={true} />
              </div>
            </div>
          ) : (
            /* Expanded */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
                    <Zap className="w-4.5 h-4.5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <StoreTypeBadge storeType={storeType} t={t} />
                    <h1 className="font-bold text-sm text-foreground leading-tight tracking-tight">FlowPOS Pro</h1>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <SyncStatusMenu />
                  <NotificationBell compact={true} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle - desktop only */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "absolute top-16 z-10 w-6 h-6 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center",
              "hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 shadow-sm",
              "text-muted-foreground",
              isRTL ? "-left-3" : "-right-3"
            )}
          >
            {effectiveCollapsed 
              ? (isRTL ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />)
              : (isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
            }
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
          <ul className="space-y-0.5">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <NavLink
                    {...(item.tourId ? { 'data-tour': item.tourId } : {})}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg transition-all duration-200 group relative",
                      effectiveCollapsed && !isMobile ? "justify-center p-2.5 mx-auto" : "px-3 py-2.5",
                      isActive 
                        ? "bg-primary/10 text-primary font-semibold" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary transition-all",
                        isRTL ? "-right-0.5" : "-left-0.5"
                      )} />
                    )}
                    
                    <item.icon className={cn(
                      "w-[18px] h-[18px] flex-shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                    )} />
                    
                    {(!effectiveCollapsed || isMobile) && (
                      <>
                        <span className="text-sm truncate">{item.dynamicKey ? tDynamic(item.dynamicKey as any) : t(item.translationKey)}</span>
                        {item.badge && (
                          <span className="mr-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}

                    {/* Collapsed tooltip with enhanced description */}
                    {effectiveCollapsed && !isMobile && (
                      <div className={cn(
                        "absolute px-3 py-2 bg-popover text-popover-foreground rounded-xl shadow-lg z-50",
                        "opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200",
                        "border border-border min-w-[180px] max-w-[240px]",
                        isRTL ? "right-full mr-2" : "left-full ml-2"
                      )}>
                        <p className="text-xs font-semibold text-foreground">{t(item.translationKey)}</p>
                        {item.tooltipKey && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t(item.tooltipKey)}</p>
                        )}
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
          "flex-shrink-0 border-t border-sidebar-border p-2",
          effectiveCollapsed && !isMobile && "flex flex-col items-center"
        )}>
          {effectiveCollapsed && !isMobile ? (
            /* Collapsed user */
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">{userInitial}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                title={t('auth.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Expanded user */
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-sidebar-accent/50">
              <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-xs">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[13px] truncate text-sidebar-foreground">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{displayEmail}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive flex-shrink-0"
                title={t('auth.logout')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// Mobile menu trigger button - unified across all pages
export function MobileMenuTrigger({ onClick }: { onClick: () => void }) {
  const isRTL = document.documentElement.dir === 'rtl';
  
  return (
    <button
      data-tour="mobile-menu-trigger"
      onClick={onClick}
      className={cn(
        "fixed top-[calc(0.75rem+env(safe-area-inset-top))] z-30 md:hidden",
        "w-9 h-9 rounded-xl bg-card/90 backdrop-blur-md border border-border",
        "text-foreground flex items-center justify-center shadow-sm",
        "hover:bg-card active:scale-95 transition-all duration-200",
        isRTL ? 'right-3' : 'left-3'
      )}
    >
      <Menu className="w-4 h-4" />
    </button>
  );
}
