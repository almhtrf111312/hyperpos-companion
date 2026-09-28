import React from 'react';
import { Type, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { useAppFont } from '@/hooks/use-app-font';
import { useLanguage } from '@/hooks/use-language';
import { AppFontId } from '@/lib/app-font-config';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface FontSelectorProps {
  className?: string;
  showCardContainer?: boolean;
}

export const FontSelector: React.FC<FontSelectorProps> = ({
  className,
  showCardContainer = true,
}) => {
  const { currentFont, setFont, availableFonts } = useAppFont();
  const { isRTL } = useLanguage();

  const handleSelectFont = (fontId: AppFontId, fontName: string) => {
    if (fontId === currentFont) return;
    setFont(fontId);
    toast.success(
      isRTL ? `تم تغيير خط النظام إلى: ${fontName}` : `System font changed to: ${fontName}`
    );
  };

  const content = (
    <div className={cn("space-y-4", className)}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {isRTL ? 'خط البرنامج والواجهة' : 'System & App Font'}
              </h3>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary bg-primary/5">
                {isRTL ? '5 خطوط مدمجة' : '5 Embedded Fonts'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRTL
                ? 'تعمل بالكامل أوفلاين بدون إنترنت مع ضمان بقاء الأرقام إنجليزية (0-9) دائماً'
                : '100% Offline with guaranteed Western numerals protection (0-9)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full self-start sm:self-auto border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-medium text-[11px]">
            {isRTL ? 'أرقام إنجليزية محمية' : 'Western Digits Active'}
          </span>
        </div>
      </div>

      {/* Font Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {availableFonts.map((font) => {
          const isSelected = currentFont === font.id;

          return (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelectFont(font.id, isRTL ? font.nameAr : font.name)}
              className={cn(
                "relative text-start p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group select-none",
                isSelected
                  ? "bg-primary/10 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                  : "bg-card/70 hover:bg-card hover:border-border/80 border-border/50"
              )}
            >
              {/* Top Row: Names + Badge + Check */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-base font-bold text-foreground", font.previewClass)}>
                      {isRTL ? font.nameAr : font.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      ({font.name})
                    </span>
                  </div>

                  {font.badgeAr && (
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                    )}>
                      {font.id === 'cairo' && <Sparkles className="w-2.5 h-2.5" />}
                      {font.badgeAr}
                    </span>
                  )}
                </div>

                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-muted-foreground/30 group-hover:border-muted-foreground/60"
                  )}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Middle Row: Live Typography Preview */}
              <div
                className={cn(
                  "p-2.5 rounded-lg border text-sm transition-colors",
                  font.previewClass,
                  isSelected
                    ? "bg-background/80 border-primary/30 text-foreground font-medium"
                    : "bg-muted/40 border-border/40 text-foreground/90 group-hover:bg-muted/70"
                )}
                dir="rtl"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                  <span>تجربة الخط العربي والواجهة</span>
                  <span className="font-semibold text-primary font-mono dir-ltr text-xs">
                    1,234.50 $
                  </span>
                </div>
              </div>

              {/* Bottom Row: Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isRTL ? font.descriptionAr : font.descriptionEn}
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
    <div className="p-4 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm space-y-4">
      {content}
    </div>
  );
};

export default FontSelector;
