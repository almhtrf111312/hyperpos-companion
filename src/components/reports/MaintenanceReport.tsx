import { useMemo } from 'react';
import { FileText, Download, Wrench, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Invoice } from '@/lib/cloud/invoices-cloud';
import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';
import { toast } from 'sonner';

interface Props {
  dateRange: { from: string; to: string };
  invoices: Invoice[];
  isLoading: boolean;
}

export function MaintenanceReport({ dateRange, invoices, isLoading }: Props) {
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const data = useMemo(() => {
    return invoices.filter(inv => {
      const d = getLocalDateString(new Date(inv.createdAt));
      return d >= dateRange.from && d <= dateRange.to && inv.type === 'maintenance';
    });
  }, [invoices, dateRange]);

  const stats = useMemo(() => {
    const totalRevenue = data.reduce((s, i) => s + i.total, 0);
    const totalProfit = data.reduce((s, i) => s + (i.profit || 0), 0);
    const totalPartsCost = data.reduce((s, i) => s + (i.partsCost || 0), 0);
    const cashCount = data.filter(i => i.paymentType === 'cash').length;
    const debtCount = data.filter(i => i.paymentType === 'debt').length;
    return { totalRevenue, totalProfit, totalPartsCost, cashCount, debtCount, count: data.length };
  }, [data]);

  const handleExportExcel = async () => {
    if (data.length === 0) { toast.error('لا توجد بيانات'); return; }
    await exportToExcel({
      sheetName: 'خدمات الصيانة',
      fileName: `صيانة_${dateRange.from}_${dateRange.to}.xlsx`,
      columns: [
        { header: 'العميل', key: 'customerName', width: 20 },
        { header: 'الوصف', key: 'serviceDescription', width: 30 },
        { header: 'سعر الخدمة', key: 'total', width: 12 },
        { header: 'تكلفة القطع', key: 'partsCost', width: 12 },
        { header: 'الربح', key: 'profit', width: 12 },
        { header: 'نوع الدفع', key: 'paymentLabel', width: 12 },
        { header: 'التاريخ', key: 'date', width: 12 },
      ],
      data: data.map(inv => ({
        customerName: inv.customerName,
        serviceDescription: inv.serviceDescription || '-',
        total: inv.total,
        partsCost: inv.partsCost || 0,
        profit: inv.profit || 0,
        paymentLabel: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
        date: getLocalDateString(new Date(inv.createdAt)),
      })),
      totals: { total: stats.totalRevenue, partsCost: stats.totalPartsCost, profit: stats.totalProfit },
      title: 'تقرير خدمات الصيانة',
      reportType: 'تقرير الصيانة',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      summary: [
        { label: 'عدد الخدمات', value: stats.count },
        { label: 'إجمالي الإيرادات', value: stats.totalRevenue },
        { label: 'تكلفة القطع', value: stats.totalPartsCost },
        { label: 'صافي الربح', value: stats.totalProfit },
      ],
    });
    toast.success('تم تصدير Excel بنجاح');
  };

  const handleExportPDF = async () => {
    if (data.length === 0) { toast.error('لا توجد بيانات'); return; }
    await exportToPDF({
      title: 'تقرير خدمات الصيانة',
      reportType: 'تقرير الصيانة',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { header: 'العميل', key: 'customerName' },
        { header: 'الوصف', key: 'serviceDescription' },
        { header: 'الإيراد', key: 'total' },
        { header: 'التكلفة', key: 'partsCost' },
        { header: 'الربح', key: 'profit' },
        { header: 'الدفع', key: 'paymentLabel' },
      ],
      data: data.map(inv => ({
        customerName: inv.customerName,
        serviceDescription: inv.serviceDescription || '-',
        total: inv.total,
        partsCost: inv.partsCost || 0,
        profit: inv.profit || 0,
        paymentLabel: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
      })),
      totals: { total: stats.totalRevenue, profit: stats.totalProfit },
      summary: [
        { label: 'عدد الخدمات', value: stats.count },
        { label: 'إجمالي الإيرادات', value: stats.totalRevenue },
        { label: 'صافي الربح', value: stats.totalProfit },
      ],
      fileName: `صيانة_${dateRange.from}_${dateRange.to}.pdf`,
      orientation: 'landscape',
    });
    toast.success('تم تصدير PDF بنجاح');
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="w-3.5 h-3.5 ml-1" />PDF</Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="w-3.5 h-3.5 ml-1" />Excel</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <Wrench className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{stats.count}</p>
          <p className="text-xs text-muted-foreground">عدد الخدمات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <DollarSign className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalProfit)}</p>
          <p className="text-xs text-muted-foreground">صافي الربح</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <CheckCircle className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold">{stats.cashCount} / {stats.debtCount}</p>
          <p className="text-xs text-muted-foreground">نقدي / آجل</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">لا توجد خدمات صيانة في الفترة المحددة</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-right">#</th>
                  <th className="p-3 text-right">العميل</th>
                  <th className="p-3 text-right">الوصف</th>
                  <th className="p-3 text-center">الإيراد</th>
                  <th className="p-3 text-center">التكلفة</th>
                  <th className="p-3 text-center">الربح</th>
                  <th className="p-3 text-center">الدفع</th>
                  <th className="p-3 text-center">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {data.map((inv, i) => (
                  <tr key={inv.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium">{inv.customerName}</td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate">{inv.serviceDescription || '-'}</td>
                    <td className="p-3 text-center">{formatCurrency(inv.total)}</td>
                    <td className="p-3 text-center text-red-500">{formatCurrency(inv.partsCost || 0)}</td>
                    <td className="p-3 text-center text-green-600 font-medium">{formatCurrency(inv.profit || 0)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${inv.paymentType === 'cash' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                        {inv.paymentType === 'cash' ? 'نقدي' : 'آجل'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{getLocalDateString(new Date(inv.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-bold">
                <tr>
                  <td className="p-3" colSpan={3}>الإجمالي</td>
                  <td className="p-3 text-center">{formatCurrency(stats.totalRevenue)}</td>
                  <td className="p-3 text-center text-red-500">{formatCurrency(stats.totalPartsCost)}</td>
                  <td className="p-3 text-center text-green-600">{formatCurrency(stats.totalProfit)}</td>
                  <td className="p-3" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
