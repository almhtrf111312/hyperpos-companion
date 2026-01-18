import { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Globe, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Language } from '@/lib/i18n';

export function LanguageSection() {
  const { language, setLanguage, t, languages } = useLanguage();
  
  // الحالة المؤقتة للغة (لا تُحفظ حتى الضغط على زر الحفظ)
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const hasChanges = pendingLanguage !== language;

  const handleLanguageSelect = (value: string) => {
    setPendingLanguage(value as Language);
  };

  const handleSave = () => {
    setLanguage(pendingLanguage);
    toast.success(t('settings.languageChanged'));
  };

  const handleCancel = () => {
    setPendingLanguage(language);
  };

  const selectedLanguage = languages.find(l => l.code === pendingLanguage);

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
      <CardContent className="space-y-4">
        <Select value={pendingLanguage} onValueChange={handleLanguageSelect}>
          <SelectTrigger className="w-full h-12">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedLanguage?.nativeName}</span>
                <span className="text-muted-foreground">({selectedLanguage?.name})</span>
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
                  {pendingLanguage === lang.code && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Save/Cancel Buttons */}
        {hasChanges && (
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 ml-2" />
              {t('common.save')}
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
