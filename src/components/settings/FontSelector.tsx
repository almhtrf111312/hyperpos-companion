import React from 'react';
import { Type, Check } from 'lucide-react';
import { useAppFont } from '@/hooks/use-app-font';
import { useLanguage } from '@/hooks/use-language';
import { AppFontId } from '@/lib/app-font-config';
import { showToast } from '@/lib/toast-config';
import { cn } from '@/lib/utils';
import { saveStoreSettings } from '@/lib/supabase-store';

interface FontSelectorProps {
  className?: string;
  showCardContainer?: boolean;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ className }) => {
  const { currentFont, setFont, availableFonts } = useAppFont();
  const { isRTL } = useLanguage();

  const handleSelectFont = async (fontId: AppFontId, fontName: string) => {
    if (fontId === currentFont) return;
    setFont(fontId);
    showToast.success(isRTL ? `تم اعتماد خط: ${fontName}` : `Font changed to: ${fontName}`);
    try {
      await saveStoreSettings({ sync_settings: { appFont: fontId } });
    } catch (e) {
      console.warn('Sync appFont error:', e);
    }
  };

  return (
    <div className={cn("space-y-3.5", className)}>
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-primary shrink-0" />
          <h3 className="text-sm font-bold text-foreground">
            {isRTL ? 'خط النظام (يدعم الأرقام الإنجليزية 0-9)' : 'System Typography'}
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted/60 border border-border/40">
          {availableFonts.length} {isRTL ? 'خطوط متاحة' : 'Fonts'}
        </span>
      </div>

      {/* تأكيد الخط الحالي النشط */}
      <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
        <span>{isRTL ? 'الخط المعتمد حالياً:' : 'Active Font:'} {isRTL ? (availableFonts.find(f => f.id === currentFont)?.nameAr || currentFont) : (availableFonts.find(f => f.id === currentFont)?.name || currentFont)}</span>
        <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          {isRTL ? 'مثبت ومحفوظ' : 'Saved'}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {availableFonts.map((font) => {
          const isSelected = currentFont === font.id;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelectFont(font.id, isRTL ? font.nameAr : font.name)}
              className={cn(
                "group relative w-full text-right p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 select-none",
                "flex items-center justify-between gap-3 overflow-visible",
                isSelected
                  ? "border-primary/80 bg-primary/[0.08] dark:bg-primary/[0.12] ring-1 ring-primary/40 shadow-sm"
                  : "border-border/60 bg-card hover:bg-muted/40 hover:border-border"
              )}
            >
              {/* تفاصيل الخط المحمية تماماً من القص */}
              <div className="flex flex-col gap-1 min-w-0 flex-1 overflow-visible">
                {/* السطر الأول: الاسم العربي والاسم الإنجليزي والشارة */}
                <div className="flex items-center gap-2 flex-wrap overflow-visible">
                  <span className={cn("text-base sm:text-lg font-bold text-foreground leading-normal tracking-tight overflow-visible", font.previewClass)}>
                    {isRTL ? font.nameAr : font.name}
                  </span>

                  <span className="text-xs text-muted-foreground font-mono tracking-tight px-1.5 py-0.5 rounded-md bg-muted/70 dark:bg-white/5 border border-border/40 whitespace-nowrap">
                    ({font.name})
                  </span>

                  {font.badgeAr && (
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors",
                      isSelected
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-muted/60 text-muted-foreground border-border/40"
                    )}>
                      {isRTL ? font.badgeAr : font.name}
                    </span>
                  )}
                </div>

                {/* السطر الثاني: الوصف والمعاينة الحية للأرقام والنصوص */}
                <p className={cn("text-xs text-muted-foreground/80 mt-0.5 leading-relaxed overflow-visible", font.previewClass)}>
                  {font.descriptionAr}
                </p>
              </div>

              {/* مؤشر الاختيار الدائري الأنيق */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs scale-105"
                    : "border-2 border-muted-foreground/30 group-hover:border-primary/50"
                )}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FontSelector;
