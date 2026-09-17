import { useState, useEffect, useCallback } from 'react';
import { Archive, Bell, Package, CreditCard, FileX, Undo2, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { loadProductsCloud, updateProductCloud } from '@/lib/cloud/products-cloud';
import { loadDebtsCloud } from '@/lib/cloud/debts-cloud';
import { loadInvoicesCloud, Invoice } from '@/lib/cloud/invoices-cloud';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';
import { formatNumber } from '@/lib/utils';

type ArchiveTab = 'general' | 'notifications';
type GeneralSubTab = 'invoices' | 'debts' | 'products' | 'deleted';

export function ArchiveSection() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<ArchiveTab>('general');
  const [generalSubTab, setGeneralSubTab] = useState<GeneralSubTab>('invoices');
  
  const {
    archivedNotifications,
    restoreNotification,
    deleteArchivedNotification,
    clearAllArchived,
  } = useNotifications();

  const [paidDebts, setPaidDebts] = useState<any[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<any[]>([]);
  const [archivedInvoices, setArchivedInvoices] = useState<Invoice[]>([]);
  const [deletedLogs, setDeletedLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadGeneralArchive = useCallback(async () => {
    setIsLoading(true);
    try {
      const [debts, products, invoices] = await Promise.all([
        loadDebtsCloud().catch(() => []),
        loadProductsCloud().catch(() => []),
        loadInvoicesCloud().catch(() => []),
      ]);
      setPaidDebts((debts || []).filter(d => d.status === 'fully_paid'));
      setOutOfStockProducts((products || []).filter(p => p.quantity === 0));
      // Include refunded, partially refunded, and cancelled invoices
      setArchivedInvoices(invoices.filter(i => 
        i.status === 'refunded' || 
        i.status === 'cancelled' || 
        (i as any).status === 'partially_refunded' ||
        ((i as any).refundedAmount && (i as any).refundedAmount > 0)
      ));

      // Load deletion & refund activity logs
      try {
        const { loadActivityLogs } = await import('@/lib/activity-log');
        const logs = loadActivityLogs();
        const relevantLogs = logs.filter(l => 
          l.type === 'invoice_deleted' || 
          l.type === 'product_deleted' || 
          l.type === 'customer_deleted' || 
          l.type === 'debt_deleted' || 
          l.type === 'debt_writeoff' || 
          l.type === 'expense_deleted' ||
          l.type === 'invoice_refunded' ||
          l.type === 'refund'
        );
        setDeletedLogs(relevantLogs);
      } catch (err) {
        console.warn('Could not load deletion logs:', err);
      }
    } catch (error) {
      console.error('Error loading archive:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGeneralArchive();
  }, [loadGeneralArchive]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return t('archive.today') || 'اليوم';
    if (diffDays === 1) return t('archive.yesterday') || 'أمس';
    return (t('archive.daysAgo') || 'منذ {days} يوم').replace('{days}', String(diffDays));
  };

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Archive className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-base sm:text-lg font-bold text-foreground">{t('archive.title') || 'الأرشيف والسجلات'}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={loadGeneralArchive} disabled={isLoading} className="h-8 px-2.5 text-xs">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <Undo2 className="w-3.5 h-3.5 ml-1" />}
          تحديث
        </Button>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors",
            activeTab === 'general'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground bg-muted/40"
          )}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>{t('archive.general') || 'سجلات العمليات والمخزون'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-[10px]">
            {archivedInvoices.length + paidDebts.length + outOfStockProducts.length + deletedLogs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors",
            activeTab === 'notifications'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground bg-muted/40"
          )}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span>{t('archive.notifications') || 'الإشعارات'}</span>
          {archivedNotifications.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-[10px]">{archivedNotifications.length}</span>
          )}
        </button>
      </div>

      {/* General Archive Sub-tabs */}
      {activeTab === 'general' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'invoices' as GeneralSubTab, label: 'فواتير مستردة وملغاة', count: archivedInvoices.length, icon: FileX },
              { id: 'debts' as GeneralSubTab, label: t('archive.paidDebts') || 'ديون مسددة', count: paidDebts.length, icon: CreditCard },
              { id: 'products' as GeneralSubTab, label: t('archive.outOfStock') || 'أصناف نفذت', count: outOfStockProducts.length, icon: Package },
              { id: 'deleted' as GeneralSubTab, label: 'سجل الحذف والاسترداد', count: deletedLogs.length, icon: Trash2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setGeneralSubTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                  generalSubTab === tab.id
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px]">{tab.count}</span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
              <p className="text-xs">{t('archive.loading') || 'جاري تحميل الأرشيف...'}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              {/* Invoices */}
              {generalSubTab === 'invoices' && (
                archivedInvoices.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl p-4">
                    <FileX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">لا توجد فواتير مستردة أو ملغاة حالياً</p>
                    <p className="text-xs text-muted-foreground mt-1">أي فاتورة يتم استردادها جزئياً أو كلياً تظهر هنا تلقائياً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {archivedInvoices.map(invoice => (
                      <div key={invoice.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{invoice.customerName || 'عميل نقدي'}</p>
                            <span className="text-xs font-mono text-muted-foreground">#{invoice.id.slice(-6)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            المبلغ: {invoice.currencySymbol || '$'}{formatNumber(invoice.totalInCurrency ?? invoice.finalTotal)} • {new Date(invoice.createdAt).toLocaleDateString('ar-SA')}
                          </p>
                        </div>
                        <span className={cn(
                          "text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0",
                          invoice.status === 'refunded' ? "bg-orange-500/15 text-orange-600 border border-orange-500/30" :
                          (invoice as any).status === 'partially_refunded' ? "bg-amber-500/15 text-amber-600 border border-amber-500/30" :
                          "bg-destructive/15 text-destructive border border-destructive/30"
                        )}>
                          {invoice.status === 'refunded' ? 'مستردة بالكامل' :
                           (invoice as any).status === 'partially_refunded' ? 'مستردة جزئياً' : 'ملغاة'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Paid Debts */}
              {generalSubTab === 'debts' && (
                paidDebts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl p-4">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">{t('archive.noPaidDebts') || 'لا توجد ديون مسددة'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paidDebts.map(debt => (
                      <div key={debt.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{debt.customerName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">${formatNumber(debt.totalDebt)} - مسدد بالكامل</p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30 shrink-0">
                          {t('archive.paid') || 'مسدد'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Out of Stock Products */}
              {generalSubTab === 'products' && (
                outOfStockProducts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl p-4">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">{t('archive.noOutOfStock') || 'لا توجد أصناف نافذة الكمية'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outOfStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{product.category || t('archive.noCategory') || 'بدون تصنيف'} • الكمية: 0</p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
                          {t('archive.out') || 'نفذ'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Deleted & Refunded Logs */}
              {generalSubTab === 'deleted' && (
                deletedLogs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl p-4">
                    <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">لا توجد سجلات حذف أو استرداد مسجلة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deletedLogs.map(log => (
                      <div key={log.id} className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground truncate">{log.description}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {new Date(log.timestamp).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>بواسطة: {log.userName || 'المسؤول'}</span>
                          <span className="px-2 py-0.5 rounded-md bg-muted text-[10px]">{log.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </ScrollArea>
          )}
        </div>
      )}

      {/* Notification Archive */}
      {activeTab === 'notifications' && (
        <div className="space-y-3">
          {archivedNotifications.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl p-4">
              <Bell className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{t('archive.noArchivedNotifications') || 'لا توجد إشعارات مؤرشفة'}</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 px-2 text-xs" onClick={clearAllArchived}>
                  <Trash2 className="w-3.5 h-3.5 me-1" />
                  {t('archive.deleteAll') || 'حذف الكل'}
                </Button>
              </div>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {archivedNotifications.map(notification => (
                    <div key={notification.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(notification.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => restoreNotification(notification.id)} title={t('archive.restore') || 'استعادة'}>
                          <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteArchivedNotification(notification.id)} title={t('archive.deletePermanent') || 'حذف نهائي'}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </div>
  );
}
