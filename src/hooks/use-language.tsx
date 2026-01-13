import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
  Language, 
  getCurrentLanguage, 
  setLanguage as setLangStorage, 
  t as translate,
  TranslationKey,
  initializeLanguage,
  languages,
  LanguageInfo
} from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  languages: LanguageInfo[];
  direction: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getCurrentLanguage);

  useEffect(() => {
    initializeLanguage();
  }, []);

  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent<Language>) => {
      setLanguageState(e.detail);
    };

    window.addEventListener('languagechange', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange as EventListener);
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLangStorage(lang);
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return translate(key, language);
  }, [language]);

  const direction = languages.find(l => l.code === language)?.direction || 'rtl';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages, direction }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
