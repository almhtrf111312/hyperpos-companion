// IndexedDB Cache Layer for Offline-First Product Access
// Provides instant loading and full offline capability for POS
import { isNativeStorageSupported, getNativeDB } from './db/native-sqlite';

const DB_NAME = 'hyperpos_cache';
const DB_VERSION = 2;
const PRODUCTS_STORE = 'products';
const META_STORE = 'meta';
const PENDING_STOCK_STORE = 'pending_stock_deductions';

export interface PendingStockDeduction {
  operationId: string;
  warehouseId?: string;
  items: Array<{ productId: string; quantity: number }>;
  createdAt: string;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
        store.createIndex('barcode', 'barcode', { unique: false });
        store.createIndex('barcode2', 'barcode2', { unique: false });
        store.createIndex('barcode3', 'barcode3', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PENDING_STOCK_STORE)) {
        db.createObjectStore(PENDING_STOCK_STORE, { keyPath: 'operationId' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getPendingStockDeductions(): Promise<PendingStockDeduction[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STOCK_STORE, 'readonly');
    const request = tx.objectStore(PENDING_STOCK_STORE).getAll();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as PendingStockDeduction[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[IDB] Failed to load pending stock deductions:', error);
    return [];
  }
}

export async function savePendingStockDeduction(deduction: PendingStockDeduction): Promise<boolean> {
  try {
    const db = await openDB();
    const existing = await new Promise<PendingStockDeduction | undefined>((resolve) => {
      const tx = db.transaction(PENDING_STOCK_STORE, 'readonly');
      const request = tx.objectStore(PENDING_STOCK_STORE).get(deduction.operationId);
      request.onsuccess = () => resolve(request.result as PendingStockDeduction | undefined);
      request.onerror = () => resolve(undefined);
    });
    if (existing) return false;

    const tx = db.transaction(PENDING_STOCK_STORE, 'readwrite');
    tx.objectStore(PENDING_STOCK_STORE).put(deduction);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (error) {
    console.warn('[IDB] Failed to save pending stock deduction:', error);
    throw error;
  }
}

export async function removePendingStockDeduction(operationId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STOCK_STORE, 'readwrite');
    tx.objectStore(PENDING_STOCK_STORE).delete(operationId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('[IDB] Failed to remove pending stock deduction:', error);
  }
}

// Save all products to Hybrid Store (SQLite on Native, IndexedDB on Web)
export async function saveProductsToIDB(products: unknown[]): Promise<void> {
  if (isNativeStorageSupported()) {
    try {
      const nativeDb = await getNativeDB();
      if (nativeDb) {
        await nativeDb.execute('BEGIN TRANSACTION;');
        for (const product of products) {
          const p = product as any;
          if (!p || !p.id) continue;
          await nativeDb.run(
            `INSERT OR REPLACE INTO local_products 
            (id, name, barcode, barcode2, barcode3, price, cost_price, stock, category, unit, pieces_per_box, is_active, custom_fields, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              p.id,
              p.name || '',
              p.barcode || null,
              p.barcode2 || null,
              p.barcode3 || null,
              Number(p.price) || 0,
              Number(p.cost_price) || 0,
              Number(p.stock) || 0,
              p.category || '',
              p.unit || 'piece',
              p.pieces_per_box || 1,
              p.is_active !== false ? 1 : 0,
              p.custom_fields ? JSON.stringify(p.custom_fields) : null,
              p.updated_at || new Date().toISOString()
            ]
          );
        }
        await nativeDb.execute('COMMIT;');
      }
    } catch (e) {
      console.warn('[HybridStore] Native SQLite save failed, falling back to IDB:', e);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction([PRODUCTS_STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);
    const metaStore = tx.objectStore(META_STORE);

    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      const oldKeys = new Set(keysReq.result as string[]);
      for (const product of products) {
        const p = product as { id: string };
        if (p && p.id) {
          store.put(p);
          oldKeys.delete(p.id);
        }
      }
      for (const key of oldKeys) {
        store.delete(key);
      }
    };

    // Save timestamp
    metaStore.put({ key: 'products_updated_at', value: Date.now() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[IDB] Failed to save products:', e);
  }
}

// Load all products from Hybrid Store (SQLite on Native, IndexedDB on Web)
export async function loadProductsFromIDB<T>(): Promise<{ products: T[]; timestamp: number } | null> {
  if (isNativeStorageSupported()) {
    try {
      const nativeDb = await getNativeDB();
      if (nativeDb) {
        const res = await nativeDb.query('SELECT * FROM local_products WHERE is_active = 1;');
        if (res.values && res.values.length > 0) {
          const products = res.values.map(p => ({
            ...p,
            custom_fields: p.custom_fields ? (typeof p.custom_fields === 'string' ? JSON.parse(p.custom_fields) : p.custom_fields) : null
          })) as T[];
          return { products, timestamp: Date.now() };
        }
      }
    } catch (e) {
      console.warn('[HybridStore] Native SQLite load failed, falling back to IDB:', e);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction([PRODUCTS_STORE, META_STORE], 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    const metaStore = tx.objectStore(META_STORE);

    const productsReq = store.getAll();
    const metaReq = metaStore.get('products_updated_at');

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        const products = productsReq.result as T[];
        const timestamp = metaReq.result?.value || 0;
        
        if (products.length === 0) {
          resolve(null);
          return;
        }
        resolve({ products, timestamp });
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[IDB] Failed to load products:', e);
    return null;
  }
}

// Get a single product by barcode from Hybrid Store (SQLite on Native, IndexedDB on Web)
export async function getProductByBarcodeIDB<T>(barcode: string): Promise<T | null> {
  if (isNativeStorageSupported()) {
    try {
      const nativeDb = await getNativeDB();
      if (nativeDb) {
        const res = await nativeDb.query(
          'SELECT * FROM local_products WHERE is_active = 1 AND (barcode = ? OR barcode2 = ? OR barcode3 = ?) LIMIT 1;',
          [barcode, barcode, barcode]
        );
        if (res.values && res.values.length > 0) {
          const p = res.values[0];
          return {
            ...p,
            custom_fields: p.custom_fields ? (typeof p.custom_fields === 'string' ? JSON.parse(p.custom_fields) : p.custom_fields) : null
          } as T;
        }
      }
    } catch (e) {
      console.warn('[HybridStore] Native barcode search failed, falling back to IDB:', e);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);

    // Search across all 3 barcode indexes
    const indexes = ['barcode', 'barcode2', 'barcode3'];
    
    for (const indexName of indexes) {
      const index = store.index(indexName);
      const result = await new Promise<T | null>((resolve) => {
        const req = index.get(barcode);
        req.onsuccess = () => resolve(req.result as T | null);
        req.onerror = () => resolve(null);
      });
      if (result) return result;
    }
    return null;
  } catch (e) {
    console.warn('[IDB] Failed to search by barcode:', e);
    return null;
  }
}

// Clear all cached products
export async function clearProductsIDB(): Promise<void> {
  if (isNativeStorageSupported()) {
    try {
      const nativeDb = await getNativeDB();
      if (nativeDb) {
        await nativeDb.execute('DELETE FROM local_products;');
      }
    } catch (e) {
      console.warn('[HybridStore] Failed to clear native products:', e);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction([PRODUCTS_STORE, META_STORE, PENDING_STOCK_STORE], 'readwrite');
    tx.objectStore(PRODUCTS_STORE).clear();
    tx.objectStore(META_STORE).delete('products_updated_at');
    tx.objectStore(PENDING_STOCK_STORE).clear();
  } catch (e) {
    console.warn('[IDB] Failed to clear products:', e);
  }
}

// Delete a single product from IndexedDB and SQLite
export async function deleteProductFromIDB(id: string): Promise<void> {
  if (isNativeStorageSupported()) {
    try {
      const nativeDb = await getNativeDB();
      if (nativeDb) {
        await nativeDb.run('DELETE FROM local_products WHERE id = ?;', [id]);
      }
    } catch (e) {
      console.warn('[HybridStore] Native delete failed:', e);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction([PRODUCTS_STORE, META_STORE], 'readwrite');
    tx.objectStore(PRODUCTS_STORE).delete(id);
    tx.objectStore(META_STORE).put({ key: 'products_updated_at', value: Date.now() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[IDB] Failed to delete product from IDB:', e);
  }
}

// Update a single product in IndexedDB and SQLite
export async function updateProductInIDB(id: string, updates: Record<string, unknown>): Promise<void> {
  if (isNativeStorageSupported()) {
    try {
      const nativeDb = await getNativeDB();
      if (nativeDb) {
        const sets: string[] = [];
        const vals: any[] = [];
        for (const [key, val] of Object.entries(updates)) {
          if (['name', 'barcode', 'barcode2', 'barcode3', 'price', 'cost_price', 'stock', 'category', 'unit', 'pieces_per_box', 'is_active', 'updated_at'].includes(key)) {
            sets.push(`${key} = ?`);
            vals.push(val);
          } else if (key === 'custom_fields') {
            sets.push('custom_fields = ?');
            vals.push(val ? JSON.stringify(val) : null);
          }
        }
        if (sets.length > 0) {
          vals.push(id);
          await nativeDb.run(`UPDATE local_products SET ${sets.join(', ')} WHERE id = ?;`, vals);
        }
      }
    } catch (e) {
      console.warn('[HybridStore] Native update failed:', e);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction([PRODUCTS_STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const updated = { ...getReq.result, ...updates };
        store.put(updated);
      }
    };

    tx.objectStore(META_STORE).put({ key: 'products_updated_at', value: Date.now() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[IDB] Failed to update product in IDB:', e);
  }
}

// Check if IDB cache is still fresh (within maxAge ms)
export async function isIDBCacheFresh(maxAgeMs: number = 86400000): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const metaStore = tx.objectStore(META_STORE);
    const req = metaStore.get('products_updated_at');

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const timestamp = req.result?.value || 0;
        resolve(Date.now() - timestamp < maxAgeMs);
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// Compatibility helper aliases for Hybrid Store bridge
export async function getCachedProducts<T = any>(): Promise<T[]> {
  const result = await loadProductsFromIDB<T>();
  return result?.products || [];
}

export async function setCachedProducts(products: unknown[]): Promise<void> {
  return await saveProductsToIDB(products);
}
