// Cloud Products Store - Supabase-backed products management
import {
  fetchFromSupabase,
  insertToSupabase,
  updateInSupabase,
  deleteFromSupabase,
  getCurrentUserId
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';
import { triggerAutoBackup } from '../local-auto-backup';
import { supabase } from '@/integrations/supabase/client';
import { saveProductsToIDB, loadProductsFromIDB, getProductByBarcodeIDB } from '../indexeddb-cache';

export interface CloudProduct {
  id: string;
  user_id: string;
  name: string;
  barcode: string | null;
  barcode2: string | null;  // باركود ثاني
  barcode3: string | null;  // باركود ثالث
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
  barcode2?: string;  // باركود ثاني
  barcode3?: string;  // باركود ثالث
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
  // Unit settings for multi-unit support
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkCostPrice?: number;
  bulkSalePrice?: number;
  trackByUnit?: 'piece' | 'bulk';
}

// Transform cloud product to legacy format
function toProduct(cloud: CloudProduct): Product {
  const customFields = cloud.custom_fields as Record<string, string | number> | undefined;

  return {
    id: cloud.id,
    name: cloud.name,
    barcode: cloud.barcode || '',
    barcode2: cloud.barcode2 || undefined,
    barcode3: cloud.barcode3 || undefined,
    category: cloud.category || '',
    costPrice: Number(cloud.cost_price) || 0,
    salePrice: Number(cloud.sale_price) || 0,
    quantity: cloud.quantity || 0,
    minStockLevel: cloud.min_stock_level || 5,
    status: getStatus(cloud.quantity, cloud.min_stock_level),
    expiryDate: cloud.expiry_date || undefined,
    image: cloud.image_url || undefined,
    // Extract static fields from custom_fields
    serialNumber: customFields?.serialNumber as string | undefined,
    warranty: customFields?.warranty as string | undefined,
    wholesalePrice: customFields?.wholesalePrice ? Number(customFields.wholesalePrice) : undefined,
    size: customFields?.size as string | undefined,
    color: customFields?.color as string | undefined,
    // Remove static fields from displayed customFields to avoid duplication/clutter
    customFields: customFields ? Object.fromEntries(
      Object.entries(customFields).filter(([key]) =>
        !['serialNumber', 'warranty', 'wholesalePrice', 'size', 'color'].includes(key)
      )
    ) : undefined,
    // Unit settings
    bulkUnit: (cloud as any).bulk_unit || 'كرتونة',
    smallUnit: (cloud as any).small_unit || 'قطعة',
    conversionFactor: (cloud as any).conversion_factor || 1,
    bulkCostPrice: Number((cloud as any).bulk_cost_price) || 0,
    bulkSalePrice: Number((cloud as any).bulk_sale_price) || 0,
    trackByUnit: (cloud as any).track_by_unit || 'piece',
  };
}

// Transform legacy product to cloud format
function toCloudProduct(product: Omit<Product, 'id' | 'status'>): Record<string, unknown> {
  // Merge static fields into custom_fields
  const mergedCustomFields = {
    ...(product.customFields || {}),
    ...(product.serialNumber ? { serialNumber: product.serialNumber } : {}),
    ...(product.warranty ? { warranty: product.warranty } : {}),
    ...(product.wholesalePrice ? { wholesalePrice: product.wholesalePrice } : {}),
    ...(product.size ? { size: product.size } : {}),
    ...(product.color ? { color: product.color } : {}),
  };

  return {
    name: product.name,
    barcode: product.barcode || null,
    barcode2: product.barcode2 || null,
    barcode3: product.barcode3 || null,
    category: product.category || null,
    cost_price: product.costPrice || 0,
    sale_price: product.salePrice || 0,
    quantity: product.quantity || 0,
    min_stock_level: product.minStockLevel || 1, // Default to 1 if not set
    expiry_date: product.expiryDate || null,
    image_url: product.image || null,
    custom_fields: Object.keys(mergedCustomFields).length > 0 ? mergedCustomFields : null,
    archived: false,
    // Unit settings
    bulk_unit: product.bulkUnit || 'كرتونة',
    small_unit: product.smallUnit || 'قطعة',
    conversion_factor: product.conversionFactor || 1,
    bulk_cost_price: product.bulkCostPrice || 0,
    bulk_sale_price: product.bulkSalePrice || 0,
    track_by_unit: product.trackByUnit || 'piece',
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
const CACHE_TTL = 10000; // 10 seconds

// Local storage key for offline fallback (legacy, kept as secondary fallback)
const LOCAL_PRODUCTS_CACHE_KEY = 'hyperpos_products_cache';

// Save products to IndexedDB + localStorage as backup
const saveToLocalCache = (products: Product[]) => {
  // Primary: IndexedDB
  saveProductsToIDB(products).catch(e => console.warn('[ProductsCloud] IDB save failed:', e));
  // Secondary: localStorage
  try {
    localStorage.setItem(LOCAL_PRODUCTS_CACHE_KEY, JSON.stringify({
      products,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('[ProductsCloud] localStorage save failed:', e);
  }
};

// Load products from IndexedDB first, then localStorage fallback
const loadFromLocalCache = async (): Promise<Product[] | null> => {
  // Try IndexedDB first (faster, larger capacity)
  try {
    const idbResult = await loadProductsFromIDB<Product>();
    if (idbResult && idbResult.products.length > 0 && Date.now() - idbResult.timestamp < 86400000) {
      console.log('[ProductsCloud] ✅ Serving from IndexedDB cache (' + idbResult.products.length + ' products)');
      return idbResult.products;
    }
  } catch (e) {
    console.warn('[ProductsCloud] IDB load failed:', e);
  }

  // Fallback: localStorage
  try {
    const cached = localStorage.getItem(LOCAL_PRODUCTS_CACHE_KEY);
    if (cached) {
      const { products, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 86400000) {
        console.log('[ProductsCloud] Serving from localStorage fallback');
        return products;
      }
    }
  } catch (e) {
    console.warn('[ProductsCloud] localStorage load failed:', e);
  }
  return null;
};

// Load products from cloud with caching and IndexedDB/localStorage fallback
export const loadProductsCloud = async (): Promise<Product[]> => {
  const userId = getCurrentUserId();

  // If no user, try local cache
  if (!userId) {
    const localProducts = await loadFromLocalCache();
    if (localProducts && localProducts.length > 0) {
      return localProducts;
    }
    return [];
  }

  // Check memory cache first
  if (productsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return productsCache;
  }

  // Check if we're online
  const isOnline = navigator.onLine;

  if (!isOnline) {
    // Offline: serve from local cache directly
    const localProducts = await loadFromLocalCache();
    if (localProducts && localProducts.length > 0) {
      productsCache = localProducts;
      cacheTimestamp = Date.now();
      console.log('[ProductsCloud] 📴 Offline - serving', localProducts.length, 'products from local cache');
      return localProducts;
    }
    return productsCache || [];
  }

  try {
    const cloudProducts = await fetchFromSupabase<CloudProduct>('products', {
      column: 'created_at',
      ascending: false
    });

    // If cloud returned empty but we have local cache, it might be a network issue
    if (cloudProducts.length === 0) {
      const localProducts = await loadFromLocalCache();
      if (localProducts && localProducts.length > 0) {
        console.log('[ProductsCloud] ⚠️ Cloud returned empty, using local cache');
        productsCache = localProducts;
        cacheTimestamp = Date.now();
        return localProducts;
      }
    }

    productsCache = cloudProducts.map(toProduct);
    cacheTimestamp = Date.now();

    // Save to IndexedDB + localStorage as backup (only if we got data)
    if (productsCache.length > 0) {
      saveToLocalCache(productsCache);
    }

    return productsCache;
  } catch (error) {
    console.error('[ProductsCloud] Cloud fetch failed, trying offline cache:', error);

    const localProducts = await loadFromLocalCache();
    if (localProducts && localProducts.length > 0) {
      return localProducts;
    }

    if (productsCache && productsCache.length > 0) {
      return productsCache;
    }

    return [];
  }
};

// Invalidate cache - مسح الذاكرة و localStorage للمزامنة الفورية
export const invalidateProductsCache = () => {
  productsCache = null;
  cacheTimestamp = 0;
  // مسح localStorage لضمان التحديث من السحابة
  try {
    localStorage.removeItem(LOCAL_PRODUCTS_CACHE_KEY);
  } catch (e) {
    console.warn('Failed to clear products localStorage cache:', e);
  }
};

// Add product to cloud
export const addProductCloud = async (product: Omit<Product, 'id' | 'status'>): Promise<Product | null> => {
  const cloudData = toCloudProduct(product);
  const inserted = await insertToSupabase<CloudProduct>('products', cloudData);

  if (inserted) {
    const newProduct = toProduct(inserted);
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
    triggerAutoBackup(`منتج جديد: ${product.name}`);
    return newProduct;
  }

  return null;
};

// Update product in cloud
export const updateProductCloud = async (id: string, data: Partial<Omit<Product, 'id' | 'status'>>): Promise<boolean> => {
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.barcode !== undefined) updates.barcode = data.barcode || null;
  if (data.barcode2 !== undefined) updates.barcode2 = data.barcode2 || null;
  if (data.barcode3 !== undefined) updates.barcode3 = data.barcode3 || null;
  if (data.category !== undefined) updates.category = data.category || null;
  if (data.costPrice !== undefined) updates.cost_price = data.costPrice;
  if (data.salePrice !== undefined) updates.sale_price = data.salePrice;
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.minStockLevel !== undefined) updates.min_stock_level = data.minStockLevel;
  if (data.expiryDate !== undefined) updates.expiry_date = data.expiryDate || null;
  if (data.image !== undefined) updates.image_url = data.image || null;
  // Unit settings
  if (data.bulkUnit !== undefined) updates.bulk_unit = data.bulkUnit;
  if (data.smallUnit !== undefined) updates.small_unit = data.smallUnit;
  if (data.conversionFactor !== undefined) updates.conversion_factor = data.conversionFactor;
  if (data.bulkCostPrice !== undefined) updates.bulk_cost_price = data.bulkCostPrice;
  if (data.bulkSalePrice !== undefined) updates.bulk_sale_price = data.bulkSalePrice;
  if (data.trackByUnit !== undefined) updates.track_by_unit = data.trackByUnit;

  // ✅ Merge static fields (wholesalePrice, serialNumber, etc.) into custom_fields
  // These fields are stored inside custom_fields JSONB column, not as separate columns
  const mergedCustomFields: Record<string, unknown> = {
    ...(data.customFields || {}),
    ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber } : {}),
    ...(data.warranty !== undefined ? { warranty: data.warranty } : {}),
    ...(data.wholesalePrice !== undefined ? { wholesalePrice: data.wholesalePrice } : {}),
    ...(data.size !== undefined ? { size: data.size } : {}),
    ...(data.color !== undefined ? { color: data.color } : {}),
  };

  // Only update custom_fields if there's something to merge
  if (Object.keys(mergedCustomFields).length > 0) {
    updates.custom_fields = mergedCustomFields;
  } else if (data.customFields !== undefined) {
    updates.custom_fields = data.customFields || null;
  }

  const success = await updateInSupabase('products', id, updates);

  if (success) {
    invalidateProductsCache();
    emitEvent(EVENTS.PRODUCTS_UPDATED, null);
    triggerAutoBackup(`تعديل منتج: ${id}`);
  }

  return success;
};

// Delete product from cloud (with cascading delete of related records)
export const deleteProductCloud = async (id: string): Promise<boolean> => {
  const userId = getCurrentUserId();
  if (!userId) return false;

  try {
    // ✅ المرحلة 1: حذف السجلات المرتبطة أولاً (بسبب المفاتيح الأجنبية)

    // حذف من stock_transfer_items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('stock_transfer_items')
      .delete()
      .eq('product_id', id);

    // حذف من warehouse_stock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('warehouse_stock')
      .delete()
      .eq('product_id', id);

    // ✅ المرحلة 2: حذف المنتج نفسه
    const success = await deleteFromSupabase('products', id);

    if (success) {
      invalidateProductsCache();
      emitEvent(EVENTS.PRODUCTS_UPDATED, null);
    }

    return success;
  } catch (error) {
    console.error('[deleteProductCloud] Error:', error);
    return false;
  }
};

// Get product by ID
export const getProductByIdCloud = async (id: string): Promise<Product | null> => {
  const products = await loadProductsCloud();
  return products.find(p => p.id === id) || null;
};

// Get product by barcode (searches all barcodes) - IDB first for instant offline lookup
export const getProductByBarcodeCloud = async (barcode: string): Promise<Product | null> => {
  // Try IDB first for instant result (even offline)
  try {
    const idbResult = await getProductByBarcodeIDB<Product>(barcode);
    if (idbResult) {
      console.log('[ProductsCloud] ⚡ Barcode found in IDB:', barcode);
      return idbResult;
    }
  } catch (e) {
    console.warn('[ProductsCloud] IDB barcode lookup failed:', e);
  }

  // Fallback to memory cache / cloud
  const products = await loadProductsCloud();
  return products.find(p =>
    p.barcode === barcode ||
    p.barcode2 === barcode ||
    p.barcode3 === barcode
  ) || null;
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
