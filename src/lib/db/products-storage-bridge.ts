// src/lib/db/products-storage-bridge.ts
import { isNativeStorageSupported, getNativeDB } from './native-sqlite';
import { getCachedProducts as getFromIndexedDB, setCachedProducts as setToIndexedDB } from '../indexeddb-cache';

export async function saveProductsLocally(products: any[]): Promise<void> {
  return await setToIndexedDB(products);
}

export async function queryLocalProduct(search: string): Promise<any[]> {
  if (!isNativeStorageSupported()) {
    const all = await getFromIndexedDB();
    return all.filter(p => 
      p.barcode === search || 
      p.barcode2 === search || 
      p.barcode3 === search || 
      p.name?.toLowerCase().includes(search.toLowerCase())
    );
  }

  const db = await getNativeDB();
  if (!db) return [];

  const res = await db.query(
    `SELECT * FROM local_products 
     WHERE is_active = 1 AND (barcode = ? OR barcode2 = ? OR barcode3 = ? OR name LIKE ?) 
     LIMIT 50;`,
    [search, search, search, `%${search}%`]
  );

  return (res.values || []).map(p => ({
    ...p,
    salePrice: Number(p.price) || 0,
    price: Number(p.price) || 0,
    costPrice: Number(p.cost_price) || 0,
    quantity: Number(p.stock) || 0,
    image: p.image || undefined,
  }));
}
