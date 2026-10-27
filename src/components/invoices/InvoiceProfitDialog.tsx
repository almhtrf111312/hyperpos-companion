import { AlertCircle, CheckCircle2, Package, Percent, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';
import { fromUsd, getCurrencyDef, roundForCurrency } from '@/lib/money-engine';
import { calculateInvoiceProfitMetrics } from '@/lib/invoice-profit';
import type { Invoice } from '@/lib/cloud/invoices-cloud';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InvoiceProfitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  financials: {
    rate: number;
    symbol: string;
    code: string;
    baseProfit: number;
  };
}

const COPY = {
  ar: {
    title: 'تحليل أرباح الفاتورة',
    description: 'بيانات مالية سرية للمالك والمدير فقط',
    netProfit: 'صافي الربح',
    margin: 'هامش الربح',
    netRevenue: 'صافي المبيعات قبل الضريبة',
    cogs: 'تكلفة البضاعة / القطع',
    usd: 'المبلغ بالدولار الأمريكي',
    debt: 'تحصيل ربح الفاتورة الآجلة',
    collection: 'نسبة التحصيل',
    collected: 'الربح المحصل',
    pending: 'الربح المعلق',
    items: 'تفصيل ربح البنود',
    quantity: 'الكمية',
    price: 'السعر',
    cost: 'التكلفة',
  },
  en: {
    title: 'Invoice Profit Analysis',
    description: 'Confidential financial details for the owner and admin only',
    netProfit: 'Net profit',
    margin: 'Profit margin',
    netRevenue: 'Net sales before tax',
    cogs: 'Goods / parts cost',
    usd: 'Amount in US dollars',
    debt: 'Deferred invoice profit collection',
    collection: 'Collected',
    collected: 'Profit collected',
    pending: 'Profit pending',
    items: 'Profit by item',
    quantity: 'Qty',
    price: 'Price',
    cost: 'Cost',
  },
  tr: {
    title: 'Fatura Kâr Analizi',
    description: 'Yalnızca mağaza sahibi ve yönetici için gizli finansal bilgiler',
    netProfit: 'Net kâr',
    margin: 'Kâr marjı',
    netRevenue: 'Vergi öncesi net satış',
    cogs: 'Ürün / parça maliyeti',
    usd: 'ABD doları tutarı',
    debt: 'Vadeli fatura kâr tahsilatı',
    collection: 'Tahsilat',
    collected: 'Tahsil edilen kâr',
    pending: 'Bekleyen kâr',
    items: 'Ürün bazında kâr',
    quantity: 'Adet',
    price: 'Fiyat',
    cost: 'Maliyet',
  },
} as const;

export function InvoiceProfitDialog({
  open,
  onOpenChange,
  invoice,
  financials,
}: InvoiceProfitDialogProps) {
  const { language } = useLanguage();
  const { isBoss, isAdmin } = useUserRole();
  const copy = COPY[language === 'en' || language === 'tr' ? language : 'ar'];

  if (!invoice || (!isBoss && !isAdmin)) return null;

  const code = financials.code || invoice.currency || 'USD';
  const rate = Number.isFinite(financials.rate) && financials.rate > 0 ? financials.rate : 1;
  const currency = getCurrencyDef(code);
  const decimals = currency.decimals;
  const toDisplay = (amountUsd: number) =>
    roundForCurrency(fromUsd(amountUsd, code, rate), code, decimals);
  const formatUsd = (amountUsd: number) => formatCurrency(
    toDisplay(amountUsd),
    financials.symbol,
    decimals,
    code,
    currency.name
  );

  const netProfitUsd = Number.isFinite(financials.baseProfit)
    ? financials.baseProfit
    : Number(invoice.profit) || 0;
  const metrics = calculateInvoiceProfitMetrics(invoice, netProfitUsd);
  const activeItems = (invoice.items || []).filter(item => !item.refunded && item.quantity > 0);
  const hasCompleteItemCosts = activeItems.length > 0 &&
    activeItems.every(item => Number.isFinite(item.costPrice));

  return (
    <Dialog open={open && (isBoss || isAdmin)} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 bg-muted/30 p-4 pe-12">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary" aria-hidden="true">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">{copy.title} #{invoice.id}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">{copy.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto p-4">
          <section className="grid grid-cols-2 gap-2.5" aria-label={copy.title}>
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
              <div>
                <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-300">{copy.netProfit}</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                  {formatUsd(netProfitUsd)}
                </span>
                {code !== 'USD' && (
                  <span className="block font-mono text-[11px] text-muted-foreground" dir="ltr">
                    ≈ ${netProfitUsd.toFixed(2)} USD
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                <Percent className="h-3 w-3" aria-hidden="true" />
                {metrics.profitMarginPercent.toFixed(1)}% {copy.margin}
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-background p-3">
              <span className="mb-1 block text-xs text-muted-foreground">{copy.netRevenue}</span>
              <span className="text-sm font-bold text-foreground">{formatUsd(metrics.netRevenueUsd)}</span>
            </div>
            <div className="rounded-xl border border-border/60 bg-background p-3">
              <span className="mb-1 block text-xs text-muted-foreground">{copy.cogs}</span>
              <span className="text-sm font-bold text-foreground">{formatUsd(metrics.totalCostUsd)}</span>
            </div>
          </section>

          {invoice.paymentType === 'debt' && (
            <section className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3" aria-label={copy.debt}>
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                  {metrics.collectionRatio >= 1
                    ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
                  {copy.debt}
                </span>
                <span>{copy.collection}: {Math.round(metrics.collectionRatio * 100)}%</span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={copy.collection}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(metrics.collectionRatio * 100)}
              >
                <div
                  className="h-full rounded-full bg-amber-500 transition-[width] duration-200"
                  style={{ width: `${metrics.collectionRatio * 100}%` }}
                />
              </div>
              <div className="flex flex-col justify-between gap-1 pt-1 text-[11px] text-muted-foreground sm:flex-row">
                <span>{copy.collected}: <strong className="text-foreground">{formatUsd(metrics.collectedProfitUsd)}</strong></span>
                <span>{copy.pending}: <strong className="text-foreground">{formatUsd(metrics.pendingProfitUsd)}</strong></span>
              </div>
            </section>
          )}

          {hasCompleteItemCosts && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {copy.items}
              </h3>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
                {activeItems.map((item, index) => {
                  const quantity = Number(item.quantity) || 0;
                  const unitPriceUsd = Number(item.price) || 0;
                  const unitCostUsd = Number(item.costPrice) || 0;
                  const itemProfitUsd = typeof item.profit === 'number' && Number.isFinite(item.profit)
                    ? item.profit
                    : (unitPriceUsd - unitCostUsd) * quantity;

                  return (
                    <div key={`${item.id}-${index}`} className="flex items-center justify-between gap-3 bg-background/50 p-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-foreground">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {copy.quantity}: {quantity} × {copy.price}: {formatUsd(unitPriceUsd)} · {copy.cost}: {formatUsd(unitCostUsd)}
                        </div>
                      </div>
                      <div className="shrink-0 text-left font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {formatUsd(itemProfitUsd)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {code !== 'USD' && (
            <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span>{copy.usd}:</span>
              <span className="text-end font-mono font-bold text-foreground" dir="ltr">
                ${netProfitUsd.toFixed(2)} USD <span className="font-normal text-muted-foreground">({rate} {financials.symbol} / $)</span>
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
