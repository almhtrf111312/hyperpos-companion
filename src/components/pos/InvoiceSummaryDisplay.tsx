// Invoice Summary Display - Shows currency details and debt information clearly
import { useLanguage } from '@/hooks/use-language';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface InvoiceSummaryProps {
  subtotal: number;
  discount: number;
  discountAmount: number;
  discountType?: 'amount' | 'percent';
  total: number;
  totalInCurrency: number;
  exchangeRate: number;
  currencySymbol: string;
  currencyCode: string;
  paidAmount?: number;
  remainingDebt?: number;
  paymentType: 'cash' | 'debt';
  profit?: number;
  showProfit?: boolean;
  usdSymbol?: string;
}

export function InvoiceSummaryDisplay({
  subtotal,
  discount,
  discountAmount,
  discountType = 'amount',
  total,
  totalInCurrency,
  exchangeRate,
  currencySymbol,
  currencyCode,
  paidAmount = 0,
  remainingDebt = 0,
  paymentType,
  profit = 0,
  showProfit = false,
  usdSymbol = '$',
}: InvoiceSummaryProps) {
  const { t } = useLanguage();

  const isDebt = paymentType === 'debt' && remainingDebt > 0;
  const paidInUSD = paidAmount / exchangeRate;

  return (
    <div className="p-4 bg-muted/30 rounded-lg space-y-3 text-sm tabular-nums">
      {/* Subtotal */}
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('pos.subtotal')}</span>
        <span>{usdSymbol}{formatNumber(subtotal)}</span>
      </div>

      {/* Discount */}
      {discountAmount > 0 && (
        <div className="flex justify-between text-success">
          <span>{t('invoices.discount') || 'الخصم'}</span>
          <span>
            -{usdSymbol}{formatNumber(discountAmount)}
            {discountType === 'percent' && discount > 0 && (
              <span className="text-xs text-muted-foreground mr-1">({discount}%)</span>
            )}
          </span>
        </div>
      )}

      {/* Paid cash & remaining debt */}
      {isDebt && (
        <>
          <div className="flex justify-between text-success">
            <span>{t('invoices.paidCash') || t('debts.paidAmount') || 'المدفوع نقداً'}</span>
            <span>
              {currencySymbol}{formatNumber(paidAmount)}
              {currencyCode !== 'USD' && (
                <span className="text-xs text-muted-foreground mr-1">
                  ({usdSymbol}{paidInUSD.toFixed(2)})
                </span>
              )}
            </span>
          </div>

          <div className="flex justify-between text-destructive font-bold">
            <span>{t('invoices.debtRemaining') || 'المتبقي (دين)'}</span>
            <span>{usdSymbol}{formatNumber(remainingDebt)}</span>
          </div>
        </>
      )}

      {/* Profit (for admin/boss only) */}
      {showProfit && profit > 0 && (
        <>
          <hr className="border-border" />
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>{t('invoices.netProfit') || 'صافي الربح'}</span>
            <span>{usdSymbol}{formatNumber(profit)}</span>
          </div>
        </>
      )}
    </div>
  );
}
