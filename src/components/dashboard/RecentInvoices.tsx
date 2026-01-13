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

const mockInvoices: InvoiceRow[] = [
  { 
    id: 'INV_001', 
    customer: 'محمد أحمد', 
    amount: 1250, 
    currency: 'USD', 
    status: 'completed', 
    time: '10:30 ص',
    date: '2025-01-13',
    items: [
      { name: 'هاتف Samsung Galaxy S24', quantity: 1, price: 1000 },
      { name: 'شاحن سريع', quantity: 2, price: 125 },
    ]
  },
  { 
    id: 'INV_002', 
    customer: 'علي حسن', 
    amount: 850, 
    currency: 'USD', 
    status: 'completed', 
    time: '11:15 ص',
    date: '2025-01-13',
    items: [
      { name: 'سماعات AirPods Pro', quantity: 1, price: 850 },
    ]
  },
  { 
    id: 'INV_003', 
    customer: 'فاطمة محمود', 
    amount: 2100, 
    currency: 'USD', 
    status: 'pending', 
    time: '12:00 م',
    date: '2025-01-13',
    items: [
      { name: 'هاتف iPhone 15 Pro', quantity: 1, price: 2000 },
      { name: 'كفر حماية', quantity: 1, price: 100 },
    ]
  },
  { 
    id: 'INV_004', 
    customer: 'خالد عمر', 
    amount: 450, 
    currency: 'USD', 
    status: 'completed', 
    time: '01:30 م',
    date: '2025-01-13',
    items: [
      { name: 'شاشة حماية', quantity: 3, price: 150 },
    ]
  },
  { 
    id: 'INV_005', 
    customer: 'سارة يوسف', 
    amount: 1800, 
    currency: 'USD', 
    status: 'cancelled', 
    time: '02:45 م',
    date: '2025-01-13',
    items: [
      { name: 'تابلت iPad Air', quantity: 1, price: 1800 },
    ]
  },
];

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
    toast.success(`جاري طباعة الفاتورة ${invoice.id}`);
    // In real app, this would trigger print dialog
    window.print();
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
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>تفاصيل الفاتورة {selectedInvoice?.id}</span>
            </DialogTitle>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
