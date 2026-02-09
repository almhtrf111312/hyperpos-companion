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
import { supabase } from '@/integrations/supabase/client';

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

  // ✅ Auto-detect system language on mount and sync with cloud
  useEffect(() => {
    const initLanguage = async () => {
      // 1. Check cloud profile first if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', session.user.id)
          .single();

        if (profile?.preferred_language) {
          const lang = profile.preferred_language as Language;
          setLanguageState(lang);
          setLangStorage(lang);
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
          return;
        }
      }

      // 2. Fallback to local storage or system default
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

    // ✅ Listen for system language changes
    setupSystemLanguageListener(async (newLang) => {
      const savedLang = getCurrentLanguage();
      if (savedLang === 'auto') {
        setLanguageState(newLang as Language);
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      }
    });

    // ✅ Listen for Auth changes to load language
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', session.user.id)
          .single();

        if (profile?.preferred_language) {
          const lang = profile.preferred_language as Language;
          setLanguageState(lang);
          setLangStorage(lang);
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
