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
  tr: Record<TerminologyKey, string>;
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
    tr: {
      product: 'Ürün',
      products: 'Ürünler',
      addProduct: 'Ürün Ekle',
      editProduct: 'Ürünü Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod / IMEI',
      maintenance: 'Bakım',
      productSearch: 'Ürün veya barkod ara...',
      productCount: 'Toplam Ürün',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satanlar',
      newProduct: 'Yeni Ürün',
      newProductDesc: 'Stoğa ürün ekle',
      pageTitle: 'Ürün Yönetimi',
      pageSubtitle: 'Ürün stok ve fiyat yönetimi',
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
    tr: {
      product: 'Ürün',
      products: 'Ürünler',
      addProduct: 'Ürün Ekle',
      editProduct: 'Ürünü Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Ürün veya barkod ara...',
      productCount: 'Toplam Ürün',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satanlar',
      newProduct: 'Yeni Ürün',
      newProductDesc: 'Stoğa ürün ekle',
      pageTitle: 'Ürün Yönetimi',
      pageSubtitle: 'Market stok ve fiyat yönetimi',
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
    tr: {
      product: 'İlaç',
      products: 'İlaçlar',
      addProduct: 'İlaç Ekle',
      editProduct: 'İlacı Düzenle',
      category: 'İlaç Grubu',
      categories: 'İlaç Grupları',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'İlaç veya barkod ara...',
      productCount: 'Toplam İlaç',
      lowStockAlert: 'İlaç Stok Uyarıları',
      topProducts: 'En Çok Satan İlaçlar',
      newProduct: 'Yeni İlaç',
      newProductDesc: 'Stoğa ilaç ekle',
      pageTitle: 'İlaç Yönetimi',
      pageSubtitle: 'İlaç stok ve fiyat yönetimi',
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
    tr: {
      product: 'Ürün',
      products: 'Ürünler',
      addProduct: 'Ürün Ekle',
      editProduct: 'Ürünü Düzenle',
      category: 'Tür',
      categories: 'Türler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Ürün veya barkod ara...',
      productCount: 'Toplam Ürün',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satanlar',
      newProduct: 'Yeni Ürün',
      newProductDesc: 'Stoğa ürün ekle',
      pageTitle: 'Ürün Yönetimi',
      pageSubtitle: 'Giyim stok ve fiyat yönetimi',
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
    tr: {
      product: 'Yemek',
      products: 'Menü',
      addProduct: 'Yemek Ekle',
      editProduct: 'Yemeği Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Yemek ara...',
      productCount: 'Toplam Yemek',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Sipariş Edilenler',
      newProduct: 'Yeni Yemek',
      newProductDesc: 'Menüye yemek ekle',
      pageTitle: 'Menü Yönetimi',
      pageSubtitle: 'Yemek ve fiyat yönetimi',
    },
  },
  bakery: {
    ar: {
      product: 'صنف',
      products: 'قائمة المبيعات',
      addProduct: 'إضافة صنف',
      editProduct: 'تعديل الصنف',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن صنف أو باركود...',
      productCount: 'إجمالي الأصناف',
      lowStockAlert: 'تنبيهات المخزون',
      topProducts: 'الأصناف الأكثر مبيعاً',
      newProduct: 'صنف جديد',
      newProductDesc: 'إضافة صنف للقائمة',
      pageTitle: 'إدارة المخبز',
      pageSubtitle: 'تتبع المبيعات والمشتريات والمصاريف',
    },
    en: {
      product: 'Item',
      products: 'Sales Items',
      addProduct: 'Add Item',
      editProduct: 'Edit Item',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search item or barcode...',
      productCount: 'Total Items',
      lowStockAlert: 'Stock Alerts',
      topProducts: 'Top Selling Items',
      newProduct: 'New Item',
      newProductDesc: 'Add item to list',
      pageTitle: 'Bakery Management',
      pageSubtitle: 'Track sales, purchases and expenses',
    },
    tr: {
      product: 'Ürün',
      products: 'Satış Ürünleri',
      addProduct: 'Ürün Ekle',
      editProduct: 'Ürünü Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Ürün veya barkod ara...',
      productCount: 'Toplam Ürün',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satanlar',
      newProduct: 'Yeni Ürün',
      newProductDesc: 'Listeye ürün ekle',
      pageTitle: 'Fırın Yönetimi',
      pageSubtitle: 'Satış, alış ve gider takibi',
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
    tr: {
      product: 'Yedek Parça',
      products: 'Yedek Parçalar',
      addProduct: 'Parça Ekle',
      editProduct: 'Parçayı Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Parça veya barkod ara...',
      productCount: 'Toplam Parça',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satan Parçalar',
      newProduct: 'Yeni Parça',
      newProductDesc: 'Stoğa parça ekle',
      pageTitle: 'Yedek Parça Yönetimi',
      pageSubtitle: 'Parça stok ve fiyat yönetimi',
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
    tr: {
      product: 'Kitap',
      products: 'Kitaplar',
      addProduct: 'Kitap Ekle',
      editProduct: 'Kitabı Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'ISBN / Barkod',
      maintenance: 'Bakım',
      productSearch: 'Kitap veya ISBN ara...',
      productCount: 'Toplam Kitap',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satan Kitaplar',
      newProduct: 'Yeni Kitap',
      newProductDesc: 'Stoğa kitap ekle',
      pageTitle: 'Kitap Yönetimi',
      pageSubtitle: 'Kitap stok ve fiyat yönetimi',
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
    tr: {
      product: 'Ürün',
      products: 'Ürünler',
      addProduct: 'Ürün Ekle',
      editProduct: 'Ürünü Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Ürün veya barkod ara...',
      productCount: 'Toplam Ürün',
      lowStockAlert: 'Stok Uyarıları',
      topProducts: 'En Çok Satanlar',
      newProduct: 'Yeni Ürün',
      newProductDesc: 'Stoğa ürün ekle',
      pageTitle: 'Ürün Yönetimi',
      pageSubtitle: 'Ürün stok ve fiyat yönetimi',
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
    case 'bakery':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: false };
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
      return ['هواتف ذكية', 'سماعات', 'شواحن وكابلات', 'قطع صيانة', 'إكسسوارات'];
    case 'grocery':
      return ['معلبات', 'ألبان وأجبان', 'منظفات', 'زيوت وحبوب', 'حلويات وبسكويت'];
    case 'pharmacy':
      return ['أدوية', 'مستحضرات تجميل', 'مكملات غذائية', 'عناية بالطفل', 'مستلزمات طبية'];
    case 'clothing':
      return ['رجالي', 'نسائي', 'أطفال', 'أحذية', 'حقائب وإكسسوارات'];
    case 'restaurant':
      return ['وجبات رئيسية', 'مقبلات', 'مشروبات', 'حلويات', 'وجبات سريعة'];
    case 'bakery':
      return ['جاتو', 'بانكيك', 'بيتي فور', 'شعبيات', 'كعك', 'خبز', 'معجنات'];
    case 'repair':
      return ['قطع غيار', 'زيوت', 'فلاتر', 'إطارات', 'أدوات صيانة'];
    case 'bookstore':
      return ['قرطاسية', 'كتب', 'أدوات رسم', 'هدايا', 'خدمات طباعة'];
    default:
      return ['عام', 'إلكترونيات', 'ملابس', 'أغذية', 'أخرى'];
  }
};

// Get terminology for a specific store type and language
export const getTerminology = (storeType: string, key: TerminologyKey, language: string): string => {
  const config = terminologyMap[storeType] || terminologyMap.general;
  const langTerms = language === 'ar' ? config.ar : (language === 'tr' ? config.tr : config.en);
  return langTerms[key] || terminologyMap.general[language === 'ar' ? 'ar' : (language === 'tr' ? 'tr' : 'en')][key];
};

// Check if the store type operates without inventory tracking (e.g., bakery)
export const isNoInventoryMode = (storeType?: string): boolean => {
  const type = storeType || getCurrentStoreType();
  return type === 'bakery';
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
