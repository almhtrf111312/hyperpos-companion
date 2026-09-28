import { useState, useEffect, useCallback } from 'react';
import {
  AppFontId,
  AppFontOption,
  APP_FONTS,
  DEFAULT_APP_FONT_ID,
  APP_FONT_STORAGE_KEY,
  APP_FONT_CHANGED_EVENT,
  getStoredAppFont,
  setStoredAppFont,
  applyAppFontToDOM,
  isValidAppFontId,
} from '@/lib/app-font-config';

export function useAppFont() {
  const [currentFont, setCurrentFontState] = useState<AppFontId>(() => getStoredAppFont());

  useEffect(() => {
    // Ensure DOM attribute is in sync on mount
    applyAppFontToDOM(currentFont);

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ fontId: AppFontId }>;
      if (customEvent.detail && isValidAppFontId(customEvent.detail.fontId)) {
        setCurrentFontState(customEvent.detail.fontId);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === APP_FONT_STORAGE_KEY && isValidAppFontId(e.newValue)) {
        setCurrentFontState(e.newValue);
        applyAppFontToDOM(e.newValue);
      }
    };

    window.addEventListener(APP_FONT_CHANGED_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(APP_FONT_CHANGED_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentFont]);

  const setFont = useCallback((fontId: AppFontId) => {
    if (!isValidAppFontId(fontId)) return;
    setCurrentFontState(fontId);
    setStoredAppFont(fontId);
  }, []);

  const currentFontConfig = APP_FONTS.find((f) => f.id === currentFont) || APP_FONTS[0];

  return {
    currentFont,
    setFont,
    availableFonts: APP_FONTS,
    currentFontConfig,
    isDefault: currentFont === DEFAULT_APP_FONT_ID,
  };
}
