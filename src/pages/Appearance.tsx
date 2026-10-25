import { useState, useEffect, useRef } from 'react';
import { Palette, Type, Maximize2, Save, Undo2, Loader2 } from 'lucide-react';
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
import { applyAppFontToDOM, AppFontId } from '@/lib/app-font-config';
import { applyUIScaleToDOM, UIScaleId } from '@/lib/ui-scale-config';
import { saveUnifiedStoreSettings } from '@/lib/store-settings-sync';

export type AppearanceTab = 'theme' | 'fonts' | 'scale';

export default function Appearance() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<AppearanceTab>('theme');
  const { mode, color, blurEnabled, transparencyLevel, themeStyle, setFullTheme, previewTheme, revertTheme } = useTheme();
  const { currentFont, setFont } = useAppFont();
  const { currentScale, setScale } = useUIScale();

  // Baseline stored settings captured upon entering Appearance
  const savedThemeRef = useRef({ mode, color, blur: blurEnabled, transparency: transparencyLevel, style: themeStyle });
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
    draftTheme.transparency !== savedThemeRef.current.transparency ||
    draftTheme.style !== savedThemeRef.current.style
  );
  const hasFontChanged = draftFont !== savedFontRef.current;
  const hasScaleChanged = draftScale !== savedScaleRef.current;

  const hasUnsavedChanges = hasThemeChanged || hasFontChanged || hasScaleChanged;

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
        setFullTheme(draftTheme.mode, draftTheme.color, draftTheme.blur, draftTheme.transparency, draftTheme.style);
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

  // Navigation tabs
  const tabs = [
    { id: 'theme' as AppearanceTab, label: isRTL ? 'المظهر العام' : 'Appearance & Theme', icon: Palette },
    { id: 'fonts' as AppearanceTab, label: t('appearance.fonts'), icon: Type },
    { id: 'scale' as AppearanceTab, label: t('appearance.uiScale'), icon: Maximize2 },
  ];

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto pb-28 pt-14 md:pt-4 space-y-5">
      {/* شريط تبويبات الإعدادات (المظهر والثيم، الخطوط، حجم الواجهة، والتخطيط) — كبسولة موحدة */}
      <div className="bg-muted/60 p-1 rounded-2xl grid grid-cols-3 gap-1 border border-border/40 shadow-xs select-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none cursor-pointer min-h-11",
                isActive
                  ? "bg-gradient-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap leading-relaxed py-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* محتوى التبويب النشط */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border/60 shadow-sm transition-all">
        {activeTab === 'theme' && (
          <ThemeSection
            resetSignal={resetSignal}
            onPendingChange={(pending, changed) => {
              setDraftTheme(changed ? pending : null);
              if (changed) {
                previewTheme(pending.mode, pending.color, pending.blur, pending.transparency, pending.style);
              } else {
                revertTheme();
              }
            }}
          />
        )}

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


      </div>

      {/* الشريط/الزر العائم الحصري عند حدوث أي تعديل غير محفوظ في السمة أو الخط أو الحجم */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-20 end-4 md:bottom-8 md:end-8 z-50 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="rounded-full shadow-2xl h-12 px-6 gap-2 bg-primary text-primary-foreground font-bold text-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isRTL ? 'حفظ التعديلات' : 'Save Changes'}</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleCancelAll}
            disabled={isSaving}
            className="rounded-full shadow-lg h-12 px-4 gap-1.5 border-border/80 bg-background/95 text-sm"
          >
            <Undo2 className="w-4 h-4" />
            <span>{isRTL ? 'إلغاء' : 'Cancel'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
