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
      USD: (syms?.USD && typeof syms.USD === 'string' && syms.USD.trim()) ? syms.USD.trim() : '$',
      TRY: (syms?.TRY && typeof syms.TRY === 'string' && syms.TRY.trim()) ? syms.TRY.trim() : '₺',
      SYP: (syms?.SYP && typeof syms.SYP === 'string' && syms.SYP.trim()) ? syms.SYP.trim() : 'ل.س',
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
      USD: (names?.USD && typeof names.USD === 'string' && names.USD.trim()) ? names.USD.trim() : 'دولار',
      TRY: (names?.TRY && typeof names.TRY === 'string' && names.TRY.trim()) ? names.TRY.trim() : 'ليرة تركية',
      SYP: (names?.SYP && typeof names.SYP === 'string' && names.SYP.trim()) ? names.SYP.trim() : 'ليرة سورية',
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
    return () => {
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
    };
  }, []);

  return useMemo(() => {
    const _ = settingsRev;
    const code = loadDefaultCurrencyCode();
    const rates = loadExchangeRates();
    const enabled = loadEnabledCurrencies();
    const symbols = loadCurrencySymbols();
    const names = loadCurrencyNames();

    let symbol = symbols.USD || '$';
    let rate = 1;
    let name = names.USD || 'دولار';
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


export interface FormattedCurrencyResult {
  formatted: string;
  convertedValue: number;
  usdEquivalent: string;
  symbol: string;
}

export function formatInCurrency(
  usdAmount: number,
  currencyCode: 'USD' | 'TRY' | 'SYP' | string = 'USD',
  customRate?: number,
  customSymbol?: string
): FormattedCurrencyResult {
  const rates = loadExchangeRates();
  const symbols = loadCurrencySymbols();
  const code = (currencyCode || 'USD') as 'USD' | 'TRY' | 'SYP';

  const rate = customRate !== undefined ? customRate : (code === 'TRY' ? rates.TRY : code === 'SYP' ? rates.SYP : 1);
  const symbol = customSymbol || symbols[code] || (code === 'USD' ? '$' : code);

  const convertedValue = (usdAmount || 0) * (rate || 1);
  const decimals = (rate >= 100 || code === 'SYP') ? 0 : 2;

  const formattedNum = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(convertedValue);

  const formatted = `${formattedNum} ${symbol}`;
  const usdFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdAmount || 0);
  const usdEquivalent = `= ${usdFormatted} $`;

  return { formatted, convertedValue, usdEquivalent, symbol };
}
