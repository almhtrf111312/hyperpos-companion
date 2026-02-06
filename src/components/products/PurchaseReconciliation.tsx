import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import {
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Package,
  Hash,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import { PurchaseInvoice, PurchaseInvoiceItem } from '@/lib/cloud/purchase-invoices-cloud';
import { cn } from '@/lib/utils';

interface PurchaseReconciliationProps {
  invoice: PurchaseInvoice;
  items: PurchaseInvoiceItem[];
  onBack: () => void;
  onFinalize: () => void;
  loading: boolean;
}

export function PurchaseReconciliation({
  invoice,
  items,
  onBack,
  onFinalize,
  loading
}: PurchaseReconciliationProps) {
  const { t } = useLanguage();

  const itemsMatch = invoice.actual_items_count === invoice.expected_items_count;
  const quantityMatch = invoice.actual_total_quantity === invoice.expected_total_quantity;
  const totalMatch = Math.abs(invoice.actual_grand_total - invoice.expected_grand_total) < 0.01;
  const allMatch = itemsMatch && quantityMatch && totalMatch;

  const itemsDiff = invoice.actual_items_count - invoice.expected_items_count;
  const quantityDiff = invoice.actual_total_quantity - invoice.expected_total_quantity;
  const totalDiff = invoice.actual_grand_total - invoice.expected_grand_total;

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={cn(
        "p-3 rounded-lg flex items-center gap-2",
        allMatch ? "bg-success/20 border border-success/30" : "bg-warning/20 border border-warning/30"
      )}>
        {allMatch ? (
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
        )}
        <div>
          <h3 className="font-medium text-sm">
            {allMatch ? t('purchaseInvoice.reconciled') : t('purchaseInvoice.discrepancyFound')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {allMatch
              ? t('purchaseInvoice.reconciledDesc')
              : t('purchaseInvoice.discrepancyDesc')}
          </p>
        </div>
      </div>

      {/* Mobile-Friendly Comparison Cards */}
      <div className="space-y-2">
        {/* Items Count */}
        <div className="grid grid-cols-4 gap-2 items-center p-2 bg-muted/50 rounded-lg text-xs">
          <div className="flex items-center gap-1 font-medium">
            <Package className="w-3 h-3" />
            المنتجات
          </div>
          <div className="text-center">{invoice.expected_items_count}</div>
          <div className="text-center">{invoice.actual_items_count}</div>
          <div className={cn(
            "text-center font-medium",
            itemsDiff === 0 ? "" : itemsDiff > 0 ? "text-success" : "text-destructive"
          )}>
            {itemsMatch ? <Check className="w-4 h-4 mx-auto text-success" /> :
              <span>{itemsDiff > 0 ? `+${itemsDiff}` : itemsDiff}</span>}
          </div>
        </div>

        {/* Total Quantity */}
        <div className="grid grid-cols-4 gap-2 items-center p-2 bg-muted/50 rounded-lg text-xs">
          <div className="flex items-center gap-1 font-medium">
            <Hash className="w-3 h-3" />
            الكميات
          </div>
          <div className="text-center">{invoice.expected_total_quantity}</div>
          <div className="text-center">{invoice.actual_total_quantity}</div>
          <div className={cn(
            "text-center font-medium",
            quantityDiff === 0 ? "" : quantityDiff > 0 ? "text-success" : "text-destructive"
          )}>
            {quantityMatch ? <Check className="w-4 h-4 mx-auto text-success" /> :
              <span>{quantityDiff > 0 ? `+${quantityDiff}` : quantityDiff}</span>}
          </div>
        </div>

        {/* Grand Total */}
        <div className="grid grid-cols-4 gap-2 items-center p-2 bg-primary/10 rounded-lg text-xs font-medium">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            الإجمالي
          </div>
          <div className="text-center">${invoice.expected_grand_total.toFixed(2)}</div>
          <div className="text-center">${invoice.actual_grand_total.toFixed(2)}</div>
          <div className={cn(
            "text-center",
            Math.abs(totalDiff) < 0.01 ? "" : totalDiff > 0 ? "text-success" : "text-destructive"
          )}>
            {totalMatch ? <Check className="w-4 h-4 mx-auto text-success" /> :
              <span>{totalDiff > 0 ? `+$${totalDiff.toFixed(2)}` : `-$${Math.abs(totalDiff).toFixed(2)}`}</span>}
          </div>
        </div>

        {/* Header Labels */}
        <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground text-center">
          <div></div>
          <div>المتوقع</div>
          <div>الفعلي</div>
          <div>الحالة</div>
        </div>
      </div>

      {/* Items Summary */}
      <div className="border rounded-lg p-3">
        <h3 className="font-medium text-sm mb-2">{t('purchaseInvoice.itemsSummary')}</h3>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between text-xs py-1">
              <span className="flex items-center gap-1 truncate flex-1">
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="truncate">{item.product_name}</span>
              </span>
              <span className="text-muted-foreground text-right flex-shrink-0 mr-2">
                {item.quantity}×${item.cost_price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions - Fixed at Bottom */}
      <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-2">
        <Button variant="outline" size="sm" onClick={onBack} disabled={loading} className="flex-1 h-10">
          <ArrowRight className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <Button
          size="sm"
          onClick={onFinalize}
          disabled={loading}
          className={cn("flex-1 h-10", allMatch ? "bg-success hover:bg-success/90" : "")}
        >
          {loading ? t('common.loading') : t('purchaseInvoice.finalizeInvoice')}
          <Check className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );
}