import { Menu, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface POSHeaderProps {
  cartItemsCount: number;
  onMenuClick: () => void;
  onCartClick: () => void;
  showCartButton?: boolean;
}

export function POSHeader({ 
  cartItemsCount, 
  onMenuClick, 
  onCartClick, 
  showCartButton = true 
}: POSHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-4 sticky top-0 z-20">
      {/* Right side - Menu and Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base md:text-lg">نقطة البيع</h1>
      </div>

      {/* Left side - Cart button (mobile only) */}
      {showCartButton && (
        <Button
          variant="default"
          size="sm"
          onClick={onCartClick}
          className="md:hidden gap-2 relative"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>السلة</span>
          {cartItemsCount > 0 && (
            <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {cartItemsCount}
            </span>
          )}
        </Button>
      )}
    </header>
  );
}
