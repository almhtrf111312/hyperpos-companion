import { EVENTS } from '@/lib/events';

export interface CurrencyDefinition {
  code: string;
  symbol: string;
  name: string;
  rate: number;
  decimals: number;
  symbolPosition: 'before' | 'after';
  enabled: boolean;
  isCustom?: boolean;
}

export interface CurrencySnapshot {
  currency_code: string;
  currency_symbol: string;
  currency_name: string;
  exchange_rate: number;
  decimals: number;
}

export interface MoneyEngineState {
  activeCode: string;
  reportCode: string;
  currencies: Record<string, CurrencyDefinition>;
  inputPrefs: Record<string, string>;
  version: number;
}

const SETTINGS_KEY = 'hyperpos_settings_v1';
const SETTINGS_BACKUP_KEY = 'hyperpos_settings_v1_backup';
const REPORT_CURRENCY_KEY = 'hyperpos_report_currency';
const INPUT_PREFS_KEY = 'hyperpos_money_input_prefs_v1';

const ZERO_DECIMAL_CODES = new Set([
  'SYP', 'LBP', 'IQD', 'YER', 'DZD', 'JPY', 'IRR', 'KRW', 'VND', 'CLP', 'IDR',
]);

const THREE_DECIMAL_CODES = new Set([
  'KWD', 'BHD', 'OMR', 'JOD', 'TND', 'LYD',
]);

const SYMBOL_BEFORE_CODES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF',
]);

export function getDefaultDecimals(code: string): number {
  const upper = (code || 'USD').toUpperCase();
  if (ZERO_DECIMAL_CODES.has(upper)) return 0;
  if (THREE_DECIMAL_CODES.has(upper)) return 3;
  return 2;
}

export function getDefaultSymbolPosition(code: string, symbol?: string): 'before' | 'after' {
  const upper = (code || 'USD').toUpperCase();
  if (SYMBOL_BEFORE_CODES.has(upper)) return 'before';
  if (symbol === '$' || symbol === '€' || symbol === '£') return 'before';
  return 'after';
}

export function normalizeCurrencyCode(rawCode?: string | null): string {
  const clean = (rawCode || 'USD').trim().toUpperCase();
  if (!clean) return 'USD';
  if (clean === 'BHR') return 'BHD';
  return clean;
}

const DEFAULT_DEFINITIONS: Record<string, Omit<CurrencyDefinition, 'enabled'>> = {
  USD: { code: 'USD', symbol: '$', name: 'دولار أمريكي', rate: 1, decimals: 2, symbolPosition: 'before' },
  TRY: { code: 'TRY', symbol: '₺', name: 'ليرة تركية', rate: 34, decimals: 2, symbolPosition: 'after' },
  SYP: { code: 'SYP', symbol: 'ل.س', name: 'ليرة سورية', rate: 14500, decimals: 0, symbolPosition: 'after' },
  SAR: { code: 'SAR', symbol: 'ر.س', name: 'ريال سعودي', rate: 3.75, decimals: 2, symbolPosition: 'after' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'درهم إماراتي', rate: 3.67, decimals: 2, symbolPosition: 'after' },
  EGP: { code: 'EGP', symbol: 'ج.م', name: 'جنيه مصري', rate: 49, decimals: 2, symbolPosition: 'after' },
  IQD: { code: 'IQD', symbol: 'د.ع', name: 'دينار عراقي', rate: 1310, decimals: 0, symbolPosition: 'after' },
  JOD: { code: 'JOD', symbol: 'د.أ', name: 'دينار أردني', rate: 0.71, decimals: 3, symbolPosition: 'after' },
  LBP: { code: 'LBP', symbol: 'ل.ل', name: 'ليرة لبنانية', rate: 89500, decimals: 0, symbolPosition: 'after' },
  KWD: { code: 'KWD', symbol: 'د.ك', name: 'دينار كويتي', rate: 0.31, decimals: 3, symbolPosition: 'after' },
  QAR: { code: 'QAR', symbol: 'ر.ق', name: 'ريال قطري', rate: 3.64, decimals: 2, symbolPosition: 'after' },
  BHD: { code: 'BHD', symbol: 'د.ب', name: 'دينار بحريني', rate: 0.38, decimals: 3, symbolPosition: 'after' },
  OMR: { code: 'OMR', symbol: 'ر.ع', name: 'ريال عماني', rate: 0.38, decimals: 3, symbolPosition: 'after' },
  YER: { code: 'YER', symbol: 'ر.ي', name: 'ريال يمني', rate: 250, decimals: 0, symbolPosition: 'after' },
  LYD: { code: 'LYD', symbol: 'د.ل', name: 'دينار ليبي', rate: 4.85, decimals: 3, symbolPosition: 'after' },
  TND: { code: 'TND', symbol: 'د.ت', name: 'دينار تونسي', rate: 3.1, decimals: 3, symbolPosition: 'after' },
  DZD: { code: 'DZD', symbol: 'د.ج', name: 'دينار جزائري', rate: 134, decimals: 0, symbolPosition: 'after' },
  MAD: { code: 'MAD', symbol: 'د.م', name: 'درهم مغربي', rate: 10, decimals: 2, symbolPosition: 'after' },
  SDG: { code: 'SDG', symbol: 'ج.س', name: 'جنيه سوداني', rate: 600, decimals: 2, symbolPosition: 'after' },
  EUR: { code: 'EUR', symbol: '€', name: 'يورو', rate: 0.92, decimals: 2, symbolPosition: 'before' },
  GBP: { code: 'GBP', symbol: '£', name: 'جنيه إسترليني', rate: 0.79, decimals: 2, symbolPosition: 'before' },
};

let cachedState: MoneyEngineState | null = null;
let stateVersion = 0;
const subscribers = new Set<() => void>();

function ensureSettingsBackup(rawSettingsJson: string | null): void {
  if (!rawSettingsJson || typeof window === 'undefined') return;
  try {
    if (!window.localStorage.getItem(SETTINGS_BACKUP_KEY)) {
      window.localStorage.setItem(SETTINGS_BACKUP_KEY, rawSettingsJson);
    }
  } catch {
    // تجاهل أخطاء مساحة التخزين الاحتياطية بهدوء
  }
}

function buildStateFromStorage(): MoneyEngineState {
  stateVersion += 1;
  const currencies: Record<string, CurrencyDefinition> = {};

  for (const [code, def] of Object.entries(DEFAULT_DEFINITIONS)) {
    currencies[code] = {
      ...def,
      enabled: code === 'USD',
    };
  }

  let activeCode = 'USD';
  let reportCode = 'USD';
  let inputPrefs: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      ensureSettingsBackup(raw);

      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, any>;
        const primary = normalizeCurrencyCode(parsed.primaryCurrency || parsed.currency || 'USD');
        activeCode = primary;

        const rates: Record<string, any> = parsed.exchangeRates || {};
        const symbols: Record<string, any> = parsed.currencySymbols || {};
        const names: Record<string, any> = parsed.currencyNames || {};
        const enabledMap: Record<string, any> = parsed.enabledCurrencies || {};
        const customList: Array<Record<string, any>> = Array.isArray(parsed.customCurrencies)
          ? parsed.customCurrencies
          : [];

        for (const item of customList) {
          if (!item || !item.code) continue;
          const code = normalizeCurrencyCode(item.code);
          const symbol = String(item.symbol || code).trim();
          currencies[code] = {
            code,
            symbol,
            name: String(item.name || code).trim(),
            rate: code === 'USD' ? 1 : Math.max(0.000001, Number(item.rate || item.exchangeRate) || 1),
            decimals: typeof item.decimals === 'number' ? item.decimals : getDefaultDecimals(code),
            symbolPosition: item.symbolPosition || getDefaultSymbolPosition(code, symbol),
            enabled: item.enabled !== false,
            isCustom: true,
          };
        }

        const allKnownCodes = new Set<string>([
          ...Object.keys(currencies),
          ...Object.keys(rates).map(normalizeCurrencyCode),
          ...Object.keys(symbols).map(normalizeCurrencyCode),
          ...Object.keys(names).map(normalizeCurrencyCode),
          ...Object.keys(enabledMap).map(normalizeCurrencyCode),
          activeCode,
        ]);

        for (const code of allKnownCodes) {
          if (!code) continue;
          const existing = currencies[code];
          const rawRate = rates[code] ?? (code === 'BHD' ? rates['BHR'] : undefined);
          const rawSymbol = symbols[code] ?? (code === 'BHD' ? symbols['BHR'] : undefined);
          const rawName = names[code] ?? (code === 'BHD' ? names['BHR'] : undefined);
          const rawEnabled = enabledMap[code] ?? (code === 'BHD' ? enabledMap['BHR'] : undefined);

          const resolvedSymbol = String(rawSymbol || existing?.symbol || (code === 'USD' ? '$' : code)).trim();
          const resolvedName = String(rawName || existing?.name || code).trim();
          const parsedRate = Number(rawRate);
          const resolvedRate =
            code === 'USD'
              ? 1
              : Number.isFinite(parsedRate) && parsedRate > 0
              ? parsedRate
              : existing?.rate && existing.rate > 0
              ? existing.rate
              : 1;

          currencies[code] = {
            code,
            symbol: resolvedSymbol,
            name: resolvedName,
            rate: resolvedRate,
            decimals: existing?.decimals ?? getDefaultDecimals(code),
            symbolPosition: existing?.symbolPosition ?? getDefaultSymbolPosition(code, resolvedSymbol),
            enabled:
              code === 'USD' ||
              code === activeCode ||
              rawEnabled === true ||
              (rawEnabled === undefined && Number.isFinite(parsedRate) && parsedRate > 0 && parsedRate !== 1),
            isCustom: existing?.isCustom ?? !DEFAULT_DEFINITIONS[code],
          };
        }
      }

      const rawReport = window.localStorage.getItem(REPORT_CURRENCY_KEY);
      if (rawReport) {
        const cleanReport = normalizeCurrencyCode(rawReport);
        reportCode = cleanReport === 'STORE' || cleanReport === 'DISPLAY' ? activeCode : cleanReport;
      } else {
        reportCode = activeCode;
      }

      const rawPrefs = window.localStorage.getItem(INPUT_PREFS_KEY);
      if (rawPrefs) {
        inputPrefs = JSON.parse(rawPrefs) || {};
      }
    } catch (err) {
      console.warn('[MoneyEngine] Failed to parse settings from storage, using defaults:', err);
    }
  }

  if (!currencies[activeCode]) {
    currencies[activeCode] = {
      code: activeCode,
      symbol: activeCode,
      name: activeCode,
      rate: 1,
      decimals: getDefaultDecimals(activeCode),
      symbolPosition: getDefaultSymbolPosition(activeCode),
      enabled: true,
      isCustom: true,
    };
  }
  currencies.USD.rate = 1;
  currencies.USD.enabled = true;

  return {
    activeCode,
    reportCode: currencies[reportCode] ? reportCode : activeCode,
    currencies,
    inputPrefs,
    version: stateVersion,
  };
}

export function getMoneyState(): MoneyEngineState {
  if (!cachedState) {
    cachedState = buildStateFromStorage();
  }
  return cachedState;
}

export function refreshMoneyState(): MoneyEngineState {
  cachedState = buildStateFromStorage();
  subscribers.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[MoneyEngine] Subscriber error:', err);
    }
  });
  return cachedState;
}

export function subscribeMoneyState(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  const handleSync = () => {
    refreshMoneyState();
  };
  window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSync);
  if ((EVENTS as Record<string, string>).CURRENCY_UPDATED) {
    window.addEventListener((EVENTS as Record<string, string>).CURRENCY_UPDATED, handleSync);
  }
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === SETTINGS_KEY || e.key === REPORT_CURRENCY_KEY || e.key === INPUT_PREFS_KEY) {
      refreshMoneyState();
    }
  });
}

export function getCurrencyDef(code?: string | null): CurrencyDefinition {
  const state = getMoneyState();
  const normalized = normalizeCurrencyCode(code || state.activeCode);
  return (
    state.currencies[normalized] || {
      code: normalized,
      symbol: normalized === 'USD' ? '$' : normalized,
      name: normalized,
      rate: 1,
      decimals: getDefaultDecimals(normalized),
      symbolPosition: getDefaultSymbolPosition(normalized),
      enabled: true,
    }
  );
}

export function getActiveCurrencyDef(): CurrencyDefinition {
  const state = getMoneyState();
  return getCurrencyDef(state.activeCode);
}

export function getEnabledCurrencies(): CurrencyDefinition[] {
  const state = getMoneyState();
  return Object.values(state.currencies).filter((c) => c.enabled || c.code === 'USD' || c.code === state.activeCode);
}

export function round8(usd: number): number {
  const num = Number(usd);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 1e8) / 1e8;
}

export function roundForCurrency(amount: number, code?: string | null, decimalsOverride?: number): number {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  const def = getCurrencyDef(code);
  const decimals = typeof decimalsOverride === 'number' ? decimalsOverride : def.decimals;
  if (decimals <= 0) {
    return Math.round(num);
  }
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function toUsd(amount: number, code?: string | null, rateOverride?: number): number {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return 0;
  const normalized = normalizeCurrencyCode(code || getMoneyState().activeCode);
  if (normalized === 'USD') return round8(num);
  const def = getCurrencyDef(normalized);
  const rate = Number(rateOverride) > 0 ? Number(rateOverride) : def.rate;
  if (!Number.isFinite(rate) || rate <= 0) return round8(num);
  return round8(num / rate);
}

export function fromUsd(usdAmount: number, code?: string | null, rateOverride?: number): number {
  const num = Number(usdAmount);
  if (!Number.isFinite(num) || num === 0) return 0;
  const normalized = normalizeCurrencyCode(code || getMoneyState().activeCode);
  if (normalized === 'USD') return round8(num);
  const def = getCurrencyDef(normalized);
  const rate = Number(rateOverride) > 0 ? Number(rateOverride) : def.rate;
  if (!Number.isFinite(rate) || rate <= 0) return round8(num);
  return round8(num * rate);
}

export function formatAmount(
  amountInTargetCurrency: number,
  code?: string | null,
  options?: {
    showSymbol?: boolean;
    symbolOverride?: string;
    decimalsOverride?: number;
  }
): string {
  const def = getCurrencyDef(code);
  const decimals =
    typeof options?.decimalsOverride === 'number' ? options.decimalsOverride : def.decimals;
  const rounded = roundForCurrency(amountInTargetCurrency, def.code, decimals);
  const formattedNumber = rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (options?.showSymbol === false) {
    return formattedNumber;
  }

  const symbol = (options?.symbolOverride || def.symbol || def.code).trim();
  const pos = getDefaultSymbolPosition(def.code, symbol);
  return pos === 'before' ? `${symbol}${formattedNumber}` : `${formattedNumber} ${symbol}`;
}

export function formatActive(usdAmount: number): string {
  const active = getActiveCurrencyDef();
  const converted = fromUsd(usdAmount, active.code, active.rate);
  return formatAmount(converted, active.code);
}

export function formatIn(usdAmount: number, targetCode?: string | null, rateOverride?: number): string {
  const def = getCurrencyDef(targetCode);
  const converted = fromUsd(usdAmount, def.code, rateOverride ?? def.rate);
  return formatAmount(converted, def.code);
}

export function createCurrencySnapshot(code?: string | null, rateOverride?: number): CurrencySnapshot {
  const def = getCurrencyDef(code);
  const rate = def.code === 'USD' ? 1 : Number(rateOverride) > 0 ? Number(rateOverride) : def.rate;
  return {
    currency_code: def.code,
    currency_symbol: def.symbol,
    currency_name: def.name,
    exchange_rate: rate,
    decimals: def.decimals,
  };
}

export function formatSnapshot(
  usdAmount: number,
  snapshot?: {
    currency_code?: string | null;
    currencySymbol?: string | null;
    currency_symbol?: string | null;
    exchange_rate?: number | null;
    exchangeRate?: number | null;
    total_in_currency?: number | null;
  } | null,
  useOriginalTotal = false
): string {
  if (!snapshot) {
    return formatActive(usdAmount);
  }
  const rawCode = snapshot.currency_code;
  const rawSymbol = snapshot.currency_symbol || snapshot.currencySymbol;
  const rawRate = Number(snapshot.exchange_rate ?? snapshot.exchangeRate ?? 0);

  const code = rawCode ? normalizeCurrencyCode(rawCode) : rawRate === 1 ? 'USD' : getMoneyState().activeCode;
  const def = getCurrencyDef(code);
  const symbol = (rawSymbol || def.symbol || code).trim();

  if (
    useOriginalTotal &&
    typeof snapshot.total_in_currency === 'number' &&
    Number.isFinite(snapshot.total_in_currency) &&
    snapshot.total_in_currency > 0
  ) {
    return formatAmount(snapshot.total_in_currency, code, { symbolOverride: symbol });
  }

  const effectiveRate = code === 'USD' ? 1 : rawRate > 0 ? rawRate : def.rate;
  const converted = fromUsd(usdAmount, code, effectiveRate);
  return formatAmount(converted, code, { symbolOverride: symbol });
}

export function getSavedInputCurrency(fieldKey: string, fallbackCode?: string): string {
  const state = getMoneyState();
  const saved = state.inputPrefs[fieldKey];
  if (saved && state.currencies[normalizeCurrencyCode(saved)]) {
    return normalizeCurrencyCode(saved);
  }
  return normalizeCurrencyCode(fallbackCode || state.activeCode);
}

export function saveInputCurrencyPref(fieldKey: string, code: string): void {
  if (!fieldKey || typeof window === 'undefined') return;
  try {
    const normalized = normalizeCurrencyCode(code);
    const state = getMoneyState();
    const nextPrefs = { ...state.inputPrefs, [fieldKey]: normalized };
    window.localStorage.setItem(INPUT_PREFS_KEY, JSON.stringify(nextPrefs));
    if (cachedState) {
      cachedState = { ...cachedState, inputPrefs: nextPrefs, version: ++stateVersion };
    }
  } catch {
    // تجاهل بصمت
  }
}
