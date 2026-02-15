import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Undo2,
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
  MoreVertical
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
  deleteInvoiceCloud,
  refundInvoiceCloud,
  updateInvoiceCloud,
  getInvoiceStatsCloud,
  Invoice,
  InvoiceType
} from '@/lib/cloud/invoices-cloud';
import { deleteDebtByInvoiceIdCloud } from '@/lib/cloud/debts-cloud';
import { printHTML } from '@/lib/native-print';
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
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [invoiceToRefund, setInvoiceToRefund] = useState<Invoice | null>(null);
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

  const handleRefund = (invoice: Invoice) => {
    setInvoiceToRefund(invoice);
    setShowRefundDialog(true);
  };

  const confirmRefund = async () => {
    if (invoiceToRefund) {
      const success = await refundInvoiceCloud(invoiceToRefund.id);
      if (success) {
        const [invoicesData, statsData] = await Promise.all([
          loadInvoicesCloud(),
          getInvoiceStatsCloud()
        ]);
        setInvoices(invoicesData);
        setStats(statsData);
        toast.success('تم استرداد الفاتورة بنجاح وإعادة المخزون');
      } else {
        toast.error('فشل في استرداد الفاتورة');
      }
      setShowRefundDialog(false);
      setInvoiceToRefund(null);
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

  const handlePrint = (invoice: Invoice) => {
    // Dynamic store settings with proper defaults
    const storeDefaults = {
      storeName: 'HyperPOS Store',
      storeAddress: '',
      storePhone: '',
      storeLogo: '',
      footer: 'شكراً لتعاملكم معنا!',
      currencySymbol: 'ر.س'
    };

    let storeConfig = { ...storeDefaults };

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeConfig = {
          storeName: settings.storeSettings?.name || storeDefaults.storeName,
          storeAddress: settings.storeSettings?.address || storeDefaults.storeAddress,
          storePhone: settings.storeSettings?.phone || storeDefaults.storePhone,
          storeLogo: settings.storeSettings?.logo || storeDefaults.storeLogo,
          footer: settings.printSettings?.footer || storeDefaults.footer,
          currencySymbol: settings.currencySymbol || storeDefaults.currencySymbol,
        };
      }
    } catch (error) {
      console.error('Failed to load store settings for print:', error);
      toast.error(t('invoices.printSettingsError'));
    }

    const { storeName, storeAddress, storePhone, storeLogo, footer } = storeConfig;

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');
    const time = new Date(invoice.createdAt).toLocaleTimeString('ar-SA');

    const itemsHtml = invoice.type === 'sale'
      ? invoice.items.map(item => `
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${formatCurrency(item.total)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" style="padding: 10px;">${invoice.serviceDescription || t('invoices.maintenanceService')}</td></tr>`;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <title>فاتورة - ${invoice.id}</title>
          <style>
            /* Reset & Base - Mobile First */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { 
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
              padding: 10px; 
              max-width: 80mm; 
              margin: 0 auto; 
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            
            /* Header */
            .header { 
              text-align: center; 
              margin-bottom: 15px; 
              border-bottom: 2px dashed #333; 
              padding-bottom: 12px; 
            }
            .logo { 
              max-width: 60px; 
              max-height: 60px; 
              margin: 0 auto 8px; 
              display: block; 
              object-fit: contain;
            }
            .store-name { 
              font-size: 1.3em; 
              font-weight: bold; 
              margin: 5px 0; 
              word-wrap: break-word;
            }
            .store-info { 
              font-size: 0.85em; 
              color: #555; 
              word-wrap: break-word;
            }
            
            /* Invoice Info */
            .invoice-info { 
              margin: 12px 0; 
              font-size: 0.9em; 
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 10px;
              background: #fafafa;
            }
            .invoice-info > div { 
              padding: 3px 0; 
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
            }
            .invoice-info strong { 
              color: #333;
              min-width: 80px;
            }
            
            /* Table */
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 12px 0; 
              font-size: 0.9em;
            }
            th { 
              background: #333; 
              color: #fff;
              padding: 8px 5px; 
              text-align: right; 
              font-size: 0.85em;
            }
            td { 
              padding: 8px 5px; 
              border-bottom: 1px solid #eee; 
              vertical-align: top;
              word-wrap: break-word;
              max-width: 120px;
            }
            td:first-child {
              max-width: 45%;
              overflow-wrap: break-word;
              hyphens: auto;
            }
            td:nth-child(2) { text-align: center; width: 20%; }
            td:nth-child(3) { text-align: left; width: 25%; white-space: nowrap; }
            
            /* Service description for maintenance */
            .service-desc {
              white-space: pre-wrap;
              word-wrap: break-word;
              line-height: 1.5;
            }
            
            /* Discount */
            .discount-row {
              text-align: left;
              padding: 5px 0;
              color: #c00;
              font-weight: 500;
            }
            
            /* Total */
            .total { 
              font-size: 1.2em; 
              font-weight: bold; 
              margin-top: 12px; 
              border-top: 2px solid #333; 
              padding-top: 10px; 
              text-align: center;
              background: #f5f5f5;
              padding: 12px;
              border-radius: 6px;
            }
            
            /* Footer */
            .footer { 
              text-align: center; 
              margin-top: 20px; 
              font-size: 0.8em; 
              color: #666;
              border-top: 1px dashed #ccc;
              padding-top: 12px;
            }
            
            /* Print Styles */
            @media print {
              body { padding: 5px; max-width: 100%; }
              .header { page-break-after: avoid; }
              table { page-break-inside: avoid; }
              .total { page-break-before: avoid; }
              @page { 
                size: 80mm auto; 
                margin: 5mm; 
              }
            }
            
            /* Mobile Optimization */
            @media screen and (max-width: 320px) {
              body { font-size: 11px; padding: 8px; }
              .store-name { font-size: 1.1em; }
              td { padding: 6px 3px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeLogo ? `<img src="${storeLogo}" alt="شعار" class="logo" onerror="this.style.display='none'" />` : ''}
            <div class="store-name">${storeName}</div>
            ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="store-info">${storePhone}</div>` : ''}
          </div>
          <div class="invoice-info">
            <div><strong>رقم الفاتورة:</strong> <span>${invoice.id}</span></div>
            <div><strong>التاريخ:</strong> <span>${date} - ${time}</span></div>
            <div><strong>العميل:</strong> <span>${invoice.customerName}</span></div>
            ${invoice.customerPhone ? `<div><strong>الهاتف:</strong> <span>${invoice.customerPhone}</span></div>` : ''}
            <div><strong>النوع:</strong> <span>${invoice.type === 'sale' ? 'مبيعات' : 'صيانة'}</span></div>
            <div><strong>الدفع:</strong> <span>${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>البيان</th>
                <th>الكمية</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${invoice.discount > 0 ? `<div class="discount-row">خصم: ${formatCurrency(invoice.discount)}</div>` : ''}
          ${invoice.taxAmount && invoice.taxAmount > 0 ? `<div class="discount-row" style="color: #555;">ضريبة${invoice.taxRate ? ` (${invoice.taxRate}%)` : ''}: ${formatCurrency(invoice.taxAmount)}</div>` : ''}
          <div class="total">
            الإجمالي: ${formatCurrency(invoice.totalInCurrency)}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;

    // استخدام iframe للطباعة بدلاً من window.open
    printHTML(printContent);
    toast.success('جاري إرسال الفاتورة للطابعة...');
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
      taxAmount: invoice.taxAmount,
      taxRate: invoice.taxRate,
    };

    const success = await shareInvoice(shareData);
    if (success) {
      toast.success(t('invoices.shareOpened'));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">
            {t('invoices.title')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
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
                        {invoice.status === 'refunded' && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                            <Undo2 className="w-3 h-3 ml-1" />
                            مسترجعة
                          </Badge>
                        )}
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
                        {invoice.status !== 'refunded' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRefund(invoice)}
                              className="text-orange-600"
                            >
                              <Undo2 className="w-4 h-4 ml-2" />
                              استرداد الفاتورة
                            </DropdownMenuItem>
                          </>
                        )}
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
                  <p className="font-semibold">{selectedInvoice.id}</p>
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
                  <p className="font-medium">{selectedInvoice.serviceDescription}</p>
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
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">السعر</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-muted/50">
                            <td className="px-3 py-2">{item.name}</td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2 text-center">{formatCurrency(item.price)}</td>
                            <td className="px-3 py-2 text-left font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('invoices.discount')}{selectedInvoice.discountPercentage ? ` (${selectedInvoice.discountPercentage}%)` : ''}:</span>
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

      {/* Refund Confirmation Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <Undo2 className="w-5 h-5" />
              استرداد الفاتورة
            </DialogTitle>
            <DialogDescription>
              {invoiceToRefund && (
                <>
                  هل أنت متأكد من استرداد الفاتورة <strong>{invoiceToRefund.id}</strong>؟
                  <br />
                  <span className="text-sm text-muted-foreground mt-2 block">
                    سيتم: إعادة المنتجات للمخزون • إلغاء الدين المرتبط • عكس الأرباح
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRefundDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={confirmRefund}>
              <Undo2 className="w-4 h-4 ml-2" />
              تأكيد الاسترداد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
