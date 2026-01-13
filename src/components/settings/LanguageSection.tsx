import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Language } from '@/lib/i18n';

export function LanguageSection() {
  const { language, setLanguage, t, languages } = useLanguage();

  const handleLanguageChange = (value: string) => {
    setLanguage(value as Language);
    toast.success(t('settings.languageChanged'));
  };

  const currentLanguage = languages.find(l => l.code === language);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('settings.language')}</CardTitle>
            <CardDescription>{t('settings.selectLanguage')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full h-12">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentLanguage?.nativeName}</span>
                <span className="text-muted-foreground">({currentLanguage?.name})</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent 
            side="bottom" 
            align="start"
            className="max-h-[300px] overflow-y-auto z-50"
            position="popper"
            sideOffset={4}
          >
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} className="py-3">
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{lang.nativeName}</span>
                    <span className="text-muted-foreground text-sm">({lang.name})</span>
                  </div>
                  {language === lang.code && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
