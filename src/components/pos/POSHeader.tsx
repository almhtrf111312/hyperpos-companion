import { ShoppingCart, Wrench, Store, Menu } from 'lucide-react';
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
  onMenuClick?: () => void; // إضافة زر المنيو المدمج
}

export function POSHeader({ 
  cartItemsCount, 
  onCartClick, 
  showCartButton = true,
  activeMode = 'products',
  onModeChange,
  hideMaintenance = false,
  onMenuClick
}: POSHeaderProps) {
  const isMobile = useIsMobile();
  const { t, tDynamic } = useLanguage();

  return (
    <header className="h-14 md:h-20 flex items-center justify-between px-3 md:px-6 sticky top-0 z-20 pt-[env(safe-area-inset-top)] shrink-0 bg-background/95 shadow-xs border-b border-border/40 transition-[transform,opacity] duration-300">
      {/* جهة اليمين (RTL): زر القائمة المدمج + عنوان نقطة البيع */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        {/* زر فتح القائمة الجانبية المدمج للموبايل بدلاً من الزر العائم */}
        {isMobile && onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="القائمة الرئيسية"
            className="w-9 h-9 rounded-xl bg-muted/60 dark:bg-zinc-900/80 border border-border/40 text-foreground flex items-center justify-center shrink-0 hover:bg-muted active:scale-95 transition-opacity cursor-pointer"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        )}

        {/* كبسولة العنوان */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 md:px-3.5 md:py-1.5 rounded-xl md:rounded-full bg-muted/60 dark:bg-zinc-900/80 border border-border/40 shrink-0">
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Store className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </div>
          <h1 className="text-xs md:text-base font-bold text-foreground whitespace-nowrap truncate tracking-tight" title={t('pos.title')}>
            {t('pos.title')}
          </h1>
        </div>


      </div>

      {/* جهة اليسار (RTL): التحكم المدمج للموبايل + اختصارات الديسكتوب */}
      <div className="flex items-center gap-2 shrink-0">


        {/* زر اختصارات الكيبورد على الديسكتوب */}
        {!isMobile && <KeyboardShortcutsHelp />}
        
        {/* زر السلة على الموبايل إذا كان مطلوباً */}
        {showCartButton && (
          <Button
            variant="default"
            size="sm"
            onClick={onCartClick}
            className="md:hidden gap-1.5 h-9 px-3 rounded-xl relative cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="text-xs">{t('pos.cart')}</span>
            {cartItemsCount > 0 && (
              <span className="absolute -top-1.5 ltr:-left-1.5 rtl:-right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {cartItemsCount}
              </span>
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
