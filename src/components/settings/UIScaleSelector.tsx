import React, { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import {
  UIScaleId,
  UI_SCALE_OPTIONS,
  getStoredUIScale,
  setStoredUIScale,
  applyUIScaleToDOM,
} from '@/lib/ui-scale-config';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { saveStoreSettings } from '@/lib/supabase-store';

const SCALE_STEPS: UIScaleId[] = ['80', '90', '100', '110', '120'];

interface UIScaleSelectorProps {
  className?: string;
  showCardContainer?: boolean;
  onPendingChange?: (scale: UIScaleId | null, changed: boolean) => void;
  resetSignal?: number;
  onSaved?: () => void;
}

export const UIScaleSelector: React.FC<UIScaleSelectorProps> = ({
  className,
  onPendingChange,
}) => {
  const { isRTL } = useLanguage();
  const [currentScale, setCurrentScale] = useState<UIScaleId>(getStoredUIScale);

  const stepIndex = SCALE_STEPS.indexOf(currentScale);

  const handleStepChange = async (index: number) => {
    const newScale = SCALE_STEPS[index] || '100';
    setCurrentScale(newScale);
    applyUIScaleToDOM(newScale);
    setStoredUIScale(newScale);
    onPendingChange?.(newScale, true);

    const option = UI_SCALE_OPTIONS.find((s) => s.id === newScale);
    toast.success(isRTL ? `المقياس الحالي: ${option?.labelAr}` : `Scale: ${option?.labelEn}`);

    try {
      await saveStoreSettings({ sync_settings: { uiScale: newScale } });
    } catch (e) {
      console.warn('Sync uiScale error:', e);
    }
  };

  const currentOption = UI_SCALE_OPTIONS.find((s) => s.id === currentScale);

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border/70 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {isRTL ? 'حجم خطوط وعناصر الشاشة' : 'UI & Font Scale'}
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
          {currentOption?.labelAr || '100%'}
        </span>
      </div>

      {/* الشريط الأفقي بنقاط الارتكاز الخمس */}
      <div className="space-y-3 pt-2">
        <div dir="ltr" className="px-2">
          <Slider
            value={[stepIndex >= 0 ? stepIndex : 2]}
            min={0}
            max={4}
            step={1}
            onValueChange={(val) => handleStepChange(val[0])}
            className="w-full cursor-pointer"
          />
        </div>

        {/* تسميات النقاط الخمس من اليسار لليمين */}
        <div className="grid grid-cols-5 text-center text-[10px] md:text-xs font-medium text-muted-foreground">
          <span className={stepIndex === 0 ? "font-bold text-primary" : ""}>صغير جداً</span>
          <span className={stepIndex === 1 ? "font-bold text-primary" : ""}>صغير</span>
          <span className={stepIndex === 2 ? "font-black text-primary underline" : "font-semibold"}>وسط</span>
          <span className={stepIndex === 3 ? "font-bold text-primary" : ""}>كبير</span>
          <span className={stepIndex === 4 ? "font-bold text-primary" : ""}>كبير جداً</span>
        </div>
      </div>
    </div>
  );
};

export default UIScaleSelector;
