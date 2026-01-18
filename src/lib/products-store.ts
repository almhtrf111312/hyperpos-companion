import { emitEvent, EVENTS } from './events';
import { safeSave } from './safe-storage';
import { toast } from 'sonner';

const PRODUCTS_STORAGE_KEY = 'hyperpos_products_v1';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minStockLevel?: number; // Fix #13: Minimum stock level for alerts
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  expiryDate?: string; // Optional expiry date for pharmacy/grocery
  image?: string; // Base64 image for product
  // Fix #16: Dynamic fields based on store type
  serialNumber?: string; // IMEI for phones, ISBN for books
  warranty?: string; // Warranty period (e.g., "12 months")
  wholesalePrice?: number; // Wholesale price for bulk sales
  size?: string; // Size for clothing
  color?: string; // Color for clothing
  // Custom fields (user-defined)
  customFields?: Record<string, string | number>;
}

// No default products - start with empty inventory
const defaultProducts: Product[] = [];

// Fix #13: Enhanced status check with custom minStockLevel
export const getStatus = (quantity: number, minStockLevel?: number): 'in_stock' | 'low_stock' | 'out_of_stock' => {
  if (quantity === 0) return 'out_of_stock';
  const threshold = minStockLevel ?? 5; // Default to 5 if not set
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
};

// Fix #13: Get products below their minimum stock level
export const getLowStockProducts = (): Product[] => {
  const products = loadProducts();
  return products.filter(p => {
    const threshold = p.minStockLevel ?? 5;
    return p.quantity <= threshold;
  });
};

// Fix #13: Get critical stock alerts (products with quantity = 0 or below half of min level)
export const getCriticalStockAlerts = (): Product[] => {
  const products = loadProducts();
  return products.filter(p => {
    if (p.quantity === 0) return true;
    const threshold = p.minStockLevel ?? 5;
    return p.quantity <= Math.floor(threshold / 2);
  });
};

export const loadProducts = (): Product[] => {
  try {
    const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Accept array even if empty ([] is a valid stored value)
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load products:', error);
  }
  return defaultProducts;
};

export const saveProducts = (products: Product[]): boolean => {
  // Validate data before saving
  if (!Array.isArray(products)) {
    console.error('saveProducts: Invalid data - expected array');
    toast.error('خطأ في حفظ المنتجات', {
      description: 'البيانات غير صالحة'
    });
    return false;
  }
  
  const result = safeSave(PRODUCTS_STORAGE_KEY, products);
  
  if (!result.success) {
    console.error('Failed to save products:', result.error);
    toast.error('فشل في حفظ المنتجات', {
      description: result.error === 'Storage quota exceeded - try clearing old data' 
        ? 'مساحة التخزين ممتلئة - حاول حذف بعض البيانات القديمة'
        : 'حدث خطأ أثناء الحفظ'
    });
    return false;
  }
  
  emitEvent(EVENTS.PRODUCTS_UPDATED, products);
  return true;
};

export const addProduct = (product: Omit<Product, 'id' | 'status'>): Product => {
  const products = loadProducts();
  const newProduct: Product = {
    ...product,
    id: Date.now().toString(),
    status: getStatus(product.quantity),
  };
  products.push(newProduct);
  saveProducts(products);
  return newProduct;
};

export const updateProduct = (id: string, data: Partial<Omit<Product, 'id' | 'status'>>): boolean => {
  const products = loadProducts();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return false;

  const updated = { ...products[index], ...data };
  if (data.quantity !== undefined) {
    updated.status = getStatus(data.quantity);
  }
  products[index] = updated;
  saveProducts(products);
  return true;
};

export const deleteProduct = (id: string): boolean => {
  const products = loadProducts();
  const filtered = products.filter(p => p.id !== id);
  if (filtered.length === products.length) return false;
  saveProducts(filtered);
  return true;
};

// Get product by ID
export const getProductById = (id: string): Product | null => {
  const products = loadProducts();
  return products.find(p => p.id === id) || null;
};

// Check expiry status
export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'no_expiry';

export const getExpiryStatus = (expiryDate?: string): ExpiryStatus => {
  if (!expiryDate) return 'no_expiry';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring_soon'; // 30 days warning
  return 'valid';
};

export const getExpiringProducts = (): Product[] => {
  const products = loadProducts();
  return products.filter(p => {
    const status = getExpiryStatus(p.expiryDate);
    return status === 'expired' || status === 'expiring_soon';
  });
};

// Convert to POS-compatible format
export interface POSProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  barcode?: string;
  expiryDate?: string;
  image?: string;
}

export const getProductsForPOS = (): POSProduct[] => {
  return loadProducts().map(p => ({
    id: p.id,
    name: p.name,
    price: p.salePrice,
    quantity: p.quantity,
    category: p.category,
    barcode: p.barcode,
    expiryDate: p.expiryDate,
    image: p.image,
  }));
};

export const getProductByBarcode = (barcode: string): POSProduct | undefined => {
  const products = getProductsForPOS();
  return products.find(p => p.barcode === barcode);
};

// Check stock availability before sale
export interface StockCheckResult {
  success: boolean;
  insufficientItems: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

export const checkStockAvailability = (items: { productId: string; quantity: number }[]): StockCheckResult => {
  const products = loadProducts();
  const insufficientItems: StockCheckResult['insufficientItems'] = [];
  
  items.forEach(({ productId, quantity }) => {
    const product = products.find(p => p.id === productId);
    if (product && product.quantity < quantity) {
      insufficientItems.push({
        productId,
        productName: product.name,
        requested: quantity,
        available: product.quantity,
      });
    }
  });
  
  return {
    success: insufficientItems.length === 0,
    insufficientItems,
  };
};

// Deduct stock after sale
export const deductStock = (productId: string, quantity: number): boolean => {
  const products = loadProducts();
  const index = products.findIndex(p => p.id === productId);
  if (index === -1) return false;
  
  // منع الكميات السالبة
  const newQuantity = Math.max(0, products[index].quantity - quantity);
  products[index].quantity = newQuantity;
  products[index].status = getStatus(newQuantity);
  saveProducts(products);
  return true;
};

// Batch deduct stock for multiple items with validation
export interface DeductStockBatchResult {
  success: boolean;
  deducted: number;
  failed: number;
  insufficientItems: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

export const deductStockBatch = (
  items: { productId: string; quantity: number }[],
  validateFirst: boolean = false
): DeductStockBatchResult => {
  const products = loadProducts();
  let deducted = 0;
  let failed = 0;
  const insufficientItems: DeductStockBatchResult['insufficientItems'] = [];
  
  // التحقق أولاً إذا طُلب ذلك
  if (validateFirst) {
    items.forEach(({ productId, quantity }) => {
      const product = products.find(p => p.id === productId);
      if (product && product.quantity < quantity) {
        insufficientItems.push({
          productId,
          productName: product.name,
          requested: quantity,
          available: product.quantity,
        });
      }
    });
    
    if (insufficientItems.length > 0) {
      return { success: false, deducted: 0, failed: items.length, insufficientItems };
    }
  }
  
  // خصم الكميات
  items.forEach(({ productId, quantity }) => {
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
      const product = products[index];
      
      // منع الكميات السالبة - خصم المتاح فقط
      const actualDeduction = Math.min(quantity, product.quantity);
      const newQuantity = product.quantity - actualDeduction;
      
      products[index].quantity = newQuantity;
      products[index].status = getStatus(newQuantity);
      
      if (actualDeduction < quantity) {
        insufficientItems.push({
          productId,
          productName: product.name,
          requested: quantity,
          available: actualDeduction,
        });
        failed++;
      } else {
        deducted++;
      }
    } else {
      failed++;
    }
  });
  
  if (deducted > 0 || failed > 0) {
    saveProducts(products);
  }
  
  return { 
    success: failed === 0, 
    deducted, 
    failed, 
    insufficientItems 
  };
};
