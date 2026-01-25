// Invoice Summary Display - Shows currency details and debt information clearly
import { useLanguage } from '@/hooks/use-language';

interface InvoiceSummaryProps {
  subtotal: number;
  discount: number;
  discountAmount: number;
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
}

export function InvoiceSummaryDisplay({
  subtotal,
  discount,
  discountAmount,
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
}: InvoiceSummaryProps) {
  const { t } = useLanguage();
  
  const isDebt = paymentType === 'debt' && remainingDebt > 0;
  const paidInUSD = paidAmount / exchangeRate;

  return (
    <div className="p-4 bg-muted/30 rounded-lg space-y-3 text-sm">
      {/* Subtotal */}
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('pos.subtotal')}</span>
        <span>${subtotal.toLocaleString()}</span>
      </div>

      {/* Discount */}
      {discount > 0 && (
        <div className="flex justify-between text-success">
          <span>{t('pos.discount')} ({discount}%)</span>
          <span>-${discountAmount.toLocaleString()}</span>
        </div>
      )}

      {/* Separator */}
      <hr className="border-border" />

      {/* Total in USD */}
      <div className="flex justify-between font-bold text-base">
        <span>{t('pos.total')} (USD)</span>
        <span className="text-primary">${total.toLocaleString()}</span>
      </div>

      {/* Total in Local Currency (if not USD) */}
      {currencyCode !== 'USD' && exchangeRate !== 1 && (
        <div className="flex justify-between text-blue-600 dark:text-blue-400">
          <span>{t('pos.total')} ({currencyCode})</span>
          <span>{currencySymbol}{totalInCurrency.toLocaleString()}</span>
        </div>
      )}

      {/* Exchange Rate Info */}
      {currencyCode !== 'USD' && exchangeRate !== 1 && (
        <div className="text-xs text-muted-foreground text-center">
          سعر الصرف: 1 USD = {exchangeRate} {currencyCode}
        </div>
      )}

      {/* Debt Payment Details */}
      {isDebt && (
        <>
          <hr className="border-border" />
          
          {paidAmount > 0 && (
            <div className="flex justify-between text-success">
              <span>المبلغ المدفوع</span>
              <span>
                {currencySymbol}{paidAmount.toLocaleString()}
                {currencyCode !== 'USD' && (
                  <span className="text-xs text-muted-foreground mr-1">
                    (${paidInUSD.toFixed(2)})
                  </span>
                )}
              </span>
            </div>
          )}
          
          <div className="flex justify-between text-destructive font-bold">
            <span>المتبقي (دين)</span>
            <span>${remainingDebt.toLocaleString()}</span>
          </div>
        </>
      )}

      {/* Profit (for admin/boss only) */}
      {showProfit && profit > 0 && (
        <>
          <hr className="border-border" />
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>الربح المتوقع</span>
            <span>${profit.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
