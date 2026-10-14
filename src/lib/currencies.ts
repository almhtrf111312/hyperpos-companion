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
