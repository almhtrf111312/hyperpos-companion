import { capsuleOuter, capsuleOuterScroll, capsuleItem, capsuleActive, capsuleIdle } from '@/components/ui/SegmentedCapsule';
import { useState, useEffect, useRef } from 'react';
import { Palette, Type, Maximize2 } from 'lucide-react';
import { ThemeSection, PendingTheme } from '@/components/settings/ThemeSection';
import { UIScaleSelector } from '@/components/settings/UIScaleSelector';
import { FontSelector } from '@/components/settings/FontSelector';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { FloatingSaveBar } from '@/components/ui/FloatingSaveBar';
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
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCommittedRef = useRef(false);

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
    isCommittedRef.current = false;
    setDraftFont(newFont);
    applyAppFontToDOM(newFont);
  };

  const handleDraftScaleChange = (newScale: UIScaleId) => {
    isCommittedRef.current = false;
    setDraftScale(newScale);
    applyUIScaleToDOM(newScale);
  };

  // Revert preview on unmount ONLY if user leaves page without saving
  useEffect(() => {
    isCommittedRef.current = false;
    return () => {
      if (!isCommittedRef.current) {
        const s = savedThemeRef.current;
        previewTheme(s.mode, s.color, s.blur, s.transparency, s.style);
        applyAppFontToDOM(savedFontRef.current);
        applyUIScaleToDOM(savedScaleRef.current);
      }
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []); // Empty deps: runs cleanup only on true unmount!

  // Commit all draft changes (Optimistic UI - 0ms immediate local apply)
  const handleSaveAll = () => {
    isCommittedRef.current = true;
    setIsSaving(false);

    const committedTheme = draftTheme;
    // 1. Save Theme immediately to DOM and context
    if (hasThemeChanged && draftTheme) {
      setFullTheme(draftTheme.mode, draftTheme.color, draftTheme.blur, draftTheme.transparency, draftTheme.style);
      savedThemeRef.current = { ...draftTheme };
      setDraftTheme(null);
    }

    // 2. Save Font immediately
    if (hasFontChanged) {
      setFont(draftFont);
      savedFontRef.current = draftFont;
    }

    // 3. Save UI Scale immediately
    if (hasScaleChanged) {
      setScale(draftScale);
      savedScaleRef.current = draftScale;
    }

    // 4. Save to Unified Store Settings in background (Fire-and-Forget / Non-blocking)
    void saveUnifiedStoreSettings({
      appFont: draftFont,
      uiScale: draftScale,
      ...(committedTheme ? { theme: committedTheme.mode, themeSettings: committedTheme } : {}),
    });

    // 5. Instant UI feedback (Checkmark for 600ms)
    setIsSaveSuccess(true);
    showSmartToast({
      type: 'settings',
      title: t('common.saved') || 'تم الحفظ',
      description: isRTL ? 'تم حفظ إعدادات المظهر بنجاح' : 'Appearance settings saved successfully',
      duration: 3000,
    });

    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      setIsSaveSuccess(false);
    }, 600);
  };

  // Discard all draft changes
  const handleCancelAll = () => {
    isCommittedRef.current = true;
    const s = savedThemeRef.current;
    previewTheme(s.mode, s.color, s.blur, s.transparency, s.style);
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
    <div className="p-3 md:p-6 max-w-2xl mx-auto pb-32 pt-14 md:pt-4 space-y-5">
      {/* شريط تبويبات الإعدادات (المظهر والثيم، الخطوط، حجم الواجهة، والتخطيط) — كبسولة موحدة */}
      <div className={capsuleOuter + " sm:w-full"}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                capsuleItem,
                isActive
                  ? capsuleActive
                  : capsuleIdle
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap leading-relaxed py-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* محتوى التبويبات — تبقى محملة في الذاكرة لمنع فقدان المسودات عند التنقل */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border/60 shadow-sm transition-all">
        <div className={activeTab === 'theme' ? 'block' : 'hidden'}>
          <ThemeSection
            resetSignal={resetSignal}
            currentDraft={draftTheme}
            onPendingChange={(pending) => {
              isCommittedRef.current = false;
              const savedTheme = savedThemeRef.current;
              const hasThemeChanges = pending.mode !== savedTheme.mode ||
                pending.color !== savedTheme.color ||
                pending.blur !== savedTheme.blur ||
                pending.transparency !== savedTheme.transparency ||
                pending.style !== savedTheme.style;
              setDraftTheme(hasThemeChanges ? pending : null);
              if (hasThemeChanges) {
                previewTheme(pending.mode, pending.color, pending.blur, pending.transparency, pending.style);
              } else {
                previewTheme(savedTheme.mode, savedTheme.color, savedTheme.blur, savedTheme.transparency, savedTheme.style);
              }
            }}
          />
        </div>

        <div className={activeTab === 'fonts' ? 'block' : 'hidden'}>
          <FontSelector
            draftFont={draftFont}
            onDraftChange={handleDraftFontChange}
          />
        </div>

        <div className={activeTab === 'scale' ? 'block' : 'hidden'}>
          <UIScaleSelector
            draftScale={draftScale}
            onDraftChange={handleDraftScaleChange}
          />
        </div>
      </div>

      <FloatingSaveBar
        visible={hasUnsavedChanges || isSaveSuccess}
        saving={isSaving}
        success={isSaveSuccess}
        onSave={handleSaveAll}
        onRevert={handleCancelAll}
      />
    </div>
  );
}
