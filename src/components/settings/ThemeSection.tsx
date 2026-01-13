import { Sun, Moon, Palette, Check } from 'lucide-react';
import { useTheme, themeColors, ThemeColor } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export function ThemeSection() {
  const { mode, color, setMode, setColor } = useTheme();

  const colorOptions = Object.entries(themeColors) as [ThemeColor, typeof themeColors[ThemeColor]][];

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">
          المظهر
        </h2>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Light Mode */}
          <button
            onClick={() => setMode('light')}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
              mode === 'light'
                ? "border-primary bg-primary/10"
                : "border-border bg-muted hover:bg-muted/80"
            )}
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              mode === 'light' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              <Sun className="w-8 h-8" />
            </div>
            <span className="font-medium text-foreground">
              الوضع النهاري
            </span>
            {mode === 'light' && (
              <div className="absolute top-2 left-2">
                <Check className="w-5 h-5 text-primary" />
              </div>
            )}
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => setMode('dark')}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
              mode === 'dark'
                ? "border-primary bg-primary/10"
                : "border-border bg-muted hover:bg-muted/80"
            )}
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              mode === 'dark' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              <Moon className="w-8 h-8" />
            </div>
            <span className="font-medium text-foreground">
              الوضع الليلي
            </span>
            {mode === 'dark' && (
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
          لون التطبيق
        </h3>
        
        <div className="grid grid-cols-5 gap-3">
          {colorOptions.map(([key, value]) => (
            <button
              key={key}
              onClick={() => setColor(key)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                color === key
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
              {color === key && (
                <div className="absolute top-1 left-1">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-muted border border-border">
        <p className="text-sm text-muted-foreground mb-3">
          معاينة المظهر
        </p>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm">
            حفظ
          </button>
          <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium text-sm">
            إلغاء
          </button>
          <button className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium text-sm">
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
