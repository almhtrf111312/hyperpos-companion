// src/lib/db/products-storage-bridge.ts
import { isNativeStorageSupported, getNativeDB } from './native-sqlite';
import { getCachedProducts as getFromIndexedDB, setCachedProducts as setToIndexedDB } from '../indexeddb-cache';

// حفظ قائمة المنتجات القادمة من السحابة في SQLite
export async function saveProductsLocally(products: any[]): Promise<void> {
  if (!isNativeStorageSupported()) {
    // الرجوع لـ IndexedDB في المتصفح
    return await setToIndexedDB(products);
  }

  const db = await getNativeDB();
  if (!db) return await setToIndexedDB(products);

  try {
    await db.execute('BEGIN TRANSACTION;');
    for (const p of products) {
      await db.run(
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
    await db.execute('COMMIT;');
  } catch (error) {
    await db.execute('ROLLBACK;');
    console.error('❌ خطأ في كتابة المنتجات في SQLite:', error);
    await setToIndexedDB(products); // fallback
  }
}

// بحث سريع بالباركود أو الاسم من SQLite
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

  return res.values || [];
}
