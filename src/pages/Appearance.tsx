import { ThemeSection } from '@/components/settings/ThemeSection';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/hooks/use-language';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";

export default function Appearance() {
  const { t } = useLanguage();
  const { blurEnabled, setBlurEnabled } = useTheme();

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t('settings.theme')}
        </h1>

        <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label className="text-base font-medium">تأثير البلور (Glassmorphism)</Label>
            <p className="text-sm text-muted-foreground">
              تفعيل خلفية شفافة ضبابية للبطاقات والقوائم
            </p>
          </div>
          <Switch
            checked={blurEnabled}
            onCheckedChange={setBlurEnabled}
          />
        </div>

        <ThemeSection />
      </div>
    </MainLayout>
  );
}
