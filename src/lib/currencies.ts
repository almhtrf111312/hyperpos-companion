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
} from '@/lib/money-engine';

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
  { code: 'SAR', symbol: 'ر.س', name: 'الريال السعودي', nameEn: 'Saudi Riyal', category: 'gulf_me', suggestedRate: 3.75 },
  { code: 'AED', symbol: 'د.إ', name: 'الدرهم الإماراتي', nameEn: 'UAE Dirham', category: 'gulf_me', suggestedRate: 3.67 },
  { code: 'KWD', symbol: 'د.ك', name: 'الدينار الكويتي', nameEn: 'Kuwaiti Dinar', category: 'gulf_me', suggestedRate: 0.31 },
  { code: 'QAR', symbol: 'ر.ق', name: 'الريال القطري', nameEn: 'Qatari Riyal', category: 'gulf_me', suggestedRate: 3.64 },
  { code: 'BHD', symbol: 'د.ب', name: 'الدينار البحريني', nameEn: 'Bahraini Dinar', category: 'gulf_me', suggestedRate: 0.38 },
  { code: 'OMR', symbol: 'ر.ع', name: 'الريال العماني', nameEn: 'Omani Rial', category: 'gulf_me', suggestedRate: 0.38 },
  { code: 'JOD', symbol: 'د.أ', name: 'الدينار الأردني', nameEn: 'Jordanian Dinar', category: 'gulf_me', suggestedRate: 0.71 },
  { code: 'IQD', symbol: 'د.ع', name: 'الدينار العراقي', nameEn: 'Iraqi Dinar', category: 'gulf_me', suggestedRate: 1310 },
  { code: 'TRY', symbol: '₺', name: 'الليرة التركية', nameEn: 'Turkish Lira', category: 'gulf_me', suggestedRate: 34 },
  { code: 'SYP', symbol: 'ل.س', name: 'الليرة السورية', nameEn: 'Syrian Pound', category: 'gulf_me', suggestedRate: 14500 },
  { code: 'LBP', symbol: 'ل.ل', name: 'الليرة اللبنانية', nameEn: 'Lebanese Pound', category: 'gulf_me', suggestedRate: 89500 },
  { code: 'EGP', symbol: 'ج.م', name: 'الجنيه المصري', nameEn: 'Egyptian Pound', category: 'gulf_me', suggestedRate: 48 },
  { code: 'YER', symbol: 'ر.ي', name: 'الريال اليمني', nameEn: 'Yemeni Rial', category: 'gulf_me', suggestedRate: 250 },

  // ─── شمال أفريقيا (North Africa) ──────────────────────────────────────────
  { code: 'LYD', symbol: 'د.ل', name: 'الدينار الليبي', nameEn: 'Libyan Dinar', category: 'north_africa', suggestedRate: 4.85 },
  { code: 'TND', symbol: 'د.ت', name: 'الدينار التونسي', nameEn: 'Tunisian Dinar', category: 'north_africa', suggestedRate: 3.1 },
  { code: 'DZD', symbol: 'د.ج', name: 'الدينار الجزائري', nameEn: 'Algerian Dinar', category: 'north_africa', suggestedRate: 134 },
  { code: 'MAD', symbol: 'د.م', name: 'الدرهم المغربي', nameEn: 'Moroccan Dirham', category: 'north_africa', suggestedRate: 9.8 },
  { code: 'SDG', symbol: 'ج.س', name: 'الجنيه السوداني', nameEn: 'Sudanese Pound', category: 'north_africa', suggestedRate: 600 },

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
 * البحث عن عملة محددة مسبقاً حسب الرمز الكودي (Code)
 */
export function getPredefinedCurrency(code?: string): PredefinedCurrency | undefined {
  if (!code) return undefined;
  const upper = normalizeCurrencyCode(code);
  return PREDEFINED_CURRENCIES.find(c => c.code === upper);
}

/**
 * الحصول على الرمز الفعلي للعملة (Symbol) بناءً على الكود
 * مثل: LBP -> ل.ل, TRY -> ₺, SYP -> ل.س, SAR -> ر.س, EUR -> €, USD -> $
 */
export function getCurrencySymbolByCode(code?: string, fallback?: string): string {
  if (!code) return fallback || '$';
  const def = getCurrencyDef(code);
  return def.symbol || fallback || def.code;
}

/**
 * استنتاج العملة التاريخية الفعلية من سعر الصرف المخزن
 * هذا يمنع تشوه الفواتير القديمة عند تغيير عملة المتجر النشطة
 */
export function inferCurrencyFromExchangeRate(rate: number, hintedCode?: string): PredefinedCurrency | undefined {
  if (!rate || isNaN(rate) || rate <= 0) return undefined;

  // إذا كان هناك تلميح بكود العملة
  if (hintedCode && hintedCode.trim().toUpperCase() !== 'USD') {
    const hintUpper = normalizeCurrencyCode(hintedCode);

    // فحص أمان صارم: إذا كان سعر الصرف غير متوافق نهائياً مع العملة المزعومة،
    // نمنع تطبيق الكود الخاطئ ونستنتج العملة الحقيقية من السعر
    if (rate >= 50000 && hintUpper !== 'LBP') {
      return PREDEFINED_CURRENCIES.find(c => c.code === 'LBP');
    }
    if (rate >= 5000 && rate < 50000 && hintUpper !== 'SYP') {
      return PREDEFINED_CURRENCIES.find(c => c.code === 'SYP');
    }
    if (rate >= 800 && rate < 5000 && hintUpper !== 'IQD') {
      return PREDEFINED_CURRENCIES.find(c => c.code === 'IQD');
    }

    const hintCur = PREDEFINED_CURRENCIES.find(c => c.code === hintUpper);
    if (hintCur) {
      return hintCur;
    }
  }

  // استنتاج حسب نطاقات أسعار الصرف الحقيقية مقابل الدولار الأمريكي
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
    // الليرة التركية (TRY ~34) أو الجنيه المصري (EGP ~48)
    if (hintedCode && hintedCode.trim().toUpperCase() === 'EGP') {
      return PREDEFINED_CURRENCIES.find(c => c.code === 'EGP');
    }
    return PREDEFINED_CURRENCIES.find(c => c.code === 'TRY');
  }
  if (rate > 1.05 && rate < 15) {
    // عملات الخليج والمغرب العربي ذات الصرف المنخفض
    if (hintedCode) {
      const match = PREDEFINED_CURRENCIES.find(c => c.code === normalizeCurrencyCode(hintedCode));
      if (match) return match;
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
    const symbol = (rawSymbol && rawSymbol !== '')
      ? rawSymbol
      : (fallbackSettings?.currencySymbols?.USD || '$');
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

  return { code, symbol, rate };
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
      if (trimmed === 'TL') return def.symbol || '₺';
      return trimmed;
    }
  }

  return def.symbol || code;
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
