import { ShoppingCart, Wrench } from 'lucide-react';
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
    <header className="h-16 md:h-20 border-b border-border/70 flex items-center justify-between px-3 md:px-4 sticky top-0 z-20 pt-[env(safe-area-inset-top)] rtl:pr-16 ltr:pl-16 md:rtl:pr-4 md:ltr:pl-4 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur-md shadow-sm">
      {/* Right side - Title and Desktop Mode Switcher */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{t('pos.title')}</h1>

        {/* Desktop Fixed Mode Toggle */}
        {!isMobile && !hideMaintenance && onModeChange && (
          <div className="flex items-center p-1 rounded-xl bg-muted/80 border border-border shadow-sm">
            <button
              type="button"
              onClick={() => onModeChange('products')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none",
                activeMode === 'products'
                  ? "bg-gradient-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{tDynamic('products')}</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('maintenance')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none",
                activeMode === 'maintenance'
                  ? "bg-gradient-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
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