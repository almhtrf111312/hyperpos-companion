import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Truck, Calendar, DollarSign, Loader2, ShoppingBag, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { useMoney } from '@/hooks/use-money';
import { formatNumber } from '@/lib/utils';
import { loadPurchaseInvoicesCloud, PurchaseInvoice } from '@/lib/cloud/purchase-invoices-cloud';
import { PurchaseInvoiceDialog } from '@/components/products/PurchaseInvoiceDialog';
import { QuickPurchaseDialog } from '@/components/products/QuickPurchaseDialog';
import { PurchaseInvoiceViewDialog } from '@/components/purchases/PurchaseInvoiceViewDialog';
import { EVENTS } from '@/lib/events';
import { format } from 'date-fns';
import { ar, enUS, tr } from 'date-fns/locale';

export default function Purchases() {
  const { t, language } = useLanguage();
  const m = useMoney();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showQuickDialog, setShowQuickDialog] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const dateLocale = language === 'ar' ? ar : language === 'tr' ? tr : enUS;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadPurchaseInvoicesCloud();
      setInvoices(data);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handler);
    window.addEventListener(EVENTS.PURCHASES_UPDATED, handler);
    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handler);
      window.removeEventListener(EVENTS.PURCHASES_UPDATED, handler);
    };
  }, [loadData]);

  const totalPurchases = invoices.reduce((sum, inv) => sum + (inv.actual_grand_total || inv.expected_grand_total || 0), 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Lifted Actions Bar with Smart Mobile Clearance */}
      <div className="flex-shrink-0 p-2.5 sm:p-3 md:p-6 md:pt-4 pb-2 md:pb-3">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
          <Button
            className="min-w-0 h-11 px-2.5 sm:px-5 text-xs sm:text-sm font-bold whitespace-normal leading-tight text-center flex items-center justify-center gap-1.5 bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground shadow-sm rounded-xl transition-all duration-200 cursor-pointer"
            onClick={() => setShowDialog(true)}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{t('purchases.addNew')}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowQuickDialog(true)}
            className="min-w-0 h-11 px-2.5 sm:px-5 text-xs sm:text-sm font-semibold whitespace-normal leading-tight text-center flex items-center justify-center gap-1.5 border-border/80 bg-card hover:bg-muted shadow-2xs rounded-xl transition-all duration-200 text-foreground cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 shrink-0 text-primary" />
            <span>{t('purchases.quickAdd')}</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 px-2.5 sm:px-3 md:px-6 pb-2 md:pb-3">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="bg-card rounded-xl border border-border p-2.5 sm:p-3 flex items-center justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{t('purchases.totalInvoices')}</span>
              </div>
              <p className="text-base sm:text-xl font-black text-foreground">{invoices.length}</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-2.5 sm:p-3 flex items-center justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{t('purchases.totalAmount')}</span>
              </div>
              <p className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{m.fmt(totalPurchases)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">{t('purchases.noInvoices')}</h3>
            <p className="text-sm text-muted-foreground">{t('purchases.noInvoicesDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => {
                  setSelectedInvoiceId(invoice.id);
                  setShowViewDialog(true);
                }}
                className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {invoice.supplier_name}
                      </h3>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        عرض التفاصيل
                      </span>
                    </div>
                    {invoice.supplier_company && (
                      <p className="text-xs text-muted-foreground">{invoice.supplier_company}</p>
                    )}
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground font-mono">
                    #{invoice.invoice_number}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: dateLocale })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="font-semibold text-foreground">
                      {m.fmtDoc(invoice.actual_grand_total || invoice.expected_grand_total, invoice as any)}
                    </span>
                  </div>
                  <span className="text-xs">
                    {invoice.actual_items_count || invoice.expected_items_count} {t('purchases.items')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <PurchaseInvoiceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSuccess={loadData}
      />
      <QuickPurchaseDialog
        open={showQuickDialog}
        onOpenChange={setShowQuickDialog}
        onSuccess={loadData}
      />
      <PurchaseInvoiceViewDialog
        invoiceId={selectedInvoiceId}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onDeleted={loadData}
      />
    </div>
  );
}
