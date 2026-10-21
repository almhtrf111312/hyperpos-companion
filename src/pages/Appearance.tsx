import { useState, useEffect, useRef } from 'react';
import { Type, Maximize2, LayoutGrid, Save, Undo2, Loader2, Sparkles } from 'lucide-react';
import { ThemeSection, PendingTheme } from '@/components/settings/ThemeSection';
import { UIScaleSelector } from '@/components/settings/UIScaleSelector';
import { FontSelector } from '@/components/settings/FontSelector';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { useAppFont } from '@/hooks/use-app-font';
import { useUIScale } from '@/hooks/use-ui-scale';
import { toast } from '@/hooks/use-toast';
import { showSmartToast } from '@/hooks/use-smart-toast';
import { getPlatformStoragePrefix, applyAppFontToDOM, AppFontId } from '@/lib/app-font-config';
import { applyUIScaleToDOM, UIScaleId } from '@/lib/ui-scale-config';
import { saveUnifiedStoreSettings } from '@/lib/store-settings-sync';

export type AppearanceTab = 'theme' | 'fonts' | 'scale' | 'layout';

export default function Appearance() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<AppearanceTab>('fonts');
  const { mode, color, blurEnabled, transparencyLevel, setFullTheme, previewTheme, revertTheme } = useTheme();
  const { currentFont, setFont } = useAppFont();
  const { currentScale, setScale } = useUIScale();

  // Baseline stored settings captured upon entering Appearance
  const savedThemeRef = useRef({ mode, color, blur: blurEnabled, transparency: transparencyLevel });
  const savedFontRef = useRef<AppFontId>(currentFont);
  const savedScaleRef = useRef<UIScaleId>(currentScale);

  // Draft states for live preview without immediate storage commit
  const [draftTheme, setDraftTheme] = useState<PendingTheme | null>(null);
  const [draftFont, setDraftFont] = useState<AppFontId>(currentFont);
  const [draftScale, setDraftScale] = useState<UIScaleId>(currentScale);

  const [resetSignal, setResetSignal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Check whether any draft differs from the saved baseline
  const hasThemeChanged = draftTheme !== null && (
    draftTheme.mode !== savedThemeRef.current.mode ||
    draftTheme.color !== savedThemeRef.current.color ||
    draftTheme.blur !== savedThemeRef.current.blur ||
    draftTheme.transparency !== savedThemeRef.current.transparency
  );
  const hasFontChanged = draftFont !== savedFontRef.current;
  const hasScaleChanged = draftScale !== savedScaleRef.current;

  const hasUnsavedChanges = hasThemeChanged || hasFontChanged || hasScaleChanged;

  const getLayoutStorageKey = () => `flowpos_layout_${getPlatformStoragePrefix()}`;

  const [dashboardDesign, setDashboardDesign] = useState<'classic' | 'unified_pro'>(() => {
    const platformKey = `flowpos_layout_${getPlatformStoragePrefix()}`;
    return (localStorage.getItem(platformKey) as any) || (localStorage.getItem('hyperpos_dashboard_design_v1') as any) || 'classic';
  });

  const handleDesignChange = async (design: 'classic' | 'unified_pro') => {
    setDashboardDesign(design);
    const platformKey = getLayoutStorageKey();
    localStorage.setItem(platformKey, design);
    localStorage.setItem('hyperpos_dashboard_design_v1', design);
    window.dispatchEvent(new CustomEvent('hyperpos:design-changed', { detail: design }));

    toast({
      title: t('common.saved'),
      description: isRTL ? 'تم تغيير نمط التصميم محلياً لهذه المنصة بنجاح' : 'Layout updated for this platform',
    });
  };

  // Live preview handlers
  const handleDraftFontChange = (newFont: AppFontId) => {
    setDraftFont(newFont);
    applyAppFontToDOM(newFont);
  };

  const handleDraftScaleChange = (newScale: UIScaleId) => {
    setDraftScale(newScale);
    applyUIScaleToDOM(newScale);
  };

  // Revert preview on unmount if user leaves page without saving
  useEffect(() => {
    return () => {
      revertTheme();
      applyAppFontToDOM(savedFontRef.current);
      applyUIScaleToDOM(savedScaleRef.current);
    };
  }, [revertTheme]);

  // Commit all draft changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // 1. Save Theme
      if (hasThemeChanged && draftTheme) {
        setFullTheme(draftTheme.mode, draftTheme.color, draftTheme.blur, draftTheme.transparency);
        savedThemeRef.current = { ...draftTheme };
        setDraftTheme(null);
      }

      // 2. Save Font
      if (hasFontChanged) {
        setFont(draftFont);
        savedFontRef.current = draftFont;
        try {
          await saveUnifiedStoreSettings({ appFont: draftFont });
        } catch (e) {
          console.warn('Sync font error:', e);
        }
      }

      // 3. Save UI Scale
      if (hasScaleChanged) {
        setScale(draftScale);
        savedScaleRef.current = draftScale;
        try {
          await saveUnifiedStoreSettings({ uiScale: draftScale });
        } catch (e) {
          console.warn('Sync scale error:', e);
        }
      }

      showSmartToast({
        type: 'settings',
        title: t('common.saved') || 'تم الحفظ',
        description: isRTL ? 'تم حفظ إعدادات المظهر بنجاح' : 'Appearance settings saved successfully',
        duration: 3500,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Discard all draft changes
  const handleCancelAll = () => {
    revertTheme();
    applyAppFontToDOM(savedFontRef.current);
    applyUIScaleToDOM(savedScaleRef.current);

    setDraftTheme(null);
    setDraftFont(savedFontRef.current);
    setDraftScale(savedScaleRef.current);
    setResetSignal((prev) => prev + 1);
  };

  // Navigation tabs (Theme tab button intentionally removed as UI element; ThemeSection is shown directly)
  const tabs = [
    { id: 'fonts' as AppearanceTab, label: t('appearance.fonts'), icon: Type },
    { id: 'scale' as AppearanceTab, label: t('appearance.uiScale'), icon: Maximize2 },
    { id: 'layout' as AppearanceTab, label: t('appearance.layout'), icon: LayoutGrid },
  ];

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto pb-28 pt-14 md:pt-4 space-y-5">
      {/* قسم المظهر العام معروض بشكل مباشر وافتراضي */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border/60 shadow-sm transition-all">
        <ThemeSection
          resetSignal={resetSignal}
          onPendingChange={(pending, changed) => {
            setDraftTheme(changed ? pending : null);
            if (changed) {
              previewTheme(pending.mode, pending.color, pending.blur, pending.transparency);
            } else {
              revertTheme();
            }
          }}
        />
      </div>

      {/* شريط تبويبات الإعدادات الإضافية (الخطوط، حجم الواجهة، والتخطيط) */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-muted/70 dark:bg-zinc-900/80 rounded-2xl border border-border/60 shadow-xs overflow-visible">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-[background-color,color,box-shadow] duration-150 select-none min-h-12 overflow-visible",
                isActive
                  ? "bg-card text-foreground shadow-sm border border-border/50 ring-1 ring-border/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <span className="whitespace-nowrap leading-relaxed py-0.5 overflow-visible">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* محتوى التبويب النشط */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border/60 shadow-sm transition-all">
        {activeTab === 'fonts' && (
          <FontSelector
            draftFont={draftFont}
            onDraftChange={handleDraftFontChange}
          />
        )}

        {activeTab === 'scale' && (
          <UIScaleSelector
            draftScale={draftScale}
            onDraftChange={handleDraftScaleChange}
          />
        )}

        {activeTab === 'layout' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">{t('appearance.dashboardDesignTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('appearance.dashboardDesignDesc')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDesignChange('classic')}
                className={cn(
                  "p-4 rounded-2xl border text-start transition-all duration-200 hover:border-primary/40",
                  dashboardDesign === 'classic'
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <div className="font-bold text-sm text-foreground">{t('appearance.classicStyle')}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('appearance.classicDesc')}</div>
              </button>

              <button
                type="button"
                onClick={() => handleDesignChange('unified_pro')}
                className={cn(
                  "p-4 rounded-2xl border text-start transition-all duration-200 hover:border-primary/40",
                  dashboardDesign === 'unified_pro'
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{t('appearance.unifiedProStyle')}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('appearance.unifiedProDesc')}</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* الشريط/الزر العائم الحصري عند حدوث أي تعديل غير محفوظ في السمة أو الخط أو الحجم */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="rounded-full shadow-2xl h-12 px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm transition-all"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isRTL ? 'حفظ التعديلات' : 'Save Changes'}</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleCancelAll}
            disabled={isSaving}
            className="rounded-full shadow-lg h-12 px-4 gap-1.5 border-border/80 bg-background/95 hover:bg-muted font-medium text-sm transition-all"
            title={isRTL ? 'إلغاء / تراجع' : 'Cancel / Undo'}
          >
            <Undo2 className="w-4 h-4" />
            <span>{isRTL ? 'إلغاء' : 'Cancel'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
