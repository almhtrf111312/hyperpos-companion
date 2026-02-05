import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    BarChart3,
    User,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';

export function BottomNav() {
    const { t } = useLanguage();
    const { isBoss, isAdmin } = useUserRole();

    const navItems = [
        { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/dashboard', show: isBoss || isAdmin },
        { icon: ShoppingCart, label: t('nav.pos'), path: '/pos', show: true },
        { icon: BarChart3, label: t('nav.reports'), path: '/reports', show: isBoss || isAdmin },
        { icon: User, label: t('nav.customers'), path: '/customers', show: true },
        { icon: Settings, label: t('nav.settings'), path: '/settings', show: isBoss || isAdmin },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 glass-card rounded-b-none border-b-0 border-x-0 z-50 flex items-center justify-around px-2 pb-2">
            {navItems.filter(item => item.show).map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => cn(
                        "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300",
                        isActive
                            ? "text-primary -translate-y-2"
                            : "text-muted-foreground hover:text-white"
                    )}
                >
                    <div className={cn(
                        "p-2 rounded-full transition-all duration-300",
                        // Active glow effect
                        // isActive && "bg-primary/20 shadow-[0_0_15px_rgba(102,126,234,0.5)]"
                    )}>
                        <item.icon className="w-6 h-6" />
                    </div>
                    {/* Label (optional, maybe hide on very small screens if crowded) */}
                    {/* <span className="text-[10px] font-medium">{item.label}</span> */}
                </NavLink>
            ))}

            {/* Floating Action Button for POS (Center) - Optional override if users prefer FAB style for POS */}
            {/* For now, sticking to standard 5 icons bar as requested */}
        </div>
    );
}
