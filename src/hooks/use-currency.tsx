import { useState, useEffect, useMemo } from 'react';
import { EVENTS } from '@/lib/events';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

export const loadExchangeRates = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { TRY: 32, SYP: 14500 };
    const parsed = JSON.parse(raw);
    const ex = parsed?.exchangeRates;
    return {
      TRY: Number(ex?.TRY ?? 32),
      SYP: Number(ex?.SYP ?? 14500)
    };
  } catch {
    return { TRY: 32, SYP: 14500 };
  }
};

export const loadDefaultCurrencyCode = (): 'USD' | 'TRY' | 'SYP' => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return 'USD';
    const parsed = JSON.parse(raw);
    return parsed?.primaryCurrency || 'USD';
  } catch {
    return 'USD';
  }
};

export const useCurrency = () => {
  const [settingsRev, setSettingsRev] = useState(0);

  useEffect(() => {
    const handleSettings = () => setSettingsRev(r => r + 1);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
    window.addEventListener('settings-updated', handleSettings as EventListener);
    window.addEventListener('STORE_SETTINGS_UPDATED', handleSettings as EventListener);
    window.addEventListener('storage', handleSettings as EventListener);
    return () => {
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
      window.removeEventListener('settings-updated', handleSettings as EventListener);
      window.removeEventListener('STORE_SETTINGS_UPDATED', handleSettings as EventListener);
      window.removeEventListener('storage', handleSettings as EventListener);
    };
  }, []);

  return useMemo(() => {
    const _ = settingsRev;
    const code = loadDefaultCurrencyCode();
    const rates = loadExchangeRates();
    let symbol = '$';
    let rate = 1;
    if (code === 'TRY') { symbol = '₺'; rate = rates.TRY; }
    else if (code === 'SYP') { symbol = 'ل.س'; rate = rates.SYP; }
    return { currencyCode: code, currencySymbol: symbol, exchangeRate: rate };
  }, [settingsRev]);
};
