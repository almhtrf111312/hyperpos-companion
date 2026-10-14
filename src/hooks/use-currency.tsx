import { useState, useEffect, useMemo } from 'react';
import { EVENTS } from '@/lib/events';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

export interface EnabledCurrencies {
  USD: boolean;
  TRY: boolean;
  SYP: boolean;
}

export interface CurrencySymbols {
  USD: string;
  TRY: string;
  SYP: string;
}

export interface CurrencyNames {
  USD: string;
  TRY: string;
  SYP: string;
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

export const loadCurrencySymbols = (): CurrencySymbols => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { USD: '$', TRY: '₺', SYP: 'ل.س' };
    const parsed = JSON.parse(raw);
    const syms = parsed?.currencySymbols;
    return {
      USD: '$',
      TRY: (syms?.TRY && typeof syms.TRY === 'string') ? syms.TRY : '₺',
      SYP: (syms?.SYP && typeof syms.SYP === 'string') ? syms.SYP : 'ل.س',
    };
  } catch {
    return { USD: '$', TRY: '₺', SYP: 'ل.س' };
  }
};

export const loadCurrencyNames = (): CurrencyNames => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { USD: 'دولار', TRY: 'ليرة تركية', SYP: 'ليرة سورية' };
    const parsed = JSON.parse(raw);
    const names = parsed?.currencyNames;
    return {
      USD: names?.USD || 'دولار',
      TRY: names?.TRY || 'ليرة تركية',
      SYP: names?.SYP || 'ليرة سورية',
    };
  } catch {
    return { USD: 'دولار', TRY: 'ليرة تركية', SYP: 'ليرة سورية' };
  }
};

export const loadDefaultCurrencyCode = (): 'USD' | 'TRY' | 'SYP' => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return 'USD';
    const parsed = JSON.parse(raw);
    const primary = (parsed?.primaryCurrency as 'USD' | 'TRY' | 'SYP') || 'USD';
    const enabled = parsed?.enabledCurrencies;
    // If primary currency is disabled, fallback to first enabled currency
    if (enabled && enabled[primary] === false) {
      if (enabled.TRY) return 'TRY';
      if (enabled.SYP) return 'SYP';
      if (enabled.USD !== false) return 'USD';
    }
    // If primary is USD but USD is disabled in settings, fallback to enabled local currency
    if (primary === 'USD' && enabled && enabled.USD === false) {
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
    const isUsd = enabled?.USD !== false;
    const isTry = enabled?.TRY !== false;
    const isSyp = enabled?.SYP !== false;
    // Ensure at least one currency is enabled
    if (!isUsd && !isTry && !isSyp) {
      return { USD: true, TRY: false, SYP: false };
    }
    return {
      USD: isUsd,
      TRY: isTry,
      SYP: isSyp,
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
    const symbols = loadCurrencySymbols();
    const names = loadCurrencyNames();

    let symbol = '$';
    let rate = 1;
    let name = 'دولار';
    if (code === 'TRY') {
      symbol = symbols.TRY;
      rate = rates.TRY;
      name = names.TRY;
    } else if (code === 'SYP') {
      symbol = symbols.SYP;
      rate = rates.SYP;
      name = names.SYP;
    }

    const decimals = rate >= 100 ? 0 : 2;

    return {
      currencyCode: code,
      currencySymbol: symbol,
      currencyName: name,
      exchangeRate: rate,
      exchangeRates: rates,
      currencySymbols: symbols,
      currencyNames: names,
      enabledCurrencies: enabled,
      decimals,
    };
  }, [settingsRev]);
};
