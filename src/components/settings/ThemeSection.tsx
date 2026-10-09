import { useState, useEffect } from 'react';
import { Sun, Moon, Palette, Check, Blend } from 'lucide-react';
import { useTheme, themeColors, ThemeColor, ThemeMode } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { ThemeLivePreview } from './ThemeLivePreview';
import { Slider } from '@/components/ui/slider';

export interface PendingTheme {
  mode: ThemeMode;
  color: ThemeColor;
  blur: boolean;
  transparency: number;
}

interface ThemeSectionProps {
  onPendingChange?: (pending: PendingTheme, hasChanges: boolean) => void;
  resetSignal?: number; // increment to trigger reset
}

export function ThemeSection({ onPendingChange, resetSignal }: ThemeSectionProps) {
  const { mode, color, blurEnabled, transparencyLevel } = useTheme();
  const { t } = useLanguage();
  
  const [pendingMode, setPendingMode] = useState<ThemeMode>(mode);
  const [pendingColor, setPendingColor] = useState<ThemeColor>(color);
  const [pendingBlur, setPendingBlur] = useState<boolean>(blurEnabled);
  const [pendingTransparency, setPendingTransparency] = useState<number>(transparencyLevel);

  const colorOptions = Object.entries(themeColors) as [ThemeColor, typeof themeColors[ThemeColor]][];

  // Reset when parent requests it
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal > 0) {
      setPendingMode(mode);
      setPendingColor(color);
      setPendingBlur(blurEnabled);
      setPendingTransparency(transparencyLevel);
    }
  }, [resetSignal, mode, color, blurEnabled, transparencyLevel]);

  const notifyChange = (m: ThemeMode, c: ThemeColor, b: boolean, tr: number) => {
    const hasChanges = m !== mode || c !== color || b !== blurEnabled || tr !== transparencyLevel;
    onPendingChange?.({ mode: m, color: c, blur: b, transparency: tr }, hasChanges);
  };

  const handleModeChange = (newMode: ThemeMode) => {
    setPendingMode(newMode);
    notifyChange(newMode, pendingColor, pendingBlur, pendingTransparency);
  };

  const handleColorChange = (newColor: ThemeColor) => {
    setPendingColor(newColor);
    notifyChange(pendingMode, newColor, pendingBlur, pendingTransparency);
  };

  const handleBlurChange = (enabled: boolean) => {
    setPendingBlur(enabled);
    const newTransparency = !enabled ? 0 : (pendingTransparency === 0 ? 30 : pendingTransparency);
    if (!enabled) setPendingTransparency(0);
    else if (pendingTransparency === 0) setPendingTransparency(30);
    notifyChange(pendingMode, pendingColor, enabled, newTransparency);
  };

  const handleTransparencyChange = (value: number[]) => {
    const val = value[0];
    setPendingTransparency(val);
    notifyChange(pendingMode, pendingColor, pendingBlur, val);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">
          {t('settings.theme')}
        </h2>
        
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => handleModeChange('light')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all relative active:scale-95",
              pendingMode === 'light'
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/60 bg-muted/40 hover:bg-muted/70"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              pendingMode === 'light' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
            )}>
              <Sun className="w-4 h-4" />
            </div>
            <span className="text-xs md:text-sm font-bold text-foreground">{t('settings.lightMode')}</span>
            {pendingMode === 'light' && (
              <Check className="w-4 h-4 text-primary absolute rtl:left-2.5 ltr:right-2.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('dark')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all relative active:scale-95",
              pendingMode === 'dark'
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/60 bg-muted/40 hover:bg-muted/70"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              pendingMode === 'dark' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
            )}>
              <Moon className="w-4 h-4" />
            </div>
            <span className="text-xs md:text-sm font-bold text-foreground">{t('settings.darkMode')}</span>
            {pendingMode === 'dark' && (
              <Check className="w-4 h-4 text-primary absolute rtl:left-2.5 ltr:right-2.5" />
            )}
          </button>
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          {t('settings.colorTheme')}
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {colorOptions.map(([key, value]) => (
            <button
              key={key}
              onClick={() => handleColorChange(key)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                pendingColor === key
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted hover:bg-muted/80"
              )}
              title={value.nameAr}
            >
              <div
                className="w-10 h-10 rounded-full shadow-lg"
                style={{
                  background: `linear-gradient(135deg, hsl(${value.primary}), hsl(${value.accent}))`
                }}
              />
              <span className="text-xs font-medium text-foreground truncate w-full text-center hidden md:block">
                {value.nameAr}
              </span>
              {pendingColor === key && (
                <div className="absolute top-1 left-1">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Transparency Feature */}
      <div className="pt-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              pendingBlur ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Blend className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">
                {t('settings.transparency')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.transparencyDesc')}
              </p>
            </div>
          </div>
          <Switch
            checked={pendingBlur}
            onCheckedChange={handleBlurChange}
          />
        </div>

        {pendingBlur && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">{t('settings.transparencyLevel')}</span>
              <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {pendingTransparency}%
              </span>
            </div>

            {/* شريط الشفافية باتجاه LTR صريح لمنع الانعكاس بين اليمين واليسار */}
            <div dir="ltr" className="space-y-1.5 px-1">
              <Slider
                value={[pendingTransparency]}
                onValueChange={handleTransparencyChange}
                min={10}
                max={90}
                step={10}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>10% (خفيف)</span>
                <span>50% (متوسط)</span>
                <span>90% (شفاف جداً)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      
    </div>
  );
}
