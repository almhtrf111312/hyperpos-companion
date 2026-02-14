import { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Globe, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Language } from '@/lib/i18n';

export function LanguageSection() {
  const { language, setLanguage, t, languages } = useLanguage();
  
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('settings.language')}</span>
        </div>
        <Select value={pendingLanguage} onValueChange={handleLanguageSelect}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue>
              <span className="text-sm">{selectedLanguage?.nativeName}</span>
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
              <SelectItem key={lang.code} value={lang.code} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{lang.nativeName}</span>
                  <span className="text-muted-foreground text-xs">({lang.name})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasChanges && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} className="flex-1 h-8">
            <Save className="w-3 h-3 ml-1" />
            {t('common.save')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel} className="flex-1 h-8">
            {t('common.cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}
