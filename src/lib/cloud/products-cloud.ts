// Cloud Products Store - Supabase-backed products management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  updateInSupabase, 
  deleteFromSupabase,
  getCurrentUserId 
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';

export interface CloudProduct {
  id: string;
  user_id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  min_stock_level: number;
  unit: string | null;
  expiry_date: string | null;
  supplier: string | null;
  location: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown> | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// Legacy Product interface for backwards compatibility
export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minStockLevel?: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  expiryDate?: string;
  image?: string;
  serialNumber?: string;
  warranty?: string;
  wholesalePrice?: number;
  size?: string;
  color?: string;
  customFields?: Record<string, string | number>;
}

// Transform cloud product to legacy format
function toProduct(cloud: CloudProduct): Product {
  return {
    id: cloud.id,
    name: cloud.name,
    barcode: cloud.barcode || '',
    category: cloud.category || '',
    costPrice: Number(cloud.cost_price) || 0,
    salePrice: Number(cloud.sale_price) || 0,
    quantity: cloud.quantity || 0,
    minStockLevel: cloud.min_stock_level || 5,
    status: getStatus(cloud.quantity, cloud.min_stock_level),
    expiryDate: cloud.expiry_date || undefined,
    image: cloud.image_url || undefined,
    customFields: cloud.custom_fields as Record<string, string | number> | undefined,
  };
}

// Transform legacy product to cloud format
function toCloudProduct(product: Omit<Product, 'id' | 'status'>): Record<string, unknown> {
  return {
    name: product.name,
    barcode: product.barcode || null,
    category: product.category || null,
    cost_price: product.costPrice || 0,
    sale_price: product.salePrice || 0,
    quantity: product.quantity || 0,
    min_stock_level: product.minStockLevel || 5,
    expiry_date: product.expiryDate || null,
    image_url: product.image || null,
    custom_fields: product.customFields || null,
    archived: false,
  };
}

// Status helper
export const getStatus = (quantity: number, minStockLevel?: number): 'in_stock' | 'low_stock' | 'out_of_stock' => {
  if (quantity === 0) return 'out_of_stock';
  const threshold = minStockLevel ?? 5;
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
};

// Cache for products
let productsCache: Product[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

// Load products from cloud with caching
export const loadProductsCloud = async (): Promise<Product[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // Check cache
  if (productsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return productsCache;
  }

  const cloudProducts = await fetchFromSupabase<CloudProduct>('products', { 
    column: 'created_at', 
    ascending: false 
  });

  productsCache = cloudProducts.map(toProduct);
  cacheTimestamp = Date.now();
  
  return productsCache;
};

// Invalidate cache
export const invalidateProductsCache = () => {
  productsCache = null;
  cacheTimestamp = 0;
};

// Add product to cloud
export const addProductCloud = async (product: Omit<Product, 'id' | 'status'>): Promise<Product | null> => {
  const cloudData = toCloudProduct(product);
  const inserted = await insertToSupabase<CloudProduct>('products', cloudData);
  
  if (inserted) {
    const newProduct = toProduct(inserted);
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
    return newProduct;
  }
  
  return null;
};

// Update product in cloud
export const updateProductCloud = async (id: string, data: Partial<Omit<Product, 'id' | 'status'>>): Promise<boolean> => {
  const updates: Record<string, unknown> = {};
  
  if (data.name !== undefined) updates.name = data.name;
  if (data.barcode !== undefined) updates.barcode = data.barcode || null;
  if (data.category !== undefined) updates.category = data.category || null;
  if (data.costPrice !== undefined) updates.cost_price = data.costPrice;
  if (data.salePrice !== undefined) updates.sale_price = data.salePrice;
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.minStockLevel !== undefined) updates.min_stock_level = data.minStockLevel;
  if (data.expiryDate !== undefined) updates.expiry_date = data.expiryDate || null;
  if (data.image !== undefined) updates.image_url = data.image || null;
  if (data.customFields !== undefined) updates.custom_fields = data.customFields || null;

  const success = await updateInSupabase('products', id, updates);
  
  if (success) {
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  }
  
  return success;
};

// Delete product from cloud
export const deleteProductCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('products', id);
  
  if (success) {
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
  }
  
  return success;
};

// Get product by ID
export const getProductByIdCloud = async (id: string): Promise<Product | null> => {
  const products = await loadProductsCloud();
  return products.find(p => p.id === id) || null;
};

// Get product by barcode
export const getProductByBarcodeCloud = async (barcode: string): Promise<Product | null> => {
  const products = await loadProductsCloud();
  return products.find(p => p.barcode === barcode) || null;
};

// Get low stock products
export const getLowStockProductsCloud = async (): Promise<Product[]> => {
  const products = await loadProductsCloud();
  return products.filter(p => {
    const threshold = p.minStockLevel ?? 5;
    return p.quantity <= threshold;
  });
};

// Deduct stock
export const deductStockCloud = async (productId: string, quantity: number): Promise<boolean> => {
  const products = await loadProductsCloud();
  const product = products.find(p => p.id === productId);
  
  if (!product) return false;
  
  const newQuantity = Math.max(0, product.quantity - quantity);
  return updateProductCloud(productId, { quantity: newQuantity });
};

// Batch deduct stock
export const deductStockBatchCloud = async (
  items: { productId: string; quantity: number }[]
): Promise<{ success: boolean; deducted: number; failed: number }> => {
  let deducted = 0;
  let failed = 0;

  for (const item of items) {
    const success = await deductStockCloud(item.productId, item.quantity);
    if (success) deducted++;
    else failed++;
  }

  return { success: failed === 0, deducted, failed };
};

// Restore stock for refunds
export const restoreStockCloud = async (productId: string, quantity: number): Promise<boolean> => {
  const products = await loadProductsCloud();
  const product = products.find(p => p.id === productId);
  
  if (!product) return false;
  
  const newQuantity = product.quantity + quantity;
  return updateProductCloud(productId, { quantity: newQuantity });
};

// Batch restore stock for refunds
export const restoreStockBatchCloud = async (
  items: { productId: string; quantity: number }[]
): Promise<{ success: boolean; restored: number; failed: number }> => {
  let restored = 0;
  let failed = 0;

  for (const item of items) {
    const success = await restoreStockCloud(item.productId, item.quantity);
    if (success) restored++;
    else failed++;
  }

  return { success: failed === 0, restored, failed };
};

// Check stock availability
export const checkStockAvailabilityCloud = async (
  items: { productId: string; quantity: number }[]
): Promise<{ success: boolean; insufficientItems: Array<{ productId: string; productName: string; requested: number; available: number }> }> => {
  const products = await loadProductsCloud();
  const insufficientItems: Array<{ productId: string; productName: string; requested: number; available: number }> = [];
  
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
