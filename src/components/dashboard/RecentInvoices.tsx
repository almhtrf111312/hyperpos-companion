import { Eye, Printer, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceRow {
  id: string;
  customer: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'cancelled';
  time: string;
}

const mockInvoices: InvoiceRow[] = [
  { id: 'INV_001', customer: 'محمد أحمد', amount: 1250, currency: 'USD', status: 'completed', time: '10:30 ص' },
  { id: 'INV_002', customer: 'علي حسن', amount: 850, currency: 'USD', status: 'completed', time: '11:15 ص' },
  { id: 'INV_003', customer: 'فاطمة محمود', amount: 2100, currency: 'USD', status: 'pending', time: '12:00 م' },
  { id: 'INV_004', customer: 'خالد عمر', amount: 450, currency: 'USD', status: 'completed', time: '01:30 م' },
  { id: 'INV_005', customer: 'سارة يوسف', amount: 1800, currency: 'USD', status: 'cancelled', time: '02:45 م' },
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
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">آخر الفواتير</h3>
          <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
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
                  "border-b border-border/50 hover:bg-muted/30 transition-colors fade-in",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
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
                <td className="py-4 px-6">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
