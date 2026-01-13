// Shared products store - used by Products and POS

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
}

const defaultProducts: Product[] = [
  { id: '1', name: 'iPhone 15 Pro Max', barcode: '123456789001', category: 'هواتف', costPrice: 1100, salePrice: 1300, quantity: 15, status: 'in_stock' },
  { id: '2', name: 'Samsung Galaxy S24', barcode: '123456789002', category: 'هواتف', costPrice: 850, salePrice: 1000, quantity: 20, status: 'in_stock' },
  { id: '3', name: 'AirPods Pro 2', barcode: '123456789003', category: 'سماعات', costPrice: 180, salePrice: 250, quantity: 5, status: 'low_stock' },
  { id: '4', name: 'شاشة iPhone 13', barcode: '123456789004', category: 'قطع غيار', costPrice: 100, salePrice: 150, quantity: 0, status: 'out_of_stock' },
  { id: '5', name: 'سلك شحن Type-C', barcode: '123456789005', category: 'أكسسوارات', costPrice: 8, salePrice: 15, quantity: 200, status: 'in_stock' },
  { id: '6', name: 'حافظة iPhone 15', barcode: '123456789006', category: 'أكسسوارات', costPrice: 12, salePrice: 25, quantity: 100, status: 'in_stock' },
  { id: '7', name: 'شاحن سريع 65W', barcode: '123456789007', category: 'شواحن', costPrice: 30, salePrice: 45, quantity: 3, status: 'low_stock' },
  { id: '8', name: 'باور بانك 20000mAh', barcode: '123456789008', category: 'أكسسوارات', costPrice: 35, salePrice: 55, quantity: 40, status: 'in_stock' },
];

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
      if (Array.isArray(parsed) && parsed.length > 0) {
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

// Convert to POS-compatible format
export interface POSProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  barcode?: string;
}

export const getProductsForPOS = (): POSProduct[] => {
  return loadProducts().map(p => ({
    id: p.id,
    name: p.name,
    price: p.salePrice,
    quantity: p.quantity,
    category: p.category,
    barcode: p.barcode,
  }));
};
