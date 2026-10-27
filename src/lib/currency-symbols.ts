export const ARABIC_TO_ENGLISH_CURRENCY_SYMBOLS: Record<string, string> = {
  'ر.ق': 'QAR',
  'ج.م': 'EGP',
  'ر.س': 'SAR',
  'د.إ': 'AED',
  'د.ك': 'KWD',
  'د.ب': 'BHD',
  'ر.ع': 'OMR',
  'د.أ': 'JOD',
  'د.ع': 'IQD',
  'ل.س': 'SYP',
  'ل.ل': 'LBP',
  'ر.ي': 'YER',
  'د.ل': 'LYD',
  'د.ت': 'TND',
  'د.ج': 'DZD',
  'د.م': 'MAD',
  'ج.س': 'SDG',
};

function normalizeLegacySymbol(symbol: string): string {
  return symbol
    .normalize('NFKC')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim();
}

export function getCurrencyCodeFromLegacySymbol(symbol?: string | null): string | undefined {
  const cleanSymbol = normalizeLegacySymbol(symbol || '');
  return ARABIC_TO_ENGLISH_CURRENCY_SYMBOLS[cleanSymbol];
}

function normalizeCode(code?: string | null): string {
  const normalized = (code || '').trim().toUpperCase();
  return normalized === 'BHR' ? 'BHD' : normalized;
}

export function toEnglishCurrencySymbol(
  symbol?: string | null,
  currencyCode?: string | null
): string {
  const cleanSymbol = normalizeLegacySymbol(symbol || '');
  const code = normalizeCode(currencyCode);
  const legacyCode = getCurrencyCodeFromLegacySymbol(cleanSymbol);

  if (legacyCode && code === legacyCode) {
    return legacyCode;
  }

  return cleanSymbol || code || '$';
}
