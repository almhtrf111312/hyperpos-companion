import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Printer, MoreVertical, X, Edit, Trash2, Copy, FileX, Loader2 } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { loadInvoicesCloud, deleteInvoiceCloud, Invoice } from '@/lib/cloud/invoices-cloud';
import { printHTML, getStoreSettings, getPrintSettings } from '@/lib/print-utils';
import { EVENTS } from '@/lib/events';

const statusStyles: Record<string, string> = {
  paid: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  cancelled: 'bg-destructive/10 text-destructive',
};

const statusLabels: Record<string, string> = {
  paid: 'مكتملة',
  pending: 'معلقة',
  cancelled: 'ملغاة',
};

export function RecentInvoices() {
  const navigate = useNavigate();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await loadInvoicesCloud();
      setInvoices(data.slice(0, 5));
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener(EVENTS.INVOICES_UPDATED, loadData);
    return () => window.removeEventListener(EVENTS.INVOICES_UPDATED, loadData);
  }, [loadData]);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const storeSettings = getStoreSettings();
    const printSettings = getPrintSettings();

    const invoiceDate = new Date(invoice.createdAt);
    const dateStr = invoiceDate.toLocaleDateString('ar-SA');
    const timeStr = invoiceDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة ${invoice.id}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .logo { max-width: 80px; max-height: 80px; margin: 0 auto 10px; display: block; }
            .store-name { font-size: 1.4em; font-weight: bold; margin: 5px 0; }
            .store-info { font-size: 0.85em; color: #555; }
            .invoice-info { margin: 15px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            .invoice-info p { margin: 5px 0; font-size: 0.9em; }
            .items { margin: 15px 0; }
            .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #ddd; }
            .item-name { flex: 1; }
            .item-qty { color: #555; font-size: 0.85em; }
            .item-price { font-weight: bold; }
            .total { font-size: 1.3em; font-weight: bold; margin-top: 15px; padding-top: 10px; border-top: 2px solid #000; text-align: center; }
            .footer { text-align: center; margin-top: 25px; font-size: 0.85em; color: #555; border-top: 1px dashed #ccc; padding-top: 15px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings.showLogo && storeSettings.logo ? `<img src="${storeSettings.logo}" alt="شعار المحل" class="logo" />` : ''}
            <div class="store-name">${storeSettings.name}</div>
            ${printSettings.showAddress && storeSettings.address ? `<div class="store-info">${storeSettings.address}</div>` : ''}
            ${printSettings.showPhone && storeSettings.phone ? `<div class="store-info">${storeSettings.phone}</div>` : ''}
          </div>
          <div class="invoice-info">
            <p><strong>رقم الفاتورة:</strong> ${invoice.id}</p>
            <p><strong>العميل:</strong> ${invoice.customerName}</p>
            <p><strong>التاريخ:</strong> ${dateStr} - ${timeStr}</p>
            <p><strong>نوع الدفع:</strong> ${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}</p>
          </div>
          <div class="items">
            ${invoice.items.map(item => `
              <div class="item">
                <span class="item-name">${item.name}</span>
                <span class="item-qty">×${item.quantity}</span>
                <span class="item-price">${invoice.currencySymbol}${item.total}</span>
              </div>
            `).join('')}
          </div>
          ${invoice.discount > 0 ? `<div style="text-align: center; color: #666;">خصم: ${invoice.currencySymbol}${invoice.discount}</div>` : ''}
          <div class="total">
            المجموع: ${invoice.currencySymbol}${formatNumber(invoice.totalInCurrency)}
          </div>
          <div class="footer">
            <p>${printSettings.footer}</p>
          </div>
        </body>
      </html>
    `;

    printHTML(printContent);
    toast.success('جاري إرسال الفاتورة للطابعة...');
  };

  const handleCopyInvoice = (invoice: Invoice) => {
    navigator.clipboard.writeText(invoice.id);
    toast.success('تم نسخ رقم الفاتورة');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    toast.info(`تعديل الفاتورة ${invoice.id}`);
    navigate('/pos');
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const success = await deleteInvoiceCloud(invoice.id);
    if (success) {
      toast.success(`تم حذف الفاتورة ${invoice.id}`);
      loadData();
      setShowViewDialog(false);
    } else {
      toast.error('فشل في حذف الفاتورة');
    }
  };

  const handleViewAll = () => {
    navigate('/invoices');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const shortenId = (id: string) => {
    if (id.length > 8) return '...' + id.slice(-6);
    return id;
  };

  return (
    <>
      <div className="glass rounded-2xl p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">آخر الفواتير</h3>
          <button
            onClick={handleViewAll}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            عرض الكل
          </button>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileX className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">لا توجد فواتير بعد</p>
            <p className="text-sm text-muted-foreground/70 mt-1">ابدأ بإنشاء فاتورة جديدة من نقطة البيع</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/pos')}
            >
              انتقل إلى نقطة البيع
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop: Table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 text-right">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground">رقم الفاتورة</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground">العميل</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground">المبلغ</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground">الحالة</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, index) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => handleViewInvoice(invoice)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-foreground">{invoice.id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">{invoice.customerName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-foreground">
                          {invoice.currencySymbol}{formatNumber(invoice.totalInCurrency)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          statusStyles[invoice.status]
                        )}>
                          {statusLabels[invoice.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            onClick={() => handleViewInvoice(invoice)}
                            title="عرض الفاتورة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            onClick={() => handlePrintInvoice(invoice)}
                            title="طباعة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                                <Eye className="w-4 h-4 ml-2" />
                                عرض التفاصيل
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyInvoice(invoice)}>
                                <Copy className="w-4 h-4 ml-2" />
                                نسخ الرقم
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditInvoice(invoice)}>
                                <Edit className="w-4 h-4 ml-2" />
                                تعديل
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteInvoice(invoice)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 ml-2" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: Compact card view */}
            <div className="md:hidden space-y-0">
              {invoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  className={cn(
                    "flex items-center justify-between gap-2 py-3 px-2 cursor-pointer transition-colors",
                    index % 2 === 0 ? "bg-muted/20" : "bg-transparent",
                    index < invoices.length - 1 && "border-b border-border/30"
                  )}
                  onClick={() => handleViewInvoice(invoice)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {shortenId(invoice.id)}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {invoice.customerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {invoice.currencySymbol}{formatNumber(invoice.totalInCurrency)}
                    </span>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap",
                      statusStyles[invoice.status]
                    )}>
                      {statusLabels[invoice.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Invoice View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg glass border-white/10">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>تفاصيل الفاتورة {selectedInvoice?.id}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowViewDialog(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="font-semibold">{selectedInvoice.customerName}</span>
                </div>
                {selectedInvoice.customerPhone && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">الهاتف:</span>
                    <span>{selectedInvoice.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">التاريخ:</span>
                  <span>{formatDate(selectedInvoice.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">الوقت:</span>
                  <span>{formatTime(selectedInvoice.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">نوع الدفع:</span>
                  <span>{selectedInvoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">المنتجات</h4>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">الكمية: {item.quantity}</p>
                      </div>
                      <span className="font-semibold">{selectedInvoice.currencySymbol}{item.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/50 pt-4">
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                    <span>الخصم:</span>
                    <span>{selectedInvoice.currencySymbol}{selectedInvoice.discount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>المجموع:</span>
                  <span className="text-primary">{selectedInvoice.currencySymbol}{formatNumber(selectedInvoice.totalInCurrency)}</span>
                </div>
              </div>

              <div className="flex justify-center">
                <span className={cn(
                  "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium",
                  statusStyles[selectedInvoice.status]
                )}>
                  {statusLabels[selectedInvoice.status]}
                </span>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                >
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowViewDialog(false);
                    handleEditInvoice(selectedInvoice);
                  }}
                >
                  <Edit className="w-4 h-4 ml-2" />
                  تعديل
                </Button>
              </div>
              <Button
                variant="secondary"
                className="w-full mt-2"
                onClick={() => setShowViewDialog(false)}
              >
                <X className="w-4 h-4 ml-2" />
                إغلاق
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
