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
} from '@/lib/app-font-config';
import {
  UIScaleId,
  UI_SCALE_STORAGE_KEY,
  UI_SCALE_CHANGED_EVENT,
  DEFAULT_UI_SCALE_ID,
  isValidUIScaleId,
  applyUIScaleToDOM,
} from '@/lib/ui-scale-config';
import { applyTheme, applyBlurTheme, ThemeMode, ThemeColor } from '@/hooks/use-theme';
import { Language, setLanguage } from '@/lib/i18n';
import { ProductFieldsConfig } from '@/lib/product-fields-config';
import { CustomField } from '@/lib/custom-fields-config';
import {
  StoreSettingsRow,
  saveStoreSettingsDirect,
  fetchStoreSettings,
} from '@/lib/supabase-store';
import { enqueueStoreSettingsUpdate } from '@/lib/sync-queue';
import { emitEvent, EVENTS } from '@/lib/events';

export const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';
export const THEME_STORAGE_KEY = 'hyperpos_theme_v1';

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
}

export interface UnifiedStoreSettings {
  storeSettings: StoreInfo;
  primaryCurrency: 'USD' | 'TRY' | 'SYP' | string;
  enabledCurrencies: {
    USD: boolean;
    TRY: boolean;
    SYP: boolean;
    [code: string]: boolean;
  };
  exchangeRates: {
    USD: number;
    TRY: number;
    SYP: number;
    [code: string]: number;
  };
  currencyNames: {
    USD: string;
    TRY: string;
    SYP: string;
    [code: string]: string;
  };
  currencySymbols: {
    USD: string;
    TRY: string;
    SYP: string;
    [code: string]: string;
  };
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
  productFieldsConfig?: ProductFieldsConfig | null;
  customFields?: CustomField[] | null;
}

export const DEFAULT_UNIFIED_SETTINGS: UnifiedStoreSettings = {
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
    TRY: true,
    SYP: true,
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

    // قراءة الثيم المحلي
    let localThemeSettings: FullThemeSettings = DEFAULT_UNIFIED_SETTINGS.themeSettings;
    try {
      const rawTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (rawTheme) {
        const pt = JSON.parse(rawTheme);
        localThemeSettings = {
          mode: pt.mode === 'light' ? 'light' : 'dark',
          color: pt.color || 'emerald',
          blur: pt.blur ?? true,
          transparency: typeof pt.transparency === 'number' ? pt.transparency : 80,
        };
      }
    } catch {
      // ignore
    }

    // قراءة الخط المحلي
    let localFont: AppFontId = DEFAULT_APP_FONT_ID;
    try {
      const storedFont = localStorage.getItem(APP_FONT_STORAGE_KEY);
      if (isValidAppFontId(storedFont)) {
        localFont = storedFont;
      } else if (isValidAppFontId(parsed?.appFont || parsed?.font_family)) {
        localFont = (parsed?.appFont || parsed?.font_family) as AppFontId;
      }
    } catch {
      // ignore
    }

    // قراءة المقياس المحلي
    let localScale: UIScaleId = DEFAULT_UI_SCALE_ID;
    try {
      const storedScale = localStorage.getItem(UI_SCALE_STORAGE_KEY);
      if (isValidUIScaleId(storedScale)) {
        localScale = storedScale;
      } else if (isValidUIScaleId(parsed?.uiScale || parsed?.sync_settings?.uiScale || parsed?.syncSettings?.uiScale)) {
        localScale = (parsed?.uiScale || parsed?.sync_settings?.uiScale || parsed?.syncSettings?.uiScale) as UIScaleId;
      }
    } catch {
      // ignore
    }

    // قراءة نمط لوحة التحكم
    let localDesign: 'classic' | 'unified_pro' = 'classic';
    try {
      const d = localStorage.getItem('hyperpos_dashboard_design_v1');
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
    };

    const rawSyms = parsed?.currencySymbols || {};
    const currencySymbols = {
      USD: (typeof rawSyms.USD === 'string' && rawSyms.USD.trim()) ? rawSyms.USD.trim() : DEFAULT_UNIFIED_SETTINGS.currencySymbols.USD,
      TRY: (typeof rawSyms.TRY === 'string' && rawSyms.TRY.trim()) ? rawSyms.TRY.trim() : DEFAULT_UNIFIED_SETTINGS.currencySymbols.TRY,
      SYP: (typeof rawSyms.SYP === 'string' && rawSyms.SYP.trim()) ? rawSyms.SYP.trim() : DEFAULT_UNIFIED_SETTINGS.currencySymbols.SYP,
    };

    const rawRates = parsed?.exchangeRates || {};
    const exchangeRates = {
      USD: 1,
      TRY: Number(rawRates.TRY) > 0 ? Number(rawRates.TRY) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.TRY,
      SYP: Number(rawRates.SYP) > 0 ? Number(rawRates.SYP) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.SYP,
    };

    const rawEnabled = parsed?.enabledCurrencies || {};
    const enabledCurrencies = {
      USD: rawEnabled.USD !== false,
      TRY: rawEnabled.TRY !== false,
      SYP: rawEnabled.SYP !== false,
    };

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
      storeSettings,
      primaryCurrency: parsed?.primaryCurrency || 'USD',
      enabledCurrencies,
      exchangeRates,
      currencyNames,
      currencySymbols,
      language: (parsed?.language as Language) || 'ar',
      theme: parsed?.theme || localThemeSettings.mode || 'dark',
      themeSettings: parsed?.themeSettings || localThemeSettings,
      appearanceSettings: {
        dashboardDesign: localDesign,
        ...(parsed?.appearanceSettings || {}),
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
      backupSettings: parsed?.backupSettings || DEFAULT_UNIFIED_SETTINGS.backupSettings,
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
  const mergedEnabled = {
    USD: cloudEnabled.USD !== undefined ? Boolean(cloudEnabled.USD) : localEnabled.USD !== false,
    TRY: cloudEnabled.TRY !== undefined ? Boolean(cloudEnabled.TRY) : localEnabled.TRY !== false,
    SYP: cloudEnabled.SYP !== undefined ? Boolean(cloudEnabled.SYP) : localEnabled.SYP !== false,
  };
  // ضمان تفعيل عملة واحدة على الأقل
  if (!mergedEnabled.USD && !mergedEnabled.TRY && !mergedEnabled.SYP) {
    mergedEnabled.USD = true;
  }

  // 4. أسماء العملات (منع الفراغ دائماً)
  const cloudNames = cloudSync.currencyNames || {};
  const localNames = base.currencyNames || DEFAULT_UNIFIED_SETTINGS.currencyNames;
  const mergedNames = {
    USD: (typeof cloudNames.USD === 'string' && cloudNames.USD.trim()) || localNames.USD || DEFAULT_UNIFIED_SETTINGS.currencyNames.USD,
    TRY: (typeof cloudNames.TRY === 'string' && cloudNames.TRY.trim()) || localNames.TRY || DEFAULT_UNIFIED_SETTINGS.currencyNames.TRY,
    SYP: (typeof cloudNames.SYP === 'string' && cloudNames.SYP.trim()) || localNames.SYP || DEFAULT_UNIFIED_SETTINGS.currencyNames.SYP,
  };

  // 5. رموز العملات (منع الفراغ دائماً)
  const cloudSyms = cloudSync.currencySymbols || {};
  const localSyms = base.currencySymbols || DEFAULT_UNIFIED_SETTINGS.currencySymbols;
  const directSymbol = (typeof cloud.currency_symbol === 'string' && cloud.currency_symbol.trim()) ? cloud.currency_symbol.trim() : undefined;
  const mergedSymbols = {
    USD: (typeof cloudSyms.USD === 'string' && cloudSyms.USD.trim()) || localSyms.USD || (mergedPrimary === 'USD' ? directSymbol : undefined) || DEFAULT_UNIFIED_SETTINGS.currencySymbols.USD,
    TRY: (typeof cloudSyms.TRY === 'string' && cloudSyms.TRY.trim()) || localSyms.TRY || (mergedPrimary === 'TRY' ? directSymbol : undefined) || DEFAULT_UNIFIED_SETTINGS.currencySymbols.TRY,
    SYP: (typeof cloudSyms.SYP === 'string' && cloudSyms.SYP.trim()) || localSyms.SYP || (mergedPrimary === 'SYP' ? directSymbol : undefined) || DEFAULT_UNIFIED_SETTINGS.currencySymbols.SYP,
  };

  // 6. أسعار الصرف
  const cloudRates = (cloud.exchange_rates && typeof cloud.exchange_rates === 'object') ? (cloud.exchange_rates as Record<string, any>) : {};
  const localRates = base.exchangeRates || DEFAULT_UNIFIED_SETTINGS.exchangeRates;
  const tryRate = Number(cloudRates.TRY) > 0 ? Number(cloudRates.TRY) : (Number(localRates.TRY) > 0 ? Number(localRates.TRY) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.TRY);
  const sypRate = Number(cloudRates.SYP) > 0 ? Number(cloudRates.SYP) : (Number(localRates.SYP) > 0 ? Number(localRates.SYP) : DEFAULT_UNIFIED_SETTINGS.exchangeRates.SYP);
  const mergedRates = {
    USD: 1,
    TRY: tryRate,
    SYP: sypRate,
  };

  // 7. اللغة
  const mergedLanguage: Language = (typeof cloud.language === 'string' && cloud.language.trim())
    ? (cloud.language as Language)
    : (base.language || 'ar');

  // 8. الثيم والسمة الكاملة
  const cloudThemeObj = (cloud.theme_settings && typeof cloud.theme_settings === 'object')
    ? (cloud.theme_settings as Record<string, any>)
    : (cloudSync.theme || {});
  const localThemeObj = base.themeSettings || DEFAULT_UNIFIED_SETTINGS.themeSettings;

  const mergedMode: ThemeMode = (cloud.theme === 'light' || cloud.theme === 'dark')
    ? cloud.theme
    : (cloudThemeObj.mode === 'light' || cloudThemeObj.mode === 'dark')
    ? cloudThemeObj.mode
    : (localThemeObj.mode || 'dark');

  const mergedThemeSettings: FullThemeSettings = {
    mode: mergedMode,
    color: (cloudThemeObj.color as ThemeColor) || localThemeObj.color || 'emerald',
    blur: cloudThemeObj.blur !== undefined ? Boolean(cloudThemeObj.blur) : (localThemeObj.blur ?? true),
    transparency: typeof cloudThemeObj.transparency === 'number' ? cloudThemeObj.transparency : (localThemeObj.transparency ?? 80),
  };

  // 9. إعدادات المظهر ولوحة التحكم
  const cloudAppearance = (cloud.appearance_settings && typeof cloud.appearance_settings === 'object')
    ? (cloud.appearance_settings as Record<string, any>)
    : (cloudSync.appearanceSettings || {});
  const localAppearance = base.appearanceSettings || DEFAULT_UNIFIED_SETTINGS.appearanceSettings;
  const mergedAppearance = {
    ...localAppearance,
    ...cloudAppearance,
    dashboardDesign: (cloudAppearance.dashboardDesign === 'unified_pro' || cloudAppearance.dashboardDesign === 'classic')
      ? cloudAppearance.dashboardDesign
      : (cloudSync.dashboardDesign || localAppearance.dashboardDesign || 'classic'),
  };

  // 10. خط النظام (appFont / font_family)
  let mergedFont: AppFontId = base.appFont || DEFAULT_APP_FONT_ID;
  if (isValidAppFontId(cloud.font_family)) {
    mergedFont = cloud.font_family as AppFontId;
  } else if (isValidAppFontId(cloudSync.appFont)) {
    mergedFont = cloudSync.appFont as AppFontId;
  }

  // 11. مقياس الواجهة (uiScale)
  let mergedScale: UIScaleId = base.uiScale || DEFAULT_UI_SCALE_ID;
  if (isValidUIScaleId(cloudSync.uiScale)) {
    mergedScale = cloudSync.uiScale as UIScaleId;
  }

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
  const mergedBarcodeMode: 'search' | 'add' = cloudSync.barcodeScanMode === 'add'
    ? 'add'
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
  const mergedCustomFields = (Array.isArray(cloudSync.customFields) && cloudSync.customFields.length > 0)
    ? cloudSync.customFields
    : (base.customFields || null);

  return {
    storeSettings: mergedStore,
    primaryCurrency: mergedPrimary,
    enabledCurrencies: mergedEnabled,
    exchangeRates: mergedRates,
    currencyNames: mergedNames,
    currencySymbols: mergedSymbols,
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

    // 2. تطبيق الخط وتحديث مفتاحه
    if (isValidAppFontId(settings.appFont)) {
      try {
        localStorage.setItem(APP_FONT_STORAGE_KEY, settings.appFont);
        applyAppFontToDOM(settings.appFont);
        window.dispatchEvent(new CustomEvent(APP_FONT_CHANGED_EVENT, { detail: { fontId: settings.appFont } }));
      } catch {
        // ignore
      }
    }

    // 3. تطبيق مقياس الواجهة وتحديث مفتاحه
    if (isValidUIScaleId(settings.uiScale)) {
      try {
        localStorage.setItem(UI_SCALE_STORAGE_KEY, settings.uiScale);
        applyUIScaleToDOM(settings.uiScale);
        window.dispatchEvent(new CustomEvent(UI_SCALE_CHANGED_EVENT, { detail: { scaleId: settings.uiScale } }));
      } catch {
        // ignore
      }
    }

    // 4. تطبيق الثيم وتحديث مفتاحه
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings.themeSettings));
      applyTheme(settings.themeSettings.mode, settings.themeSettings.color);
      applyBlurTheme(settings.themeSettings.blur, settings.themeSettings.mode, settings.themeSettings.transparency);
    } catch {
      // ignore
    }

    // 5. تطبيق نمط لوحة التحكم
    if (settings.appearanceSettings?.dashboardDesign) {
      try {
        localStorage.setItem('hyperpos_dashboard_design_v1', settings.appearanceSettings.dashboardDesign);
        window.dispatchEvent(new CustomEvent('hyperpos:design-changed', { detail: settings.appearanceSettings.dashboardDesign }));
      } catch {
        // ignore
      }
    }

    // 6. تطبيق حقول المنتجات والحقول المخصصة
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

    // 7. إطلاق الأحداث العامة لتحديث شاشات الكاشير، الفواتير، والمنتجات
    emitEvent(EVENTS.SETTINGS_UPDATED, settings);
    emitEvent(EVENTS.STORE_TYPE_CHANGED);
  } catch (err) {
    console.error('[StoreSettingsSync] Failed to apply settings to runtime:', err);
  }
}

/**
 * بناء حمولة الحفظ السحابي لجدول stores
 * - تملأ الأعمدة المخصصة: theme, theme_settings, appearance_settings, font_family, primary_currency, etc.
 * - تدمج كائن sync_settings بالكامل شاملاً كل الإعدادات المشتركة
 */
export function buildCloudStorePayload(
  settings: UnifiedStoreSettings,
  existingCloudSync?: Record<string, unknown>
): Record<string, unknown> {
  const mergedSync: Record<string, unknown> = {
    ...(existingCloudSync || {}),
    uiScale: settings.uiScale,
    appFont: settings.appFont,
    theme: settings.themeSettings,
    primaryCurrency: settings.primaryCurrency,
    enabledCurrencies: settings.enabledCurrencies,
    currencyNames: settings.currencyNames,
    currencySymbols: settings.currencySymbols,
    discountPercentEnabled: settings.discountPercentEnabled,
    discountFixedEnabled: settings.discountFixedEnabled,
    barcodeScanMode: settings.barcodeScanMode,
    hideMaintenanceSection: settings.hideMaintenanceSection,
    trackCapital: settings.trackCapital,
    initialCapital: settings.initialCapital,
    backupSettings: settings.backupSettings,
    dashboardDesign: settings.appearanceSettings?.dashboardDesign || 'classic',
  };

  if (settings.productFieldsConfig) {
    mergedSync.productFieldsConfig = settings.productFieldsConfig;
  }
  if (settings.customFields && settings.customFields.length > 0) {
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
      USD: 1,
      TRY: settings.exchangeRates.TRY,
      SYP: settings.exchangeRates.SYP,
    },
    language: settings.language,
    theme: settings.themeSettings.mode,
    theme_settings: settings.themeSettings,
    appearance_settings: {
      dashboardDesign: settings.appearanceSettings?.dashboardDesign || 'classic',
      ...settings.appearanceSettings,
    },
    font_family: settings.appFont,
    tax_enabled: settings.taxEnabled,
    tax_rate: settings.taxRate,
    notification_settings: settings.notificationSettings,
    print_settings: settings.printSettings,
    sync_settings: mergedSync,
  };
}

export type StoreSettingsSaveStatus = 'synced' | 'queued' | 'saved_locally';

export interface SaveSettingsResult {
  success: boolean;
  status: StoreSettingsSaveStatus;
  message: string;
}

/**
 * حفظ الإعدادات الموحدة:
 * 1. حفظ محلي فوري وتطبيق على الواجهة بدون أي انتظار.
 * 2. مزامنة سحابية في الخلفية مع توضيح الحالة الدقيقة (محفوظ محلياً، بانتظار المزامنة، تمت المزامنة).
 */
export async function saveUnifiedStoreSettings(
  partial: Partial<UnifiedStoreSettings>
): Promise<SaveSettingsResult> {
  // 1. تحميل الإعدادات الحالية ودمج الجزئيات معها
  const current = loadUnifiedStoreSettings();
  const merged: UnifiedStoreSettings = {
    ...current,
    ...partial,
    storeSettings: {
      ...current.storeSettings,
      ...(partial.storeSettings || {}),
    },
    enabledCurrencies: {
      ...current.enabledCurrencies,
      ...(partial.enabledCurrencies || {}),
    },
    exchangeRates: {
      ...current.exchangeRates,
      ...(partial.exchangeRates || {}),
    },
    currencyNames: {
      ...current.currencyNames,
      ...(partial.currencyNames || {}),
    },
    currencySymbols: {
      ...current.currencySymbols,
      ...(partial.currencySymbols || {}),
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
