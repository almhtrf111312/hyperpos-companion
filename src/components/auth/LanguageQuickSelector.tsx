import { useLanguage } from '@/hooks/use-language';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Language } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export function LanguageQuickSelector() {
  const { language, setLanguage, languages } = useLanguage();
  const selectedLanguage = languages.find(l => l.code === language);

  return (
    <div className="absolute top-4 end-4 z-50">
      <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
        <SelectTrigger className="w-auto min-h-8 px-2.5 gap-1.5 text-xs font-medium border-border/40 bg-background/90 hover:bg-background shadow-sm rounded-full transition-colors cursor-pointer">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <SelectValue>
            <span>{selectedLanguage?.nativeName}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" position="popper" sideOffset={6} className="z-50 min-w-[8.6rem]">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-xs cursor-pointer">
              <span className="font-medium">{lang.nativeName}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
