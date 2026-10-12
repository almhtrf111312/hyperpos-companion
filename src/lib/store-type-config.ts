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
  fa?: Record<TerminologyKey, string>;
  ku?: Record<TerminologyKey, string>;
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
    fa: {
      product: 'محصول',
      products: 'محصولات',
      addProduct: 'افزودن محصول',
      editProduct: 'ویرایش محصول',
      category: 'دسته‌بندی',
      categories: 'دسته‌بندی‌ها',
      barcode: 'بارکد / IMEI',
      maintenance: 'تعمیرات',
      productSearch: 'جستجوی محصول یا بارکد...',
      productCount: 'تعداد کل محصولات',
      lowStockAlert: 'هشدارهای موجودی',
      topProducts: 'پرفروش‌ترین محصولات',
      newProduct: 'محصول جدید',
      newProductDesc: 'افزودن محصول به انبار',
      pageTitle: 'مدیریت محصولات',
      pageSubtitle: 'مدیریت موجودی کالاها و قیمت‌ها',
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
    fa: {
      product: 'کالا',
      products: 'کالاها',
      addProduct: 'افزودن کالا',
      editProduct: 'ویرایش کالا',
      category: 'بخش',
      categories: 'بخش‌ها',
      barcode: 'بارکد کالا',
      maintenance: 'خدمات',
      productSearch: 'جستجوی کالا یا بارکد...',
      productCount: 'تعداد کل کالاها',
      lowStockAlert: 'هشدارهای کسری موجودی',
      topProducts: 'کالاهای پرفروش',
      newProduct: 'کالای جدید',
      newProductDesc: 'افزودن کالا به فروشگاه',
      pageTitle: 'مدیریت کالاها',
      pageSubtitle: 'مدیریت موجودی قفسه‌ها و قیمت‌ها',
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
    fa: {
      product: 'دارو / محصول',
      products: 'داروها و محصولات',
      addProduct: 'افزودن دارو',
      editProduct: 'ویرایش دارو',
      category: 'دسته‌بندی درمانی',
      categories: 'دسته‌بندی‌های درمانی',
      barcode: 'بارکد دارو',
      maintenance: 'خدمات',
      productSearch: 'جستجوی دارو، نام علمی یا بارکد...',
      productCount: 'تعداد کل داروها',
      lowStockAlert: 'هشدارهای موجودی و انقضا',
      topProducts: 'داروهای پرمصرف',
      newProduct: 'داروی جدید',
      newProductDesc: 'ثبت داروی جدید در داروخانه',
      pageTitle: 'مدیریت داروها و تجهیزات',
      pageSubtitle: 'پیگیری موجودی داروها و تاریخ انقضا',
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
    fa: {
      product: 'پوشاک / مدل',
      products: 'پوشاک و اجناس',
      addProduct: 'افزودن مدل جدید',
      editProduct: 'ویرایش مشخصات لباس',
      category: 'بخش پوشاک',
      categories: 'بخش‌های پوشاک',
      barcode: 'بارکد لباس',
      maintenance: 'دوخت و تعمیرات',
      productSearch: 'جستجوی لباس با نام یا بارکد...',
      productCount: 'تعداد کل مدل‌ها',
      lowStockAlert: 'هشدارهای اتمام سایز یا رنگ',
      topProducts: 'مدل‌های پرطرفدار',
      newProduct: 'مدل جدید',
      newProductDesc: 'ثبت مدل جدید در انبار',
      pageTitle: 'مدیریت پوشاک و مد',
      pageSubtitle: 'مدیریت موجودی سایزها، رنگ‌ها و قیمت‌ها',
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
    fa: {
      product: 'غذا / نوشیدنی',
      products: 'منوی رستوران',
      addProduct: 'افزودن غذای جدید',
      editProduct: 'ویرایش غذا',
      category: 'بخش منو',
      categories: 'بخش‌های منو',
      barcode: 'کد آیتم',
      maintenance: 'سرویس و تحویل',
      productSearch: 'جستجو در منو...',
      productCount: 'تعداد آیتم‌های منو',
      lowStockAlert: 'هشدارهای مواد اولیه',
      topProducts: 'غذاهای پرطرفدار',
      newProduct: 'غذای جدید',
      newProductDesc: 'افزودن غذای جدید به منو',
      pageTitle: 'مدیریت منوی رستوران',
      pageSubtitle: 'تنظیم اقلام منو، قیمت‌ها و بخش‌ها',
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
    fa: {
      product: 'نان / شیرینی',
      products: 'محصولات قنادی و نانوایی',
      addProduct: 'افزودن محصول جدید',
      editProduct: 'ویرایش محصول',
      category: 'نوع پخت',
      categories: 'انواع پخت',
      barcode: 'کد محصول',
      maintenance: 'سفارشات ویژه',
      productSearch: 'جستجوی نان یا شیرینی...',
      productCount: 'تعداد کل محصولات',
      lowStockAlert: 'هشدارهای کمبود تولید',
      topProducts: 'محصولات پرفروش روز',
      newProduct: 'محصول جدید',
      newProductDesc: 'ثبت محصول جدید برای پخت',
      pageTitle: 'مدیریت محصولات قنادی',
      pageSubtitle: 'مدیریت محصولات پخت روز و قیمت‌ها',
    },
  },
  repair: {
    ar: {
      product: 'عنصر',
      products: 'العناصر',
      addProduct: 'إضافة عنصر',
      editProduct: 'تعديل العنصر',
      category: 'التصنيف',
      categories: 'التصنيفات',
      barcode: 'الباركود',
      maintenance: 'الصيانة',
      productSearch: 'بحث عن عنصر...',
      productCount: 'إجمالي العناصر',
      lowStockAlert: 'تنبيهات',
      topProducts: 'العناصر الأكثر استخداماً',
      newProduct: 'عنصر جديد',
      newProductDesc: 'إضافة عنصر صيانة',
      pageTitle: 'ورشة الصيانة',
      pageSubtitle: 'إدارة عناصر الصيانة والتكاليف',
    },
    en: {
      product: 'Item',
      products: 'Items',
      addProduct: 'Add Item',
      editProduct: 'Edit Item',
      category: 'Category',
      categories: 'Categories',
      barcode: 'Barcode',
      maintenance: 'Maintenance',
      productSearch: 'Search item...',
      productCount: 'Total Items',
      lowStockAlert: 'Alerts',
      topProducts: 'Most Used Items',
      newProduct: 'New Item',
      newProductDesc: 'Add maintenance item',
      pageTitle: 'Maintenance Workshop',
      pageSubtitle: 'Manage maintenance items and costs',
    },
    tr: {
      product: 'Öğe',
      products: 'Öğeler',
      addProduct: 'Öğe Ekle',
      editProduct: 'Öğeyi Düzenle',
      category: 'Kategori',
      categories: 'Kategoriler',
      barcode: 'Barkod',
      maintenance: 'Bakım',
      productSearch: 'Öğe ara...',
      productCount: 'Toplam Öğe',
      lowStockAlert: 'Uyarılar',
      topProducts: 'En Çok Kullanılanlar',
      newProduct: 'Yeni Öğe',
      newProductDesc: 'Bakım öğesi ekle',
      pageTitle: 'Bakım Atölyesi',
      pageSubtitle: 'Bakım öğeleri ve maliyet yönetimi',
    },
    fa: {
      product: 'قطعه / خدمات',
      products: 'قطعات و خدمات تعمیر',
      addProduct: 'افزودن قطعه یا خدمت',
      editProduct: 'ویرایش قطعه / خدمت',
      category: 'نوع تعمیر / قطعه',
      categories: 'انواع تعمیرات و قطعات',
      barcode: 'کد قطعه',
      maintenance: 'کارگاه تعمیرات',
      productSearch: 'جستجوی قطعه یدکی یا خدمت...',
      productCount: 'تعداد قطعات و خدمات',
      lowStockAlert: 'هشدارهای قطعات یدکی رو به اتمام',
      topProducts: 'خدمات و قطعات پرتقاضا',
      newProduct: 'قطعه / خدمت جدید',
      newProductDesc: 'افزودن قطعه یا خدمات جدید به کارگاه',
      pageTitle: 'مدیریت کارگاه و قطعات',
      pageSubtitle: 'پیگیری قطعات یدکی، خدمات و قیمت‌ها',
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
    fa: {
      product: 'کتاب / لوازم‌التحریر',
      products: 'کتاب‌ها و لوازم‌التحریر',
      addProduct: 'افزودن کتاب',
      editProduct: 'ویرایش مشخصات کتاب',
      category: 'موضوع / بخش',
      categories: 'موضوعات و بخش‌ها',
      barcode: 'شابک (ISBN) / بارکد',
      maintenance: 'صحافی و خدمات',
      productSearch: 'جستجوی کتاب با نام، نویسنده یا شابک...',
      productCount: 'تعداد کل عناوین',
      lowStockAlert: 'عناوین رو به اتمام',
      topProducts: 'کتاب‌های پرفروش',
      newProduct: 'کتاب جدید',
      newProductDesc: 'ثبت کتاب یا کالای جدید در کتابفروشی',
      pageTitle: 'مدیریت کتابفروشی',
      pageSubtitle: 'مدیریت عناوین، موجودی انبار و قیمت‌ها',
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
    fa: {
      product: 'محصول',
      products: 'محصولات',
      addProduct: 'افزودن محصول',
      editProduct: 'ویرایش محصول',
      category: 'دسته‌بندی',
      categories: 'دسته‌بندی‌ها',
      barcode: 'بارکد',
      maintenance: 'خدمات',
      productSearch: 'جستجوی محصول یا بارکد...',
      productCount: 'تعداد کل محصولات',
      lowStockAlert: 'هشدارهای موجودی',
      topProducts: 'پرفروش‌ترین محصولات',
      newProduct: 'محصول جدید',
      newProductDesc: 'افزودن محصول به سیستم',
      pageTitle: 'مدیریت محصولات',
      pageSubtitle: 'مدیریت موجودی کالاها و قیمت‌ها',
    },
    ku: {
      product: 'بەرهەم',
      products: 'بەرهەمەکان',
      addProduct: 'زیادکردنی بەرهەم',
      editProduct: 'دەستکاریکردنی بەرهەم',
      category: 'پۆلێن',
      categories: 'پۆلێنەکان',
      barcode: 'بارکۆد',
      maintenance: 'خزمەتگوزارییەکان',
      productSearch: 'گەڕان بۆ بەرهەم یان بارکۆد...',
      productCount: 'کۆی گشتی بەرهەمەکان',
      lowStockAlert: 'ئاگادارییەکانی کەمبوونەوەی کۆگا',
      topProducts: 'پڕفرۆشترین بەرهەمەکان',
      newProduct: 'بەرهەمی نوێ',
      newProductDesc: 'زیادکردنی بەرهەمی نوێ بۆ سیستەم',
      pageTitle: 'بەڕێوەبردنی بەرهەمەکان',
      pageSubtitle: 'بەڕێوەبردنی کۆگا و نرخەکان',
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
  purchases: boolean;
}

export const getVisibleSections = (storeType: string): VisibleSections => {
  switch (storeType) {
    case 'phones':
      return { maintenance: true, warranty: true, expiry: false, serialNumber: true, sizeColor: false, purchases: true };
    case 'repair':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: false, purchases: true };
    case 'grocery':
      return { maintenance: false, warranty: false, expiry: true, serialNumber: false, sizeColor: false, purchases: true };
    case 'pharmacy':
      return { maintenance: false, warranty: false, expiry: true, serialNumber: false, sizeColor: false, purchases: true };
    case 'clothing':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: true, purchases: true };
    case 'restaurant':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: false, purchases: true };
    case 'bakery':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: false, purchases: true };
    case 'bookstore':
      return { maintenance: false, warranty: false, expiry: false, serialNumber: true, sizeColor: false, purchases: true };
    default:
      return { maintenance: false, warranty: false, expiry: false, serialNumber: false, sizeColor: false, purchases: true };
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
      return ['كهرباء', 'ميكانيكا', 'إلكترونيات', 'أدوات', 'قطع غيار عامة'];
    case 'bookstore':
      return ['روايات', 'علمي', 'ديني', 'أدب', 'تعليمي', 'أطفال', 'قرطاسية'];
    default:
      return ['عام', 'إلكترونيات', 'ملابس', 'أغذية', 'أخرى'];
  }
};

// Get terminology for a specific store type and language
export const getTerminology = (storeType: string, key: TerminologyKey, language: string): string => {
  const config = terminologyMap[storeType] || terminologyMap.general;
  const langTerms =
    language === 'ar'
      ? config.ar
      : language === 'tr'
      ? config.tr
      : language === 'fa' && config.fa
      ? config.fa
      : language === 'ku' && config.ku
      ? config.ku
      : config.en;
  return (
    langTerms?.[key] ||
    (language === 'fa' && terminologyMap.general.fa ? terminologyMap.general.fa[key] : undefined) ||
    (language === 'ku' && terminologyMap.general.ku ? terminologyMap.general.ku[key] : undefined) ||
    terminologyMap.general[language === 'ar' ? 'ar' : language === 'tr' ? 'tr' : 'en']?.[key] ||
    key
  );
};

// Check if the store type operates without inventory tracking (e.g., bakery, repair/workshop)
export const isNoInventoryMode = (storeType?: string): boolean => {
  const type = storeType || getCurrentStoreType();
  return type === 'bakery' || type === 'repair';
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
