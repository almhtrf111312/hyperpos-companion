import { useLanguage } from '@/hooks/use-language';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Language } from '@/lib/i18n';

export function LanguageQuickSelector() {
  const { language, setLanguage, languages } = useLanguage();
  const selectedLanguage = languages.find(l => l.code === language);

  return (
    <div className="flex justify-center z-10">
      <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
        <SelectTrigger className="w-auto min-w-[130px] h-10 text-sm border-border/50 bg-background/80 backdrop-blur-sm">
          <SelectValue>
            <span>{selectedLanguage?.nativeName}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4} className="z-50">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-sm">
              <span className="font-medium">{lang.nativeName}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
