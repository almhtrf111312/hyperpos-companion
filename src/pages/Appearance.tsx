import { useState } from 'react';
import { Save, Undo2, Loader2 } from 'lucide-react';
import { ThemeSection, PendingTheme } from '@/components/settings/ThemeSection';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Appearance() {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const { setFullTheme } = useTheme();

  const [pendingTheme, setPendingTheme] = useState<PendingTheme | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (!pendingTheme) return;
    setIsSaving(true);
    setFullTheme(pendingTheme.mode, pendingTheme.color, pendingTheme.blur, pendingTheme.transparency);
    setHasChanges(false);
    setPendingTheme(null);
    setIsSaving(false);
    toast({
      title: t('common.saved'),
      description: isRTL ? 'تم حفظ إعدادات المظهر' : 'Appearance settings saved',
    });
  };

  const handleRevert = () => {
    setResetSignal(prev => prev + 1);
    setHasChanges(false);
    setPendingTheme(null);
    toast({
      title: t('common.success'),
      description: isRTL ? 'تم التراجع عن التغييرات' : 'Changes reverted',
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24">
      <ThemeSection
        onPendingChange={(pending, changed) => {
          setPendingTheme(pending);
          setHasChanges(changed);
        }}
        resetSignal={resetSignal}
      />

      {/* Floating Action Buttons (FAB) */}
      <div
        className={cn(
          "fixed bottom-6 z-50 flex items-center gap-3 transition-all duration-300 ease-in-out",
          isRTL ? "left-6" : "right-6",
          hasChanges
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-14 h-14 rounded-full shadow-lg p-0"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Save className="w-6 h-6" />
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={handleRevert}
          className="w-14 h-14 rounded-full shadow-lg p-0"
        >
          <Undo2 className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
