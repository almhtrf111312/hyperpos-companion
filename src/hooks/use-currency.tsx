import { useState, useEffect, useMemo } from 'react';
import { EVENTS } from '@/lib/events';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

export interface EnabledCurrencies {
  USD: boolean;
  TRY: boolean;
  SYP: boolean;
}

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
    const primary = parsed?.primaryCurrency || 'USD';
    const enabled = parsed?.enabledCurrencies;
    // If primary currency is disabled, fallback to first enabled currency
    if (enabled && enabled[primary] === false) {
      if (enabled.USD !== false) return 'USD';
      if (enabled.TRY) return 'TRY';
      if (enabled.SYP) return 'SYP';
    }
    return primary;
  } catch {
    return 'USD';
  }
};

export const loadEnabledCurrencies = (): EnabledCurrencies => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { USD: true, TRY: true, SYP: true };
    const parsed = JSON.parse(raw);
    const enabled = parsed?.enabledCurrencies;
    return {
      USD: true,
      TRY: enabled?.TRY !== false,
      SYP: enabled?.SYP !== false,
    };
  } catch {
    return { USD: true, TRY: true, SYP: true };
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
    const enabled = loadEnabledCurrencies();
    let symbol = '$';
    let rate = 1;
    if (code === 'TRY') { symbol = '₺'; rate = rates.TRY; }
    else if (code === 'SYP') { symbol = 'ل.س'; rate = rates.SYP; }
    return {
      currencyCode: code,
      currencySymbol: symbol,
      exchangeRate: rate,
      enabledCurrencies: enabled,
    };
  }, [settingsRev]);
};
