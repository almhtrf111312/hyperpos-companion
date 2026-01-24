/**
 * Unified Transaction System - FlowPOS Pro
 * =========================================
 * هذا الملف يضمن ترابط جميع العمليات المالية:
 * - المبيعات ← المخزون + الصندوق
 * - الديون ← العملاء + الصندوق
 * - المصاريف ← الصندوق + الأرباح
 * - المرتجعات ← المخزون + الصندوق
 * 
 * كل عملية مالية تؤثر على (المخزون، الصندوق، وسجل الأرباح) في نفس اللحظة
 */

import { addSalesToShift, addDepositToShift, addWithdrawalFromShift, addExpensesToShift, getActiveShift } from './cashbox-store';
import { deductStockBatch, checkStockAvailability, restoreStockBatch } from './products-store';
import { updateCustomerStats } from './customers-store';
import { addActivityLog } from './activity-log';
import { emitEvent, EVENTS } from './events';
import { roundCurrency } from './utils';

// Cloud imports
import { deductStockBatchCloud, restoreStockBatchCloud } from './cloud/products-cloud';
import { updateCustomerStatsCloud } from './cloud/customers-cloud';

export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number;
}

export interface TransactionResult {
  success: boolean;
  error?: string;
  insufficientItems?: Array<{ productName: string; available: number; requested: number }>;
}

/**
 * 1. عملية بيع نقدي متكاملة
 * - التحقق من المخزون
 * - خصم الكميات من المنتجات
 * - إضافة المبلغ للصندوق
 * - تحديث إحصائيات العميل
 */
export const processCashSale = async (
  items: TransactionItem[],
  total: number,
  customerId?: string,
  userId?: string,
  userName?: string
): Promise<TransactionResult> => {
  // Step 1: التحقق من توفر المخزون
  const stockItems = items.map(item => ({ productId: item.productId, quantity: item.quantity }));
  const stockCheck = checkStockAvailability(stockItems);
  
  if (!stockCheck.success) {
    return {
      success: false,
      error: 'المخزون غير كافٍ',
      insufficientItems: stockCheck.insufficientItems
    };
  }

  try {
    // Step 2: خصم الكميات من المخزون (Cloud + Local)
    await deductStockBatchCloud(stockItems);
    deductStockBatch(stockItems);

    // Step 3: إضافة المبلغ للصندوق
    addSalesToShift(roundCurrency(total));

    // Step 4: تحديث إحصائيات العميل
    if (customerId) {
      await updateCustomerStatsCloud(customerId, total, false);
      updateCustomerStats(customerId, total, false);
    }

    // Step 5: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'sale',
        userId,
        userName,
        `عملية بيع نقدي متكاملة بقيمة $${total.toLocaleString()}`,
        { total, itemsCount: items.length, type: 'cash' }
      );
    }

    // Emit unified event
    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'cash_sale', total });

    return { success: true };
  } catch (error) {
    console.error('خطأ في عملية البيع المتكاملة:', error);
    return { success: false, error: 'حدث خطأ أثناء إتمام العملية' };
  }
};

/**
 * 2. عملية بيع بالدين متكاملة
 * - التحقق من المخزون
 * - خصم الكميات
 * - تحديث رصيد العميل (زيادة الدين)
 * - لا يُضاف للصندوق حتى السداد
 */
export const processDebtSale = async (
  items: TransactionItem[],
  total: number,
  customerId: string,
  userId?: string,
  userName?: string
): Promise<TransactionResult> => {
  // Step 1: التحقق من توفر المخزون
  const stockItems = items.map(item => ({ productId: item.productId, quantity: item.quantity }));
  const stockCheck = checkStockAvailability(stockItems);
  
  if (!stockCheck.success) {
    return {
      success: false,
      error: 'المخزون غير كافٍ',
      insufficientItems: stockCheck.insufficientItems
    };
  }

  try {
    // Step 2: خصم الكميات من المخزون
    await deductStockBatchCloud(stockItems);
    deductStockBatch(stockItems);

    // Step 3: تحديث رصيد العميل (إضافة الدين)
    await updateCustomerStatsCloud(customerId, total, true);
    updateCustomerStats(customerId, total, true);

    // Step 4: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'sale',
        userId,
        userName,
        `عملية بيع بالدين بقيمة $${total.toLocaleString()}`,
        { total, itemsCount: items.length, type: 'debt' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'debt_sale', total });

    return { success: true };
  } catch (error) {
    console.error('خطأ في عملية البيع بالدين:', error);
    return { success: false, error: 'حدث خطأ أثناء إتمام العملية' };
  }
};

/**
 * 3. تسديد دين متكامل
 * - إضافة المبلغ للصندوق
 * - تحديث رصيد العميل (خصم من الدين)
 * - تحديث حالة الفاتورة
 */
export const processDebtPayment = (
  amount: number,
  customerId?: string,
  userId?: string,
  userName?: string
): TransactionResult => {
  try {
    // Step 1: إضافة المبلغ المدفوع للصندوق
    addDepositToShift(roundCurrency(amount));

    // Step 2: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'debt_payment',
        userId,
        userName,
        `تسديد دين بقيمة $${amount.toLocaleString()}`,
        { amount, customerId, type: 'debt_payment' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'debt_payment', amount });
    emitEvent(EVENTS.CASHBOX_UPDATED, { added: amount });

    return { success: true };
  } catch (error) {
    console.error('خطأ في تسديد الدين:', error);
    return { success: false, error: 'حدث خطأ أثناء تسجيل الدفعة' };
  }
};

/**
 * 4. عملية مرتجع متكاملة
 * - إعادة الكميات للمخزون
 * - خصم المبلغ من الصندوق
 * - تحديث إحصائيات العميل
 */
export const processRefund = async (
  items: TransactionItem[],
  total: number,
  customerId?: string,
  userId?: string,
  userName?: string
): Promise<TransactionResult> => {
  try {
    // Step 1: إعادة الكميات للمخزون
    const stockItems = items.map(item => ({ productId: item.productId, quantity: item.quantity }));
    await restoreStockBatchCloud(stockItems);
    restoreStockBatch(stockItems);

    // Step 2: خصم المبلغ من الصندوق
    addWithdrawalFromShift(roundCurrency(total));

    // Step 3: تحديث إحصائيات العميل (خصم المشتريات)
    if (customerId) {
      // Negative purchase to reduce total
      await updateCustomerStatsCloud(customerId, -total, false);
    }

    // Step 4: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'refund',
        userId,
        userName,
        `عملية مرتجع بقيمة $${total.toLocaleString()}`,
        { total, itemsCount: items.length, type: 'refund' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'refund', total });

    return { success: true };
  } catch (error) {
    console.error('خطأ في عملية المرتجع:', error);
    return { success: false, error: 'حدث خطأ أثناء إتمام المرتجع' };
  }
};

/**
 * 5. تسجيل مصروف متكامل
 * - خصم المبلغ من الصندوق
 * - تسجيل في سجل المصاريف
 */
export const processExpense = (
  amount: number,
  expenseType: string,
  userId?: string,
  userName?: string
): TransactionResult => {
  try {
    // Step 1: خصم المبلغ من الصندوق
    addExpensesToShift(roundCurrency(amount));

    // Step 2: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'expense',
        userId,
        userName,
        `تسجيل مصروف (${expenseType}) بقيمة $${amount.toLocaleString()}`,
        { amount, expenseType, type: 'expense' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'expense', amount });
    emitEvent(EVENTS.EXPENSES_UPDATED, null);

    return { success: true };
  } catch (error) {
    console.error('خطأ في تسجيل المصروف:', error);
    return { success: false, error: 'حدث خطأ أثناء تسجيل المصروف' };
  }
};

/**
 * حساب صافي الربح الحقيقي
 * إجمالي الأرباح - إجمالي المصاريف
 */
export const calculateNetProfit = (totalProfit: number, totalExpenses: number): number => {
  return roundCurrency(totalProfit - totalExpenses);
};

/**
 * التحقق من إمكانية إتمام عملية البيع
 */
export const canProcessSale = (items: Array<{ productId: string; quantity: number }>): TransactionResult => {
  const stockCheck = checkStockAvailability(items);
  
  if (!stockCheck.success) {
    return {
      success: false,
      error: 'المخزون غير كافٍ',
      insufficientItems: stockCheck.insufficientItems
    };
  }
  
  return { success: true };
};

/**
 * التحقق من وجود وردية مفتوحة
 */
export const hasActiveShift = (): boolean => {
  return getActiveShift() !== null;
};
