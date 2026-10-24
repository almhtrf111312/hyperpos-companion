import { useSyncExternalStore, useMemo } from 'react';
import {
  getMoneyState,
  subscribeMoneyState,
  getCurrencyDef,
  normalizeCurrencyCode,
  fromUsd,
  toUsd,
  formatActive,
} from '@/lib/money-engine';

export interface EnabledCurrencies {
  USD: boolean;
  TRY: boolean;
  SYP: boolean;
  [key: string]: boolean;
}

export interface CurrencySymbols {
  USD: string;
  TRY: string;
  SYP: string;
  [key: string]: string;
}

export interface CurrencyNames {
  USD: string;
  TRY: string;
  SYP: string;
  [key: string]: string;
}

export const loadExchangeRates = (): Record<string, number> => {
  const state = getMoneyState();
  const rates: Record<string, number> = { TRY: 34, SYP: 14500 };
  for (const [code, def] of Object.entries(state.currencies)) {
    rates[code] = def.rate;
  }
  return rates;
};

export const loadCurrencySymbols = (): CurrencySymbols => {
  const state = getMoneyState();
  const syms: Record<string, string> = { USD: '$', TRY: '₺', SYP: 'ل.س' };
  for (const [code, def] of Object.entries(state.currencies)) {
    syms[code] = def.symbol;
  }
  return syms as CurrencySymbols;
};

export const loadCurrencyNames = (): CurrencyNames => {
  const state = getMoneyState();
  const names: Record<string, string> = { USD: 'دولار', TRY: 'ليرة تركية', SYP: 'ليرة سورية' };
  for (const [code, def] of Object.entries(state.currencies)) {
    names[code] = def.name;
  }
  return names as CurrencyNames;
};

export const loadDefaultCurrencyCode = (): string => {
  return getMoneyState().activeCode;
};

export const loadEnabledCurrencies = (): EnabledCurrencies => {
  const state = getMoneyState();
  const enabled: Record<string, boolean> = { USD: true, TRY: true, SYP: true };
  for (const [code, def] of Object.entries(state.currencies)) {
    enabled[code] = def.enabled;
  }
  return enabled as EnabledCurrencies;
};

export const useCurrency = () => {
  const state = useSyncExternalStore(subscribeMoneyState, getMoneyState, getMoneyState);

  return useMemo(() => {
    const active = getCurrencyDef(state.activeCode);
    const rates: Record<string, number> = { TRY: 34, SYP: 14500 };
    const symbols: Record<string, string> = { USD: '$', TRY: '₺', SYP: 'ل.س' };
    const names: Record<string, string> = { USD: 'دولار', TRY: 'ليرة تركية', SYP: 'ليرة سورية' };
    const enabled: Record<string, boolean> = { USD: true, TRY: true, SYP: true };

    for (const [code, def] of Object.entries(state.currencies)) {
      rates[code] = def.rate;
      symbols[code] = def.symbol;
      names[code] = def.name;
      enabled[code] = def.enabled;
    }

    return {
      currencyCode: active.code,
      currencySymbol: active.symbol,
      currencyName: active.name,
      exchangeRate: active.rate,
      exchangeRates: rates,
      currencySymbols: symbols as CurrencySymbols,
      currencyNames: names as CurrencyNames,
      enabledCurrencies: enabled as EnabledCurrencies,
      decimals: active.decimals,
      convertFromUSD: (usd: number, code?: string) => fromUsd(usd, code || active.code),
      convertToUSD: (amount: number, code?: string) => toUsd(amount, code || active.code),
      formatPrice: (usd: number) => formatActive(usd),
    };
  }, [state]);
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
  const code = normalizeCurrencyCode(currencyCode || 'USD');
  const def = getCurrencyDef(code);

  const rate = customRate !== undefined && customRate > 0 ? customRate : def.rate;
  const symbol = customSymbol || def.symbol;

  const convertedValue = (usdAmount || 0) * (rate || 1);
  const decimals = def.decimals;

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
