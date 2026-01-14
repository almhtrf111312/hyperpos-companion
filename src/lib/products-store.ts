import { emitEvent, EVENTS } from './events';

const PRODUCTS_STORAGE_KEY = 'hyperpos_products_v1';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  expiryDate?: string; // Optional expiry date for pharmacy/grocery
  image?: string; // Base64 image for product
}

// No default products - start with empty inventory
const defaultProducts: Product[] = [];

export const getStatus = (quantity: number): 'in_stock' | 'low_stock' | 'out_of_stock' => {
  if (quantity === 0) return 'out_of_stock';
  if (quantity <= 5) return 'low_stock';
  return 'in_stock';
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
  } catch {
    // ignore
  }
  return defaultProducts;
};

export const saveProducts = (products: Product[]) => {
  try {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    emitEvent(EVENTS.PRODUCTS_UPDATED, products);
  } catch {
    // ignore
  }
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
