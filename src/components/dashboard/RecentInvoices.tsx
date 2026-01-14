import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Printer, MoreVertical, X, Edit, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface InvoiceRow {
  id: string;
  customer: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'cancelled';
  time: string;
  date: string;
  items: { name: string; quantity: number; price: number }[];
}

// Empty invoices - will be populated from real data
const mockInvoices: InvoiceRow[] = [];

const statusStyles = {
  completed: 'badge-success',
  pending: 'badge-warning',
  cancelled: 'badge-danger',
};

const statusLabels = {
  completed: 'مكتملة',
  pending: 'معلقة',
  cancelled: 'ملغاة',
};

export function RecentInvoices() {
  const navigate = useNavigate();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const handleViewInvoice = (invoice: InvoiceRow) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
  };

  const handlePrintInvoice = (invoice: InvoiceRow) => {
    // Load store settings for invoice
    let storeName = 'HyperPOS Store';
    let storeAddress = '';
    let storePhone = '';
    let storeLogo = '';
    let showLogo = true;
    let showAddress = true;
    let showPhone = true;
    let footer = 'شكراً لتسوقكم معنا!';
    
    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storeAddress = settings.storeSettings?.address || '';
        storePhone = settings.storeSettings?.phone || '';
        storeLogo = settings.storeSettings?.logo || '';
        showLogo = settings.printSettings?.showLogo ?? true;
        showAddress = settings.printSettings?.showAddress ?? true;
        showPhone = settings.printSettings?.showPhone ?? true;
        footer = settings.printSettings?.footer || footer;
      }
    } catch {}

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
            ${showLogo && storeLogo ? `<img src="${storeLogo}" alt="شعار المحل" class="logo" />` : ''}
            <div class="store-name">${storeName}</div>
            ${showAddress && storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
            ${showPhone && storePhone ? `<div class="store-info">${storePhone}</div>` : ''}
          </div>
          <div class="invoice-info">
            <p><strong>رقم الفاتورة:</strong> ${invoice.id}</p>
            <p><strong>العميل:</strong> ${invoice.customer}</p>
            <p><strong>التاريخ:</strong> ${invoice.date} - ${invoice.time}</p>
          </div>
          <div class="items">
            ${invoice.items.map(item => `
              <div class="item">
                <span class="item-name">${item.name}</span>
                <span class="item-qty">×${item.quantity}</span>
                <span class="item-price">$${item.price}</span>
              </div>
            `).join('')}
          </div>
          <div class="total">
            المجموع: $${invoice.amount.toLocaleString()}
          </div>
          <div class="footer">
            <p>${footer}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `;
    
    const printWindow = window.open('about:blank', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
    toast.success(`جاري طباعة الفاتورة ${invoice.id}`);
  };

  const handleCopyInvoice = (invoice: InvoiceRow) => {
    navigator.clipboard.writeText(invoice.id);
    toast.success('تم نسخ رقم الفاتورة');
  };

  const handleEditInvoice = (invoice: InvoiceRow) => {
    toast.info(`تعديل الفاتورة ${invoice.id}`);
    navigate('/pos');
  };

  const handleDeleteInvoice = (invoice: InvoiceRow) => {
    toast.error(`تم حذف الفاتورة ${invoice.id}`);
  };

  const handleViewAll = () => {
    navigate('/pos');
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">آخر الفواتير</h3>
            <button 
              onClick={handleViewAll}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              عرض الكل
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">رقم الفاتورة</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">العميل</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">المبلغ</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الحالة</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الوقت</th>
                <th className="text-center py-4 px-6 text-sm font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {mockInvoices.map((invoice, index) => (
                <tr 
                  key={invoice.id}
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer fade-in",
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => handleViewInvoice(invoice)}
                >
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm text-foreground">{invoice.id}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-foreground">{invoice.customer}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-semibold text-foreground">
                      ${invoice.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                      statusStyles[invoice.status]
                    )}>
                      {statusLabels[invoice.status]}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-muted-foreground">{invoice.time}</span>
                  </td>
                  <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => handleViewInvoice(invoice)}
                        title="عرض الفاتورة"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => handlePrintInvoice(invoice)}
                        title="طباعة"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
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
      </div>

      {/* Invoice View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
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
              {/* Customer Info */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="font-semibold">{selectedInvoice.customer}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">التاريخ:</span>
                  <span>{selectedInvoice.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الوقت:</span>
                  <span>{selectedInvoice.time}</span>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold mb-3">المنتجات</h4>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">الكمية: {item.quantity}</p>
                      </div>
                      <span className="font-semibold">${item.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>المجموع:</span>
                  <span className="text-primary">${selectedInvoice.amount}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex justify-center">
                <span className={cn(
                  "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium",
                  statusStyles[selectedInvoice.status]
                )}>
                  {statusLabels[selectedInvoice.status]}
                </span>
              </div>

              {/* Actions */}
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
