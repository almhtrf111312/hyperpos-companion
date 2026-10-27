import type { Invoice } from '@/lib/cloud/invoices-cloud';

export interface InvoiceProfitMetrics {
  netRevenueUsd: number;
  totalCostUsd: number;
  netProfitUsd: number;
  profitMarginPercent: number;
  collectionRatio: number;
  collectedProfitUsd: number;
  pendingProfitUsd: number;
}

export function calculateInvoiceProfitMetrics(
  invoice: Invoice,
  netProfitUsd: number,
): InvoiceProfitMetrics {
  const profit = Number.isFinite(netProfitUsd) ? netProfitUsd : 0;
  const invoiceTotalUsd = Number(invoice.total) || 0;
  const fallbackRevenueUsd = Math.max(0, (Number(invoice.subtotal) || 0) - (Number(invoice.discount) || 0));
  const billedRevenueUsd = invoiceTotalUsd > 0
    ? Math.max(0, invoiceTotalUsd - (Number(invoice.taxAmount) || 0))
    : fallbackRevenueUsd;
  const activeItems = (invoice.items || []).filter(item => !item.refunded && item.quantity > 0);
  const hasCompleteItemCosts = activeItems.length > 0 &&
    activeItems.every(item => Number.isFinite(item.costPrice));
  const itemCostsUsd = activeItems.reduce(
    (sum, item) => sum + (Number(item.costPrice) || 0) * item.quantity,
    0,
  );
  const totalCostUsd = invoice.type === 'maintenance'
    ? Number(invoice.partsCost) || Math.max(0, billedRevenueUsd - profit)
    : hasCompleteItemCosts
      ? itemCostsUsd
      : Math.max(0, billedRevenueUsd - profit);
  const netRevenueUsd = invoice.type === 'maintenance' && Number(invoice.partsCost) > 0
    ? Number(invoice.partsCost) + profit
    : hasCompleteItemCosts
      ? totalCostUsd + profit
      : billedRevenueUsd;
  const profitMarginPercent = netRevenueUsd > 0 ? (profit / netRevenueUsd) * 100 : 0;
  const paidUsd = Math.max(0, Number(invoice.debtPaid) || 0);
  const collectionRatio = invoice.paymentType === 'cash' || invoice.status === 'paid'
    ? 1
    : invoiceTotalUsd > 0
      ? Math.min(1, Math.max(0, paidUsd / invoiceTotalUsd))
      : 0;
  const collectedProfitUsd = profit * collectionRatio;

  return {
    netRevenueUsd,
    totalCostUsd,
    netProfitUsd: profit,
    profitMarginPercent,
    collectionRatio,
    collectedProfitUsd,
    pendingProfitUsd: profit - collectedProfitUsd,
  };
}
