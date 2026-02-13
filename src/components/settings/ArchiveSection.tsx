import { useState, useEffect, useCallback } from 'react';
import { Archive, Bell, Package, CreditCard, FileX, Undo2, Trash2, AlertTriangle } from 'lucide-react';
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

type ArchiveTab = 'notifications' | 'general';
type GeneralSubTab = 'debts' | 'products' | 'invoices';

export function ArchiveSection() {
  const { isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<ArchiveTab>('notifications');
  const [generalSubTab, setGeneralSubTab] = useState<GeneralSubTab>('debts');
  
  const {
    archivedNotifications,
    restoreNotification,
    deleteArchivedNotification,
    clearAllArchived,
  } = useNotifications();

  // General archive data
  const [paidDebts, setPaidDebts] = useState<any[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<any[]>([]);
  const [cancelledInvoices, setCancelledInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadGeneralArchive = useCallback(async () => {
    setIsLoading(true);
    try {
      const [debts, products, invoices] = await Promise.all([
        loadDebtsCloud(),
        loadProductsCloud(),
        loadInvoicesCloud(),
      ]);
      setPaidDebts(debts.filter(d => d.status === 'fully_paid'));
      setOutOfStockProducts(products.filter(p => p.quantity === 0));
      setCancelledInvoices(invoices.filter(i => i.status === 'cancelled'));
    } catch (error) {
      console.error('Error loading archive:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'general') {
      loadGeneralArchive();
    }
  }, [activeTab, loadGeneralArchive]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return isRTL ? 'اليوم' : 'Today';
    if (diffDays === 1) return isRTL ? 'أمس' : 'Yesterday';
    return isRTL ? `منذ ${diffDays} يوم` : `${diffDays} days ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Archive className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          {isRTL ? 'الأرشيف' : 'Archive'}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('notifications')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors",
            activeTab === 'notifications'
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bell className="w-4 h-4" />
          {isRTL ? 'أرشيف الإشعارات' : 'Notifications'}
          {archivedNotifications.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-muted">{archivedNotifications.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors",
            activeTab === 'general'
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="w-4 h-4" />
          {isRTL ? 'الأرشيف العام' : 'General Archive'}
        </button>
      </div>

      {/* Notification Archive */}
      {activeTab === 'notifications' && (
        <div className="space-y-3">
          {archivedNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">{isRTL ? 'لا توجد إشعارات مؤرشفة' : 'No archived notifications'}</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearAllArchived}>
                  <Trash2 className="w-4 h-4 me-1" />
                  {isRTL ? 'حذف الكل' : 'Delete All'}
                </Button>
              </div>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {archivedNotifications.map(notification => (
                    <div key={notification.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(notification.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => restoreNotification(notification.id)} title={isRTL ? 'استعادة' : 'Restore'}>
                          <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteArchivedNotification(notification.id)} title={isRTL ? 'حذف نهائي' : 'Delete'}>
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

      {/* General Archive */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          {/* Sub tabs */}
          <div className="flex gap-2">
            {([
              { id: 'debts' as GeneralSubTab, label: isRTL ? 'ديون مدفوعة' : 'Paid Debts', count: paidDebts.length, icon: CreditCard },
              { id: 'products' as GeneralSubTab, label: isRTL ? 'منتجات نفذت' : 'Out of Stock', count: outOfStockProducts.length, icon: Package },
              { id: 'invoices' as GeneralSubTab, label: isRTL ? 'فواتير ملغاة' : 'Cancelled', count: cancelledInvoices.length, icon: FileX },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setGeneralSubTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  generalSubTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px]">{tab.count}</span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : (
            <ScrollArea className="max-h-96">
              {/* Paid Debts */}
              {generalSubTab === 'debts' && (
                paidDebts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد ديون مدفوعة' : 'No paid debts'}</div>
                ) : (
                  <div className="space-y-2">
                    {paidDebts.map(debt => (
                      <div key={debt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{debt.customerName}</p>
                          <p className="text-xs text-muted-foreground">${formatNumber(debt.totalDebt)} - {isRTL ? 'مدفوع بالكامل' : 'Fully Paid'}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                          {isRTL ? 'مدفوع' : 'Paid'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Out of Stock Products */}
              {generalSubTab === 'products' && (
                outOfStockProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد منتجات نفذت' : 'No out of stock products'}</div>
                ) : (
                  <div className="space-y-2">
                    {outOfStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category || (isRTL ? 'بدون تصنيف' : 'No category')}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                          {isRTL ? 'نفذ' : 'Out'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Cancelled Invoices */}
              {generalSubTab === 'invoices' && (
                cancelledInvoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد فواتير ملغاة' : 'No cancelled invoices'}</div>
                ) : (
                  <div className="space-y-2">
                    {cancelledInvoices.map(invoice => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{invoice.customerName}</p>
                          <p className="text-xs text-muted-foreground">#{invoice.id.slice(-6)} - {invoice.currencySymbol}{formatNumber(invoice.totalInCurrency)}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                          {isRTL ? 'ملغاة' : 'Cancelled'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
