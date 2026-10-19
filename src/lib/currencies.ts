/**
 * HyperPOS Currency Configuration & Predefined Regional/Global Currencies
 * =======================================================================
 * Contains predefined currencies for Gulf/Middle East, North Africa, and Global.
 * Allows users to easily select pre-filled currency symbols, names, and codes.
 */

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
  { code: 'BHR', symbol: 'د.ب', name: 'الدينار البحريني', nameEn: 'Bahraini Dinar', category: 'gulf_me', suggestedRate: 0.38 },
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
  const upper = code.trim().toUpperCase();
  return PREDEFINED_CURRENCIES.find(c => c.code === upper);
}

/**
 * الحصول على الرمز الفعلي للعملة (Symbol) بناءً على الكود
 * مثل: LBP -> ل.ل, TRY -> ₺, SYP -> ل.س, SAR -> ر.س, EUR -> €, USD -> $
 */
export function getCurrencySymbolByCode(code?: string, fallback?: string): string {
  if (!code) return fallback || '$';
  const upper = code.trim().toUpperCase();
  const found = PREDEFINED_CURRENCIES.find(c => c.code === upper);
  if (found) return found.symbol;
  return fallback || upper;
}

/**
 * استنتاج العملة التاريخية الفعلية من سعر الصرف المخزن
 * هذا يمنع تشوه الفواتير القديمة عند تغيير عملة المتجر النشطة
 */
export function inferCurrencyFromExchangeRate(rate: number, hintedCode?: string): PredefinedCurrency | undefined {
  if (!rate || isNaN(rate) || rate <= 0) return undefined;

  // إذا كان هناك تلميح بكود العملة
  if (hintedCode && hintedCode.trim().toUpperCase() !== 'USD') {
    const hintUpper = hintedCode.trim().toUpperCase();

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
      const match = PREDEFINED_CURRENCIES.find(c => c.code === hintedCode.trim().toUpperCase());
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

  // 1. استنتاج العملة التاريخية من سعر الصرف أو الكود
  const inferred = inferCurrencyFromExchangeRate(rate, rawCurrency);
  const code = inferred?.code || (rawCurrency && rawCurrency !== 'USD' ? rawCurrency : (fallbackSettings?.currencyCode !== 'USD' ? fallbackSettings?.currencyCode || 'TRY' : 'TRY'));

  // 2. التحقق من صحة الرمز وتجميده
  let symbol: string;
  const canonical = getCurrencySymbolByCode(code);

  // متى نعتبر الرمز المخزن غير صالح ويجب استبداله بالرمز المعياري الموثوق؟
  // - إذا كان فارغاً أو "$" لفاتورة غير دولارية
  // - إذا كان "€" ولكن العملة ليست EUR وسعر الصرف لا يمت لليورو بصلة (مثل LBP 89500 أو TRY 34)
  // - إذا كان الرمز لا يطابق العملة المستنتجة بشكل قاطع
  const isSuspiciousSymbol =
    !rawSymbol ||
    rawSymbol === '$' ||
    (rawSymbol === '€' && code !== 'EUR') ||
    (rawSymbol === '₺' && code !== 'TRY' && code !== 'USD') ||
    (rawSymbol === 'ل.س' && code !== 'SYP') ||
    (rawSymbol === 'ل.ل' && code !== 'LBP');

  if (!isSuspiciousSymbol && rawSymbol !== '') {
    symbol = rawSymbol;
  } else if (canonical && canonical !== '$') {
    symbol = canonical;
  } else if (fallbackSettings?.currencySymbols?.[code]) {
    symbol = fallbackSettings.currencySymbols[code];
  } else {
    symbol = code;
  }

  return { code, symbol, rate };
}

/**
 * الحصول على العملة الافتراضية للعرض ورمزها من مصدر الإعدادات الموحد
 */
export function getDisplayCurrency(): { code: string; symbol: string } {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('hyperpos_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        const primary = (parsed.primaryCurrency || parsed.currencyCode || parsed.defaultCurrency || '').trim().toUpperCase();
        const enabled = parsed.enabledCurrencies;

        let activeCode = primary;
        if (enabled && activeCode && enabled[activeCode] === false) {
          activeCode = enabled.TRY ? 'TRY' : enabled.SYP ? 'SYP' : enabled.USD !== false ? 'USD' : '';
        }
        if (!activeCode) {
          activeCode = enabled?.TRY ? 'TRY' : enabled?.SYP ? 'SYP' : 'USD';
        }

        const syms = parsed.currencySymbols;
        const symbol =
          (syms && syms[activeCode] && typeof syms[activeCode] === 'string' && syms[activeCode].trim())
            ? syms[activeCode].trim()
            : (parsed.currencySymbol && typeof parsed.currencySymbol === 'string' && parsed.currencySymbol.trim())
            ? parsed.currencySymbol.trim()
            : getCurrencySymbolByCode(activeCode, activeCode);

        return { code: activeCode, symbol };
      }
    }
  } catch {}

  return { code: 'USD', symbol: getCurrencySymbolByCode('USD', '$') };
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
  const upper = (displayCurrency || '').trim().toUpperCase();
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
 * المحرك المركزي الموحد لحل وتأكيد بيانات العملة (الكود، الرمز، الاسم، وسعر الصرف مقابل الدولار)
 * يمنع منعاً باتاً إرجاع '₺' أو اسم 'ليرة تركية' إلا إذا كان الكود صراحة 'TRY'
 */
export function resolveCurrencyMeta(
  currencyCode?: string,
  customSymbol?: string,
  customRate?: number,
  customName?: string
): ResolvedCurrencyMeta {
  let settings: any = null;
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('hyperpos_settings_v1');
      if (raw) settings = JSON.parse(raw);
    }
  } catch {}

  // 1. تحديد كود العملة المستهدف
  let code = (currencyCode || '').trim().toUpperCase();
  if (!code || code === 'STORED' || code === 'DEFAULT') {
    code = (settings?.primaryCurrency || settings?.currencyCode || settings?.defaultCurrency || '').trim().toUpperCase();
    if (!code) {
      const enabled = settings?.enabledCurrencies;
      code = enabled?.TRY ? 'TRY' : enabled?.SYP ? 'SYP' : 'USD';
    }
  }
  if (!code) code = 'USD';

  const isUsd = code === 'USD';

  // 2. البحث عن العملة المعيارية من القائمة المسبقة
  const canonical = PREDEFINED_CURRENCIES.find(c => c.code === code);

  // 3. تحديد الرمز بدقة ومنع الرموز الخاطئة (مثل ₺ لغير التركي أو $ لغير الدولار)
  let symbol = '';
  const rawSymbol = (customSymbol || '').trim();
  const isSuspicious =
    rawSymbol === '' ||
    (rawSymbol === '₺' && code !== 'TRY') ||
    (rawSymbol === '$' && code !== 'USD') ||
    (rawSymbol === '€' && code !== 'EUR') ||
    (rawSymbol === 'ل.س' && code !== 'SYP');

  if (!isSuspicious && rawSymbol) {
    symbol = rawSymbol;
  } else if (settings?.currencySymbols?.[code]) {
    const s = String(settings.currencySymbols[code]).trim();
    if (!(s === '₺' && code !== 'TRY') && !(s === '$' && code !== 'USD')) {
      symbol = s;
    }
  }
  
  if (!symbol) {
    symbol = canonical ? canonical.symbol : (isUsd ? '$' : code);
  }

  // 4. تحديد الاسم بدقة
  let name = '';
  const rawName = (customName || '').trim();
  const isSuspiciousName =
    rawName === '' ||
    (rawName.includes('تركي') && code !== 'TRY') ||
    (rawName.includes('دولار') && code !== 'USD') ||
    (rawName.includes('سوري') && code !== 'SYP');

  if (!isSuspiciousName && rawName) {
    name = rawName;
  } else if (settings?.currencyNames?.[code]) {
    const n = String(settings.currencyNames[code]).trim();
    if (!(n.includes('تركي') && code !== 'TRY')) {
      name = n;
    }
  }
  
  if (!name) {
    name = canonical ? canonical.name : (isUsd ? 'دولار أمريكي' : code);
  }

  // 5. تحديد سعر الصرف مقابل الدولار
  let rate = 1;
  if (!isUsd) {
    if (typeof customRate === 'number' && !isNaN(customRate) && customRate > 0) {
      rate = customRate;
    } else if (settings?.exchangeRates?.[code] && Number(settings.exchangeRates[code]) > 0) {
      rate = Number(settings.exchangeRates[code]);
    } else if (canonical?.suggestedRate) {
      rate = canonical.suggestedRate;
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
 * تنسيق المبالغ المالية المخزنة داخلياً بالدولار الأمريكي وتحويلها ديناميكياً
 * إلى عملة المتجر المعتمدة الحالية مع مراعاة دقة الكسور (بدون فواصل إذا كان الصرف >= 100)
 */
export function formatReportAmount(amountUsd: number): string {
  if (typeof amountUsd !== 'number' || isNaN(amountUsd)) return '0.00';
  const active = getActiveStoreCurrency();
  const converted = active.isUsd ? amountUsd : amountUsd * (active.rate > 0 ? active.rate : 1);
  const decimals = active.rate >= 100 ? 0 : 2;
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


