import { useState, useEffect } from 'react';
import { Sun, Moon, Palette, Check, Blend, Sparkles, Zap, Cpu } from 'lucide-react';
import { usePerformanceMode, PerformanceModePref } from '@/lib/performance-mode';
import { useTheme, themeColors, ThemeColor, ThemeMode, ThemeStyle } from '@/hooks/use-theme';
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
  style: ThemeStyle;
}

interface ThemeSectionProps {
  onPendingChange?: (pending: PendingTheme, hasChanges: boolean) => void;
  resetSignal?: number; // increment to trigger reset
}

export function ThemeSection({ onPendingChange, resetSignal }: ThemeSectionProps) {
  const { mode, color, blurEnabled, transparencyLevel, themeStyle } = useTheme();
  const { t, isRTL } = useLanguage();
  const { pref: perfPref, effective: effectivePerf, setPref: setPerfPref } = usePerformanceMode();
  
  const [pendingMode, setPendingMode] = useState<ThemeMode>(mode);
  const [pendingColor, setPendingColor] = useState<ThemeColor>(color);
  const [pendingBlur, setPendingBlur] = useState<boolean>(blurEnabled);
  const [pendingTransparency, setPendingTransparency] = useState<number>(transparencyLevel);
  const [pendingStyle, setPendingStyle] = useState<ThemeStyle>(themeStyle || 'standard');

  const colorOptions = Object.entries(themeColors) as [ThemeColor, typeof themeColors[ThemeColor]][];

  // Reset when parent requests it
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal > 0) {
      setPendingMode(mode);
      setPendingColor(color);
      setPendingBlur(blurEnabled);
      setPendingTransparency(transparencyLevel);
      setPendingStyle(themeStyle || 'standard');
    }
  }, [resetSignal, mode, color, blurEnabled, transparencyLevel, themeStyle]);

  const notifyChange = (m: ThemeMode, c: ThemeColor, b: boolean, tr: number, s: ThemeStyle) => {
    const hasChanges = m !== mode || c !== color || b !== blurEnabled || tr !== transparencyLevel || s !== (themeStyle || 'standard');
    onPendingChange?.({ mode: m, color: c, blur: b, transparency: tr, style: s }, hasChanges);
  };

  const handleModeChange = (newMode: ThemeMode) => {
    setPendingMode(newMode);
    notifyChange(newMode, pendingColor, pendingBlur, pendingTransparency, pendingStyle);
  };

  const handleColorChange = (newColor: ThemeColor) => {
    setPendingColor(newColor);
    notifyChange(pendingMode, newColor, pendingBlur, pendingTransparency, pendingStyle);
  };

  const handleStyleChange = (newStyle: ThemeStyle) => {
    setPendingStyle(newStyle);
    notifyChange(pendingMode, pendingColor, pendingBlur, pendingTransparency, newStyle);
  };

  const handleBlurChange = (enabled: boolean) => {
    setPendingBlur(enabled);
    const newTransparency = !enabled ? 0 : (pendingTransparency === 0 ? 50 : pendingTransparency);
    if (!enabled) setPendingTransparency(0);
    else if (pendingTransparency === 0) setPendingTransparency(50);
    notifyChange(pendingMode, pendingColor, enabled, newTransparency, pendingStyle);
  };

  const handleTransparencyChange = (value: number[]) => {
    const val = value[0];
    setPendingTransparency(val);
    notifyChange(pendingMode, pendingColor, pendingBlur, val, pendingStyle);
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

      {/* Theme Style Selection (FlowPOS Standard vs Xiaomi HyperOS) */}
      <div className="pt-2">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>{isRTL ? 'نمط الواجهة والتصميم' : 'Design System Style'}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleStyleChange('standard')}
            className={cn(
              "p-3.5 sm:p-4 rounded-xl border-2 text-start transition-all relative active:scale-98",
              pendingStyle === 'standard'
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/60 bg-muted/40 hover:bg-muted/70"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-xs sm:text-sm text-foreground">
                {isRTL ? 'الافتراضي (FlowPOS Standard)' : 'FlowPOS Standard'}
              </span>
              {pendingStyle === 'standard' && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              {isRTL 
                ? 'المظهر القياسي المستقر بحواف متوازنة وتناسق مريح.'
                : 'Standard stable styling with balanced edges and comfortable contrast.'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleStyleChange('xiaomi')}
            className={cn(
              "p-3.5 sm:p-4 rounded-xl border-2 text-start transition-all relative active:scale-98",
              pendingStyle === 'xiaomi'
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/60 bg-muted/40 hover:bg-muted/70"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-foreground">
                  {isRTL ? 'مظهر شاومي (Xiaomi HyperOS)' : 'Xiaomi HyperOS'}
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-primary/20 text-primary text-[10px] font-bold">
                  HyperOS
                </span>
              </div>
              {pendingStyle === 'xiaomi' && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              {isRTL 
                ? 'زوايا دائرية ناعمة (Squircle) وتأثيرات زجاجية مستوحاة من واجهة HyperOS.'
                : 'Soft squircle corners and dynamic glass depth inspired by HyperOS.'}
            </p>
          </button>
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          {t('settings.colorTheme')}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {colorOptions.map(([key, value]) => (
            <button
              key={key}
              onClick={() => handleColorChange(key)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all",
                pendingColor === key
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-muted hover:bg-muted/80"
              )}
              title={isRTL ? value.nameAr : value.name}
            >
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-md shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(${value.primary}), hsl(${value.accent}))`
                }}
              />
              <span className="text-[11px] sm:text-xs font-medium text-foreground truncate w-full text-center">
                {isRTL ? value.nameAr : value.name}
              </span>
              {pendingColor === key && (
                <div className="absolute top-1 left-1 rtl:left-auto rtl:right-1">
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
                max={100}
                step={10}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>{isRTL ? '10% (خفيف)' : '10% (Subtle)'}</span>
                <span>{isRTL ? '50% (متوسط)' : '50% (Medium)'}</span>
                <span>{isRTL ? '80% (قوي)' : '80% (Strong)'}</span>
                <span>{isRTL ? '100% (زجاجي فائق)' : '100% (Ultra Glass)'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* وضع الأداء والسرعة (Lite Mode للأجهزة الضعيفة) */}
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              effectivePerf === 'lite' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"
            )}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">
                {isRTL ? 'وضع الأداء والسرعة' : 'Performance Mode'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isRTL 
                  ? 'تحسين سرعة الاستجابة على الأجهزة الضعيفة والمتوسطة عبر إيقاف التمويه والرسوميات الثقيلة'
                  : 'Optimize responsiveness on low-end devices by disabling blur and heavy GPU animations'}
              </p>
            </div>
          </div>
          <span className={cn(
            "text-xs px-2.5 py-1 rounded-full font-bold border",
            effectivePerf === 'lite'
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          )}>
            {effectivePerf === 'lite' ? (isRTL ? 'وضع خفيف نشط ⚡' : 'Lite Active ⚡') : (isRTL ? 'مؤثرات كاملة ✨' : 'Full Effects ✨')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {[
            {
              id: 'auto' as PerformanceModePref,
              label: isRTL ? 'تلقائي ذكي' : 'Auto Detect',
              desc: isRTL ? 'يكتشف مواصفات الجهاز تلقائياً' : 'Detects device hardware',
              icon: Cpu,
            },
            {
              id: 'lite' as PerformanceModePref,
              label: isRTL ? 'أداء خفيف (Lite)' : 'Lite Performance',
              desc: isRTL ? 'سرعة فائقة وإلغاء التمويه' : 'Max speed & no blur',
              icon: Zap,
            },
            {
              id: 'full' as PerformanceModePref,
              label: isRTL ? 'مؤثرات كاملة' : 'Full Effects',
              desc: isRTL ? 'شفافية ورسوميات سلسة' : 'Glass blur & full animations',
              icon: Sparkles,
            },
          ].map((item) => {
            const isSelected = perfPref === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPerfPref(item.id)}
                className={cn(
                  "p-3 rounded-xl border text-start transition-all flex flex-col gap-1.5",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border bg-card hover:bg-muted/60 text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    {item.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
