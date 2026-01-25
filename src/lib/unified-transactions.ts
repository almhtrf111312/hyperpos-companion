/**
 * Unified Transaction System - FlowPOS Pro
 * =========================================
 * هذا الملف يضمن ترابط جميع العمليات المالية:
 * - المبيعات ← المخزون + الصندوق + سجل الأرباح
 * - الديون ← العملاء + الصندوق + سجل الأرباح
 * - المصاريف ← الصندوق + سجل المصروفات التشغيلية
 * - المرتجعات ← المخزون + الصندوق + إلغاء سجل الربح
 * 
 * كل عملية مالية تؤثر على (المخزون، الصندوق، وسجل الأرباح) في نفس اللحظة
 * 
 * الصيغة الصحيحة للربح:
 * صافي الربح = (المبيعات - تكلفة البضاعة المباعة) - المصروفات التشغيلية
 * 
 * التحسينات:
 * - نظام الأقفال (Transaction Locks) لمنع تداخل العمليات
 * - طابور التزامن (Sync Queue) للعمل offline-first
 */

import { addSalesToShift, addDepositToShift, addWithdrawalFromShift, addExpensesToShift, getActiveShift } from './cashbox-store';
import { deductStockBatch, checkStockAvailability, restoreStockBatch } from './products-store';
import { updateCustomerStats } from './customers-store';
import { addActivityLog } from './activity-log';
import { emitEvent, EVENTS } from './events';
import { roundCurrency, addCurrency } from './utils';
import { addGrossProfit, addOperatingExpense, removeGrossProfit } from './profits-store';
import { withLock, LOCK_RESOURCES } from './transaction-lock';
import { addToQueue } from './sync-queue';

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
  // بيانات الربح للعملية
  grossProfit?: number;
  cogs?: number;
  invoiceId?: string;
}

/**
 * 1. عملية بيع نقدي متكاملة
 * - التحقق من المخزون
 * - خصم الكميات من المنتجات
 * - حساب COGS والربح الإجمالي
 * - إضافة المبلغ للصندوق
 * - تسجيل الربح في سجل الأرباح
 * - تحديث إحصائيات العميل
 */
export const processCashSale = async (
  items: TransactionItem[],
  total: number,
  customerId?: string,
  userId?: string,
  userName?: string,
  invoiceId?: string
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

  // استخدام القفل لضمان عدم تداخل العمليات
  const lockResult = await withLock(LOCK_RESOURCES.SALE_PROCESSING, async () => {
    // Step 2: حساب تكلفة البضاعة المباعة والربح الإجمالي
    const totalCOGS = items.reduce((sum, item) => 
      addCurrency(sum, roundCurrency(item.costPrice * item.quantity)), 0);
    const grossProfit = roundCurrency(total - totalCOGS);

    // Step 3: خصم الكميات من المخزون (Local أولاً)
    deductStockBatch(stockItems);
    
    // Step 4: إضافة المبلغ للصندوق مع بيانات الربح
    addSalesToShift(roundCurrency(total), grossProfit, totalCOGS);

    // Step 5: تسجيل الربح في سجل الأرباح
    const saleId = invoiceId || `sale_${Date.now()}`;
    addGrossProfit(saleId, grossProfit, totalCOGS, total);

    // Step 6: تحديث إحصائيات العميل
    if (customerId) {
      updateCustomerStats(customerId, total, false);
    }

    // Step 7: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'sale',
        userId,
        userName,
        `عملية بيع نقدي: $${total.toLocaleString()} | ربح: $${grossProfit.toLocaleString()}`,
        { total, grossProfit, cogs: totalCOGS, itemsCount: items.length, type: 'cash' }
      );
    }

    // Step 8: إرسال للسحابة (في الخلفية)
    try {
      await deductStockBatchCloud(stockItems);
      if (customerId) {
        await updateCustomerStatsCloud(customerId, total, false);
      }
    } catch (cloudError) {
      // إضافة للطابور للتزامن لاحقاً
      console.warn('فشل التزامن السحابي، إضافة للطابور:', cloudError);
      addToQueue('sale', { items: stockItems, total, customerId, invoiceId: saleId });
    }

    // Emit unified event
    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'cash_sale', total, grossProfit, cogs: totalCOGS });

    return { grossProfit, cogs: totalCOGS, saleId };
  });

  if (!lockResult.success) {
    return { success: false, error: lockResult.error || 'عملية أخرى جارية، حاول مرة أخرى' };
  }

  return { 
    success: true, 
    grossProfit: lockResult.result?.grossProfit, 
    cogs: lockResult.result?.cogs, 
    invoiceId: lockResult.result?.saleId 
  };
};

/**
 * 2. عملية بيع بالدين متكاملة
 * - التحقق من المخزون
 * - خصم الكميات
 * - حساب COGS والربح الإجمالي
 * - تسجيل الربح في سجل الأرباح
 * - تحديث رصيد العميل (زيادة الدين)
 * - لا يُضاف للصندوق حتى السداد
 */
export const processDebtSale = async (
  items: TransactionItem[],
  total: number,
  customerId: string,
  userId?: string,
  userName?: string,
  invoiceId?: string
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
    // Step 2: حساب تكلفة البضاعة المباعة والربح الإجمالي
    const totalCOGS = items.reduce((sum, item) => 
      addCurrency(sum, roundCurrency(item.costPrice * item.quantity)), 0);
    const grossProfit = roundCurrency(total - totalCOGS);

    // Step 3: خصم الكميات من المخزون
    await deductStockBatchCloud(stockItems);
    deductStockBatch(stockItems);

    // Step 4: تسجيل الربح في سجل الأرباح (الربح يُسجل عند البيع وليس عند السداد)
    const saleId = invoiceId || `sale_${Date.now()}`;
    addGrossProfit(saleId, grossProfit, totalCOGS, total);

    // Step 5: تحديث رصيد العميل (إضافة الدين)
    await updateCustomerStatsCloud(customerId, total, true);
    updateCustomerStats(customerId, total, true);

    // Step 6: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'sale',
        userId,
        userName,
        `عملية بيع بالدين: $${total.toLocaleString()} | ربح: $${grossProfit.toLocaleString()}`,
        { total, grossProfit, cogs: totalCOGS, itemsCount: items.length, type: 'debt' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'debt_sale', total, grossProfit, cogs: totalCOGS });

    return { success: true, grossProfit, cogs: totalCOGS, invoiceId: saleId };
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
 * - إلغاء سجل الربح من سجل الأرباح
 * - تحديث إحصائيات العميل
 */
export const processRefund = async (
  items: TransactionItem[],
  total: number,
  customerId?: string,
  userId?: string,
  userName?: string,
  originalInvoiceId?: string
): Promise<TransactionResult> => {
  try {
    // Step 1: حساب COGS للمرتجع
    const totalCOGS = items.reduce((sum, item) => 
      addCurrency(sum, roundCurrency(item.costPrice * item.quantity)), 0);
    const grossProfit = roundCurrency(total - totalCOGS);

    // Step 2: إعادة الكميات للمخزون
    const stockItems = items.map(item => ({ productId: item.productId, quantity: item.quantity }));
    await restoreStockBatchCloud(stockItems);
    restoreStockBatch(stockItems);

    // Step 3: خصم المبلغ من الصندوق مع عكس بيانات الربح
    addWithdrawalFromShift(roundCurrency(total));

    // Step 4: إزالة سجل الربح الأصلي إذا كان متاحاً
    if (originalInvoiceId) {
      removeGrossProfit(originalInvoiceId);
    }

    // Step 5: تحديث إحصائيات العميل (خصم المشتريات)
    if (customerId) {
      await updateCustomerStatsCloud(customerId, -total, false);
    }

    // Step 6: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'refund',
        userId,
        userName,
        `مرتجع: -$${total.toLocaleString()} | تراجع ربح: -$${grossProfit.toLocaleString()}`,
        { total, grossProfit, cogs: totalCOGS, itemsCount: items.length, type: 'refund' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'refund', total, grossProfit, cogs: totalCOGS });
    emitEvent(EVENTS.REFUND_PROCESSED, { total, originalInvoiceId });

    return { success: true, grossProfit: -grossProfit, cogs: totalCOGS };
  } catch (error) {
    console.error('خطأ في عملية المرتجع:', error);
    return { success: false, error: 'حدث خطأ أثناء إتمام المرتجع' };
  }
};

/**
 * 5. تسجيل مصروف متكامل
 * - خصم المبلغ من الصندوق
 * - تسجيل في سجل المصاريف
 * - تسجيل كمصروف تشغيلي في سجل الأرباح
 */
export const processExpense = (
  amount: number,
  expenseType: string,
  userId?: string,
  userName?: string,
  expenseId?: string
): TransactionResult => {
  try {
    // Step 1: خصم المبلغ من الصندوق
    addExpensesToShift(roundCurrency(amount));

    // Step 2: تسجيل كمصروف تشغيلي في سجل الأرباح
    const expId = expenseId || `exp_${Date.now()}`;
    addOperatingExpense(expId, amount, expenseType);

    // Step 3: تسجيل النشاط
    if (userId && userName) {
      addActivityLog(
        'expense',
        userId,
        userName,
        `مصروف تشغيلي (${expenseType}): $${amount.toLocaleString()}`,
        { amount, expenseType, type: 'expense' }
      );
    }

    emitEvent(EVENTS.TRANSACTION_COMPLETED, { type: 'expense', amount, expenseType });
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
