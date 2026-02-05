import { ThemeSection } from '@/components/settings/ThemeSection';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/hooks/use-language';

export default function Appearance() {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          {t('settings.theme')}
        </h1>
        <ThemeSection />
      </div>
    </MainLayout>
  );
}
