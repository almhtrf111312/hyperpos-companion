import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/hooks/use-language';

interface POSHeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  showCartButton?: boolean;
}

export function POSHeader({ 
  cartItemsCount, 
  onCartClick, 
  showCartButton = true 
}: POSHeaderProps) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  return (
    <header className="h-16 md:h-20 border-b border-border/70 flex items-center justify-between px-3 md:px-4 sticky top-0 z-20 pt-[env(safe-area-inset-top)] rtl:pr-16 ltr:pl-16 md:rtl:pr-4 md:ltr:pl-4 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur-md shadow-sm">
      {/* Right side - Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('pos.title')}</h1>
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