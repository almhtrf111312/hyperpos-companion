import React, { useState, useEffect } from 'react';
import { Maximize2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import {
  UIScaleId,
  UI_SCALE_OPTIONS,
  UI_SCALE_CHANGED_EVENT,
  getStoredUIScale,
  setStoredUIScale,
  applyUIScaleToDOM,
} from '@/lib/ui-scale-config';
import { toast } from '@/lib/sonner-bridge';
import { Slider } from '@/components/ui/slider';
import { saveUnifiedStoreSettings } from '@/lib/store-settings-sync';
import { EVENTS } from '@/lib/events';

import { cn } from '@/lib/utils';

const SCALE_STEPS: UIScaleId[] = ['60', '70', '80', '90', '100', '110', '120'];

interface UIScaleSelectorProps {
  className?: string;
  showCardContainer?: boolean;
  draftScale?: UIScaleId;
  onDraftChange?: (scaleId: UIScaleId) => void;
  onPendingChange?: (scale: UIScaleId | null, changed: boolean) => void;
  resetSignal?: number;
  onSaved?: () => void;
}

export const UIScaleSelector: React.FC<UIScaleSelectorProps> = ({
  className,
  draftScale,
  onDraftChange,
  onPendingChange,
}) => {
  const { isRTL } = useLanguage();
  const [currentScale, setCurrentScale] = useState<UIScaleId>(getStoredUIScale);

  const effectiveScale = draftScale ?? currentScale;

  useEffect(() => {
    const handleUpdate = () => {
      setCurrentScale(getStoredUIScale());
    };
    window.addEventListener(UI_SCALE_CHANGED_EVENT, handleUpdate);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleUpdate);
    return () => {
      window.removeEventListener(UI_SCALE_CHANGED_EVENT, handleUpdate);
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleUpdate);
    };
  }, []);

  const stepIndex = SCALE_STEPS.indexOf(effectiveScale);

  const handleStepChange = async (index: number) => {
    const newScale = SCALE_STEPS[index] || '60';
    if (onDraftChange) {
      onDraftChange(newScale);
      return;
    }
    setCurrentScale(newScale);
    setStoredUIScale(newScale);
    onPendingChange?.(newScale, true);

    const option = UI_SCALE_OPTIONS.find((s) => s.id === newScale);

    try {
      const res = await saveUnifiedStoreSettings({ uiScale: newScale });
      if (res.status === 'synced') {
        toast.success(isRTL ? `المقياس الحالي: ${option?.labelAr} (تمت المزامنة سحابياً)` : `Scale: ${option?.labelEn} (Synced)`);
      } else {
        toast.info(isRTL ? `المقياس الحالي: ${option?.labelAr} (محفوظ محلياً - بانتظار المزامنة)` : `Scale: ${option?.labelEn} (Saved locally - Queued)`);
      }
    } catch (e) {
      console.warn('Sync uiScale error:', e);
      toast.success(isRTL ? `المقياس الحالي: ${option?.labelAr}` : `Scale: ${option?.labelEn}`);
    }
  };

  const currentOption = UI_SCALE_OPTIONS.find((s) => s.id === effectiveScale);

  // ترتيب التسميات: في RTL من اليمين يبدأ الكبير جداً (خطوة 4) ثم كبير ثم وسط ثم صغير ثم صغير جداً (خطوة 0)
  // ليتطابق تماماً مع مؤشر شريط السحب الأفقي
  const stepsConfig = isRTL
    ? [
        { index: 6, label: 'كبير جداً' },
        { index: 5, label: 'كبير' },
        { index: 4, label: 'وسط' },
        { index: 3, label: 'صغير' },
        { index: 2, label: 'مدمج' },
        { index: 1, label: 'مكثف' },
        { index: 0, label: 'الأصغر' },
      ]
    : [
        { index: 0, label: '60%' },
        { index: 1, label: '70%' },
        { index: 2, label: '80%' },
        { index: 3, label: '90%' },
        { index: 4, label: '100%' },
        { index: 5, label: '110%' },
        { index: 6, label: '120%' },
      ];

  return (
    <div className={cn("space-y-4 p-4 rounded-xl border border-border/70 bg-card", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {isRTL ? 'حجم خطوط وعناصر الشاشة' : 'UI & Font Scale'}
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
          {(isRTL ? currentOption?.labelAr : currentOption?.labelEn) || '100%'}
        </span>
      </div>

      {/* الشريط الأفقي بنقاط الارتكاز الخمس */}
      <div className="space-y-3 pt-2">
        <div dir="ltr" className="px-2">
          <Slider
            value={[stepIndex >= 0 ? stepIndex : 0]}
            min={0}
            max={6}
            step={1}
            onValueChange={(val) => handleStepChange(val[0])}
            className="w-full cursor-pointer"
          />
        </div>

        {/* تسميات النقاط السبع: من اليمين (كبير جداً) إلى اليسار (الأصغر 60%) في RTL */}
        <div className="grid grid-cols-7 text-center text-[10px] md:text-xs font-medium text-muted-foreground select-none">
          {stepsConfig.map((item) => {
            const isActive = stepIndex === item.index;
            const isDefault = item.index === 0;
            return (
              <button
                key={item.index}
                type="button"
                onClick={() => handleStepChange(item.index)}
                className={cn(
                  "py-1 rounded-md transition-colors cursor-pointer text-center",
                  isActive
                    ? "font-bold text-primary underline underline-offset-4"
                    : isDefault
                    ? "font-semibold text-foreground/80 hover:text-foreground"
                    : "hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UIScaleSelector;
