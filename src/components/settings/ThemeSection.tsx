import { useState } from 'react';
import { Sun, Moon, Palette, Check, Save } from 'lucide-react';
import { useTheme, themeColors, ThemeColor, ThemeMode } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ThemeSection() {
  const { mode, color, setTheme } = useTheme();
  const { t } = useLanguage();
  
  // الحالة المؤقتة للتغييرات (لا تُحفظ حتى الضغط على زر الحفظ)
  const [pendingMode, setPendingMode] = useState<ThemeMode>(mode);
  const [pendingColor, setPendingColor] = useState<ThemeColor>(color);
  const [hasChanges, setHasChanges] = useState(false);

  const colorOptions = Object.entries(themeColors) as [ThemeColor, typeof themeColors[ThemeColor]][];

  const handleModeChange = (newMode: ThemeMode) => {
    setPendingMode(newMode);
    setHasChanges(newMode !== mode || pendingColor !== color);
  };

  const handleColorChange = (newColor: ThemeColor) => {
    setPendingColor(newColor);
    setHasChanges(pendingMode !== mode || newColor !== color);
  };

  const handleSave = () => {
    setTheme(pendingMode, pendingColor);
    setHasChanges(false);
    toast.success(t('settings.languageChanged'));
  };

  const handleCancel = () => {
    setPendingMode(mode);
    setPendingColor(color);
    setHasChanges(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
      {/* Save/Cancel Buttons - Above theme options */}
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
          {/* Light Mode */}
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
            <span className="font-medium text-foreground">
              {t('settings.lightMode')}
            </span>
            {pendingMode === 'light' && (
              <div className="absolute top-2 left-2">
                <Check className="w-5 h-5 text-primary" />
              </div>
            )}
          </button>

          {/* Dark Mode */}
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
            <span className="font-medium text-foreground">
              {t('settings.darkMode')}
            </span>
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

    </div>
  );
}
