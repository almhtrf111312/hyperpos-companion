/**
 * Flow POS Pro - Unified Store Settings & Cross-Device Sync Module
 * ==============================================================
 * العقد الموحد لإعدادات المتجر والتزامن الشامل بين الويب والموبايل
 * - Offline-First: الحفظ المحلي فوري وغير قابل للحذف عند غياب بيانات السحابة
 * - دمج ذكي بدون سباق: لا تُستبدل القيم المحلية غير الفارغة بفراغات أو قيم افتراضية
 * - تطبيق فوري وموحد للخط، المقياس، الثيم، العملات، وإعدادات الكاشير
 */

import {
  AppFontId,
  APP_FONT_STORAGE_KEY,
  APP_FONT_CHANGED_EVENT,
  DEFAULT_APP_FONT_ID,
  isValidAppFontId,
  applyAppFontToDOM,
  getStoredAppFont,
  setStoredAppFont,
  getPlatformStoragePrefix,
} from '@/lib/app-font-config';
import {
  UIScaleId,
  UI_SCALE_STORAGE_KEY,
  UI_SCALE_CHANGED_EVENT,
  DEFAULT_UI_SCALE_ID,
  isValidUIScaleId,
  applyUIScaleToDOM,
  setStoredUIScale,
  getStoredUIScale,
} from '@/lib/ui-scale-config';
import { applyTheme, applyBlurTheme, applyThemeStyle, ThemeMode, ThemeColor, ThemeStyle, getThemeStorageKey, THEME_STORAGE_KEY } from '@/hooks/use-theme';
import { Language, setLanguage, getCurrentLanguage } from '@/lib/i18n';
import type { ProductFieldsConfig } from '@/lib/product-fields-config';
import type { CustomField } from '@/lib/custom-fields-config';
import {
  StoreSettingsRow,
  saveStoreSettingsDirect,
  fetchStoreSettings,
} from '@/lib/supabase-store';
import { enqueueStoreSettingsUpdate } from '@/lib/sync-queue';
import { emitEvent, EVENTS } from '@/lib/events';

export const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

export interface StoreInfo {
  name: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  logo: string;
}

export interface FullThemeSettings {
  mode: ThemeMode;
  color: ThemeColor;
  blur: boolean;
  transparency: number;
  style?: ThemeStyle;
}

export type CurrencyDisplayMode = 'symbol' | 'name' | 'both';

export interface UnifiedStoreSettings {
  updatedAt?: number;
  storeSettings: StoreInfo;
  primaryCurrency: 'USD' | 'TRY' | 'SYP' | string;
  enabledCurrencies: {
    USD?: boolean;
    TRY?: boolean;
    SYP?: boolean;
    [code: string]: boolean | undefined;
  };
  exchangeRates: {
    USD?: number;
    TRY?: number;
    SYP?: number;
    [code: string]: number | undefined;
  };
  currencyNames: {
    USD?: string;
    TRY?: string;
    SYP?: string;
    [code: string]: string | undefined;
  };
  currencySymbols: {
    USD?: string;
    TRY?: string;
    SYP?: string;
    [code: string]: string | undefined;
  };
  currencyDisplayMode: Record<string, CurrencyDisplayMode>;
  language: Language;
  theme: ThemeMode;
  themeSettings: FullThemeSettings;
  appearanceSettings: {
    dashboardDesign?: 'classic' | 'unified_pro';
    [key: string]: unknown;
  };
  appFont: AppFontId;
  uiScale: UIScaleId;
  taxEnabled: boolean;
  taxRate: number;
  discountPercentEnabled: boolean;
  discountFixedEnabled: boolean;
  barcodeScanMode: 'search' | 'add';
  hideMaintenanceSection: boolean;
  trackCapital: boolean;
  initialCapital: number;
  notificationSettings: Record<string, unknown>;
  printSettings: Record<string, unknown>;
  backupSettings: {
    autoBackup: boolean;
    interval: string;
    keepDays: string;
    [key: string]: unknown;
  };
  syncSettings?: Record<string, unknown>;
  productFieldsConfig?: ProductFieldsConfig | null;
  customFields?: CustomField[] | null;
}

export const DEFAULT_UNIFIED_SETTINGS: UnifiedStoreSettings = {
  updatedAt: undefined,
  storeSettings: {
    name: '',
    type: 'general',
    phone: '',
    email: '',
    address: '',
    logo: '',
  },
  primaryCurrency: 'USD',
  enabledCurrencies: {
    USD: true,
    TRY: false,
    SYP: false,
  },
  exchangeRates: {
    USD: 1,
    TRY: 32,
    SYP: 14500,
  },
  currencyNames: {
    USD: 'دولار',
    TRY: 'ليرة تركية',
    SYP: 'ليرة سورية',
  },
  currencySymbols: {
    USD: '$',
    TRY: '₺',
    SYP: 'ل.س',
  },
  currencyDisplayMode: { USD: 'symbol' },
  language: 'ar',
  theme: 'dark',
  themeSettings: {
    mode: 'dark',
    color: 'emerald',
    blur: true,
    transparency: 80,
  },
  appearanceSettings: {
    dashboardDesign: 'classic',
  },
  appFont: DEFAULT_APP_FONT_ID,
  uiScale: DEFAULT_UI_SCALE_ID,
  taxEnabled: false,
  taxRate: 0,
  discountPercentEnabled: true,
  discountFixedEnabled: true,
  barcodeScanMode: 'search',
  hideMaintenanceSection: false,
  trackCapital: false,
  initialCapital: 0,
  notificationSettings: {
    soundEnabled: true,
    durationSeconds: 2,
  },
  printSettings: {},
  backupSettings: {
    autoBackup: true,
    interval: 'daily',
    keepDays: '7',
  },
};

/**
 * قراءة الإعدادات المحلية الموحدة مع الحفاظ على كل القيم الموجودة
 */
export function loadUnifiedStoreSettings(): UnifiedStoreSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_UNIFIED_SETTINGS };

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    // قراءة الثيم المحلي للمنصة الحالية
    let localThemeSettings: FullThemeSettings = DEFAULT_UNIFIED_SETTINGS.themeSettings;
    try {
      const themeKey = getThemeStorageKey();
      let rawTheme = localStorage.getItem(themeKey);
      if (!rawTheme) {
        rawTheme = localStorage.getItem('hyperpos_theme_v1');
      }
      if (rawTheme) {
        const pt = JSON.parse(rawTheme);
        localThemeSettings = {
          mode: pt.mode === 'light' ? 'light' : 'dark',
          color: pt.color || 'emerald',
          blur: pt.blur ?? true,
          transparency: typeof pt.transparency === 'number' ? pt.transparency : 80,
          style: pt.style === 'xiaomi' ? 'xiaomi' : 'standard',
        };
      }
    } catch {
      // ignore
    }

    // قراءة الخط المحلي للمنصة الحالية
    const localFont: AppFontId = getStoredAppFont();

    // قراءة المقياس المحلي للمنصة الحالية
    const localScale: UIScaleId = getStoredUIScale();

    // قراءة نمط لوحة التحكم للمنصة الحالية
    let localDesign: 'classic' | 'unified_pro' = 'classic';
    try {
      const designKey = `flowpos_layout_${getPlatformStoragePrefix()}`;
      const d = localStorage.getItem(designKey) || localStorage.getItem('hyperpos_dashboard_design_v1');
      if (d === 'unified_pro' || d === 'classic') localDesign = d;
    } catch {
      // ignore
    }

    // أسماء ورموز العملات: تجنب إرجاع فراغات نهائياً
    const rawNames = parsed?.currencyNames || {};
    const currencyNames = {
      USD: (typeof rawNames.USD === 'string' && rawNames.USD.trim()) ? rawNames.USD.trim() : DEFAULT_UNIFIED_SETTINGS.currencyNames.USD,
      TRY: (typeof rawNames.TRY === 'string' && rawNames.TRY.trim()) ? rawNames.TRY.trim() : DEFAULT_UNIFIED_SETTINGS.currencyNames.TRY,
      SYP: (typeof rawNames.SYP === 'string' && rawNames.SYP.trim()) ? rawNames.SYP.trim() : DEFAULT_UNIFIED_SETTINGS.currencyNames.SYP,
      ...Object.fromEntries(Object.entries(rawNames).filter(([code, value]) =>
        !['USD', 'TRY', 'SYP'].includes(code) && typeof value === 'string' && value.trim()
      ).map(([code, value]) => [code.toUpperCase(), (value as string).trim()])),
    };

    const rawSyms = parsed?.currencySymbols || {};
    const currencySymbols = {
      USD: (typeof rawSyms.USD === 'string' && rawSyms.USD.trim()) ? rawSyms.USD.trim() : DEFAULT_UNIFIED_SETTINGS.currencySymbols.USD,
      TRY: (typeof rawSyms.TRY === 'string' && rawSyms.TRY.trim()) ? rawSyms.TRY.trim() : DEFAULT_UNIFIED_SETTINGS.currencySymbols.TRY,
      SYP: (typeof rawSyms.SYP === 'string' && rawSyms.SYP.trim()) ? rawSyms.SYP.trim() : DEFAULT_UNIFIED_SETTINGS.currencySymbols.SYP,
      ...Object.fromEntries(Object.entries(rawSyms).filter(([code, value]) =>
        !['USD', 'TRY', 'SYP'].includes(code) && typeof value === 'string' && value.trim()
      ).map(([code, value]) => [code.toUpperCase(), (value as string).trim()])),
    };

    const rawRates = parsed?.exchangeRates || {};
    const exchangeRates = {
      USD: 1,
      TRY: Number(rawRates.TRY) > 0 ? Number(rawRates.TRY) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.TRY,
      SYP: Number(rawRates.SYP) > 0 ? Number(rawRates.SYP) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.SYP,
      ...Object.fromEntries(Object.entries(rawRates).filter(([code, value]) =>
        !['USD', 'TRY', 'SYP'].includes(code) && Number(value) > 0
      ).map(([code, value]) => [code.toUpperCase(), Number(value)])),
    };

    const rawEnabled = parsed?.enabledCurrencies || {};
    const enabledCurrencies = {
      USD: rawEnabled.USD !== false,
      ...Object.fromEntries(Object.entries(rawEnabled)
        .filter(([code]) => code.toUpperCase() !== 'USD')
        .map(([code, enabled]) => [code.toUpperCase(), enabled === true])),
    };
    const rawDisplayModes = parsed?.currencyDisplayMode || {};
    const currencyDisplayMode = Object.fromEntries(
      Object.entries(rawDisplayModes)
        .filter(([, mode]) => mode === 'symbol' || mode === 'name' || mode === 'both')
        .map(([code, mode]) => [code.toUpperCase(), mode])
    ) as Record<string, CurrencyDisplayMode>;

    const rawStore = parsed?.storeSettings || {};
    const storeSettings: StoreInfo = {
      name: rawStore.name || '',
      type: rawStore.type || 'general',
      phone: rawStore.phone || '',
      email: rawStore.email || '',
      address: rawStore.address || '',
      logo: rawStore.logo || '',
    };

    return {
      updatedAt: typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : undefined,
      storeSettings,
      primaryCurrency: parsed?.primaryCurrency || 'USD',
      enabledCurrencies,
      exchangeRates,
      currencyNames,
      currencySymbols,
      currencyDisplayMode,
      language: (parsed?.language as Language) || getCurrentLanguage(),
      theme: localThemeSettings.mode,
      themeSettings: localThemeSettings,
      appearanceSettings: {
        dashboardDesign: localDesign,
        ...(parsed?.appearanceSettings || {}),
        settingsLayout: localStorage.getItem('settings_layout_mode') || parsed?.appearanceSettings?.settingsLayout || 'grid',
      },
      appFont: localFont,
      uiScale: localScale,
      taxEnabled: typeof parsed?.taxEnabled === 'boolean' ? parsed.taxEnabled : false,
      taxRate: typeof parsed?.taxRate === 'number' ? parsed.taxRate : 0,
      discountPercentEnabled: typeof parsed?.discountPercentEnabled === 'boolean' ? parsed.discountPercentEnabled : true,
      discountFixedEnabled: typeof parsed?.discountFixedEnabled === 'boolean' ? parsed.discountFixedEnabled : true,
      barcodeScanMode: parsed?.barcodeScanMode === 'add' ? 'add' : 'search',
      hideMaintenanceSection: Boolean(parsed?.hideMaintenanceSection),
      trackCapital: Boolean(parsed?.trackCapital),
      initialCapital: Number(parsed?.initialCapital) || 0,
      notificationSettings: parsed?.notificationSettings || DEFAULT_UNIFIED_SETTINGS.notificationSettings,
      printSettings: parsed?.printSettings || {},
      backupSettings: {
        ...DEFAULT_UNIFIED_SETTINGS.backupSettings,
        ...(parsed?.backupSettings || {}),
        cloudAutoUpload: parsed?.backupSettings?.cloudAutoUpload ?? (localStorage.getItem('hp_cloud_auto_backup') === 'true'),
      },
      syncSettings: parsed?.syncSettings || {},
      productFieldsConfig: parsed?.productFieldsConfig || null,
      customFields: parsed?.customFields || null,
    };
  } catch (err) {
    console.error('[StoreSettingsSync] Failed to load local settings:', err);
    return { ...DEFAULT_UNIFIED_SETTINGS };
  }
}

/**
 * خوارزمية الدمج الذكي بين الإعدادات المحلية وإعدادات السحابة:
 * 1. إذا كانت القيمة في السحابة فارغة/غير موجودة، والقيمة المحلية غير فارغة -> يتم الحفاظ على القيمة المحلية.
 * 2. إذا كانت السحابة تحتوي على قيمة غير فارغة -> يتم اعتمادها كمرجع موحد.
 * 3. لا يُسمح نهائياً بمسح أسماء العملات أو رموزها أو تركها فارغة.
 * 4. دمج وحفظ الثيم، الخط، ومقياس الواجهة من السحابة وتطبيقها محلياً.
 */
export function mergeStoreSettings(
  local: Partial<UnifiedStoreSettings> | null,
  cloud: StoreSettingsRow | null
): UnifiedStoreSettings {
  const base = local ? { ...DEFAULT_UNIFIED_SETTINGS, ...local } : { ...DEFAULT_UNIFIED_SETTINGS };
  if (!cloud) return base;

  const cloudSync = (cloud.sync_settings && typeof cloud.sync_settings === 'object'
    ? cloud.sync_settings as Record<string, unknown>
    : {}) as Record<string, any>;

  const cloudUpdatedAt = Number(cloudSync.updatedAt) || (cloud.updated_at ? new Date(cloud.updated_at as string).getTime() : 0);
  const localUpdatedAt = Number(base.updatedAt) || 0;
  const mergedUpdatedAt = Math.max(localUpdatedAt, cloudUpdatedAt) || Date.now();

  // 1. معلومات المتجر الأساسية
  const localStore = base.storeSettings || DEFAULT_UNIFIED_SETTINGS.storeSettings;
  const mergedStore: StoreInfo = {
    name: (typeof cloud.name === 'string' && cloud.name.trim()) ? cloud.name.trim() : (localStore.name || ''),
    type: (typeof cloud.store_type === 'string' && cloud.store_type.trim()) ? cloud.store_type.trim() : (localStore.type || 'general'),
    phone: (typeof cloud.phone === 'string' && cloud.phone.trim()) ? cloud.phone.trim() : (localStore.phone || ''),
    email: (typeof cloud.email === 'string' && cloud.email.trim()) ? cloud.email.trim() : (localStore.email || ''),
    address: (typeof cloud.address === 'string' && cloud.address.trim()) ? cloud.address.trim() : (localStore.address || ''),
    logo: (typeof cloud.logo_url === 'string' && cloud.logo_url.trim()) ? cloud.logo_url.trim() : (localStore.logo || ''),
  };

  // 2. العملة الأساسية
  const mergedPrimary = (typeof cloud.primary_currency === 'string' && cloud.primary_currency.trim())
    || (typeof cloudSync.primaryCurrency === 'string' && cloudSync.primaryCurrency.trim())
    || base.primaryCurrency
    || 'USD';

  // 3. العملات المفعلة
  const cloudEnabled = cloudSync.enabledCurrencies || {};
  const localEnabled = base.enabledCurrencies || DEFAULT_UNIFIED_SETTINGS.enabledCurrencies;
  const currencyCodes = new Set([...Object.keys(cloudEnabled), ...Object.keys(localEnabled)]);
  const mergedEnabled: Record<string, boolean> = { USD: true };
  currencyCodes.forEach((code) => {
    if (code.toUpperCase() === 'USD') return;
    const cloudValue = cloudEnabled[code];
    mergedEnabled[code.toUpperCase()] = cloudValue !== undefined
      ? cloudValue === true
      : localEnabled[code] === true;
  });

  // 4. أسماء العملات (منع الفراغ دائماً)
  const cloudNames = cloudSync.currencyNames || {};
  const localNames = base.currencyNames || DEFAULT_UNIFIED_SETTINGS.currencyNames;
  const mergedNames: Record<string, string> = {
    USD: (typeof cloudNames.USD === 'string' && cloudNames.USD.trim()) || localNames.USD || DEFAULT_UNIFIED_SETTINGS.currencyNames.USD,
    TRY: (typeof cloudNames.TRY === 'string' && cloudNames.TRY.trim()) || localNames.TRY || DEFAULT_UNIFIED_SETTINGS.currencyNames.TRY,
    SYP: (typeof cloudNames.SYP === 'string' && cloudNames.SYP.trim()) || localNames.SYP || DEFAULT_UNIFIED_SETTINGS.currencyNames.SYP,
  };
  new Set([...Object.keys(cloudNames), ...Object.keys(localNames)]).forEach((code) => {
    const cloudName = cloudNames[code];
    const localName = localNames[code];
    const name = (typeof cloudName === 'string' && cloudName.trim()) || localName;
    if (typeof name === 'string' && name.trim()) mergedNames[code.toUpperCase()] = name.trim();
  });

  // 5. رموز العملات (منع الفراغ دائماً)
  const cloudSyms = cloudSync.currencySymbols || {};
  const localSyms = base.currencySymbols || DEFAULT_UNIFIED_SETTINGS.currencySymbols;
  const directSymbol = (typeof cloud.currency_symbol === 'string' && cloud.currency_symbol.trim()) ? cloud.currency_symbol.trim() : undefined;
  const mergedSymbols: Record<string, string> = {
    USD: (typeof cloudSyms.USD === 'string' && cloudSyms.USD.trim()) || localSyms.USD || (mergedPrimary === 'USD' ? directSymbol : undefined) || DEFAULT_UNIFIED_SETTINGS.currencySymbols.USD,
    TRY: (typeof cloudSyms.TRY === 'string' && cloudSyms.TRY.trim()) || localSyms.TRY || (mergedPrimary === 'TRY' ? directSymbol : undefined) || DEFAULT_UNIFIED_SETTINGS.currencySymbols.TRY,
    SYP: (typeof cloudSyms.SYP === 'string' && cloudSyms.SYP.trim()) || localSyms.SYP || (mergedPrimary === 'SYP' ? directSymbol : undefined) || DEFAULT_UNIFIED_SETTINGS.currencySymbols.SYP,
  };
  new Set([...Object.keys(cloudSyms), ...Object.keys(localSyms)]).forEach((code) => {
    const cloudSymbol = cloudSyms[code];
    const localSymbol = localSyms[code];
    const symbol = (typeof cloudSymbol === 'string' && cloudSymbol.trim()) || localSymbol;
    if (typeof symbol === 'string' && symbol.trim()) mergedSymbols[code.toUpperCase()] = symbol.trim();
  });

  // 6. أسعار الصرف
  const cloudRates = (cloud.exchange_rates && typeof cloud.exchange_rates === 'object') ? (cloud.exchange_rates as Record<string, any>) : {};
  const localRates = base.exchangeRates || DEFAULT_UNIFIED_SETTINGS.exchangeRates;
  const tryRate = Number(cloudRates.TRY) > 0 ? Number(cloudRates.TRY) : (Number(localRates.TRY) > 0 ? Number(localRates.TRY) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.TRY);
  const sypRate = Number(cloudRates.SYP) > 0 ? Number(cloudRates.SYP) : (Number(localRates.SYP) > 0 ? Number(localRates.SYP) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.SYP);
  const mergedRates: Record<string, number> = { USD: 1, TRY: tryRate, SYP: sypRate };
  new Set([...Object.keys(cloudRates), ...Object.keys(localRates)]).forEach((code) => {
    if (code.toUpperCase() === 'USD') return;
    const cloudRate = Number(cloudRates[code]);
    const localRate = Number(localRates[code]);
    const rate = cloudRate > 0 ? cloudRate : localRate;
    if (rate > 0) mergedRates[code.toUpperCase()] = rate;
  });
  const cloudDisplayModes = cloudSync.currencyDisplayMode || {};
  const localDisplayModes = base.currencyDisplayMode || DEFAULT_UNIFIED_SETTINGS.currencyDisplayMode;
  const mergedDisplayModes: Record<string, CurrencyDisplayMode> = { ...localDisplayModes };
  Object.entries(cloudDisplayModes).forEach(([code, mode]) => {
    if (mode === 'symbol' || mode === 'name' || mode === 'both') {
      mergedDisplayModes[code.toUpperCase()] = mode;
    }
  });

  // 7. اللغة
  const mergedLanguage: Language = (typeof cloud.language === 'string' && cloud.language.trim())
    ? (cloud.language as Language)
    : (base.language || 'ar');

  // 8. الثيم والسمة (معزولة محلياً حسب المنصة ولا تُستبدل من السحابة)
  const localThemeObj = base.themeSettings || DEFAULT_UNIFIED_SETTINGS.themeSettings;
  const mergedThemeSettings: FullThemeSettings = {
    ...localThemeObj,
  };
  const mergedMode: ThemeMode = base.theme || localThemeObj.mode || 'dark';

  // 9. إعدادات المظهر ولوحة التحكم (معزولة محلياً حسب المنصة)
  const mergedAppearance = base.appearanceSettings || DEFAULT_UNIFIED_SETTINGS.appearanceSettings;

  // 10. خط النظام (معزول محلياً حسب المنصة)
  const mergedFont: AppFontId = base.appFont || DEFAULT_APP_FONT_ID;

  // 11. مقياس الواجهة (معزول محلياً حسب المنصة)
  const mergedScale: UIScaleId = base.uiScale || DEFAULT_UI_SCALE_ID;

  // 12. الضريبة
  const mergedTaxEnabled = typeof cloud.tax_enabled === 'boolean'
    ? cloud.tax_enabled
    : (base.taxEnabled ?? false);
  const mergedTaxRate = typeof cloud.tax_rate === 'number'
    ? cloud.tax_rate
    : (base.taxRate ?? 0);

  // 13. خيارات الكاشير والخصم ومسح الباركود
  const mergedDiscountPercent = typeof cloudSync.discountPercentEnabled === 'boolean'
    ? cloudSync.discountPercentEnabled
    : (base.discountPercentEnabled ?? true);
  const mergedDiscountFixed = typeof cloudSync.discountFixedEnabled === 'boolean'
    ? cloudSync.discountFixedEnabled
    : (base.discountFixedEnabled ?? true);
  const mergedBarcodeMode: 'search' | 'add' = cloudSync.barcodeScanMode === 'add' || cloudSync.barcodeScanMode === 'search'
    ? cloudSync.barcodeScanMode
    : (base.barcodeScanMode ?? 'search');
  const mergedHideMaintenance = typeof cloudSync.hideMaintenanceSection === 'boolean'
    ? cloudSync.hideMaintenanceSection
    : (base.hideMaintenanceSection ?? false);
  const mergedTrackCapital = typeof cloudSync.trackCapital === 'boolean'
    ? cloudSync.trackCapital
    : (base.trackCapital ?? false);
  const mergedInitialCapital = cloudSync.initialCapital !== undefined
    ? (Number(cloudSync.initialCapital) || 0)
    : (base.initialCapital ?? 0);

  // 14. الإشعارات والطباعة والنسخ الاحتياطي
  const mergedNotifications = (cloud.notification_settings && typeof cloud.notification_settings === 'object')
    ? { ...base.notificationSettings, ...(cloud.notification_settings as Record<string, unknown>) }
    : (base.notificationSettings || DEFAULT_UNIFIED_SETTINGS.notificationSettings);

  const mergedPrint = (cloud.print_settings && typeof cloud.print_settings === 'object')
    ? { ...base.printSettings, ...(cloud.print_settings as Record<string, unknown>) }
    : (base.printSettings || {});

  const mergedBackup = (cloudSync.backupSettings && typeof cloudSync.backupSettings === 'object')
    ? { ...base.backupSettings, ...cloudSync.backupSettings }
    : (base.backupSettings || DEFAULT_UNIFIED_SETTINGS.backupSettings);

  // 15. حقول المنتجات والحقول المخصصة
  const mergedProductFields = cloudSync.productFieldsConfig || base.productFieldsConfig || null;
  const mergedCustomFields = Array.isArray(cloudSync.customFields)
    ? cloudSync.customFields
    : (base.customFields || null);

  return {
    updatedAt: mergedUpdatedAt,
    storeSettings: mergedStore,
    primaryCurrency: mergedPrimary,
    enabledCurrencies: mergedEnabled,
    exchangeRates: mergedRates,
    currencyNames: mergedNames,
    currencySymbols: mergedSymbols,
    currencyDisplayMode: mergedDisplayModes,
    language: mergedLanguage,
    theme: mergedMode,
    themeSettings: mergedThemeSettings,
    appearanceSettings: mergedAppearance,
    appFont: mergedFont,
    uiScale: mergedScale,
    taxEnabled: mergedTaxEnabled,
    taxRate: mergedTaxRate,
    discountPercentEnabled: mergedDiscountPercent,
    discountFixedEnabled: mergedDiscountFixed,
    barcodeScanMode: mergedBarcodeMode,
    hideMaintenanceSection: mergedHideMaintenance,
    trackCapital: mergedTrackCapital,
    initialCapital: mergedInitialCapital,
    notificationSettings: mergedNotifications,
    printSettings: mergedPrint,
    backupSettings: mergedBackup,
    syncSettings: { ...base.syncSettings, ...(cloudSync.syncSettings || {}) },
    productFieldsConfig: mergedProductFields,
    customFields: mergedCustomFields,
  };
}

/**
 * تطبيق الإعدادات الموحدة على بيئة التشغيل فوراً (DOM, LocalStorage, CustomEvents)
 */
export function applySettingsToRuntime(settings: UnifiedStoreSettings): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. حفظ في SETTINGS_STORAGE_KEY
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (['ar', 'en', 'tr', 'fa', 'ku'].includes(settings.language)) {
      setLanguage(settings.language);
    }

    // مفاتيح التشغيل القديمة يجب أن تتبع النسخة الموحدة أيضاً عند السحب من السحابة.
    if (typeof settings.notificationSettings.durationSeconds === 'number') {
      localStorage.setItem('hyperpos_toast_duration', String(settings.notificationSettings.durationSeconds * 1000));
    }
    if (typeof settings.backupSettings.cloudAutoUpload === 'boolean') {
      localStorage.setItem('hp_cloud_auto_backup', String(settings.backupSettings.cloudAutoUpload));
    }

    // 2. تطبيق الخط المحلي للمنصة
    const platformFont = getStoredAppFont();
    applyAppFontToDOM(platformFont);

    // 3. تطبيق مقياس الواجهة للمنصة
    const platformScale = getStoredUIScale();
    applyUIScaleToDOM(platformScale);

    // 4. تطبيق حقول المنتجات والحقول المخصصة
    if (settings.productFieldsConfig) {
      try {
        localStorage.setItem('hyperpos_product_fields_v1', JSON.stringify(settings.productFieldsConfig));
        emitEvent(EVENTS.PRODUCT_FIELDS_UPDATED, settings.productFieldsConfig);
      } catch {
        // ignore
      }
    }
    if (settings.customFields && Array.isArray(settings.customFields)) {
      try {
        localStorage.setItem('hyperpos_custom_fields_v1', JSON.stringify(settings.customFields));
        emitEvent(EVENTS.CUSTOM_FIELDS_UPDATED, settings.customFields);
      } catch {
        // ignore
      }
    }

    // 5. إطلاق الأحداث العامة لتحديث شاشات الكاشير، الفواتير، والمنتجات
    emitEvent(EVENTS.SETTINGS_UPDATED, settings);
    emitEvent(EVENTS.STORE_TYPE_CHANGED);
  } catch (err) {
    console.error('[StoreSettingsSync] Failed to apply settings to runtime:', err);
  }
}

/**
 * بناء حمولة الحفظ السحابي لجدول stores
 * - تحفظ المظهر والخطوط والمقياس في ملفات منفصلة لكل منصة لمنع الكتابة العكسية
 * - تدمج كائن sync_settings حاملاً إعدادات المتجر والعملات والضرائب والتشغيل و updatedAt
 */
export function buildCloudStorePayload(
  settings: UnifiedStoreSettings,
  existingCloudSync?: Record<string, unknown>
): Record<string, unknown> {
  const mergedSync: Record<string, unknown> = {
    ...(existingCloudSync || {}),
    updatedAt: settings.updatedAt || Date.now(),
    appearanceProfiles: {
      ...((existingCloudSync?.appearanceProfiles as Record<string, unknown>) || {}),
      [getPlatformStoragePrefix()]: {
        theme: settings.themeSettings.mode,
        fullTheme: settings.themeSettings,
        appFont: settings.appFont,
        uiScale: settings.uiScale,
        appearanceSettings: settings.appearanceSettings,
        updatedAt: settings.updatedAt || Date.now(),
      },
    },
    primaryCurrency: settings.primaryCurrency,
    enabledCurrencies: settings.enabledCurrencies,
    currencyNames: settings.currencyNames,
    currencySymbols: settings.currencySymbols,
    currencyDisplayMode: settings.currencyDisplayMode,
    exchangeRates: settings.exchangeRates,
    taxEnabled: settings.taxEnabled,
    taxRate: settings.taxRate,
    discountPercentEnabled: settings.discountPercentEnabled,
    discountFixedEnabled: settings.discountFixedEnabled,
    barcodeScanMode: settings.barcodeScanMode,
    hideMaintenanceSection: settings.hideMaintenanceSection,
    trackCapital: settings.trackCapital,
    initialCapital: settings.initialCapital,
    backupSettings: settings.backupSettings,
    syncSettings: settings.syncSettings || {},
  };

  if (settings.productFieldsConfig) {
    mergedSync.productFieldsConfig = settings.productFieldsConfig;
  }
  if (Array.isArray(settings.customFields)) {
    mergedSync.customFields = settings.customFields;
  }

  const primarySym = settings.currencySymbols[settings.primaryCurrency] || '$';

  return {
    name: settings.storeSettings.name,
    store_type: settings.storeSettings.type,
    phone: settings.storeSettings.phone,
    email: settings.storeSettings.email,
    address: settings.storeSettings.address,
    logo_url: settings.storeSettings.logo,
    primary_currency: settings.primaryCurrency,
    currency_symbol: primarySym,
    exchange_rates: {
      ...settings.exchangeRates,
      USD: 1,
    },
    language: settings.language,
    tax_enabled: settings.taxEnabled,
    tax_rate: settings.taxRate,
    notification_settings: settings.notificationSettings,
    print_settings: settings.printSettings,
    sync_settings: mergedSync,
  };
}


export const applyCloudStoreSettings = (cloudSettings: any) => {
  if (typeof window === 'undefined' || !cloudSettings) return;
  // كل منصة تستعيد ملفها فقط؛ لا يتغير حجم الهاتف من حفظ إعدادات الكمبيوتر.
  const profile = cloudSettings?.sync_settings?.appearanceProfiles?.[getPlatformStoragePrefix()];
  if (profile) {
    const theme = profile.fullTheme;
    if (theme && typeof theme === 'object' && (theme.mode === 'dark' || theme.mode === 'light')) {
      const newValue = JSON.stringify(theme);
      localStorage.setItem(getThemeStorageKey(), newValue);
      localStorage.setItem('hyperpos_theme_v1', newValue);
      applyTheme(theme.mode, theme.color);
      applyBlurTheme(theme.blur, theme.mode, theme.transparency);
      applyThemeStyle(theme.style === 'xiaomi' ? 'xiaomi' : 'standard');
      window.dispatchEvent(new StorageEvent('storage', { key: getThemeStorageKey(), newValue }));
    }
    if (profile.appFont && isValidAppFontId(profile.appFont)) {
      setStoredAppFont(profile.appFont);
    }
    if (profile.uiScale && isValidUIScaleId(profile.uiScale)) {
      setStoredUIScale(profile.uiScale);
    }
    if (profile.appearanceSettings && typeof profile.appearanceSettings === 'object') {
      const layout = profile.appearanceSettings.settingsLayout;
      if (layout === 'grid' || layout === 'list') localStorage.setItem('settings_layout_mode', layout);
      const current = loadUnifiedStoreSettings();
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...current, appearanceSettings: { ...current.appearanceSettings, ...profile.appearanceSettings },
      }));
    }
    emitEvent(EVENTS.THEME_CHANGED);
  }
};

export type StoreSettingsSaveStatus = 'synced' | 'queued' | 'saved_locally';

export interface SaveSettingsResult {
  success: boolean;
  status: StoreSettingsSaveStatus;
  message: string;
}

/**
 * سحب الإعدادات السحابية بحماية Anti-Overwrite Guard (Pull-Before-Push)
 * يتم استدعاؤها عند فتح التطبيق أو تسجيل الدخول:
 * - إذا كان المتصفح جديداً (!localUpdatedAt) أو كان السحابي أحدث (cloudUpdatedAt > localUpdatedAt):
 *   يتم اعتماد الإعدادات السحابية وتحديث localStorage والعملات والضرائب فوراً.
 * - يمنع منعاً باتاً رفع الإعدادات الافتراضية للسحابة أثناء عملية السحب.
 */
export async function pullStoreSettingsWithGuard(): Promise<UnifiedStoreSettings> {
  const localSettings = loadUnifiedStoreSettings();
  try {
    const cloudSettings = await fetchStoreSettings();
    if (!cloudSettings) {
      return localSettings;
    }

    const cloudSync = (cloudSettings.sync_settings && typeof cloudSettings.sync_settings === 'object'
      ? cloudSettings.sync_settings as Record<string, unknown>
      : {}) as Record<string, any>;
    const cloudUpdatedAt = Number(cloudSync.updatedAt) || (cloudSettings.updated_at ? new Date(cloudSettings.updated_at as string).getTime() : 0);
    const localUpdatedAt = Number(localSettings.updatedAt) || 0;

    // إذا كانت جلسة محلية جديدة دون طابع زمني أو كان السحابي أحدث
    if (!localUpdatedAt || cloudUpdatedAt > localUpdatedAt) {
      console.log(`[StoreSettingsSync] Adopting cloud settings (cloud: ${cloudUpdatedAt}, local: ${localUpdatedAt})`);
      applyCloudStoreSettings(cloudSettings);
      const merged = mergeStoreSettings(loadUnifiedStoreSettings(), cloudSettings);
      merged.updatedAt = cloudUpdatedAt || Date.now();
      applySettingsToRuntime(merged);
      return merged;
    } else {
      console.log(`[StoreSettingsSync] Local settings are current (local: ${localUpdatedAt} >= cloud: ${cloudUpdatedAt})`);
      return localSettings;
    }
  } catch (err) {
    console.warn('[StoreSettingsSync] Failed to pull store settings from cloud:', err);
    return localSettings;
  }
}

/**
 * حفظ الإعدادات الموحدة:
 * 1. حفظ محلي فوري وتطبيق على الواجهة بدون أي انتظار مع طابع زمني جديد updatedAt.
 * 2. مزامنة سحابية في الخلفية مع توضيح الحالة الدقيقة.
 */
export async function saveUnifiedStoreSettings(
  partial: Partial<UnifiedStoreSettings>
): Promise<SaveSettingsResult> {
  // 1. تحميل الإعدادات الحالية ودمج الجزئيات معها
  const current = loadUnifiedStoreSettings();
  const updatedAt = partial.updatedAt || Date.now();
  const merged: UnifiedStoreSettings = {
    ...current,
    ...partial,
    updatedAt,
    storeSettings: {
      ...current.storeSettings,
      ...(partial.storeSettings || {}),
    },
    enabledCurrencies: {
      ...current.enabledCurrencies,
      ...(partial.enabledCurrencies || {}),
      USD: true,
    },
    exchangeRates: {
      ...current.exchangeRates,
      ...(partial.exchangeRates || {}),
    },
    currencyNames: {
      ...current.currencyNames,
      USD: (typeof partial.currencyNames?.USD === 'string' && partial.currencyNames.USD.trim()) || current.currencyNames.USD || DEFAULT_UNIFIED_SETTINGS.currencyNames.USD,
      TRY: (typeof partial.currencyNames?.TRY === 'string' && partial.currencyNames.TRY.trim()) || current.currencyNames.TRY || DEFAULT_UNIFIED_SETTINGS.currencyNames.TRY,
      SYP: (typeof partial.currencyNames?.SYP === 'string' && partial.currencyNames.SYP.trim()) || current.currencyNames.SYP || DEFAULT_UNIFIED_SETTINGS.currencyNames.SYP,
      ...(partial.currencyNames ? Object.fromEntries(
        Object.entries(partial.currencyNames).filter(([_, v]) => typeof v === 'string' && v.trim() !== '')
      ) : {}),
    },
    currencySymbols: {
      ...current.currencySymbols,
      USD: (typeof partial.currencySymbols?.USD === 'string' && partial.currencySymbols.USD.trim()) || current.currencySymbols.USD || DEFAULT_UNIFIED_SETTINGS.currencySymbols.USD,
      TRY: (typeof partial.currencySymbols?.TRY === 'string' && partial.currencySymbols.TRY.trim()) || current.currencySymbols.TRY || DEFAULT_UNIFIED_SETTINGS.currencySymbols.TRY,
      SYP: (typeof partial.currencySymbols?.SYP === 'string' && partial.currencySymbols.SYP.trim()) || current.currencySymbols.SYP || DEFAULT_UNIFIED_SETTINGS.currencySymbols.SYP,
      ...(partial.currencySymbols ? Object.fromEntries(
        Object.entries(partial.currencySymbols).filter(([_, v]) => typeof v === 'string' && v.trim() !== '')
      ) : {}),
    },
    currencyDisplayMode: {
      ...current.currencyDisplayMode,
      ...(partial.currencyDisplayMode || {}),
    },
    themeSettings: {
      ...current.themeSettings,
      ...(partial.themeSettings || {}),
    },
    appearanceSettings: {
      ...current.appearanceSettings,
      ...(partial.appearanceSettings || {}),
    },
    notificationSettings: {
      ...current.notificationSettings,
      ...(partial.notificationSettings || {}),
    },
    printSettings: {
      ...current.printSettings,
      ...(partial.printSettings || {}),
    },
    backupSettings: {
      ...current.backupSettings,
      ...(partial.backupSettings || {}),
    },
    syncSettings: { ...current.syncSettings, ...(partial.syncSettings || {}) },
  };

  // 2. تطبيق محلي فوري وشامل
  applySettingsToRuntime(merged);

  // 3. تجهيز حمولة السحابة
  const cloudPayload = buildCloudStorePayload(merged);

  // 4. إذا كان الجهاز غير متصل بالإنترنت: إضافة أو دمج في طابور التزامن فوراً
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      enqueueStoreSettingsUpdate(cloudPayload);
      console.log('[StoreSettingsSync] Saved offline to consolidated sync queue');
    } catch (e) {
      console.warn('[StoreSettingsSync] Failed to enqueue offline store settings:', e);
    }
    return {
      success: true,
      status: 'queued',
      message: 'تم الحفظ محلياً وبانتظار المزامنة عند توفر الاتصال',
    };
  }

  // 5. محاولة المزامنة المباشرة مع السحابة
  try {
    const success = await saveStoreSettingsDirect(cloudPayload);
    if (success) {
      return {
        success: true,
        status: 'synced',
        message: 'تم الحفظ والمزامنة السحابية بنجاح',
      };
    } else {
      enqueueStoreSettingsUpdate(cloudPayload);
      return {
        success: true,
        status: 'queued',
        message: 'تم الحفظ محلياً، وأُضيفت العملية للمزامنة في الخلفية',
      };
    }
  } catch (err) {
    console.warn('[StoreSettingsSync] Network error while syncing settings, enqueuing:', err);
    enqueueStoreSettingsUpdate(cloudPayload);
    return {
      success: true,
      status: 'queued',
      message: 'تم الحفظ محلياً، وأُضيفت للمزامنة في الخلفية',
    };
  }
}
