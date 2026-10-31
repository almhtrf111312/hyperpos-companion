// src/lib/db/sales-storage-bridge.ts
import { isNativeStorageSupported, getNativeDB } from './native-sqlite';

export interface NativeSaleItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  totalPrice: number;
  isBox?: boolean;
}

export interface NativeSaleRecord {
  id: string; // operationId
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  subtotal: number;
  discount?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount?: number;
  currency?: string;
  exchangeRate?: number;
  paymentType?: 'cash' | 'debt' | 'split';
  cashierName?: string | null;
  createdAt?: string;
  items: NativeSaleItem[];
}

/**
 * تسجيل فاتورة البيع وخصم المخزون ذرياً في SQLite محلياً قبل الرفع
 */
export async function recordSaleInNativeSQLite(sale: NativeSaleRecord): Promise<boolean> {
  if (!isNativeStorageSupported()) {
    return true; // في بيئة الويب والمتصفح يتم الاكتفاء بـ IndexedDB
  }

  const db = await getNativeDB();
  if (!db) return false;

  try {
    await db.execute('BEGIN TRANSACTION;');

    // 1. إدراج الفاتورة بحالة pending
    await db.run(
      `INSERT OR REPLACE INTO local_invoices (
        id, invoice_number, customer_id, customer_name,
        subtotal, discount, tax_amount, total_amount,
        paid_amount, remaining_amount, currency, exchange_rate,
        payment_type, sync_status, cashier_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?);`,
      [
        sale.id,
        sale.invoiceNumber,
        sale.customerId || null,
        sale.customerName || 'عميل نقدي',
        Number(sale.subtotal) || 0,
        Number(sale.discount) || 0,
        Number(sale.taxAmount) || 0,
        Number(sale.totalAmount) || 0,
        Number(sale.paidAmount) || 0,
        Number(sale.remainingAmount) || 0,
        sale.currency || 'USD',
        Number(sale.exchangeRate) || 1,
        sale.paymentType || 'cash',
        sale.cashierName || null,
        sale.createdAt || new Date().toISOString(),
      ]
    );

    // 2. إدراج بنود الفاتورة وخصم المخزون المحلي من local_products
    for (const item of sale.items) {
      const itemId = item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.run(
        `INSERT OR REPLACE INTO local_invoice_items (
          id, invoice_id, product_id, product_name,
          quantity, unit_price, cost_price, total_price, is_box
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          itemId,
          sale.id,
          item.productId,
          item.productName,
          Number(item.quantity) || 0,
          Number(item.unitPrice) || 0,
          Number(item.costPrice) || 0,
          Number(item.totalPrice) || 0,
          item.isBox ? 1 : 0,
        ]
      );

      // خصم الكمية المباعة من جدول المنتجات المحلي في SQLite
      if (item.productId && item.quantity > 0) {
        await db.run(
          `UPDATE local_products 
           SET stock = MAX(0, stock - ?) 
           WHERE id = ?;`,
          [Number(item.quantity), item.productId]
        );
      }
    }

    await db.execute('COMMIT;');
    return true;
  } catch (error) {
    await db.execute('ROLLBACK;');
    console.error('❌ [NativeSQLite] فشل تسجيل البيع الذري محلياً:', error);
    return false;
  }
}

/**
 * تحديث حالة الفاتورة في SQLite إلى synced بعد المزامنة السحابية بنجاح
 */
export async function markSaleAsSyncedInNativeSQLite(
  invoiceId: string,
  invoiceNumber?: string
): Promise<void> {
  if (!isNativeStorageSupported()) return;

  const db = await getNativeDB();
  if (!db) return;

  try {
    await db.run(
      `UPDATE local_invoices 
       SET sync_status = 'synced' 
       WHERE id = ? OR invoice_number = ? OR invoice_number = ?;`,
      [invoiceId, invoiceId, invoiceNumber || invoiceId]
    );
  } catch (error) {
    console.warn('⚠️ [NativeSQLite] تعذر تحديث حالة الفاتورة إلى synced:', error);
  }
}
