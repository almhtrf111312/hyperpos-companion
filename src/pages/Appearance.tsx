import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useTheme, ThemeColor, themeColors } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import {
  Moon,
  Sun,
  Palette,
  Sparkles,
  Check,
  Droplets
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Appearance() {
  const {
    mode,
    color,
    blurEnabled,
    setMode,
    setColor,
    setBlurEnabled
  } = useTheme();

  const [blurOpacity, setBlurOpacity] = useState(50);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleColorChange = (newColor: ThemeColor) => {
    setColor(newColor);
    toast({
      title: "تم التغيير",
      description: `تم تغيير لون الثيم إلى ${themeColors[newColor].nameAr}`
    });
  };

  const handleBlurToggle = (enabled: boolean) => {
    setBlurEnabled(enabled);
    toast({
      title: enabled ? "تم تفعيل البلور" : "تم إيقاف البلور",
      description: enabled ? "تأثير الشفافية مفعل الآن" : "التأثير معطل"
    });
  };

  const handleOpacityChange = (value: number[]) => {
    const newOpacity = value[0];
    setBlurOpacity(newOpacity);
    // تطبيق الشفافية على CSS Variables
    const root = document.documentElement;
    const opacityDecimal = newOpacity / 100;
    root.style.setProperty('--glass-opacity', opacityDecimal.toString());

    if (blurEnabled) {
      const currentBg = getComputedStyle(root).getPropertyValue('--glass-bg');
      const newBg = currentBg.replace(/[\d.]+\)$/, `${opacityDecimal})`);
      root.style.setProperty('--glass-bg', newBg);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">المظهر</h1>
      </div>

      {/* الوضع (فاتح/داكن) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {mode === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            الوضع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'light' ? 'default' : 'outline'}
              onClick={() => setMode('light')}
              className="flex-1 gap-2"
            >
              <Sun className="h-4 w-4" />
              فاتح
            </Button>
            <Button
              variant={mode === 'dark' ? 'default' : 'outline'}
              onClick={() => setMode('dark')}
              className="flex-1 gap-2"
            >
              <Moon className="h-4 w-4" />
              داكن
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* لون الثيم */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5" />
            لون الثيم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-5'}`}>
            {(Object.keys(themeColors) as ThemeColor[]).map((colorKey) => {
              const colorData = themeColors[colorKey];
              const isSelected = color === colorKey;

              return (
                <Button
                  key={colorKey}
                  variant="outline"
                  onClick={() => handleColorChange(colorKey)}
                  className={`
                    h-auto py-3 px-4 flex items-center gap-3 justify-start
                    ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                >
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{
                      background: `hsl(${colorData.primary})`,
                      boxShadow: `0 0 0 2px hsl(${colorData.primary} / 0.3)`
                    }}
                  />
                  <span className="text-sm">{colorData.nameAr}</span>
                  {isSelected && <Check className="h-4 w-4 mr-auto text-primary" />}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* تأثير البلور (Glassmorphism) - زر واحد فقط */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            تأثير البلور
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* تفعيل/إيقاف */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">تفعيل تأثير البلور</Label>
              <p className="text-sm text-muted-foreground">
                تفعيل خلفية شفافة ضبابية للبطاقات
              </p>
            </div>
            <Switch
              checked={blurEnabled}
              onCheckedChange={handleBlurToggle}
            />
          </div>

          {/* نسبة الشفافية - تظهر فقط عند تفعيل البلور */}
          {blurEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                <Label>نسبة الشفافية: {blurOpacity}%</Label>
              </div>

              <Slider
                value={[blurOpacity]}
                onValueChange={handleOpacityChange}
                min={10}
                max={90}
                step={10}
                className="w-full"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10%</span>
                <span>30%</span>
                <span>50%</span>
                <span>70%</span>
                <span>90%</span>
              </div>

              {/* معاينة */}
              <div
                className="p-4 rounded-lg border mt-4"
                style={{
                  background: `rgba(var(--background), ${blurOpacity / 100})`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <p className="text-sm text-center text-muted-foreground">
                  معاينة الشفافية
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* معاينة عامة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">معاينة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm font-medium">بطاقة عادية</p>
              <p className="text-xs text-muted-foreground">نص تجريبي</p>
            </div>
            <div className="p-4 rounded-lg border bg-primary/10">
              <p className="text-sm font-medium text-primary">بطاقة ملونة</p>
              <p className="text-xs text-muted-foreground">نص تجريبي</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
