import React, { useState, useEffect } from 'react';
import { Maximize2, Check, Sparkles, Undo2, Save, Eye } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import {
  UIScaleId,
  UI_SCALE_OPTIONS,
  getStoredUIScale,
  setStoredUIScale,
  applyUIScaleToDOM,
} from '@/lib/ui-scale-config';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { saveStoreSettings } from '@/lib/supabase-store';

interface UIScaleSelectorProps {
  className?: string;
  showCardContainer?: boolean;
  onPendingChange?: (pendingScale: UIScaleId | null, hasChanges: boolean) => void;
  resetSignal?: number;
  onSaved?: () => void;
}

export const UIScaleSelector: React.FC<UIScaleSelectorProps> = ({
  className,
  showCardContainer = true,
  onPendingChange,
  resetSignal,
  onSaved,
}) => {
  const { isRTL } = useLanguage();
  const [savedScale, setSavedScale] = useState<UIScaleId>(getStoredUIScale);
  const [pendingScale, setPendingScale] = useState<UIScaleId | null>(null);

  // Sync state if savedScale changes elsewhere
  useEffect(() => {
    const current = getStoredUIScale();
    setSavedScale(current);
  }, []);

  // Handle reset signal from parent (e.g. Floating Undo button)
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal > 0 && pendingScale !== null) {
      applyUIScaleToDOM(savedScale);
      setPendingScale(null);
      onPendingChange?.(null, false);
    }
  }, [resetSignal, savedScale, pendingScale, onPendingChange]);

  const activeScale = pendingScale ?? savedScale;
  const isPreviewMode = pendingScale !== null && pendingScale !== savedScale;

  const handleSelectScale = (scaleId: UIScaleId) => {
    if (scaleId === savedScale) {
      // Reverting to the already saved scale
      applyUIScaleToDOM(scaleId);
      setPendingScale(null);
      onPendingChange?.(null, false);
      return;
    }

    // Apply live preview immediately
    applyUIScaleToDOM(scaleId);
    setPendingScale(scaleId);
    onPendingChange?.(scaleId, true);
  };

  const handleCommitSave = async () => {
    if (!pendingScale) return;
    const targetScale = pendingScale;

    setStoredUIScale(targetScale);
    setSavedScale(targetScale);
    setPendingScale(null);
    onPendingChange?.(null, false);
    onSaved?.();

    const scaleOpt = UI_SCALE_OPTIONS.find((s) => s.id === targetScale);
    const label = isRTL ? scaleOpt?.labelAr : scaleOpt?.labelEn;

    toast.success(
      isRTL
        ? `تم اعتماد مقياس الواجهة: ${label}`
        : `UI scale applied: ${label}`
    );

    // مزامنة فورية لسحابة المتجر النشط
    try {
      await saveStoreSettings({
        sync_settings: { uiScale: targetScale },
      });
    } catch (e) {
      console.warn('Failed to sync uiScale to store cloud settings:', e);
    }
  };

  const handleRevert = () => {
    applyUIScaleToDOM(savedScale);
    setPendingScale(null);
    onPendingChange?.(null, false);
    toast.info(
      isRTL ? 'تم إلغاء المعاينة واستعادة المقياس السابق' : 'Preview cancelled, reverted to previous scale'
    );
  };

  const content = (
    <div className={cn("space-y-4", className)}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {isRTL ? 'مقياس وحجم الواجهة والنوافذ' : 'UI & Text Scale'}
              </h3>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary bg-primary/5">
                {isRTL ? '5 مستويات تكبير' : '5 Scaling Levels'}
              </Badge>
              {isPreviewMode && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-warning/20 text-warning border-warning/30 animate-pulse">
                  <Eye className="w-2.5 h-2.5 inline mr-1 rtl:ml-1" />
                  {isRTL ? 'معاينة حية' : 'Live Preview'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRTL
                ? 'تكبير أو تصغير أبعاد الأزرار والنصوص والجداول بنسب متوازنة مع حفظ يدوي'
                : 'Scale entire interface fonts, buttons and dialogs proportionally'}
            </p>
          </div>
        </div>

        {/* Live status badge */}
        <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full self-start sm:self-auto border border-primary/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-bold text-[11px] font-mono">
            {UI_SCALE_OPTIONS.find((s) => s.id === activeScale)?.percentage}%
          </span>
          <span className="text-[10px] opacity-80">
            ({UI_SCALE_OPTIONS.find((s) => s.id === activeScale)?.fontSizePx})
          </span>
        </div>
      </div>

      {/* Preview notification banner when changes are pending */}
      {isPreviewMode && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="text-foreground font-medium">
              {isRTL
                ? 'تشاهد الآن معاينة حية للمقياس. اضغط حفظ للاعتماد أو تراجع للإلغاء.'
                : 'Viewing live scale preview. Click Save to apply or Revert to cancel.'}
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRevert}
              className="h-7 text-xs flex-1 sm:flex-initial"
            >
              <Undo2 className="w-3.5 h-3.5 ml-1 rtl:ml-1 ltr:mr-1" />
              {isRTL ? 'إلغاء' : 'Revert'}
            </Button>
            <Button
              size="sm"
              onClick={handleCommitSave}
              className="h-7 text-xs flex-1 sm:flex-initial bg-primary hover:bg-primary/90"
            >
              <Save className="w-3.5 h-3.5 ml-1 rtl:ml-1 ltr:mr-1" />
              {isRTL ? 'حفظ المقياس' : 'Save Scale'}
            </Button>
          </div>
        </div>
      )}

      {/* Scale Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
        {UI_SCALE_OPTIONS.map((scale) => {
          const isSelected = activeScale === scale.id;
          const isSaved = savedScale === scale.id;

          return (
            <button
              key={scale.id}
              type="button"
              onClick={() => handleSelectScale(scale.id)}
              className={cn(
                "relative text-start p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group select-none",
                isSelected
                  ? "bg-primary/10 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                  : "bg-card/70 hover:bg-card hover:border-border/80 border-border/50"
              )}
            >
              {/* Top Row: Name + Percentage + Radio Badge */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-foreground">
                      {isRTL ? scale.labelAr : scale.labelEn}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {isRTL ? scale.badgeAr : scale.badgeEn} • {scale.fontSizePx}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isSaved && !isSelected && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {isRTL ? 'المحفوظ' : 'Saved'}
                    </span>
                  )}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border/70 group-hover:border-primary/50"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Text Size Visual Preview */}
              <div
                className="p-2 rounded-lg bg-background/60 border border-border/40 text-foreground overflow-hidden"
                style={{ fontSize: scale.fontSizePx }}
              >
                <div className="flex items-center justify-between gap-2 leading-tight">
                  <span className="font-semibold truncate">
                    {isRTL ? 'فاتورة بيع #104' : 'Invoice #104'}
                  </span>
                  <span className="font-bold text-primary font-mono text-[0.9em] shrink-0">
                    $125.00
                  </span>
                </div>
                <p className="text-muted-foreground text-[0.8em] mt-0.5 truncate">
                  {isRTL ? 'هاتف آيفون 15 برو مكس' : 'iPhone 15 Pro Max'}
                </p>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-normal">
                {isRTL ? scale.descriptionAr : scale.descriptionEn}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!showCardContainer) {
    return content;
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-5 shadow-sm space-y-4">
      {content}
    </div>
  );
};
