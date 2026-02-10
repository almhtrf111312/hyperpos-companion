import { useState, useEffect, useMemo } from 'react';
import { printHTML, generateClientInvoiceHTML } from '@/lib/native-print';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Trash2,
  Printer,
  Send,
  Filter,
  Calendar,
  DollarSign,
  Banknote,
  CreditCard,
  Wrench,
  ShoppingCart,
  X,
  Check,
  MoreVertical,
  Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { cn, formatNumber, formatCurrency, formatDateTime } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';
import {
  loadInvoicesCloud,
  voidInvoiceCloud,
  updateInvoiceCloud,
  getInvoiceStatsCloud,
  Invoice,
  InvoiceType
} from '@/lib/cloud/invoices-cloud';
import { deleteDebtByInvoiceIdCloud } from '@/lib/cloud/debts-cloud';
import { shareInvoice, InvoiceShareData } from '@/lib/native-share';

export default function Invoices() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | InvoiceType>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'debt'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [stats, setStats] = useState({ total: 0, todayCount: 0, todaySales: 0, totalSales: 0, pendingDebts: 0, totalProfit: 0 });

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load invoices with proper cleanup
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [invoicesData, statsData] = await Promise.all([
        loadInvoicesCloud(),
        getInvoiceStatsCloud()
      ]);
      setInvoices(invoicesData);
      setStats(statsData);
      setIsLoading(false);
    };
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    };
  }, []);

  // Memoized filtered invoices for performance
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(inv =>
        inv.customerName.toLowerCase().includes(query) ||
        inv.id.toLowerCase().includes(query) ||
        inv.serviceDescription?.toLowerCase().includes(query)
      );
    }

    if (filterType !== 'all') {
      result = result.filter(inv => inv.type === filterType);
    }

    if (filterPayment !== 'all') {
      result = result.filter(inv => inv.paymentType === filterPayment);
    }

    return result;
  }, [invoices, debouncedSearch, filterType, filterPayment]);

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
  };

  const handleVoid = (invoice: Invoice) => {
    setInvoiceToVoid(invoice);
    setVoidReason('');
    setShowVoidDialog(true);
  };

  const confirmVoid = async () => {
    if (invoiceToVoid) {
      if (!voidReason.trim()) {
        toast.error(t('common.required'));
        return;
      }

      const success = await voidInvoiceCloud(invoiceToVoid.id, voidReason);

      if (success) {
        const [invoicesData, statsData] = await Promise.all([
          loadInvoicesCloud(),
          getInvoiceStatsCloud()
        ]);
        setInvoices(invoicesData);
        setStats(statsData);
        toast.success(t('invoices.voidSuccess') || 'تم إلغاء الفاتورة بنجاح');
        setShowVoidDialog(false);
        setInvoiceToVoid(null);
      } else {
        toast.error(t('common.error'));
      }
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    // Update invoice status
    await updateInvoiceCloud(invoice.id, { status: 'paid', debtPaid: invoice.total, debtRemaining: 0 });
    // Delete associated debt
    await deleteDebtByInvoiceIdCloud(invoice.id);
    // Reload data
    const invoicesData = await loadInvoicesCloud();
    setInvoices(invoicesData);
    toast.success(t('invoices.statusUpdated'));
  };

  // Navigate to debts page to pay installment
  const handlePayDebt = (invoice: Invoice) => {
    navigate(`/debts?invoiceId=${invoice.id}&autoOpenPayment=true`);
  };

  const handlePrint = async (invoice: Invoice) => {
    // Dynamic store settings extraction
    let storeName = 'HyperPOS Store';
    let storePhone = '';
    let storeAddress = '';
    let storeLogo = '';
    let footer = 'شكراً لتعاملكم معنا!';
    let currencySymbol = 'ر.س';

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storePhone = settings.storeSettings?.phone || '';
        storeAddress = settings.storeSettings?.address || '';
        storeLogo = settings.storeSettings?.logo || '';
        footer = settings.printSettings?.footer || footer;
        // Find currency symbol based on stored settings if possible, defaulting to SAR/USD or item currency
        // Here we just use a default or what's in settings.
      }
    } catch { }

    const printData = {
      id: invoice.id,
      date: new Date(invoice.createdAt).toLocaleDateString('ar-SA'),
      customerName: invoice.customerName,
      items: invoice.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      total: invoice.total,
      currencySymbol: currencySymbol, // This might need better dynamic handling if multiple currencies
      storeName,
      storePhone,
      storeAddress,
      storeLogo,
      footer,
      paymentType: 'cash' as const // Simplified for now, or derive from invoice data if available
    };

    // Use the new professional template
    const html = generateClientInvoiceHTML(printData);

    // Print using native/web method
    await printHTML(html);
  };
  const handleWhatsApp = async (invoice: Invoice) => {
    // Dynamic store settings with proper defaults
    let storeName = 'FlowPOS Pro';
    let storePhone = '';

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storePhone = settings.storeSettings?.phone || '';
      }
    } catch (error) {
      console.error('Failed to load store settings for WhatsApp:', error);
    }

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');

    // تحضير بيانات المشاركة
    const shareData: InvoiceShareData = {
      id: invoice.id,
      storeName,
      storePhone,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      date,
      items: invoice.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      total: invoice.totalInCurrency,
      currencySymbol: invoice.currencySymbol,
      paymentType: invoice.paymentType,
      serviceDescription: invoice.serviceDescription,
      type: invoice.type,
    };

    const success = await shareInvoice(shareData);
    if (success) {
      toast.success(t('invoices.shareOpened'));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-14 md:pr-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {t('invoices.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('invoices.subtitle')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.totalInvoices')}</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.todaySales')}</p>
                <p className="text-xl font-bold">{formatCurrency(stats.todaySales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CreditCard className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.pendingDebts')}</p>
                <p className="text-xl font-bold">{stats.pendingDebts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Banknote className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.totalProfit')}</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('invoices.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v: 'all' | InvoiceType) => setFilterType(v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('invoices.invoiceType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="sale">{t('invoices.sales')}</SelectItem>
            <SelectItem value="maintenance">{t('invoices.maintenance')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterPayment}
          onValueChange={(v: 'all' | 'cash' | 'debt') => setFilterPayment(v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('invoices.paymentMethod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="cash">{t('invoices.cash')}</SelectItem>
            <SelectItem value="debt">{t('invoices.credit')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {isLoading ? (
          // Skeleton loading state
          [1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-10 w-10 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t('invoices.noInvoices')}</p>
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      invoice.type === 'sale' ? "bg-primary/10" : "bg-warning/10"
                    )}>
                      {invoice.type === 'sale' ? (
                        <ShoppingCart className="w-5 h-5 text-primary" />
                      ) : (
                        <Wrench className="w-5 h-5 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{invoice.customerName}</span>
                        <Badge variant={invoice.paymentType === 'cash' ? 'default' : 'secondary'}>
                          {invoice.paymentType === 'cash' ? t('invoices.cash') : t('invoices.credit')}
                        </Badge>
                        {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                          invoice.debtPaid && invoice.debtPaid > 0 && invoice.debtRemaining && invoice.debtRemaining > 0 ? (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                              مدفوع جزئياً
                            </Badge>
                          ) : (
                            <Badge variant="destructive">{t('invoices.unpaid')}</Badge>
                          )
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                        <span>{invoice.id}</span>
                        <span>•</span>
                        <span>{formatDateTime(new Date(invoice.createdAt))}</span>
                        {invoice.cashierName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                              👤 {invoice.cashierName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-bold text-lg">
                        {formatCurrency(invoice.totalInCurrency)}
                      </p>
                      {invoice.paymentType === 'debt' && invoice.status === 'pending' && invoice.debtPaid !== undefined && invoice.debtPaid > 0 && (
                        <p className="text-xs text-muted-foreground">
                          المدفوع: {formatCurrency(invoice.debtPaid)} / المتبقي: {formatCurrency(invoice.debtRemaining || 0)}
                        </p>
                      )}
                      {invoice.profit !== undefined && invoice.profit > 0 && (
                        <p className="text-xs text-success">
                          ربح: {formatCurrency(invoice.profit)}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 min-w-[40px]">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(invoice)}>
                          <Eye className="w-4 h-4 ml-2" />
                          {t('common.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrint(invoice)}>
                          <Printer className="w-4 h-4 ml-2" />
                          {t('common.print')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleWhatsApp(invoice)}>
                          <Send className="w-4 h-4 ml-2" />
                          {t('common.whatsapp')}
                        </DropdownMenuItem>
                        {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handlePayDebt(invoice)}>
                              <DollarSign className="w-4 h-4 ml-2" />
                              تسديد دفعة
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMarkPaid(invoice)}>
                              <Check className="w-4 h-4 ml-2" />
                              {t('invoices.markAsPaid')}
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleVoid(invoice)}
                          className="text-destructive"
                          disabled={invoice.status === 'cancelled'}
                        >
                          <Ban className="w-4 h-4 ml-2" />
                          {t('invoices.voidInvoice') || 'إلغاء الفاتورة'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t('invoices.details')}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('invoices.invoiceNumber')}:</span>
                  <p className="font-semibold flex items-center gap-2">
                    {selectedInvoice.id}
                    {selectedInvoice.status === 'cancelled' && (
                      <Badge variant="destructive" className="h-5 text-[10px]">
                        {t('invoices.voided') || 'ملغاة'}
                      </Badge>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.date')}:</span>
                  <p className="font-semibold" dir="ltr">
                    {formatDateTime(new Date(selectedInvoice.createdAt))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.customer')}:</span>
                  <p className="font-semibold">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.phone')}:</span>
                  <p className="font-semibold">{selectedInvoice.customerPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.type')}:</span>
                  <Badge variant={selectedInvoice.type === 'sale' ? 'default' : 'secondary'}>
                    {selectedInvoice.type === 'sale' ? t('invoices.sales') : t('invoices.maintenance')}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.payment')}:</span>
                  <Badge variant={selectedInvoice.paymentType === 'cash' ? 'default' : 'destructive'}>
                    {selectedInvoice.paymentType === 'cash' ? t('invoices.cash') : t('invoices.credit')}
                  </Badge>
                </div>
              </div>

              {selectedInvoice.type === 'maintenance' && selectedInvoice.serviceDescription && (
                <div className="bg-muted rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">{t('invoices.service')}:</span>
                  <div className="font-medium flex items-center gap-2">
                    {selectedInvoice.serviceDescription}
                    {selectedInvoice.status === 'cancelled' && (
                      <Badge variant="destructive" className="mt-1 text-[10px] h-5">
                        {t('invoices.voided') || 'ملغاة'}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {selectedInvoice.type === 'sale' && selectedInvoice.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">{t('invoices.products')}:</span>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">المنتج</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">الكمية</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">التكلفة</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">السعر</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">الربح</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item, idx) => {
                          const cost = item.costPrice || 0;
                          const profit = item.profit || 0;
                          const margin = item.price > 0 ? (profit / item.total) * 100 : 0;

                          return (
                            <tr key={idx} className="border-t border-muted/50">
                              <td className="px-3 py-2">{item.name}</td>
                              <td className="px-3 py-2 text-center">{item.quantity}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{formatCurrency(cost)}</td>
                              <td className="px-3 py-2 text-center">{formatCurrency(item.price)}</td>
                              <td className="px-3 py-2 text-center text-success">
                                {formatCurrency(profit)}
                                <span className="text-[10px] text-muted-foreground block">
                                  ({margin.toFixed(1)}%)
                                </span>
                              </td>
                              <td className="px-3 py-2 text-left font-medium">{formatCurrency(item.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Summary Footer for Analytics */}
                      <tfoot className="bg-muted/30 border-t border-muted">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right font-medium">الإجماليات:</td>
                          <td className="px-3 py-2 text-center font-medium text-muted-foreground">
                            {formatCurrency(selectedInvoice.items.reduce((sum, item) => sum + (item.costPrice || 0) * item.quantity, 0))}
                          </td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-center font-bold text-success">
                            {formatCurrency(selectedInvoice.profit || 0)}
                          </td>
                          <td className="px-3 py-2 text-left font-bold">
                            {formatCurrency(selectedInvoice.items.reduce((sum, item) => sum + item.total, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('invoices.discount')}{selectedInvoice.discountPercentage ? ` (${selectedInvoice.discountPercentage} %)` : ''}:</span>
                    <span className="text-destructive">-{formatCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('invoices.total')}:</span>
                  <span className="text-primary">{formatCurrency(selectedInvoice.totalInCurrency)}</span>
                </div>
                {selectedInvoice.profit !== undefined && (
                  <div className="flex justify-between text-sm text-success">
                    <span>{t('invoices.profit')}:</span>
                    <span>{formatCurrency(selectedInvoice.profit)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handlePrint(selectedInvoice)}>
                  <Printer className="w-4 h-4 ml-2" />
                  {t('common.print')}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleWhatsApp(selectedInvoice)}>
                  <Send className="w-4 h-4 ml-2" />
                  {t('common.whatsapp')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Ban className="w-5 h-5" />
              {t('invoices.voidInvoice') || 'إلغاء الفاتورة'}
            </DialogTitle>
            <DialogDescription>
              {t('invoices.voidConfirm') || 'هل أنت متأكد من إلغاء هذه الفاتورة؟ سيتم عكس جميع آثارها المالية والمخزنية.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <label className="text-sm font-medium">{t('invoices.voidReason') || 'سبب الإلغاء'}</label>
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="خطأ في الإدخال، مرتجع..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowVoidDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmVoid}>
              {t('common.confirm') || 'تأكيد الإلغاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
