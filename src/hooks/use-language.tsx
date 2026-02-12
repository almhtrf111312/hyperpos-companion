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
import { getSystemLanguage, mapSystemLanguage, setupSystemLanguageListener } from '@/lib/system-language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  languages: LanguageInfo[];
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// RTL languages from the supported list
const RTL_LANGUAGES: Language[] = ['ar'];

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getCurrentLanguage);

  // ✅ Auto-detect system language on mount
  useEffect(() => {
    const initLanguage = async () => {
      const savedLang = getCurrentLanguage();

      if (savedLang === 'auto') {
        const systemLang = await getSystemLanguage();
        const mappedLang = mapSystemLanguage(systemLang);
        setLanguageState(mappedLang);
        document.documentElement.dir = mappedLang === 'ar' ? 'rtl' : 'ltr';
      } else {
        document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
      }
    };

    initLanguage();

    // ✅ Listen for system language changes (when user returns from Settings)
    setupSystemLanguageListener(async (newLang) => {
      const savedLang = getCurrentLanguage();
      if (savedLang === 'auto') {
        setLanguageState(newLang as Language);
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      }
    });
  }, []);

  useEffect(() => {
    initializeLanguage();
  }, []);

  // Apply RTL/LTR styles to document
  useEffect(() => {
    const isRTL = RTL_LANGUAGES.includes(language);

    // Set document direction
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;

    // Add/remove RTL class for CSS targeting
    if (isRTL) {
      document.documentElement.classList.add('rtl');
      document.documentElement.classList.remove('ltr');
    } else {
      document.documentElement.classList.add('ltr');
      document.documentElement.classList.remove('rtl');
    }

    // Update meta for proper rendering
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }
  }, [language]);

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
  const isRTL = RTL_LANGUAGES.includes(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages, direction, isRTL }}>
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
