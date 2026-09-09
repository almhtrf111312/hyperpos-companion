/**
 * Customer Stats - Single Source of Truth
 * =======================================
 * كل أرقام العميل (عدد الفواتير، المشتريات، الديون) تُحسب من الفواتير النشطة فقط.
 * الفواتير المستردة أو الملغاة لا تُحتسب إطلاقاً.
 */

import { loadInvoicesCloud, Invoice } from './invoices-cloud';

export interface CustomerStats {
  invoiceCount: number;
  totalPurchases: number;
  totalDebt: number;
}

export const EMPTY_CUSTOMER_STATS: CustomerStats = {
  invoiceCount: 0,
  totalPurchases: 0,
  totalDebt: 0,
};

const INACTIVE_STATUSES = new Set(['refunded', 'cancelled']);

export const isActiveInvoice = (invoice: Invoice): boolean =>
  !INACTIVE_STATUSES.has(String(invoice.status));

/** الرصيد المتبقي على فاتورة بيع مؤجل (0 للنقدي أو المسدّد) */
export const remainingDebtOf = (invoice: Invoice): number => {
  if (invoice.paymentType !== 'debt') return 0;
  if (invoice.status === 'paid') return 0;
  const remaining = Number(invoice.debtRemaining) || 0;
  return remaining > 0 ? remaining : Number(invoice.total) || 0;
};

export const normalizeCustomerKey = (name?: string | null): string =>
  (name || '').trim().toLowerCase();

const accumulate = (map: Map<string, CustomerStats>, key: string, invoice: Invoice) => {
  if (!key) return;
  const current = map.get(key) || { ...EMPTY_CUSTOMER_STATS };
  current.invoiceCount += 1;
  current.totalPurchases = Math.round((current.totalPurchases + (Number(invoice.total) || 0)) * 100) / 100;
  current.totalDebt = Math.round((current.totalDebt + remainingDebtOf(invoice)) * 100) / 100;
  map.set(key, current);
};

/**
 * يبني خريطة إحصاءات مفهرسة بمعرّف العميل وباسمه المُطبَّع معاً،
 * حتى تعمل المطابقة مع الفواتير القديمة غير المربوطة بمعرّف.
 */
export function buildCustomersStatsMap(invoices: Invoice[]): Map<string, CustomerStats> {
  const byId = new Map<string, CustomerStats>();
  const byName = new Map<string, CustomerStats>();

  for (const invoice of invoices) {
    if (!isActiveInvoice(invoice)) continue;
    if (invoice.customerId) accumulate(byId, invoice.customerId, invoice);
    accumulate(byName, normalizeCustomerKey(invoice.customerName), invoice);
  }

  // الاسم لا يُدمج مع المعرّف لتفادي العدّ المزدوج — المعرّف له الأولوية عند القراءة
  const merged = new Map<string, CustomerStats>();
  byName.forEach((value, key) => merged.set(`name:${key}`, value));
  byId.forEach((value, key) => merged.set(`id:${key}`, value));
  return merged;
}

export function getCustomerStatsFrom(
  map: Map<string, CustomerStats>,
  customer: { id?: string | null; name?: string | null }
): CustomerStats {
  if (customer.id) {
    const byId = map.get(`id:${customer.id}`);
    if (byId) return byId;
  }
  return map.get(`name:${normalizeCustomerKey(customer.name)}`) || { ...EMPTY_CUSTOMER_STATS };
}

/** فواتير عميل واحد النشطة — مطابقة بالمعرّف مع رجوع للاسم */
export function filterCustomerInvoices(
  invoices: Invoice[],
  customer: { id?: string | null; name?: string | null }
): Invoice[] {
  const nameKey = normalizeCustomerKey(customer.name);
  return invoices.filter(inv => {
    if (!isActiveInvoice(inv)) return false;
    if (customer.id && inv.customerId) return inv.customerId === customer.id;
    return normalizeCustomerKey(inv.customerName) === nameKey;
  });
}

/** يحمّل الفواتير ويبني الخريطة (يستفيد من كاش الفواتير) */
export async function loadCustomersStatsMap(): Promise<Map<string, CustomerStats>> {
  const invoices = await loadInvoicesCloud();
  return buildCustomersStatsMap(invoices);
}
