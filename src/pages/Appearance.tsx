import { useState, Component, ReactNode } from 'react';
import { Save, Undo2, Loader2, AlertTriangle, SlidersHorizontal, Sparkles } from 'lucide-react';
import { ThemeSection, PendingTheme } from '@/components/settings/ThemeSection';
import { UIScaleSelector } from '@/components/settings/UIScaleSelector';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FontSelector } from '@/components/settings/FontSelector';
import {
  UIScaleId,
  setStoredUIScale,
  getStoredUIScale,
  applyUIScaleToDOM,
} from '@/lib/ui-scale-config';
import { saveStoreSettings } from '@/lib/supabase-store';

// Error Boundary to catch ThemeSection render crashes
class ThemeErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('[ThemeErrorBoundary] Render error:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const DASHBOARD_DESIGN_KEY = 'hyperpos_dashboard_design_v1';

export default function Appearance() {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const { setFullTheme } = useTheme();

  const [pendingTheme, setPendingTheme] = useState<PendingTheme | null>(null);
  const [pendingScale, setPendingScale] = useState<UIScaleId | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [dashboardDesign, setDashboardDesign] = useState<'classic' | 'unified_pro'>(() => {
    return (localStorage.getItem(DASHBOARD_DESIGN_KEY) as 'classic' | 'unified_pro') || 'classic';
  });

  const handleDesignChange = (design: 'classic' | 'unified_pro') => {
    setDashboardDesign(design);
    localStorage.setItem(DASHBOARD_DESIGN_KEY, design);
    window.dispatchEvent(new Event('hyperpos:design-changed'));
    toast({
      title: t('common.saved'),
      description: isRTL ? 'تم تغيير نمط التصميم بنجاح' : 'Design layout updated successfully',
    });
  };


  const hasChanges = Boolean(pendingTheme || pendingScale);

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);

    try {
      if (pendingTheme) {
        setFullTheme(
          pendingTheme.mode,
          pendingTheme.color,
          pendingTheme.blur,
          pendingTheme.transparency
        );
      }

      if (pendingScale) {
        setStoredUIScale(pendingScale);
        try {
          await saveStoreSettings({
            sync_settings: { uiScale: pendingScale },
          });
        } catch (e) {
          console.warn('Failed to sync uiScale to store cloud settings:', e);
        }
      }

      setPendingTheme(null);
      setPendingScale(null);
      toast({
        title: t('common.saved'),
        description: isRTL
          ? 'تم حفظ إعدادات المظهر ومقياس الواجهة بنجاح'
          : 'Appearance & UI scale settings saved successfully',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    // Revert pending scale on DOM
    applyUIScaleToDOM(getStoredUIScale());
    setResetSignal((prev) => prev + 1);
    setPendingTheme(null);
    setPendingScale(null);
    toast({
      title: t('common.success'),
      description: isRTL ? 'تم التراجع عن التغييرات' : 'Changes reverted',
    });
  };

  const errorFallback = (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-destructive" />
      <h3 className="text-lg font-semibold text-foreground">
        {isRTL ? 'حدث خطأ في تحميل إعدادات المظهر' : 'Failed to load theme settings'}
      </h3>
      <Button variant="outline" onClick={() => window.location.reload()}>
        {isRTL ? 'إعادة تحميل' : 'Reload'}
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24 pt-14 md:pt-4">
      <ThemeErrorBoundary fallback={errorFallback}>
        <ThemeSection
          onPendingChange={(pending, changed) => {
            setPendingTheme(changed ? pending : null);
          }}
          resetSignal={resetSignal}
        />
      </ThemeErrorBoundary>

      {/* Embedded UI & Text Scale Selector */}
      <div className="mt-6">
        <UIScaleSelector
          onPendingChange={(scale, changed) => {
            setPendingScale(changed ? scale : null);
          }}
          resetSignal={resetSignal}
          onSaved={() => {
            setPendingScale(null);
          }}
        />
      </div>

      {/* Embedded App Fonts Selector */}
      <div className="mt-6">
        <FontSelector />
      </div>

      {/* خيار نمط التصميم (مضاف هنا) */}
      <div className="mt-6 rounded-2xl bg-card border border-border/70 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isRTL ? 'نمط تصميم لوحة التحكم والتقارير' : 'Dashboard & Reports Layout'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'اختر بين التصميم الافتراضي أو التصميم الموحد الحديث' : 'Choose layout mode'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => handleDesignChange('classic')}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border text-right transition-all",
              dashboardDesign === 'classic'
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border hover:bg-muted/40"
            )}
          >
            <span className="font-semibold text-sm text-foreground">
              {isRTL ? 'التصميم الافتراضي (Classic)' : 'Classic Layout'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'اللوحة التقليدية القديمة' : 'Standard cards layout'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleDesignChange('unified_pro')}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border text-right transition-all",
              dashboardDesign === 'unified_pro'
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border hover:bg-muted/40"
            )}
          >
            <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              {isRTL ? 'التصميم الجديد (الموحد Pro)' : 'Unified Pro'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'تصميم الرسوم البيانية الموحد بدون أزرار سريعة' : 'Analytics & charts layout'}
            </span>
          </button>
        </div>
      </div>

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
          className="w-14 h-14 rounded-full shadow-2xl p-0 bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-transform"
          title={t('common.save')}
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
          className="w-14 h-14 rounded-full shadow-2xl p-0 hover:scale-105 active:scale-95 transition-transform"
          title={t('common.cancel')}
        >
          <Undo2 className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
