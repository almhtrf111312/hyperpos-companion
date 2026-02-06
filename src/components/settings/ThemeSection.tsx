import { useState } from 'react';
import { Sun, Moon, Palette, Check, Save, Blend } from 'lucide-react';
import { useTheme, themeColors, ThemeColor, ThemeMode } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export function ThemeSection() {
  const { mode, color, blurEnabled, transparencyLevel, setFullTheme } = useTheme();
  const { t } = useLanguage();
  
  const [pendingMode, setPendingMode] = useState<ThemeMode>(mode);
  const [pendingColor, setPendingColor] = useState<ThemeColor>(color);
  const [pendingBlur, setPendingBlur] = useState<boolean>(blurEnabled);
  const [pendingTransparency, setPendingTransparency] = useState<number>(transparencyLevel);
  const [hasChanges, setHasChanges] = useState(false);

  const colorOptions = Object.entries(themeColors) as [ThemeColor, typeof themeColors[ThemeColor]][];

  const checkChanges = (m: ThemeMode, c: ThemeColor, b: boolean, tr: number) => {
    setHasChanges(m !== mode || c !== color || b !== blurEnabled || tr !== transparencyLevel);
  };

  const handleModeChange = (newMode: ThemeMode) => {
    setPendingMode(newMode);
    checkChanges(newMode, pendingColor, pendingBlur, pendingTransparency);
  };

  const handleColorChange = (newColor: ThemeColor) => {
    setPendingColor(newColor);
    checkChanges(pendingMode, newColor, pendingBlur, pendingTransparency);
  };

  const handleBlurChange = (enabled: boolean) => {
    setPendingBlur(enabled);
    if (!enabled) {
      setPendingTransparency(0);
      checkChanges(pendingMode, pendingColor, false, 0);
    } else {
      if (pendingTransparency === 0) setPendingTransparency(30);
      checkChanges(pendingMode, pendingColor, true, pendingTransparency || 30);
    }
  };

  const handleTransparencyChange = (value: number[]) => {
    const val = value[0];
    setPendingTransparency(val);
    checkChanges(pendingMode, pendingColor, pendingBlur, val);
  };

  const handleSave = () => {
    setFullTheme(pendingMode, pendingColor, pendingBlur, pendingTransparency);
    setHasChanges(false);
    toast.success(t('settings.languageChanged'));
  };

  const handleCancel = () => {
    setPendingMode(mode);
    setPendingColor(color);
    setPendingBlur(blurEnabled);
    setPendingTransparency(transparencyLevel);
    setHasChanges(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
      {hasChanges && (
        <div className="flex gap-3 pb-4 border-b border-border">
          <Button onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4 ml-2" />
            {t('common.save')}
          </Button>
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            {t('common.cancel')}
          </Button>
        </div>
      )}

      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">
          {t('settings.theme')}
        </h2>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleModeChange('light')}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all relative",
              pendingMode === 'light'
                ? "border-primary bg-primary/10"
                : "border-border bg-muted hover:bg-muted/80"
            )}
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              pendingMode === 'light' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              <Sun className="w-8 h-8" />
            </div>
            <span className="font-medium text-foreground">{t('settings.lightMode')}</span>
            {pendingMode === 'light' && (
              <div className="absolute top-2 left-2">
                <Check className="w-5 h-5 text-primary" />
              </div>
            )}
          </button>

          <button
            onClick={() => handleModeChange('dark')}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all relative",
              pendingMode === 'dark'
                ? "border-primary bg-primary/10"
                : "border-border bg-muted hover:bg-muted/80"
            )}
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              pendingMode === 'dark' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              <Moon className="w-8 h-8" />
            </div>
            <span className="font-medium text-foreground">{t('settings.darkMode')}</span>
            {pendingMode === 'dark' && (
              <div className="absolute top-2 left-2">
                <Check className="w-5 h-5 text-primary" />
              </div>
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
              <span className="text-xs font-medium text-foreground truncate w-full text-center">
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
          <div className="space-y-3 pr-13">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('settings.transparencyLevel')}</span>
              <span className="font-medium text-foreground">{pendingTransparency}%</span>
            </div>
            <Slider
              value={[pendingTransparency]}
              onValueChange={handleTransparencyChange}
              min={10}
              max={90}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span>
              <span>50%</span>
              <span>90%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
