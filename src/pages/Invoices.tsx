import { useState, useEffect, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { 
  loadInvoices, 
  deleteInvoice, 
  updateInvoice,
  Invoice, 
  InvoiceType,
  getInvoiceStats 
} from '@/lib/invoices-store';

export default function Invoices() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | InvoiceType>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'debt'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [stats, setStats] = useState(getInvoiceStats());

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load invoices with proper cleanup
  useEffect(() => {
    setIsLoading(true);
    const loadData = () => {
      setInvoices(loadInvoices());
      setStats(getInvoiceStats());
      setIsLoading(false);
    };
    loadData();
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('hyperpos')) {
        loadData();
      }
    };
    const handleFocus = () => loadData();
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
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

  const handleDelete = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (invoiceToDelete) {
      deleteInvoice(invoiceToDelete.id);
      setInvoices(loadInvoices());
      setStats(getInvoiceStats());
      toast.success('تم حذف الفاتورة بنجاح');
      setShowDeleteDialog(false);
      setInvoiceToDelete(null);
    }
  };

  const handleMarkPaid = (invoice: Invoice) => {
    updateInvoice(invoice.id, { status: 'paid', paymentType: 'cash' });
    setInvoices(loadInvoices());
    toast.success('تم تحديث حالة الفاتورة');
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
      toast.error('تعذر تحميل إعدادات المتجر للطباعة');
    }

    const { storeName, storeAddress, storePhone, storeLogo, footer } = storeConfig;

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');
    const time = new Date(invoice.createdAt).toLocaleTimeString('ar-SA');
    
    const itemsHtml = invoice.type === 'sale' 
      ? invoice.items.map(item => `
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${invoice.currencySymbol}${item.total.toLocaleString()}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" style="padding: 10px;">${invoice.serviceDescription || 'خدمة صيانة'}</td></tr>`;
    
    const printContent = `
      <html dir="rtl">
        <head>
          <title>فاتورة - ${invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .logo { max-width: 80px; max-height: 80px; margin: 0 auto 10px; display: block; }
            .store-name { font-size: 1.4em; font-weight: bold; margin: 5px 0; }
            .store-info { font-size: 0.85em; color: #555; }
            .invoice-info { margin: 15px 0; font-size: 0.9em; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #f5f5f5; padding: 8px; text-align: right; }
            .total { font-size: 1.3em; font-weight: bold; margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; text-align: center; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.85em; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeLogo ? `<img src="${storeLogo}" alt="شعار" class="logo" />` : ''}
            <div class="store-name">${storeName}</div>
            ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="store-info">${storePhone}</div>` : ''}
          </div>
          <div class="invoice-info">
            <div><strong>رقم الفاتورة:</strong> ${invoice.id}</div>
            <div><strong>التاريخ:</strong> ${date} - ${time}</div>
            <div><strong>العميل:</strong> ${invoice.customerName}</div>
            ${invoice.customerPhone ? `<div><strong>الهاتف:</strong> ${invoice.customerPhone}</div>` : ''}
            <div><strong>النوع:</strong> ${invoice.type === 'sale' ? 'مبيعات' : 'صيانة'}</div>
            <div><strong>الدفع:</strong> ${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}</div>
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
          ${invoice.discount > 0 ? `<div style="text-align: left;">خصم: ${invoice.currencySymbol}${invoice.discount.toLocaleString()}</div>` : ''}
          <div class="total">
            الإجمالي: ${invoice.currencySymbol}${invoice.totalInCurrency.toLocaleString()}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleWhatsApp = (invoice: Invoice) => {
    // Dynamic store settings with proper defaults
    let storeName = 'HyperPOS Store';
    let footer = 'شكراً لتعاملكم معنا!';
    
    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        footer = settings.printSettings?.footer || footer;
      }
    } catch (error) {
      console.error('Failed to load store settings for WhatsApp:', error);
      toast.error('تعذر تحميل إعدادات المتجر');
    }

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');
    
    const itemsList = invoice.type === 'sale'
      ? invoice.items.map(item => `• ${item.name} × ${item.quantity} = ${invoice.currencySymbol}${item.total.toLocaleString()}`).join('\n')
      : `🔧 ${invoice.serviceDescription || 'خدمة صيانة'}`;
    
    const message = `╔══════════════════╗
    *${storeName}*
╚══════════════════╝

📄 *فاتورة رقم:* ${invoice.id}
📅 ${date}

━━━━━━━━━━━━━━━━━━
👤 *العميل:* ${invoice.customerName}
${invoice.customerPhone ? `📱 *الهاتف:* ${invoice.customerPhone}` : ''}
━━━━━━━━━━━━━━━━━━

${invoice.type === 'sale' ? '🛒 *المشتريات:*' : '🔧 *الخدمة:*'}
${itemsList}

${invoice.discount > 0 ? `✂️ *الخصم:* ${invoice.currencySymbol}${invoice.discount.toLocaleString()}\n` : ''}
💰 *الإجمالي:* ${invoice.currencySymbol}${invoice.totalInCurrency.toLocaleString()}
💳 *طريقة الدفع:* ${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}

${footer}`;
    
    const phone = invoice.customerPhone?.replace(/[^\d]/g, '');
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            الفواتير
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            عرض وإدارة جميع الفواتير
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
                <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
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
                <p className="text-xs text-muted-foreground">مبيعات اليوم</p>
                <p className="text-xl font-bold">${stats.todaySales.toLocaleString()}</p>
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
                <p className="text-xs text-muted-foreground">ديون معلقة</p>
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
                <p className="text-xs text-muted-foreground">إجمالي الأرباح</p>
                <p className="text-xl font-bold">${stats.totalProfit.toLocaleString()}</p>
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
            placeholder="بحث بالاسم أو رقم الفاتورة..."
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
            <SelectValue placeholder="نوع الفاتورة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="sale">مبيعات</SelectItem>
            <SelectItem value="maintenance">صيانة</SelectItem>
          </SelectContent>
        </Select>
        <Select 
          value={filterPayment} 
          onValueChange={(v: 'all' | 'cash' | 'debt') => setFilterPayment(v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="طريقة الدفع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="cash">نقدي</SelectItem>
            <SelectItem value="debt">آجل</SelectItem>
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
              <p className="text-muted-foreground">لا توجد فواتير</p>
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
                          {invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}
                        </Badge>
                        {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                          <Badge variant="destructive">غير مدفوع</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>{invoice.id}</span>
                        <span>•</span>
                        <span>{new Date(invoice.createdAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-bold text-lg">
                        {invoice.currencySymbol}{invoice.totalInCurrency.toLocaleString()}
                      </p>
                      {invoice.profit !== undefined && invoice.profit > 0 && (
                        <p className="text-xs text-success">
                          ربح: ${invoice.profit.toLocaleString()}
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
                          عرض
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrint(invoice)}>
                          <Printer className="w-4 h-4 ml-2" />
                          طباعة
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleWhatsApp(invoice)}>
                          <Send className="w-4 h-4 ml-2" />
                          واتساب
                        </DropdownMenuItem>
                        {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleMarkPaid(invoice)}>
                              <Check className="w-4 h-4 ml-2" />
                              تحديد كمدفوع
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(invoice)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 ml-2" />
                          حذف
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
              تفاصيل الفاتورة
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">رقم الفاتورة:</span>
                  <p className="font-semibold">{selectedInvoice.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">التاريخ:</span>
                  <p className="font-semibold">{new Date(selectedInvoice.createdAt).toLocaleDateString('ar-SA')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">العميل:</span>
                  <p className="font-semibold">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">الهاتف:</span>
                  <p className="font-semibold">{selectedInvoice.customerPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">النوع:</span>
                  <Badge variant={selectedInvoice.type === 'sale' ? 'default' : 'secondary'}>
                    {selectedInvoice.type === 'sale' ? 'مبيعات' : 'صيانة'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">طريقة الدفع:</span>
                  <Badge variant={selectedInvoice.paymentType === 'cash' ? 'default' : 'destructive'}>
                    {selectedInvoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}
                  </Badge>
                </div>
              </div>
              
              {selectedInvoice.type === 'maintenance' && selectedInvoice.serviceDescription && (
                <div className="bg-muted rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">وصف الخدمة:</span>
                  <p className="font-medium">{selectedInvoice.serviceDescription}</p>
                </div>
              )}
              
              {selectedInvoice.type === 'sale' && selectedInvoice.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">المنتجات:</span>
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    {selectedInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="font-semibold">{selectedInvoice.currencySymbol}{item.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="border-t pt-4 space-y-2">
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>الخصم:</span>
                    <span>{selectedInvoice.currencySymbol}{selectedInvoice.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي:</span>
                  <span className="text-primary">{selectedInvoice.currencySymbol}{selectedInvoice.totalInCurrency.toLocaleString()}</span>
                </div>
                {selectedInvoice.profit !== undefined && (
                  <div className="flex justify-between text-sm text-success">
                    <span>الربح:</span>
                    <span>${selectedInvoice.profit.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handlePrint(selectedInvoice)}>
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleWhatsApp(selectedInvoice)}>
                  <Send className="w-4 h-4 ml-2" />
                  واتساب
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              حذف الفاتورة
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
