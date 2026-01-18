import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

interface NavItem {
  icon: React.ElementType;
  label: string;
  translationKey: string;
  path: string;
  badge?: number;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: ShoppingCart, label: 'نقطة البيع', translationKey: 'nav.pos', path: '/' },
  { icon: LayoutDashboard, label: 'لوحة التحكم', translationKey: 'nav.dashboard', path: '/dashboard' },
  { icon: FileText, label: 'الفواتير', translationKey: 'nav.invoices', path: '/invoices' },
  { icon: Package, label: 'المنتجات', translationKey: 'nav.products', path: '/products' },
  { icon: Users, label: 'العملاء', translationKey: 'nav.customers', path: '/customers' },
  { icon: CreditCard, label: 'الديون', translationKey: 'nav.debts', path: '/debts' },
  { icon: Wrench, label: 'الصيانة', translationKey: 'nav.services', path: '/services' },
  { icon: UserCheck, label: 'الشركاء', translationKey: 'nav.partners', path: '/partners' },
  { icon: Receipt, label: 'المصاريف', translationKey: 'nav.expenses', path: '/expenses' },
  { icon: Wallet, label: 'الصندوق', translationKey: 'nav.cashbox', path: '/cashbox' },
  { icon: BarChart3, label: 'التقارير', translationKey: 'nav.reports', path: '/reports' },
  { icon: Settings, label: 'الإعدادات', translationKey: 'nav.settings', path: '/settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, profile, signOut } = useAuth();
  const { t, isRTL } = useLanguage();

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile && isOpen) {
      onToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isMobile]);

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

  // All nav items are accessible now (no role filtering)
  const filteredNavItems = navItems;

  const handleLogout = async () => {
    await signOut();
    toast.success(t('auth.logoutSuccess'));
    navigate('/login');
  };

  // Get user display info
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'مستخدم';
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
                <h1 className="font-bold text-lg text-foreground">HyperPOS</h1>
                <p className="text-xs text-muted-foreground">نظام إدارة متكامل</p>
              </div>
            )}
          </div>
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
                        <span className="font-medium">{t(item.translationKey as any)}</span>
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
                        {t(item.translationKey as any)}
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
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-30 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow md:hidden"
    >
      <Menu className="w-6 h-6" />
    </button>
  );
}