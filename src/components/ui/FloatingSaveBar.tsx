import { Save, Undo2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useScrollDirectionVisibility, useSidebarOpenState } from '@/hooks/use-scroll-visibility';
import { floatingSideClass, floatingBottomClass } from '@/components/ui/SmartFab';

interface FloatingSaveBarProps {
  visible: boolean;
  saving?: boolean;
  success?: boolean;
  onSave: () => void;
  onRevert: () => void;
}

/** زرّا حفظ وتراجع عائمان موحدان (المظهر والخطوط) */
export function FloatingSaveBar({ visible, saving, success, onSave, onRevert }: FloatingSaveBarProps) {
  const { isRTL, t } = useLanguage();
  const scrollVisible = useScrollDirectionVisibility();
  const sidebarOpen = useSidebarOpenState();
  const show = visible && scrollVisible && !sidebarOpen;

  return (
    <div
      className={cn(
        'fixed z-30 flex items-center gap-3 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
        floatingSideClass(isRTL),
        floatingBottomClass,
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[calc(100%+2rem)] pointer-events-none'
      )}
    >
      <Button
        onClick={onSave}
        disabled={saving}
        title={t('common.save') || (isRTL ? 'حفظ' : 'Save')}
        aria-label={t('common.save') || (isRTL ? 'حفظ' : 'Save')}
        className="size-14 rounded-full p-0 bg-primary text-primary-foreground shadow-2xl hover:scale-105 active:scale-95 transition-transform"
      >
        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : success ? <Check className="w-6 h-6 stroke-[3]" /> : <Save className="w-6 h-6" />}
      </Button>
      {!success && (
        <Button
          variant="secondary"
          onClick={onRevert}
          disabled={saving}
          title={t('common.cancel') || (isRTL ? 'تراجع' : 'Cancel')}
          aria-label={t('common.cancel') || (isRTL ? 'تراجع' : 'Cancel')}
          className="size-14 rounded-full p-0 shadow-2xl hover:scale-105 active:scale-95 transition-transform"
        >
          <Undo2 className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}
