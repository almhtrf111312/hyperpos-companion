// src/lib/db/schema.ts
import { SQLiteDBConnection } from '@capacitor-community/sqlite';

export async function initNativeSchema(db: SQLiteDBConnection): Promise<void> {
  const schemaQuery = `
    PRAGMA foreign_keys = ON;

    -- جدول المنتجات المحلي (فائق السرعة)
    CREATE TABLE IF NOT EXISTS local_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      barcode2 TEXT,
      barcode3 TEXT,
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      image TEXT,
      category TEXT,
      unit TEXT DEFAULT 'piece',
      pieces_per_box INTEGER DEFAULT 1,
      min_stock_alert REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      custom_fields TEXT,
      raw_data TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_prod_barcode ON local_products(barcode);
    CREATE INDEX IF NOT EXISTS idx_prod_barcode2 ON local_products(barcode2);
    CREATE INDEX IF NOT EXISTS idx_prod_barcode3 ON local_products(barcode3);
    CREATE INDEX IF NOT EXISTS idx_prod_category ON local_products(category);

    -- جدول فواتير البيع المحلية
    CREATE TABLE IF NOT EXISTS local_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      customer_id TEXT,
      customer_name TEXT,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      remaining_amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      exchange_rate REAL DEFAULT 1,
      payment_type TEXT DEFAULT 'cash',
      sync_status TEXT DEFAULT 'pending',
      cashier_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inv_sync ON local_invoices(sync_status);

    -- جدول بنود الفواتير
    CREATE TABLE IF NOT EXISTS local_invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      total_price REAL NOT NULL,
      is_box INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES local_invoices(id) ON DELETE CASCADE
    );

    -- جدول العملاء المحلي
    CREATE TABLE IF NOT EXISTS local_customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      current_balance REAL DEFAULT 0,
      updated_at TEXT
    );
  `;

  await db.execute(schemaQuery);

  // ترقية تلقائية آمنة للأجهزة التي تمتلك الجدول مسبقاً
  try {
    await db.execute('ALTER TABLE local_products ADD COLUMN image TEXT;');
  } catch (_) {}
  try {
    await db.execute('ALTER TABLE local_products ADD COLUMN raw_data TEXT;');
  } catch (_) {}
}
