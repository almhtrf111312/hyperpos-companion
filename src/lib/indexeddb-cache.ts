// IndexedDB Cache Layer for Offline-First Product Access
// Provides instant loading and full offline capability for POS

const DB_NAME = 'hyperpos_cache';
const DB_VERSION = 2;
const PRODUCTS_STORE = 'products';
const META_STORE = 'meta';
const PENDING_STOCK_STORE = 'pending_stock_deductions';

export interface PendingStockDeduction {
  operationId: string;
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

// Save all products to IndexedDB (bulk replace)
export async function saveProductsToIDB(products: unknown[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([PRODUCTS_STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);
    const metaStore = tx.objectStore(META_STORE);

    // Clear existing and write new
    store.clear();
    for (const product of products) {
      store.put(product);
    }

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

// Load all products from IndexedDB
export async function loadProductsFromIDB<T>(): Promise<{ products: T[]; timestamp: number } | null> {
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

// Get a single product by barcode from IndexedDB
export async function getProductByBarcodeIDB<T>(barcode: string): Promise<T | null> {
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
