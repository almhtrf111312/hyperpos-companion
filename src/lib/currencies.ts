/**
 * HyperPOS Currency Configuration & Predefined Regional/Global Currencies
 * =======================================================================
 * Contains predefined currencies for Gulf/Middle East, North Africa, and Global.
 * Allows users to easily select pre-filled currency symbols, names, and codes.
 */

import {
  getMoneyState,
  getCurrencyDef,
  getActiveCurrencyDef,
  normalizeCurrencyCode,
  CurrencyDefinition,
  getDefaultDecimals,
  getDefaultSymbolPosition,
} from '@/lib/money-engine';
import { toEnglishCurrencySymbol } from '@/lib/currency-symbols';

export type { CurrencyDefinition };
export { ARABIC_TO_ENGLISH_CURRENCY_SYMBOLS, toEnglishCurrencySymbol } from '@/lib/currency-symbols';

export interface PredefinedCurrency {
  code: string;
  symbol: string;
  name: string;
  nameEn: string;
  category: 'gulf_me' | 'north_africa' | 'global';
  suggestedRate?: number;
}

export const PREDEFINED_CURRENCIES: PredefinedCurrency[] = [
  // ─── الشرق الأوسط والخليج (Gulf & Middle East) ──────────────────────────
  { code: 'SAR', symbol: 'SAR', name: 'الريال السعودي', nameEn: 'Saudi Riyal', category: 'gulf_me', suggestedRate: 3.75 },
  { code: 'AED', symbol: 'AED', name: 'الدرهم الإماراتي', nameEn: 'UAE Dirham', category: 'gulf_me', suggestedRate: 3.67 },
  { code: 'KWD', symbol: 'KWD', name: 'الدينار الكويتي', nameEn: 'Kuwaiti Dinar', category: 'gulf_me', suggestedRate: 0.31 },
  { code: 'QAR', symbol: 'QAR', name: 'الريال القطري', nameEn: 'Qatari Riyal', category: 'gulf_me', suggestedRate: 3.64 },
  { code: 'BHD', symbol: 'BHD', name: 'الدينار البحريني', nameEn: 'Bahraini Dinar', category: 'gulf_me', suggestedRate: 0.38 },
  { code: 'OMR', symbol: 'OMR', name: 'الريال العماني', nameEn: 'Omani Rial', category: 'gulf_me', suggestedRate: 0.38 },
  { code: 'JOD', symbol: 'JOD', name: 'الدينار الأردني', nameEn: 'Jordanian Dinar', category: 'gulf_me', suggestedRate: 0.71 },
  { code: 'IQD', symbol: 'IQD', name: 'الدينار العراقي', nameEn: 'Iraqi Dinar', category: 'gulf_me', suggestedRate: 1310 },
  { code: 'TRY', symbol: '₺', name: 'الليرة التركية', nameEn: 'Turkish Lira', category: 'gulf_me', suggestedRate: 34 },
  { code: 'SYP', symbol: 'SYP', name: 'الليرة السورية', nameEn: 'Syrian Pound', category: 'gulf_me', suggestedRate: 14500 },
  { code: 'LBP', symbol: 'LBP', name: 'الليرة اللبنانية', nameEn: 'Lebanese Pound', category: 'gulf_me', suggestedRate: 89500 },
  { code: 'EGP', symbol: 'EGP', name: 'الجنيه المصري', nameEn: 'Egyptian Pound', category: 'gulf_me', suggestedRate: 48 },
  { code: 'YER', symbol: 'YER', name: 'الريال اليمني', nameEn: 'Yemeni Rial', category: 'gulf_me', suggestedRate: 250 },

  // ─── شمال أفريقيا (North Africa) ──────────────────────────────────────────
  { code: 'LYD', symbol: 'LYD', name: 'الدينار الليبي', nameEn: 'Libyan Dinar', category: 'north_africa', suggestedRate: 4.85 },
  { code: 'TND', symbol: 'TND', name: 'الدينار التونسي', nameEn: 'Tunisian Dinar', category: 'north_africa', suggestedRate: 3.1 },
  { code: 'DZD', symbol: 'DZD', name: 'الدينار الجزائري', nameEn: 'Algerian Dinar', category: 'north_africa', suggestedRate: 134 },
  { code: 'MAD', symbol: 'MAD', name: 'الدرهم المغربي', nameEn: 'Moroccan Dirham', category: 'north_africa', suggestedRate: 9.8 },
  { code: 'SDG', symbol: 'SDG', name: 'الجنيه السوداني', nameEn: 'Sudanese Pound', category: 'north_africa', suggestedRate: 600 },

  // ─── عملات عالمية (Global Currencies) ────────────────────────────────────
  { code: 'USD', symbol: '$', name: 'الدولار الأمريكي', nameEn: 'US Dollar', category: 'global', suggestedRate: 1 },
  { code: 'EUR', symbol: '€', name: 'اليورو', nameEn: 'Euro', category: 'global', suggestedRate: 0.92 },
  { code: 'GBP', symbol: '£', name: 'الجنيه الإسترليني', nameEn: 'British Pound', category: 'global', suggestedRate: 0.79 },
  { code: 'CHF', symbol: 'CHF', name: 'الفرنك السويسري', nameEn: 'Swiss Franc', category: 'global', suggestedRate: 0.88 },
  { code: 'CAD', symbol: 'C$', name: 'الدولار الكندي', nameEn: 'Canadian Dollar', category: 'global', suggestedRate: 1.38 },
  { code: 'AUD', symbol: 'A$', name: 'الدولار الأسترالي', nameEn: 'Australian Dollar', category: 'global', suggestedRate: 1.52 },
  { code: 'CNY', symbol: '¥', name: 'اليوان الصيني', nameEn: 'Chinese Yuan', category: 'global', suggestedRate: 7.25 },
  { code: 'JPY', symbol: '¥', name: 'الين الياباني', nameEn: 'Japanese Yen', category: 'global', suggestedRate: 153 },
];

export const CURRENCY_CATEGORIES = [
  { id: 'gulf_me', label: 'الشرق الأوسط والخليج', labelEn: 'Middle East & Gulf' },
  { id: 'north_africa', label: 'شمال أفريقيا', labelEn: 'North Africa' },
  { id: 'global', label: 'عملات عالمية', labelEn: 'Global' },
] as const;

/**
 * كتالوج العملات الصريح الموحد
 */
export const CURRENCY_CATALOG: Record<string, CurrencyDefinition> = Object.fromEntries(
  PREDEFINED_CURRENCIES.map(c => [
    c.code.toUpperCase(),
    {
      code: c.code,
      symbol: c.symbol,
      name: c.name,
      rate: c.suggestedRate || 1,
      decimals: getDefaultDecimals(c.code),
      symbolPosition: getDefaultSymbolPosition(c.code, c.symbol),
      enabled: true,
    }
  ])
);

/**
 * الحصول على تعريف العملة الأساسية للمتجر
 */
export const getPrimaryCurrencyDef = (): CurrencyDefinition => {
  return getActiveCurrencyDef();
};

/**
 * الحصول على كود العملة الأساسية/النشطة للمتجر
 */
export const getActiveCurrencyCode = (): string => {
  return getActiveCurrencyDef().code || 'USD';
};

/**
 * Safe currency resolver: Prioritizes explicit code over rate guessing
 */
export const resolveSafeCurrency = (
  code?: string,
  symbol?: string,
  rate?: number
): CurrencyDefinition => {
  if (code) {
    const upper = code.toUpperCase();
    if (CURRENCY_CATALOG[upper]) {
      return CURRENCY_CATALOG[upper];
    }
    const stateDef = getCurrencyDef(upper);
    if (stateDef && stateDef.code === upper) {
      return stateDef;
    }
  }
  
  // فحص بالرمز إذا كان الكود مفقوداً
  if (symbol) {
    const cleanSym = symbol.trim();
    const foundBySymbol = Object.values(CURRENCY_CATALOG).find(c => c.symbol === cleanSym);
    if (foundBySymbol) return foundBySymbol;
  }

  // fallback آمن إلى العملة الأساسية للمتجر بدلاً من فرض TRY عشوائياً
  return getPrimaryCurrencyDef();
};

/**
 * البحث عن عملة محددة مسبقاً حسب الرمز الكودي (Code)
 */
export function getPredefinedCurrency(code?: string): PredefinedCurrency | undefined {
  if (!code) return undefined;
  const upper = normalizeCurrencyCode(code);
  return PREDEFINED_CURRENCIES.find(c => c.code === upper);
}

/**
 * الحصول على الرمز الفعلي للعملة (Symbol) بناءً على الكود
 * مثل: LBP -> LBP, TRY -> ₺, SYP -> SYP, SAR -> SAR, EUR -> €, USD -> $
 */
export function getCurrencySymbolByCode(code?: string, fallback?: string): string {
  if (!code) return fallback || '$';
  const def = getCurrencyDef(code);
  return toEnglishCurrencySymbol(def.symbol || fallback || def.code, code);
}

/**
 * استنتاج العملة التاريخية الفعلية من سعر الصرف المخزن
 * هذا يمنع تشوه الفواتير القديمة عند تغيير عملة المتجر النشطة
 */
export function inferCurrencyFromExchangeRate(rate: number, hintedCode?: string): PredefinedCurrency | undefined {
  if (!rate || isNaN(rate) || rate <= 0) return undefined;

  // 1. إذا كان هناك كود صريح، يتم اعتماده فوراً وتفضيله على أي تخمين لسعر الصرف
  if (hintedCode && hintedCode.trim().toUpperCase() !== 'USD') {
    const hintUpper = normalizeCurrencyCode(hintedCode);
    const hintCur = PREDEFINED_CURRENCIES.find(c => c.code === hintUpper);
    if (hintCur) {
      return hintCur;
    }
  }

  // 2. التحقق من العملة النشطة للمتجر: إذا كان سعر الصرف الحالي للمتجر متوافقاً مع هذا المعدل
  const activeDef = getActiveCurrencyDef();
  if (activeDef && activeDef.code !== 'USD' && activeDef.rate > 0) {
    if (Math.abs(activeDef.rate - rate) / activeDef.rate < 0.15) {
      const match = PREDEFINED_CURRENCIES.find(c => c.code === activeDef.code);
      if (match) return match;
    }
  }

  // 3. استنتاج العملة التاريخية بحيادية من نطاقات الأسعار دون فرض أعمى لـ TRY أو SAR
  if (rate >= 50000) {
    // الليرة اللبنانية (LBP ~89500)
    return PREDEFINED_CURRENCIES.find(c => c.code === 'LBP');
  }
  if (rate >= 5000 && rate < 50000) {
    // الليرة السورية (SYP ~14500)
    return PREDEFINED_CURRENCIES.find(c => c.code === 'SYP');
  }
  if (rate >= 800 && rate < 5000) {
    // الدينار العراقي (IQD ~1310)
    return PREDEFINED_CURRENCIES.find(c => c.code === 'IQD');
  }
  if (rate >= 300 && rate < 800) {
    // الجنيه السوداني (SDG ~600)
    return PREDEFINED_CURRENCIES.find(c => c.code === 'SDG');
  }
  if (rate >= 180 && rate < 300) {
    // الريال اليمني (YER ~250)
    return PREDEFINED_CURRENCIES.find(c => c.code === 'YER');
  }
  if (rate >= 80 && rate < 180) {
    // الدينار الجزائري (DZD ~134) أو الين الياباني (JPY ~153)
    if (hintedCode && hintedCode.trim().toUpperCase() === 'JPY') {
      return PREDEFINED_CURRENCIES.find(c => c.code === 'JPY');
    }
    return PREDEFINED_CURRENCIES.find(c => c.code === 'DZD');
  }
  if (rate >= 15 && rate < 80) {
    // التفريق العادل بين الجنيه المصري (EGP ~48-50) والليرة التركية (TRY ~34)
    if (activeDef.code === 'EGP' || activeDef.code === 'TRY') {
      return PREDEFINED_CURRENCIES.find(c => c.code === activeDef.code);
    }
    return rate >= 42
      ? PREDEFINED_CURRENCIES.find(c => c.code === 'EGP')
      : PREDEFINED_CURRENCIES.find(c => c.code === 'TRY');
  }
  if (rate > 1.05 && rate < 15) {
    // عملات الخليج والمغرب العربي (SAR, AED, QAR, MAD, LYD, TND, JOD)
    if (activeDef && activeDef.code !== 'USD') {
      const activeMatch = PREDEFINED_CURRENCIES.find(c => c.code === activeDef.code);
      if (activeMatch) return activeMatch;
    }
    return PREDEFINED_CURRENCIES.find(c => c.code === 'SAR');
  }

  return undefined;
}

/**
 * تحديد العملة التاريخية وسعر الصرف والرمز الفعلي للفاتورة بشكل مجمد ومستقل
 * يضمن عدم تأثر الفواتير القديمة بأي تغيير في إعدادات عملة المتجر الحالية
 */
export function resolveHistoricalCurrency(
  inv: {
    currency?: string | null;
    currencySymbol?: string | null;
    exchangeRate?: number | null;
  },
  fallbackSettings?: {
    currencyCode?: string;
    currencySymbol?: string;
    currencySymbols?: Record<string, string>;
  }
): { code: string; symbol: string; rate: number } {
  const rawCurrency = (inv.currency || '').trim().toUpperCase();
  const rawSymbol = (inv.currencySymbol || '').trim();
  const hasRate = typeof inv.exchangeRate === 'number' && !isNaN(inv.exchangeRate) && inv.exchangeRate > 0;
  const rate = hasRate ? inv.exchangeRate! : 1;

  // هل الفاتورة أجنبية/محلية (سعر صرف > 1 أو عملة ليست USD)؟
  const isForeign = (rawCurrency !== 'USD' && rawCurrency !== '') || rate > 1;

  if (!isForeign) {
    // فاتورة بالدولار الأمريكي
    const symbol = toEnglishCurrencySymbol(
      rawSymbol || fallbackSettings?.currencySymbols?.USD || '$',
      'USD'
    );
    return { code: 'USD', symbol, rate: 1 };
  }

  // 1. العملة المحفوظة في الفاتورة هي المرجع؛ التخمين من سعر الصرف فقط للفواتير القديمة بلا كود
  let code: string;
  if (rawCurrency && rawCurrency !== 'USD') {
    code = normalizeCurrencyCode(rawCurrency);
  } else {
    const active = (fallbackSettings?.currencyCode || '').toUpperCase();
    code = (active && active !== 'USD')
      ? normalizeCurrencyCode(active)
      : (inferCurrencyFromExchangeRate(rate, rawCurrency)?.code || 'USD');
  }

  // 2. التحقق من صحة الرمز وتجميده
  let symbol: string;

  const isSuspiciousSymbol =
    !rawSymbol ||
    rawSymbol === '$' ||
    (rawSymbol === '€' && code !== 'EUR') ||
    (rawSymbol === '₺' && code !== 'TRY' && code !== 'USD') ||
    (rawSymbol === 'ل.س' && code !== 'SYP') ||
    (rawSymbol === 'ل.ل' && code !== 'LBP');

  if (!isSuspiciousSymbol && rawSymbol !== '') {
    symbol = rawSymbol;
  } else if (fallbackSettings?.currencySymbols?.[code]) {
    symbol = fallbackSettings.currencySymbols[code];
  } else {
    symbol = resolveInvoiceCurrencySymbol(code, rawSymbol);
  }

  return { code, symbol: toEnglishCurrencySymbol(symbol, code), rate };
}

/**
 * دالة موحدة وذكية لجلب رمز العملة للفاتورة
 * تقرأ رمز العملة المحفوظ في الفاتورة أولاً، ثم كاش المحرك الموحد
 */
export function resolveInvoiceCurrencySymbol(
  currencyCode?: string,
  savedSymbol?: string
): string {
  const code = normalizeCurrencyCode(currencyCode || 'USD');
  if (code === 'USD') {
    return '$';
  }

  const def = getCurrencyDef(code);

  // إذا كان الرمز محفوظاً مسبقاً داخل الفاتورة نفسها وصالحاً
  if (savedSymbol && typeof savedSymbol === 'string') {
    const trimmed = savedSymbol.trim();
    const isSuspicious =
      trimmed === '' ||
      (trimmed === '$' && code !== 'USD') ||
      (trimmed === '₺' && code !== 'TRY') ||
      (trimmed === 'ل.س' && code !== 'SYP') ||
      (trimmed === '€' && code !== 'EUR');
    if (!isSuspicious) {
      if (trimmed === 'TL') return toEnglishCurrencySymbol(def.symbol || '₺', code);
      return toEnglishCurrencySymbol(trimmed, code);
    }
  }

  return toEnglishCurrencySymbol(def.symbol || code, code);
}

/**
 * دالة موحدة لجلب اسم العملة للفاتورة
 */
export function resolveInvoiceCurrencyName(
  currencyCode?: string,
  savedName?: string
): string {
  const code = normalizeCurrencyCode(currencyCode || 'USD');
  if (code === 'USD') return 'دولار أمريكي';

  if (savedName && typeof savedName === 'string' && savedName.trim() !== '') {
    return savedName.trim();
  }

  const def = getCurrencyDef(code);
  return def.name || code;
}

/**
 * الحصول على العملة الافتراضية للعرض ورمزها من مصدر الإعدادات الموحد في الذاكرة
 */
export function getDisplayCurrency(): { code: string; symbol: string } {
  const active = getActiveCurrencyDef();
  return { code: active.code, symbol: active.symbol };
}

/**
 * تحويل مبلغ بالدولار إلى عملة العرض بسعر الصرف المحدد، أو null إذا لم يتوفر السعر التاريخي
 */
export function convertUsdToDisplay(
  amountUsd: number,
  displayCurrency: string,
  rateAtDate?: number | null
): number | null {
  if (typeof amountUsd !== 'number' || isNaN(amountUsd)) return null;
  const upper = normalizeCurrencyCode(displayCurrency || 'USD');
  if (upper === 'USD') return amountUsd;
  if (rateAtDate && typeof rateAtDate === 'number' && !isNaN(rateAtDate) && rateAtDate > 0) {
    return amountUsd * rateAtDate;
  }
  return null;
}

export interface ResolvedCurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  rate: number;
  isUsd: boolean;
}

/**
 * المحرك المركزي الموحد لحل وتأكيد بيانات العملة من الكاش الحي في الذاكرة
 */
export function resolveCurrencyMeta(
  currencyCode?: string,
  customSymbol?: string,
  customRate?: number,
  customName?: string
): ResolvedCurrencyMeta {
  const state = getMoneyState();

  // 1. تحديد كود العملة المستهدف
  let code = (currencyCode || '').trim().toUpperCase();
  if (!code || code === 'STORED' || code === 'DEFAULT') {
    code = state.activeCode;
  }
  code = normalizeCurrencyCode(code);
  const isUsd = code === 'USD';
  const def = getCurrencyDef(code);

  // 2. تحديد الرمز بدقة ومنع الرموز الخاطئة
  let symbol = (customSymbol || '').trim();
  const isSuspicious =
    !symbol ||
    (symbol === '₺' && code !== 'TRY') ||
    (symbol === '$' && code !== 'USD') ||
    (symbol === '€' && code !== 'EUR') ||
    (symbol === 'ل.س' && code !== 'SYP');

  if (isSuspicious) {
    symbol = def.symbol || (isUsd ? '$' : code);
  }
  symbol = toEnglishCurrencySymbol(symbol, code);

  // 3. تحديد الاسم بدقة
  let name = (customName || '').trim();
  const isSuspiciousName =
    !name ||
    (name.includes('تركي') && code !== 'TRY') ||
    (name.includes('دولار') && code !== 'USD') ||
    (name.includes('سوري') && code !== 'SYP');

  if (isSuspiciousName) {
    name = def.name || (isUsd ? 'دولار أمريكي' : code);
  }

  // 4. تحديد سعر الصرف مقابل الدولار
  let rate = 1;
  if (!isUsd) {
    if (typeof customRate === 'number' && !isNaN(customRate) && customRate > 0) {
      rate = customRate;
    } else {
      rate = def.rate > 0 ? def.rate : 1;
    }
  }

  return { code, symbol, name, rate, isUsd };
}

/**
 * تنسيق المبلغ مع رمز العملة واسمها
 */
export function formatCurrencyWithMeta(
  amount: number,
  meta: { symbol: string; name?: string },
  options?: { showName?: boolean; decimals?: number }
): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
  const decimals = options?.decimals ?? 2;
  const numStr = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (options?.showName && meta.name) {
    return `${numStr} ${meta.symbol} (${meta.name})`;
  }
  return `${numStr} ${meta.symbol}`;
}

/**
 * عرض سعر الصرف مقابل الدولار بصيغة موحدة
 */
export function formatRateAgainstUsd(
  meta: { code: string; symbol: string; name: string; rate: number }
): string {
  if (meta.code === 'USD' || meta.rate <= 0) return '';
  const formattedRate = meta.rate.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return `1 $ = ${formattedRate} ${meta.symbol} (${meta.name})`;
}

/**
 * الحصول على بيانات العملة المعتمدة حالياً في المتجر (الكود، الرمز، الاسم، وسعر الصرف مقابل الدولار)
 */
export function getActiveStoreCurrency(): ResolvedCurrencyMeta {
  return resolveCurrencyMeta();
}

/**
 * عملة التقارير: الدولار أو العملة الافتراضية للمتجر (من الكاش في الذاكرة)
 */
export const REPORT_CURRENCY_KEY = 'hyperpos_report_currency';

export function getReportCurrency(): ResolvedCurrencyMeta {
  const state = getMoneyState();
  const def = getCurrencyDef(state.reportCode);
  return {
    code: def.code,
    symbol: def.symbol,
    name: def.name,
    rate: def.rate,
    isUsd: def.code === 'USD',
  };
}

export function formatReportAmount(amountUsd: number): string {
  if (typeof amountUsd !== 'number' || isNaN(amountUsd)) return '0.00';
  const active = getReportCurrency();
  const converted = active.isUsd ? amountUsd : amountUsd * (active.rate > 0 ? active.rate : 1);
  const def = getCurrencyDef(active.code);
  const decimals = def.decimals;
  const numStr = converted.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const cleanSymbol = (active.symbol || '').trim();
  if (cleanSymbol === '$' || cleanSymbol === '€' || cleanSymbol === '£') {
    return `${cleanSymbol}${numStr}`;
  }
  return `${numStr}\u00A0${cleanSymbol}`;
}

export interface StoreCurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  decimals: number;
  enabled: boolean;
}

export interface NormalizedCurrencySettings {
  primaryCurrencyCode: string;
  currencies: Record<string, StoreCurrencyConfig>;
}

/**
 * دالة ذكية لتحديد كود العملة الحقيقي من الاسم والرمز دون افتراض TRY/SYP
 */
export function detectCurrencyCodeFromMeta(
  symbol?: string,
  name?: string,
  fallbackCode: string = 'USD'
): string {
  const cleanSym = (symbol || '').trim();
  const cleanName = (name || '').trim();

  // 1. فحص مباشر بالرمز والاسم المميزين
  if (cleanSym === 'ر.ق' || cleanName.includes('قطر')) return 'QAR';
  if (cleanSym === 'ج.م' || cleanName.includes('مصر')) return 'EGP';
  if (cleanSym === 'ر.س' || cleanName.includes('سعود')) return 'SAR';
  if (cleanSym === 'د.إ' || cleanName.includes('إمارات')) return 'AED';
  if (cleanSym === 'د.ك' || cleanName.includes('كويت')) return 'KWD';
  if (cleanSym === 'د.ب' || cleanName.includes('بحرين')) return 'BHD';
  if (cleanSym === 'ر.ع' || cleanName.includes('عمان')) return 'OMR';
  if (cleanSym === 'د.أ' || cleanName.includes('أردن')) return 'JOD';
  if (cleanSym === 'د.ع' || cleanName.includes('عراق')) return 'IQD';
  if (cleanSym === 'ل.ل' || cleanName.includes('لبنان')) return 'LBP';
  if (cleanSym === 'د.ل' || cleanName.includes('ليبيا')) return 'LYD';
  if (cleanSym === 'د.ت' || cleanName.includes('تونس')) return 'TND';
  if (cleanSym === 'د.ج' || cleanName.includes('جزائر')) return 'DZD';
  if (cleanSym === 'د.م' || cleanName.includes('مغرب')) return 'MAD';
  if (cleanSym === 'ج.س' || cleanName.includes('سودان')) return 'SDG';
  if (cleanSym === 'ر.ي' || cleanName.includes('يمن')) return 'YER';
  if (cleanSym === '₺' || cleanName.includes('ترك')) return 'TRY';
  if (cleanSym === 'ل.س' || cleanName.includes('سور')) return 'SYP';

  // 2. مطابقة بالكتالوج العام
  if (cleanSym) {
    const bySym = PREDEFINED_CURRENCIES.find(c => c.symbol === cleanSym);
    if (bySym) return bySym.code;
  }
  if (cleanName) {
    const byName = PREDEFINED_CURRENCIES.find(c => c.name === cleanName || c.nameEn.toLowerCase() === cleanName.toLowerCase());
    if (byName) return byName.code;
  }

  return fallbackCode ? fallbackCode.toUpperCase() : 'USD';
}

/**
 * تطبيع إعدادات العملة وتحرير هوية العملات من فرض TRY و SYP
 */
export function normalizeCurrencySettings(rawSettings?: any): NormalizedCurrencySettings {
  let settings = rawSettings;
  if (!settings && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('hyperpos_settings_v1');
      if (raw) settings = JSON.parse(raw);
    } catch {}
  }

  const enabledMap = settings?.enabledCurrencies || {};
  const namesMap = settings?.currencyNames || {};
  const symbolsMap = settings?.currencySymbols || {};
  const ratesMap = settings?.exchangeRates || {};
  let rawPrimary = (settings?.primaryCurrency || 'USD') as string;

  const currencies: Record<string, StoreCurrencyConfig> = {};

  // 1. العملة الأساسية/المرجعية USD
  currencies.USD = {
    code: 'USD',
    name: (namesMap.USD && namesMap.USD.trim()) || 'دولار أمريكي',
    symbol: (symbolsMap.USD && symbolsMap.USD.trim()) || '$',
    rate: 1,
    decimals: 2,
    enabled: enabledMap.USD !== false,
  };

  const processedRealCodes = new Set<string>(['USD']);
  const legacySlots = ['TRY', 'SYP'];

  // 2. معالجة الخانات القديمة TRY / SYP واكتشاف إن كانت تحوي عملة مخصصة كـ QAR أو EGP
  for (const slotKey of legacySlots) {
    const sym = symbolsMap[slotKey];
    const name = namesMap[slotKey];
    const rate = Number(ratesMap[slotKey]);
    const isExplicitlyDisabled = enabledMap[slotKey] === false;

    // إذا كانت الخانة فارغة كلياً، نتخطاها
    if (!sym && !name && !rate && enabledMap[slotKey] !== true) {
      continue;
    }

    const detectedCode = detectCurrencyCodeFromMeta(sym, name, slotKey);
    const catalogItem = getPredefinedCurrency(detectedCode);

    const finalCode = detectedCode;
    const finalName = (name && name.trim()) || catalogItem?.name || finalCode;
    const finalSymbol = (sym && sym.trim()) || catalogItem?.symbol || finalCode;
    const finalRate = Number.isFinite(rate) && rate > 0 ? rate : (catalogItem?.suggestedRate || 1);
    const decimals = getDefaultDecimals(finalCode);

    currencies[finalCode] = {
      code: finalCode,
      name: finalName,
      symbol: toEnglishCurrencySymbol(finalSymbol, finalCode),
      rate: finalRate,
      decimals,
      enabled: !isExplicitlyDisabled,
    };
    processedRealCodes.add(finalCode);

    if (rawPrimary === slotKey) {
      rawPrimary = finalCode;
    }
  }

  // 3. معالجة أي عملات أخرى مخزنة بكودها المباشر
  const allCodes = new Set([
    ...Object.keys(enabledMap),
    ...Object.keys(ratesMap),
    ...Object.keys(namesMap),
    ...Object.keys(symbolsMap),
  ]);

  for (const rawCode of allCodes) {
    const code = rawCode.trim().toUpperCase();
    if (processedRealCodes.has(code) || legacySlots.includes(code)) continue;

    const sym = symbolsMap[rawCode] || symbolsMap[code];
    const name = namesMap[rawCode] || namesMap[code];
    const rate = Number(ratesMap[rawCode] ?? ratesMap[code]);
    const isExplicitlyDisabled = enabledMap[rawCode] === false || enabledMap[code] === false;

    const catalogItem = getPredefinedCurrency(code);
    currencies[code] = {
      code,
      name: (name && name.trim()) || catalogItem?.name || code,
      symbol: toEnglishCurrencySymbol((sym && sym.trim()) || catalogItem?.symbol || code, code),
      rate: Number.isFinite(rate) && rate > 0 ? rate : (catalogItem?.suggestedRate || 1),
      decimals: getDefaultDecimals(code),
      enabled: !isExplicitlyDisabled,
    };
    processedRealCodes.add(code);
  }

  // 4. ضبط كود العملة الأساسية
  let primaryCurrencyCode = rawPrimary;
  if (!currencies[primaryCurrencyCode] || !currencies[primaryCurrencyCode].enabled) {
    const firstEnabled = Object.values(currencies).find(c => c.enabled);
    primaryCurrencyCode = firstEnabled ? firstEnabled.code : 'USD';
  }

  return {
    primaryCurrencyCode,
    currencies,
  };
}

export function loadNormalizedCurrencySettings(): NormalizedCurrencySettings {
  return normalizeCurrencySettings();
}
