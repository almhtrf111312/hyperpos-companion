import { useLanguage } from '@/hooks/use-language';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Language } from '@/lib/i18n';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageQuickSelectorProps {
  className?: string;
  isAbsolute?: boolean;
}

export function LanguageQuickSelector({ className, isAbsolute = false }: LanguageQuickSelectorProps = {}) {
  const { language, setLanguage, languages } = useLanguage();
  const selectedLanguage = languages.find(l => l.code === language);

  return (
    <div className={cn(isAbsolute ? "absolute top-4 end-4 z-50" : "relative z-20", className)}>
      <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
        <SelectTrigger className="w-auto min-h-9 px-3 gap-2 text-xs sm:text-sm font-bold border-border/80 bg-card hover:bg-muted shadow-sm rounded-xl transition-colors cursor-pointer">
          <Globe className="w-4 h-4 text-primary shrink-0" />
          <SelectValue>
            <span>{selectedLanguage?.nativeName}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" position="popper" sideOffset={6} className="z-50 min-w-[9rem] rounded-xl border-border bg-popover">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-xs sm:text-sm font-semibold cursor-pointer">
              <span>{lang.nativeName}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
