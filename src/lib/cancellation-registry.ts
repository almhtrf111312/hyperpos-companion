/**
 * Cancellation Registry - FlowPOS Pro
 * =====================================
 * سجل الإلغاء والتعويض الدائم للعمليات غير المكتملة أو غير المزامنة.
 * 
 * القواعد المحاسبية والأمان:
 * 1. ربط الفاتورة وعملية الطابور ومعرف العملية (operationId) بعلامة إلغاء دائمة.
 * 2. منع إعادة رفع أو إنشاء أي فاتورة ملغاة عند عودة الإنترنت أو إعادة المحاولة.
 * 3. تتبع عكس الآثار المحلية لضمان تنفيذ كل أثر مرة واحدة فقط (Idempotent).
 * 4. مطابقة السحابة عند توفر الاتصال:
 *    - إذا لم توجد فاتورة في السحابة -> تثبيت الإلغاء 'cancelled'.
 *    - إذا كانت الفاتورة موجودة في السحابة -> استدعاء مسار الاسترداد المعتمد 'refunded'.
 *    - في حالة عدم توفر الاتصال -> تظل الحالة 'local_cancelled_pending_cloud'.
 */

import { emitEvent, EVENTS } from './events';
import { isGuestDemoMode } from './demo-data';
import { supabase } from '@/integrations/supabase/client';

const CANCELLATION_REGISTRY_KEY = 'hp_cancellation_registry_v1';

export type CancelledOpStatus = 
  | 'local_cancelled_pending_cloud' // إلغاء محلي بانتظار مطابقة السحابة
  | 'cancelled'                     // ملغاة نهائياً (لم تصل للسحابة)
  | 'refunded'                      // استرداد مكتمل (وجدت بالسحابة واستُردت رسمياً)
  | 'needs_attention';              // فشل التعويض ويحتاج معالجة

export interface CancelledOperationRecord {
  operationId: string;
  operationQueueId?: string;
  invoiceNumber?: string;
  type: string;
  status: CancelledOpStatus;
  cancelledAt: string;
  updatedAt: string;
  reason?: string;
  error?: string;
  reversedEffects: {
    stock: boolean;
    shift: boolean;
    profit: boolean;
    debt: boolean;
    invoice: boolean;
  };
  bundleSummary?: {
    total?: number;
    currency?: string;
    customerName?: string;
    downPayment?: number;
    itemsCount?: number;
  };
}

/**
 * تحميل سجل الإلغاء من التخزين المحلي
 */
export const loadCancellationRegistry = (): Record<string, CancelledOperationRecord> => {
  try {
    const raw = localStorage.getItem(CANCELLATION_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.error('[CancellationRegistry] Error loading cancellation registry:', error);
    return {};
  }
};

/**
 * حفظ سجل الإلغاء في التخزين المحلي
 */
export const saveCancellationRegistry = (registry: Record<string, CancelledOperationRecord>): void => {
  try {
    localStorage.setItem(CANCELLATION_REGISTRY_KEY, JSON.stringify(registry));
  } catch (error) {
    console.error('[CancellationRegistry] Error saving cancellation registry:', error);
  }
};

/**
 * فحص ما إذا كانت العملية أو رقم الفاتورة مسجلاً كملغى
 */
export const isOperationCancelled = (operationIdOrInvoiceNumber: string): boolean => {
  if (!operationIdOrInvoiceNumber) return false;
  const key = String(operationIdOrInvoiceNumber).trim();
  if (!key) return false;

  const registry = loadCancellationRegistry();
  
  // فحص مباشر بالمعرف
  if (registry[key]) {
    const rec = registry[key];
    return rec.status !== 'needs_attention' || rec.reversedEffects.invoice;
  }

  // فحص عبر invoiceNumber أو operationId المقترن
  const found = Object.values(registry).find(
    rec => rec.operationId === key || rec.invoiceNumber === key || rec.operationQueueId === key
  );

  return Boolean(found && (found.status !== 'needs_attention' || found.reversedEffects.invoice));
};

/**
 * جلب سجل الإلغاء لمعرف أو رقم فاتورة
 */
export const getCancellationRecord = (
  operationIdOrInvoiceNumber: string
): CancelledOperationRecord | undefined => {
  if (!operationIdOrInvoiceNumber) return undefined;
  const key = String(operationIdOrInvoiceNumber).trim();
  const registry = loadCancellationRegistry();

  if (registry[key]) return registry[key];

  return Object.values(registry).find(
    rec => rec.operationId === key || rec.invoiceNumber === key || rec.operationQueueId === key
  );
};

/**
 * تسجيل أو تحديث عملية ملغاة في السجل الدائم
 */
export const recordCancellation = (record: CancelledOperationRecord): void => {
  const registry = loadCancellationRegistry();
  const key = record.operationId || record.invoiceNumber || record.operationQueueId || `cancel_${Date.now()}`;
  
  registry[key] = {
    ...registry[key],
    ...record,
    updatedAt: new Date().toISOString(),
  };

  saveCancellationRegistry(registry);
};

/**
 * تحديث حالة سجل إلغاء قائم
 */
export const updateCancellationRecord = (
  operationId: string,
  updates: Partial<CancelledOperationRecord>
): CancelledOperationRecord | null => {
  const registry = loadCancellationRegistry();
  const targetKey = Object.keys(registry).find(
    k => k === operationId || registry[k].operationId === operationId || registry[k].invoiceNumber === operationId
  );

  if (!targetKey || !registry[targetKey]) return null;

  registry[targetKey] = {
    ...registry[targetKey],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveCancellationRegistry(registry);
  return registry[targetKey];
};

/**
 * مطابقة العمليات الملغاة محلياً مع السحابة عند توفر الاتصال
 * - إذا لم توجد الفاتورة في السحابة: تأكيد الحالة 'cancelled'
 * - إذا كانت موجودة: استدعاء دالة الاسترداد الرسمية 'refundInvoiceCloud' وتحديث الحالة إلى 'refunded'
 */
export const reconcileCancelledOperationsWithCloud = async (): Promise<{
  checked: number;
  refunded: number;
  confirmedCancelled: number;
  failed: number;
}> => {
  if (isGuestDemoMode()) {
    return { checked: 0, refunded: 0, confirmedCancelled: 0, failed: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { checked: 0, refunded: 0, confirmedCancelled: 0, failed: 0 };
  }

  const registry = loadCancellationRegistry();
  const pendingCloudRecords = Object.values(registry).filter(
    rec => rec.status === 'local_cancelled_pending_cloud'
  );

  if (pendingCloudRecords.length === 0) {
    return { checked: 0, refunded: 0, confirmedCancelled: 0, failed: 0 };
  }

  console.log(`[CancellationRegistry] Reconciling ${pendingCloudRecords.length} cancelled operations with cloud...`);

  let refunded = 0;
  let confirmedCancelled = 0;
  let failed = 0;

  for (const record of pendingCloudRecords) {
    try {
      const invNum = record.invoiceNumber;
      const opId = record.operationId;

      // استعلام قراءة فقط آمن للبحث عن الفاتورة في السحابة
      let query = supabase.from('invoices').select('id, invoice_number, status, total');

      if (invNum && opId && invNum !== opId) {
        query = query.or(`invoice_number.eq.${invNum},id.eq.${opId}`);
      } else if (invNum) {
        query = query.eq('invoice_number', invNum);
      } else if (opId) {
        query = query.eq('id', opId);
      } else {
        continue;
      }

      const { data: cloudInvoices, error } = await query.limit(1);

      if (error) {
        console.warn('[CancellationRegistry] Cloud check error for op:', opId, error);
        failed++;
        continue;
      }

      const cloudInvoice = cloudInvoices && cloudInvoices.length > 0 ? cloudInvoices[0] : null;

      if (!cloudInvoice) {
        // الفاتورة لم تصل السحابة أبداً -> تأكيد الإلغاء المحلي النهائي
        updateCancellationRecord(record.operationId, {
          status: 'cancelled',
          reason: 'تم التحقق من السحابة: الفاتورة لم تُنشأ هناك وتم تثبيت الإلغاء المحلي',
        });
        confirmedCancelled++;
        console.log(`[CancellationRegistry] Confirmed cancelled (not in cloud): ${record.operationId}`);
      } else {
        // الفاتورة وُجدت في السحابة!
        if (cloudInvoice.status === 'refunded') {
          // مستردة بالفعل في السحابة
          updateCancellationRecord(record.operationId, {
            status: 'refunded',
            reason: 'الفاتورة مستردة بالفعل في السحابة',
          });
          const { markInvoiceRefundedLocally } = await import('./cloud/invoices-cloud');
          markInvoiceRefundedLocally(cloudInvoice.invoice_number);
          refunded++;
        } else {
          // الفاتورة نشطة في السحابة -> استدعاء مسار الاسترداد الذري المعتمد
          const { refundInvoiceCloud, markInvoiceRefundedLocally } = await import('./cloud/invoices-cloud');
          const refundResult = await refundInvoiceCloud(cloudInvoice.invoice_number, 'offline-sync');
          const isSuccess = refundResult === true || (typeof refundResult === 'object' && refundResult.success);

          if (isSuccess) {
            updateCancellationRecord(record.operationId, {
              status: 'refunded',
              reason: 'تم استرداد الفاتورة السحابية بنجاح عبر المسار المعتمد',
            });
            markInvoiceRefundedLocally(cloudInvoice.invoice_number);
            refunded++;
            console.log(`[CancellationRegistry] Cloud refund completed for: ${cloudInvoice.invoice_number}`);
          } else {
            const errMsg = typeof refundResult === 'object' && refundResult.error ? refundResult.error : 'فشل الاسترداد السحابي';
            updateCancellationRecord(record.operationId, {
              status: 'needs_attention',
              error: errMsg,
            });
            failed++;
          }
        }
      }
    } catch (err) {
      console.error('[CancellationRegistry] Reconcile error for record:', record.operationId, err);
      failed++;
    }
  }

  emitEvent(EVENTS.INVOICES_UPDATED, null);
  emitEvent(EVENTS.SYNC_QUEUE_UPDATED, null);

  return { checked: pendingCloudRecords.length, refunded, confirmedCancelled, failed };
};
