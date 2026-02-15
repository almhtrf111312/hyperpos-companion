import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Truck, Calendar, User, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { formatNumber } from '@/lib/utils';
import { loadPurchaseInvoicesCloud, PurchaseInvoice } from '@/lib/cloud/purchase-invoices-cloud';
import { PurchaseInvoiceDialog } from '@/components/products/PurchaseInvoiceDialog';
import { EVENTS } from '@/lib/events';
import { format } from 'date-fns';
import { ar, enUS, tr } from 'date-fns/locale';

export default function Purchases() {
  const { t, language } = useLanguage();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

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
    window.addEventListener('focus', loadData);
    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handler);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

  const totalPurchases = invoices.reduce((sum, inv) => sum + (inv.expected_grand_total || 0), 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-3 pt-6 md:p-6 pb-2 md:pb-3 rtl:pr-14 ltr:pl-14 md:rtl:pr-6 md:ltr:pl-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('purchases.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">{t('purchases.subtitle')}</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('purchases.addNew')}
          </Button>
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
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />
              {t('purchases.addNew')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{invoice.supplier_name}</h3>
                    {invoice.supplier_company && (
                      <p className="text-xs text-muted-foreground">{invoice.supplier_company}</p>
                    )}
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
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
                    <span className="font-semibold text-foreground">${formatNumber(invoice.expected_grand_total, 2)}</span>
                  </div>
                  <span className="text-xs">
                    {invoice.expected_items_count} {t('purchases.items')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Invoice Dialog */}
      <PurchaseInvoiceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSuccess={loadData}
      />
    </div>
  );
}
