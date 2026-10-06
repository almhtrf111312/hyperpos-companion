import { useState, useEffect, useCallback } from 'react';
import {
  UIScaleId,
  UIScaleOption,
  UI_SCALE_OPTIONS,
  DEFAULT_UI_SCALE_ID,
  UI_SCALE_STORAGE_KEY,
  UI_SCALE_CHANGED_EVENT,
  getStoredUIScale,
  setStoredUIScale,
  applyUIScaleToDOM,
  isValidUIScaleId,
} from '@/lib/ui-scale-config';

export function useUIScale() {
  const [currentScale, setCurrentScaleState] = useState<UIScaleId>(() => {
    const scale = getStoredUIScale();
    applyUIScaleToDOM(scale);
    return scale;
  });

  useEffect(() => {
    // Ensure DOM attribute and style are in sync on mount
    applyUIScaleToDOM(currentScale);

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ scaleId: UIScaleId }>;
      if (customEvent.detail && isValidUIScaleId(customEvent.detail.scaleId)) {
        setCurrentScaleState(customEvent.detail.scaleId);
        applyUIScaleToDOM(customEvent.detail.scaleId);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === UI_SCALE_STORAGE_KEY && isValidUIScaleId(e.newValue)) {
        setCurrentScaleState(e.newValue);
        applyUIScaleToDOM(e.newValue);
      }
    };

    window.addEventListener(UI_SCALE_CHANGED_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(UI_SCALE_CHANGED_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentScale]);

  const setScale = useCallback((scaleId: UIScaleId) => {
    if (!isValidUIScaleId(scaleId)) return;
    setCurrentScaleState(scaleId);
    setStoredUIScale(scaleId);
  }, []);

  const currentScaleConfig =
    UI_SCALE_OPTIONS.find((s) => s.id === currentScale) || UI_SCALE_OPTIONS[2];

  return {
    currentScale,
    setScale,
    previewScale: applyUIScaleToDOM,
    availableScales: UI_SCALE_OPTIONS,
    currentScaleConfig,
    defaultScale: DEFAULT_UI_SCALE_ID,
  };
}
