import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Truck, Calendar, DollarSign, Loader2, ShoppingBag, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
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
      {/* Header */}
      <div className="flex-shrink-0 p-3 pt-6 md:p-6 pb-2 md:pb-3 rtl:pr-14 ltr:pl-14 md:rtl:pr-6 md:ltr:pl-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('purchases.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">{t('purchases.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowQuickDialog(true)}
              className="flex-1 sm:flex-initial h-9 md:h-10 px-2 sm:px-4 text-xs sm:text-sm font-medium whitespace-nowrap shadow-sm min-w-0"
            >
              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 rtl:ml-1.5 ltr:mr-1.5 shrink-0" />
              <span className="truncate">{t('purchases.quickAdd')}</span>
            </Button>
            <Button
              className="flex-1 sm:flex-initial h-9 md:h-10 px-2 sm:px-4 text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90 whitespace-nowrap shadow-sm min-w-0"
              onClick={() => setShowDialog(true)}
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 rtl:ml-1.5 ltr:mr-1.5 shrink-0" />
              <span className="truncate">{t('purchases.addNew')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 px-3 md:px-6 pb-2 md:pb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg border border-border p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">{t('purchases.totalInvoices')}</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-foreground">{invoices.length}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">{t('purchases.totalAmount')}</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-foreground">${formatNumber(totalPurchases, 2)}</p>
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
            <p className="text-sm text-muted-foreground mb-4">{t('purchases.noInvoicesDesc')}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-xs mx-auto">
              <Button variant="outline" className="flex-1 min-w-[130px] text-xs sm:text-sm" onClick={() => setShowQuickDialog(true)}>
                <ShoppingBag className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
                {t('purchases.quickAdd')}
              </Button>
              <Button className="flex-1 min-w-[130px] bg-primary hover:bg-primary/90 text-xs sm:text-sm" onClick={() => setShowDialog(true)}>
                <Plus className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
                {t('purchases.addNew')}
              </Button>
            </div>
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
                      ${formatNumber(invoice.actual_grand_total || invoice.expected_grand_total, 2)}
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
