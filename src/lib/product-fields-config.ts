// Product Fields Configuration - Dynamic fields based on store type and user preferences

import { emitEvent, EVENTS } from './events';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from './supabase-store';

export interface ProductFieldsConfig {
  expiryDate: boolean;
  batchNumber: boolean;
  serialNumber: boolean;
  warranty: boolean;
  wholesalePrice: boolean;
  sizeColor: boolean;
  minStockLevel: boolean;
  weight: boolean;
  fabricType: boolean;
  tableNumber: boolean;
  orderNotes: boolean;
  author: boolean;
  publisher: boolean;
}

export type StoreType = 'phones' | 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'repair' | 'bookstore' | 'bakery' | 'general' | 'custom';

// Default fields based on store type
export const getDefaultFieldsByStoreType = (storeType: StoreType): ProductFieldsConfig => {
  switch (storeType) {
    case 'phones':
      return {
        expiryDate: false, batchNumber: false, serialNumber: true, warranty: true,
        wholesalePrice: true, sizeColor: false, minStockLevel: true,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'repair':
      return {
        expiryDate: false, batchNumber: false, serialNumber: true, warranty: true,
        wholesalePrice: false, sizeColor: false, minStockLevel: true,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'grocery':
      return {
        expiryDate: true, batchNumber: false, serialNumber: false, warranty: false,
        wholesalePrice: true, sizeColor: false, minStockLevel: true,
        weight: true, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'pharmacy':
      return {
        expiryDate: true, batchNumber: true, serialNumber: false, warranty: false,
        wholesalePrice: true, sizeColor: false, minStockLevel: true,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'clothing':
      return {
        expiryDate: false, batchNumber: false, serialNumber: false, warranty: false,
        wholesalePrice: true, sizeColor: true, minStockLevel: true,
        weight: false, fabricType: true, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'bakery':
      return {
        expiryDate: false, batchNumber: false, serialNumber: false, warranty: false,
        wholesalePrice: true, sizeColor: false, minStockLevel: false,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'restaurant':
      return {
        expiryDate: true, batchNumber: false, serialNumber: false, warranty: false,
        wholesalePrice: false, sizeColor: false, minStockLevel: true,
        weight: false, fabricType: false, tableNumber: true, orderNotes: true, author: false, publisher: false,
      };
    case 'bakery':
      return {
        expiryDate: false, batchNumber: false, serialNumber: false, warranty: false,
        wholesalePrice: true, sizeColor: false, minStockLevel: false,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
    case 'bookstore':
      return {
        expiryDate: false, batchNumber: false, serialNumber: true, warranty: false,
        wholesalePrice: true, sizeColor: false, minStockLevel: true,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: true, publisher: true,
      };
    case 'general':
    case 'custom':
    default:
      return {
        expiryDate: false, batchNumber: false, serialNumber: false, warranty: false,
        wholesalePrice: false, sizeColor: false, minStockLevel: false,
        weight: false, fabricType: false, tableNumber: false, orderNotes: false, author: false, publisher: false,
      };
  }
};

const PRODUCT_FIELDS_STORAGE_KEY = 'hyperpos_product_fields_v1';

// Load user-defined field configuration from localStorage (for instant access)
export const loadProductFieldsConfig = (): ProductFieldsConfig | null => {
  try {
    const stored = localStorage.getItem(PRODUCT_FIELDS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load product fields config:', error);
  }
  return null;
};

// Save user-defined field configuration (to both localStorage and cloud)
export const saveProductFieldsConfig = async (config: ProductFieldsConfig): Promise<boolean> => {
  try {
    // Save to localStorage for instant access
    localStorage.setItem(PRODUCT_FIELDS_STORAGE_KEY, JSON.stringify(config));

    // Emit event to notify components in the same tab
    emitEvent(EVENTS.PRODUCT_FIELDS_UPDATED, config);

    // Sync to cloud - merge with existing sync_settings instead of overwriting
    const userId = getCurrentUserId();
    if (userId) {
      // First read existing sync_settings
      const { data: storeData } = await supabase
        .from('stores')
        .select('sync_settings')
        .eq('user_id', userId)
        .maybeSingle();

      const existingSyncSettings = (storeData?.sync_settings as Record<string, unknown>) || {};

      // Merge productFieldsConfig into existing settings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('stores')
        .update({
          sync_settings: {
            ...existingSyncSettings,
            productFieldsConfig: config
          }
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to sync product fields to cloud:', error);
      } else {
        console.log('[ProductFields] Synced to cloud successfully');
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to save product fields config:', error);
    return false;
  }
};

// Load product fields from cloud and sync to localStorage
export const syncProductFieldsFromCloud = async (): Promise<ProductFieldsConfig | null> => {
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('stores')
      .select('sync_settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch product fields from cloud:', error);
      return null;
    }

    const syncSettings = data?.sync_settings as { productFieldsConfig?: ProductFieldsConfig } | null;
    const cloudConfig = syncSettings?.productFieldsConfig;

    if (cloudConfig) {
      // Sync to localStorage
      localStorage.setItem(PRODUCT_FIELDS_STORAGE_KEY, JSON.stringify(cloudConfig));
      emitEvent(EVENTS.PRODUCT_FIELDS_UPDATED, cloudConfig);
      console.log('[ProductFields] Synced from cloud to localStorage');
      return cloudConfig;
    }

    return null;
  } catch (error) {
    console.error('Failed to sync product fields from cloud:', error);
    return null;
  }
};

// Get effective field configuration (user override or store type default)
export const getEffectiveFieldsConfig = (): ProductFieldsConfig => {
  // First check user overrides
  const userConfig = loadProductFieldsConfig();
  if (userConfig) {
    return userConfig;
  }

  // Otherwise use store type defaults
  try {
    const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      const storeType = settings.storeSettings?.type || 'general';
      return getDefaultFieldsByStoreType(storeType);
    }
  } catch (error) {
    console.error('Failed to load store settings for fields config:', error);
  }

  return getDefaultFieldsByStoreType('general');
};

// Field labels in Arabic
export const FIELD_LABELS: Record<keyof ProductFieldsConfig, { name: string; description: string }> = {
  expiryDate: {
    name: 'تاريخ الصلاحية',
    description: 'للمنتجات الغذائية والأدوية',
  },
  batchNumber: {
    name: 'رقم التشغيلة',
    description: 'رقم الدفعة أو التشغيلة للأدوية',
  },
  serialNumber: {
    name: 'الرقم التسلسلي',
    description: 'IMEI للهواتف أو ISBN للكتب',
  },
  warranty: {
    name: 'الضمان',
    description: 'مدة ضمان المنتج',
  },
  wholesalePrice: {
    name: 'سعر الجملة',
    description: 'سعر خاص للبيع بالجملة',
  },
  sizeColor: {
    name: 'المقاس واللون',
    description: 'للملابس والأزياء',
  },
  minStockLevel: {
    name: 'الحد الأدنى للمخزون',
    description: 'تنبيه عند انخفاض الكمية',
  },
  weight: {
    name: 'الوزن',
    description: 'وزن المنتج بالكيلو أو الجرام',
  },
  fabricType: {
    name: 'نوع القماش',
    description: 'نوع قماش الملابس',
  },
  tableNumber: {
    name: 'رقم الطاولة',
    description: 'رقم الطاولة في المطعم',
  },
  orderNotes: {
    name: 'ملاحظات الطلب',
    description: 'ملاحظات خاصة بالطلب',
  },
  author: {
    name: 'اسم المؤلف',
    description: 'مؤلف الكتاب',
  },
  publisher: {
    name: 'دار النشر',
    description: 'دار نشر الكتاب',
  },
};
