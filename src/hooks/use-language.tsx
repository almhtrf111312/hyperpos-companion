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
import { getTerminology, getCurrentStoreType, TerminologyKey } from '@/lib/store-type-config';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  tDynamic: (key: TerminologyKey) => string;
  storeType: string;
  languages: LanguageInfo[];
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// RTL languages from the supported list
const RTL_LANGUAGES: Language[] = ['ar', 'fa', 'ku'];

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getCurrentLanguage);

  // ✅ Auto-detect system language on mount
  useEffect(() => {
    const initLanguage = async () => {
      const savedLang = getCurrentLanguage();

      if ((savedLang as string) === 'auto') {
        const systemLang = await getSystemLanguage();
        const mappedLang = mapSystemLanguage(systemLang);
        setLanguageState(mappedLang);
        const langInfo = languages.find(l => l.code === mappedLang);
        document.documentElement.dir = langInfo?.direction || 'rtl';
      } else {
        const langInfo = languages.find(l => l.code === savedLang);
        document.documentElement.dir = langInfo?.direction || 'rtl';
      }
    };

    initLanguage();

    // ✅ Listen for system language changes (when user returns from Settings)
    setupSystemLanguageListener(async (newLang) => {
      const savedLang = getCurrentLanguage();
      if ((savedLang as string) === 'auto') {
        setLanguageState(newLang as Language);
        const langInfo = languages.find(l => l.code === newLang);
        document.documentElement.dir = langInfo?.direction || 'rtl';
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

  const storeType = getCurrentStoreType();

  const tDynamic = useCallback((key: TerminologyKey) => {
    return getTerminology(storeType, key, language);
  }, [language, storeType]);

  const direction = languages.find(l => l.code === language)?.direction || 'rtl';
  const isRTL = RTL_LANGUAGES.includes(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tDynamic, storeType, languages, direction, isRTL }}>
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
