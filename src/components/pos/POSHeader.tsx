import { Menu, ShoppingCart, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

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
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success(t('auth.logoutSuccess'));
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(t('common.error'));
    }
  };

  return (
    <header className="h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-4 sticky top-0 z-20">
      {/* Right side - Menu and Title */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base md:text-lg">{t('pos.title')}</h1>
      </div>

      {/* Left side - Actions */}
      <div className="flex items-center gap-2">
        {/* Keyboard shortcuts help - Desktop only */}
        {!isMobile && <KeyboardShortcutsHelp />}
        
        {/* Logout button (mobile only) - Always visible */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
            title={t('auth.logout')}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        )}
        
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
              <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
                {cartItemsCount}
              </span>
            )}
          </Button>
        )}
      </div>
    </header>
  );
}