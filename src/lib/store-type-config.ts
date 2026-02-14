// Store Type Configuration - Dynamic terminology and visibility based on business type

import { StoreType } from './product-fields-config';

// Terminology keys that change based on store type
export type TerminologyKey =
  | 'product'
  | 'products'
  | 'addProduct'
  | 'editProduct'
  | 'category'
  | 'categories'
  | 'barcode'
  | 'maintenance'
  | 'productSearch'
  | 'productCount'
  | 'lowStockAlert'
  | 'topProducts'
  | 'newProduct'
  | 'newProductDesc'
  | 'pageTitle'
  | 'pageSubtitle';

interface TerminologySet {
  ar: Record<TerminologyKey, string>;
  en: Record<TerminologyKey, string>;
}

const terminologyMap: Record<string, TerminologySet> = {
  phones: {
    ar: {
      product: 'منتج',
      products: 'المنتجات',
      addProduct: 'إضافة منتج',
      editProduct: 'تعديل المنتج',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود / IMEI',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن منتج أو باركود...',
      productCount: 'إجمالي المنتجات',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'المنتجات الأكثر مبيعاً',
      newProduct: 'منتج جديد',
      newProductDesc: 'إضافة منتج للمخزن',
      pageTitle: 'إدارة المنتجات',
      pageSubtitle: 'إدارة مخزون المنتجات والأسعار',
    },
    en: {
      product: 'Product',
      products: 'Products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode / IMEI',
      maintenance: 'Maintenance',
      productSearch: 'Search product or barcode...',
      productCount: 'Total Products',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Products',
      newProduct: 'New Product',
      newProductDesc: 'Add product to inventory',
      pageTitle: 'Product Management',
      pageSubtitle: 'Manage product inventory and prices',
    },
  },
  grocery: {
    ar: {
      product: 'منتج',
      products: 'المنتجات',
      addProduct: 'إضافة منتج',
      editProduct: 'تعديل المنتج',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن منتج أو باركود...',
      productCount: 'إجمالي المنتجات',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'المنتجات الأكثر مبيعاً',
      newProduct: 'منتج جديد',
      newProductDesc: 'إضافة منتج للمخزن',
      pageTitle: 'إدارة المنتجات',
      pageSubtitle: 'إدارة مخزون المواد الغذائية والأسعار',
    },
    en: {
      product: 'Product',
      products: 'Products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search product or barcode...',
      productCount: 'Total Products',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Products',
      newProduct: 'New Product',
      newProductDesc: 'Add product to inventory',
      pageTitle: 'Product Management',
      pageSubtitle: 'Manage grocery inventory and prices',
    },
  },
  pharmacy: {
    ar: {
      product: 'دواء',
      products: 'الأدوية',
      addProduct: 'إضافة دواء',
      editProduct: 'تعديل الدواء',
      category: 'التصنيف الدوائي',
      categories: 'التصنيفات الدوائية',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن دواء أو باركود...',
      productCount: 'إجمالي الأدوية',
      lowStockAlert: 'تنبيهات المخزون الدوائي',
      topProducts: 'الأدوية الأكثر مبيعاً',
      newProduct: 'دواء جديد',
      newProductDesc: 'إضافة دواء للمخزن',
      pageTitle: 'إدارة الأدوية',
      pageSubtitle: 'إدارة مخزون الأدوية والمستحضرات',
    },
    en: {
      product: 'Medicine',
      products: 'Medicines',
      addProduct: 'Add Medicine',
      editProduct: 'Edit Medicine',
      category: 'Drug Category',
      categories: 'Drug Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search medicine or barcode...',
      productCount: 'Total Medicines',
      lowStockAlert: 'Medicine Stock Alerts',
      topProducts: 'Top Selling Medicines',
      newProduct: 'New Medicine',
      newProductDesc: 'Add medicine to inventory',
      pageTitle: 'Medicine Management',
      pageSubtitle: 'Manage medicine inventory and prices',
    },
  },
  clothing: {
    ar: {
      product: 'قطعة',
      products: 'الأصناف',
      addProduct: 'إضافة قطعة',
      editProduct: 'تعديل القطعة',
      category: 'النوع',
      categories: 'الأنواع',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن صنف أو باركود...',
      productCount: 'إجمالي الأصناف',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'الأصناف الأكثر مبيعاً',
      newProduct: 'صنف جديد',
      newProductDesc: 'إضافة صنف جديد',
      pageTitle: 'إدارة الأصناف',
      pageSubtitle: 'إدارة مخزون الملابس والأزياء',
    },
    en: {
      product: 'Item',
      products: 'Items',
      addProduct: 'Add Item',
      editProduct: 'Edit Item',
      category: 'Type',
      categories: 'Types',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search item or barcode...',
      productCount: 'Total Items',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Items',
      newProduct: 'New Item',
      newProductDesc: 'Add item to inventory',
      pageTitle: 'Item Management',
      pageSubtitle: 'Manage clothing inventory and prices',
    },
  },
  restaurant: {
    ar: {
      product: 'طبق',
      products: 'القائمة',
      addProduct: 'إضافة طبق',
      editProduct: 'تعديل الطبق',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن طبق...',
      productCount: 'إجمالي الأطباق',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'الأطباق الأكثر طلباً',
      newProduct: 'طبق جديد',
      newProductDesc: 'إضافة طبق للقائمة',
      pageTitle: 'إدارة القائمة',
      pageSubtitle: 'إدارة الأطباق والأسعار',
    },
    en: {
      product: 'Dish',
      products: 'Menu',
      addProduct: 'Add Dish',
      editProduct: 'Edit Dish',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search dish...',
      productCount: 'Total Dishes',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Most Ordered Dishes',
      newProduct: 'New Dish',
      newProductDesc: 'Add dish to menu',
      pageTitle: 'Menu Management',
      pageSubtitle: 'Manage dishes and prices',
    },
  },
  repair: {
    ar: {
      product: 'قطعة غيار',
      products: 'قطع الغيار',
      addProduct: 'إضافة قطعة غيار',
      editProduct: 'تعديل قطعة الغيار',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن قطعة غيار أو باركود...',
      productCount: 'إجمالي قطع الغيار',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'القطع الأكثر مبيعاً',
      newProduct: 'قطعة غيار جديدة',
      newProductDesc: 'إضافة قطعة غيار للمخزن',
      pageTitle: 'إدارة قطع الغيار',
      pageSubtitle: 'إدارة مخزون قطع الغيار والأسعار',
    },
    en: {
      product: 'Spare Part',
      products: 'Spare Parts',
      addProduct: 'Add Spare Part',
      editProduct: 'Edit Spare Part',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search spare part or barcode...',
      productCount: 'Total Spare Parts',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Parts',
      newProduct: 'New Spare Part',
      newProductDesc: 'Add spare part to inventory',
      pageTitle: 'Spare Parts Management',
      pageSubtitle: 'Manage spare parts inventory and prices',
    },
  },
  bookstore: {
    ar: {
      product: 'كتاب',
      products: 'الكتب',
      addProduct: 'إضافة كتاب',
      editProduct: 'تعديل الكتاب',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'ISBN / الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن كتاب أو ISBN...',
      productCount: 'إجمالي الكتب',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'الكتب الأكثر مبيعاً',
      newProduct: 'كتاب جديد',
      newProductDesc: 'إضافة كتاب للمخزن',
      pageTitle: 'إدارة الكتب',
      pageSubtitle: 'إدارة مخزون الكتب والأسعار',
    },
    en: {
      product: 'Book',
      products: 'Books',
      addProduct: 'Add Book',
      editProduct: 'Edit Book',
      category: 'Category',
      categories: 'Categories',
      barcode: 'ISBN / Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search book or ISBN...',
      productCount: 'Total Books',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Books',
      newProduct: 'New Book',
      newProductDesc: 'Add book to inventory',
      pageTitle: 'Book Management',
      pageSubtitle: 'Manage book inventory and prices',
    },
  },
  general: {
    ar: {
      product: 'منتج',
      products: 'المنتجات',
      addProduct: 'إضافة منتج',
      editProduct: 'تعديل المنتج',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن منتج أو باركود...',
      productCount: 'إجمالي المنتجات',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'المنتجات الأكثر مبيعاً',
      newProduct: 'منتج جديد',
      newProductDesc: 'إضافة منتج للمخزن',
      pageTitle: 'إدارة المنتجات',
      pageSubtitle: 'إدارة مخزون المنتجات والأسعار',
    },
    en: {
      product: 'Product',
      products: 'Products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search product or barcode...',
      productCount: 'Total Products',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Products',
      newProduct: 'New Product',
      newProductDesc: 'Add product to inventory',
      pageTitle: 'Product Management',
      pageSubtitle: 'Manage product inventory and prices',
    },
  },
};

// Sections visibility based on store type
export interface VisibleSections {
  maintenance: boolean;
  warranty: boolean;
  expiry: boolean;
  serialNumber: boolean;
  sizeColor: boolean;
}

export const getVisibleSections = (storeType: string): VisibleSections => {
  switch (storeType) {
    case 'phones':
      return { maintenance: true, warranty: true, expiry: false, serialNumber: true, sizeColor: false };
    case 'repair':
      return { maintenance: true, warranty: true, expiry: false, serialNumber: true, sizeColor: false };
    case 'grocery':
      return { maintenance: false, warranty: false, expiry: true, serialNumber: false, sizeColor: false };
    case 'pharmacy':
      return { maintenance: false, warranty: false, expiry: true, serialNumber: false, sizeColor: false };
    case 'clothing':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: true };
    case 'restaurant':
      return { maintenance: false, warranty: false, expiry: true, serialNumber: false, sizeColor: false };
    case 'bookstore':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: true, sizeColor: false };
    default:
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: false };
  }
};

// Default categories per store type
export const getDefaultCategories = (storeType: string): string[] => {
  switch (storeType) {
    case 'phones':
      return ['هواتف ذكية', 'أجهزة لوحية', 'إكسسوارات', 'شواحن وكوابل', 'سماعات', 'حافظات وأغطية', 'قطع غيار'];
    case 'grocery':
      return ['مواد غذائية', 'مشروبات', 'ألبان وأجبان', 'معلبات', 'حلويات وسناكس', 'منظفات', 'مواد تنظيف'];
    case 'pharmacy':
      return ['مسكنات', 'مضادات حيوية', 'فيتامينات', 'أدوية قلب وضغط', 'أدوية سكري', 'مستحضرات تجميل', 'مستلزمات طبية'];
    case 'clothing':
      return ['قمصان', 'بنطلونات', 'فساتين', 'أحذية', 'حقائب', 'إكسسوارات', 'ملابس أطفال', 'ملابس رياضية'];
    case 'restaurant':
      return ['مقبلات', 'أطباق رئيسية', 'مشروبات', 'حلويات', 'سلطات', 'وجبات سريعة'];
    case 'repair':
      return ['شاشات', 'بطاريات', 'لوحات إلكترونية', 'كوابل داخلية', 'أزرار ومفاتيح', 'كاميرات', 'سماعات'];
    case 'bookstore':
      return ['روايات', 'كتب تعليمية', 'كتب أطفال', 'قرطاسية', 'كتب دينية', 'كتب علمية', 'مجلات'];
    default:
      return ['عام', 'إلكترونيات', 'ملابس', 'أغذية', 'أخرى'];
  }
};

// Get terminology for a specific store type and language
export const getTerminology = (storeType: string, key: TerminologyKey, language: string): string => {
  const config = terminologyMap[storeType] || terminologyMap.general;
  const langTerms = language === 'ar' ? config.ar : config.en;
  return langTerms[key] || terminologyMap.general[language === 'ar' ? 'ar' : 'en'][key];
};

// Get current store type from localStorage
export const getCurrentStoreType = (): string => {
  try {
    const raw = localStorage.getItem('hyperpos_settings_v1');
    if (raw) {
      const settings = JSON.parse(raw);
      return settings.storeSettings?.type || 'general';
    }
  } catch {
    // ignore
  }
  return 'general';
};
