import { ShoppingCart, Wrench, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

interface POSHeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  showCartButton?: boolean;
  activeMode?: 'products' | 'maintenance';
  onModeChange?: (mode: 'products' | 'maintenance') => void;
  hideMaintenance?: boolean;
}

export function POSHeader({ 
  cartItemsCount, 
  onCartClick, 
  showCartButton = true,
  activeMode = 'products',
  onModeChange,
  hideMaintenance = false
}: POSHeaderProps) {
  const isMobile = useIsMobile();
  const { t, tDynamic } = useLanguage();

  return (
    <header className="h-16 md:h-20 flex items-center justify-between pe-3 ps-14 md:px-6 sticky top-0 z-20 pt-[env(safe-area-inset-top)] shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-3xl shadow-[0_4px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgb(0,0,0,0.3)] transition-all duration-300 border-b border-black/5 dark:border-white/5">
      {/* Right side - Title Capsule and Desktop Mode Switcher */}
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-2xl md:rounded-full bg-muted/70 dark:bg-zinc-900/80 border border-border/40 shadow-xs backdrop-blur-3xl shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <h1 className="text-sm md:text-base font-bold text-foreground whitespace-nowrap truncate tracking-tight">
            {t('pos.title')}
          </h1>
        </div>

        {/* Desktop Fixed Mode Toggle */}
        {!isMobile && !hideMaintenance && onModeChange && (
          <div className="flex items-center p-1 rounded-full bg-slate-100/80 dark:bg-zinc-900/80 border border-black/5 dark:border-white/5 shadow-inner backdrop-blur-3xl">
            <button
              type="button"
              onClick={() => onModeChange('products')}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 select-none",
                  activeMode === 'products'
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-[0_4px_12px_rgb(0,0,0,0.08)] dark:shadow-[0_4px_12px_rgb(0,0,0,0.4)] scale-105"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{tDynamic('products')}</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('maintenance')}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 select-none",
                  activeMode === 'maintenance'
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-[0_4px_12px_rgb(0,0,0,0.08)] dark:shadow-[0_4px_12px_rgb(0,0,0,0.4)] scale-105"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{t('pos.maintenance')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Left side - Actions */}
      <div className="flex items-center gap-2">
        {/* Keyboard shortcuts help - Desktop only */}
        {!isMobile && <KeyboardShortcutsHelp />}
        
        {/* Cart button (mobile only) */}
        {showCartButton && (
          <Button
            variant="default"
            size="sm"
            onClick={onCartClick}
            className="md:hidden gap-2 relative"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{t('pos.cart')}</span>
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 ltr:-left-1 rtl:-right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
                {cartItemsCount}
              </span>
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
