import { Save, Undo2, Loader2, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useSidebarOpenState } from '@/hooks/use-scroll-visibility';
import { floatingSideClass, floatingBottomClass } from '@/components/ui/SmartFab';

interface FloatingSaveBarProps {
  visible: boolean;
  saving?: boolean;
  success?: boolean;
  onSave: () => void;
  onRevert: () => void;
}

/** أزرار الحفظ والتراجع العائمة، وتظهر عند وجود تغييرات غير محفوظة. */
export function FloatingSaveBar({ visible, saving, success, onSave, onRevert }: FloatingSaveBarProps) {
  const { isRTL, t } = useLanguage();
  const sidebarOpen = useSidebarOpenState();
  const show = visible && !sidebarOpen;
  const saveLabel = t('common.save') || (isRTL ? 'حفظ' : 'Save');
  const revertLabel = t('common.cancel') || (isRTL ? 'تراجع' : 'Revert');

  return createPortal(
    <div
      className={cn(
        'fixed z-[60] flex items-center gap-3',
        'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
        floatingSideClass(isRTL),
        floatingBottomClass,
        show
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label={isRTL ? 'إجراءات المظهر' : 'Appearance actions'}
    >
      <Button
        type="button"
        onClick={onSave}
        disabled={saving}
        title={saveLabel}
        aria-label={saveLabel}
        className="size-14 rounded-full p-0 bg-primary text-primary-foreground shadow-2xl hover:scale-105 active:scale-95 transition-transform"
      >
        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : success ? <Check className="w-6 h-6 stroke-[3]" /> : <Save className="w-6 h-6" />}
      </Button>
      {!success && (
        <Button
          type="button"
          variant="secondary"
          onClick={onRevert}
          disabled={saving}
          title={revertLabel}
          aria-label={revertLabel}
          className="size-14 rounded-full p-0 shadow-2xl hover:scale-105 active:scale-95 transition-transform"
        >
          <Undo2 className="w-6 h-6" />
        </Button>
      )}
    </div>,
    document.body
  );
}
