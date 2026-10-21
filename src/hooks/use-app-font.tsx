import { useState, useEffect, useCallback } from 'react';
import {
  AppFontId,
  AppFontOption,
  APP_FONTS,
  DEFAULT_APP_FONT_ID,
  APP_FONT_STORAGE_KEY,
  LEGACY_APP_FONT_STORAGE_KEY,
  getAppFontStorageKey,
  APP_FONT_CHANGED_EVENT,
  getStoredAppFont,
  setStoredAppFont,
  applyAppFontToDOM,
  isValidAppFontId,
} from '@/lib/app-font-config';
import { EVENTS } from '@/lib/events';

export function useAppFont() {
  const [currentFont, setCurrentFontState] = useState<AppFontId>(() => {
    const font = getStoredAppFont();
    applyAppFontToDOM(font);
    return font;
  });

  useEffect(() => {
    // Ensure DOM attribute is in sync on mount
    applyAppFontToDOM(currentFont);

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ fontId: AppFontId }>;
      if (customEvent.detail && isValidAppFontId(customEvent.detail.fontId)) {
        setCurrentFontState(customEvent.detail.fontId);
        applyAppFontToDOM(customEvent.detail.fontId);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      const activeKey = getAppFontStorageKey();
      if ((e.key === activeKey || e.key === APP_FONT_STORAGE_KEY || e.key === LEGACY_APP_FONT_STORAGE_KEY) && isValidAppFontId(e.newValue)) {
        setCurrentFontState(e.newValue);
        applyAppFontToDOM(e.newValue);
      }
    };

    const handleSettingsUpdated = () => {
      const stored = getStoredAppFont();
      setCurrentFontState(stored);
      applyAppFontToDOM(stored);
    };

    window.addEventListener(APP_FONT_CHANGED_EVENT, handleCustomChange);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(APP_FONT_CHANGED_EVENT, handleCustomChange);
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
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
    previewFont: applyAppFontToDOM,
    revertFont: () => applyAppFontToDOM(currentFont),
    availableFonts: APP_FONTS,
    currentFontConfig,
    isDefault: currentFont === DEFAULT_APP_FONT_ID,
  };
}
