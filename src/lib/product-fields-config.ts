// Product Fields Configuration - Dynamic fields based on store type and user preferences

export interface ProductFieldsConfig {
  expiryDate: boolean;
  serialNumber: boolean;
  warranty: boolean;
  wholesalePrice: boolean;
  sizeColor: boolean;
  minStockLevel: boolean;
}

export type StoreType = 'phones' | 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'repair' | 'bookstore' | 'general' | 'custom';

// Default fields based on store type
export const getDefaultFieldsByStoreType = (storeType: StoreType): ProductFieldsConfig => {
  switch (storeType) {
    case 'phones':
    case 'repair':
      return {
        expiryDate: false,
        serialNumber: true,
        warranty: true,
        wholesalePrice: true,
        sizeColor: false,
        minStockLevel: true,
      };
    case 'grocery':
    case 'pharmacy':
      return {
        expiryDate: true,
        serialNumber: false,
        warranty: false,
        wholesalePrice: true,
        sizeColor: false,
        minStockLevel: true,
      };
    case 'clothing':
      return {
        expiryDate: false,
        serialNumber: false,
        warranty: false,
        wholesalePrice: true,
        sizeColor: true,
        minStockLevel: true,
      };
    case 'restaurant':
      return {
        expiryDate: true,
        serialNumber: false,
        warranty: false,
        wholesalePrice: false,
        sizeColor: false,
        minStockLevel: true,
      };
    case 'bookstore':
      return {
        expiryDate: false,
        serialNumber: true, // ISBN
        warranty: false,
        wholesalePrice: true,
        sizeColor: false,
        minStockLevel: true,
      };
    case 'general':
    case 'custom':
    default:
      return {
        expiryDate: true,
        serialNumber: true,
        warranty: true,
        wholesalePrice: true,
        sizeColor: true,
        minStockLevel: true,
      };
  }
};

const PRODUCT_FIELDS_STORAGE_KEY = 'hyperpos_product_fields_v1';

// Load user-defined field configuration
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

// Save user-defined field configuration
export const saveProductFieldsConfig = (config: ProductFieldsConfig): boolean => {
  try {
    localStorage.setItem(PRODUCT_FIELDS_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Failed to save product fields config:', error);
    return false;
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
};
