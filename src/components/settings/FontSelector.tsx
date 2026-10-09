import React from 'react';
import { Type, Check } from 'lucide-react';
import { useAppFont } from '@/hooks/use-app-font';
import { useLanguage } from '@/hooks/use-language';
import { AppFontId } from '@/lib/app-font-config';
import { toast } from 'sonner';
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
    toast.success(isRTL ? `تم اعتماد خط: ${fontName}` : `Font changed to: ${fontName}`);
    try {
      await saveStoreSettings({ sync_settings: { appFont: fontId } });
    } catch (e) {
      console.warn('Sync appFont error:', e);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Type className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">
          {isRTL ? 'خط النظام (يدعم الأرقام الإنجليزية 0-9)' : 'System Font'}
        </h3>
      </div>

      <div className="flex flex-col gap-1.5">
        {availableFonts.map((font) => {
          const isSelected = currentFont === font.id;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelectFont(font.id, isRTL ? font.nameAr : font.name)}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-all text-right select-none",
                isSelected
                  ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                  : "border-border/60 bg-card hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn("text-sm md:text-base font-bold text-foreground", font.previewClass)}>
                  {isRTL ? font.nameAr : font.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  ({font.name})
                </span>
                {font.badgeAr && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {font.badgeAr}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "border border-border"
                )}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FontSelector;
