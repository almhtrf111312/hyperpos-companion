import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'لوحة التحكم', path: '/' },
  { icon: ShoppingCart, label: 'نقطة البيع', path: '/pos' },
  { icon: Package, label: 'المنتجات', path: '/products' },
  { icon: Users, label: 'العملاء', path: '/customers' },
  { icon: CreditCard, label: 'الديون', path: '/debts' },
  { icon: Wrench, label: 'الصيانة', path: '/services' },
  { icon: UserCheck, label: 'الشركاء', path: '/partners' },
  { icon: BarChart3, label: 'التقارير', path: '/reports' },
  { icon: Settings, label: 'الإعدادات', path: '/settings' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside 
      className={cn(
        "fixed top-0 right-0 h-screen bg-sidebar border-l border-sidebar-border z-50 transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center glow">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg text-foreground">HyperPOS</h1>
              <p className="text-xs text-muted-foreground">نظام إدارة متكامل</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors",
            collapsed && "absolute -left-4 top-6 bg-primary hover:bg-primary/90"
          )}
        >
          <ChevronRight className={cn(
            "w-4 h-4 transition-transform duration-300",
            collapsed ? "rotate-180 text-primary-foreground" : "text-sidebar-foreground"
          )} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
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
                    collapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "animate-pulse")} />
                  {!collapsed && (
                    <>
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="mr-auto bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && (
                    <div className="absolute right-full mr-2 px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.label}
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
        collapsed && "flex justify-center"
      )}>
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent",
          collapsed && "p-2"
        )}>
          <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-bold">م</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate text-sidebar-foreground">المشرف</p>
              <p className="text-xs text-muted-foreground truncate">admin@hyperpos.com</p>
            </div>
          )}
          {!collapsed && (
            <button className="p-2 rounded-lg hover:bg-sidebar-border transition-colors text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
