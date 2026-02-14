import { useMemo } from 'react';
import { FileText, Download, Users, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Invoice } from '@/lib/cloud/invoices-cloud';
import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';
import { toast } from 'sonner';

interface Props {
  dateRange: { from: string; to: string };
  invoices: Invoice[];
  isLoading: boolean;
}

export function CashierPerformanceReport({ dateRange, invoices, isLoading }: Props) {
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const data = useMemo(() => {
    const filtered = invoices.filter(inv => {
      const d = getLocalDateString(new Date(inv.createdAt));
      return d >= dateRange.from && d <= dateRange.to;
    });

    const cashierMap: Record<string, {
      name: string;
      invoiceCount: number;
      totalSales: number;
      totalProfit: number;
      cashSales: number;
      debtSales: number;
    }> = {};

    filtered.forEach(inv => {
      const name = inv.cashierName || 'غير محدد';
      if (!cashierMap[name]) {
        cashierMap[name] = { name, invoiceCount: 0, totalSales: 0, totalProfit: 0, cashSales: 0, debtSales: 0 };
      }
      cashierMap[name].invoiceCount += 1;
      cashierMap[name].totalSales += inv.total;
      cashierMap[name].totalProfit += inv.profit || 0;
      if (inv.paymentType === 'cash') cashierMap[name].cashSales += inv.total;
      else cashierMap[name].debtSales += inv.total;
    });

    return Object.values(cashierMap).sort((a, b) => b.totalSales - a.totalSales);
  }, [invoices, dateRange]);

  const totalSales = data.reduce((s, c) => s + c.totalSales, 0);
  const totalProfit = data.reduce((s, c) => s + c.totalProfit, 0);
  const totalInvoices = data.reduce((s, c) => s + c.invoiceCount, 0);

  const handleExportExcel = async () => {
    if (data.length === 0) { toast.error('لا توجد بيانات'); return; }
    await exportToExcel({
      sheetName: 'أداء الكاشير',
      fileName: `أداء_الكاشير_${dateRange.from}_${dateRange.to}.xlsx`,
      columns: [
        { header: 'الكاشير', key: 'name', width: 20 },
        { header: 'عدد الفواتير', key: 'invoiceCount', width: 12 },
        { header: 'إجمالي المبيعات', key: 'totalSales', width: 15 },
        { header: 'إجمالي الربح', key: 'totalProfit', width: 15 },
        { header: 'متوسط الفاتورة', key: 'avgInvoice', width: 15 },
        { header: 'مبيعات نقدية', key: 'cashSales', width: 15 },
        { header: 'مبيعات آجلة', key: 'debtSales', width: 15 },
      ],
      data: data.map(c => ({
        ...c,
        avgInvoice: c.invoiceCount > 0 ? Math.round(c.totalSales / c.invoiceCount) : 0,
      })),
      totals: { totalSales, totalProfit, invoiceCount: totalInvoices },
      title: 'تقرير أداء الكاشير',
      reportType: 'تقرير الأداء',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      summary: [
        { label: 'عدد الكاشيرات', value: data.length },
        { label: 'إجمالي المبيعات', value: totalSales },
        { label: 'إجمالي الأرباح', value: totalProfit },
        { label: 'إجمالي الفواتير', value: totalInvoices },
      ],
    });
    toast.success('تم تصدير Excel بنجاح');
  };

  const handleExportPDF = async () => {
    if (data.length === 0) { toast.error('لا توجد بيانات'); return; }
    await exportToPDF({
      title: 'تقرير أداء الكاشير',
      reportType: 'تقرير الأداء',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { header: 'الكاشير', key: 'name' },
        { header: 'الفواتير', key: 'invoiceCount' },
        { header: 'المبيعات', key: 'totalSales' },
        { header: 'الربح', key: 'totalProfit' },
        { header: 'متوسط الفاتورة', key: 'avgInvoice' },
      ],
      data: data.map(c => ({
        ...c,
        avgInvoice: c.invoiceCount > 0 ? Math.round(c.totalSales / c.invoiceCount) : 0,
      })),
      totals: { totalSales, totalProfit, invoiceCount: totalInvoices },
      summary: [
        { label: 'عدد الكاشيرات', value: data.length },
        { label: 'إجمالي المبيعات', value: totalSales },
        { label: 'إجمالي الأرباح', value: totalProfit },
      ],
      fileName: `أداء_الكاشير_${dateRange.from}_${dateRange.to}.pdf`,
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
          <Users className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{data.length}</p>
          <p className="text-xs text-muted-foreground">عدد الكاشيرات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <ShoppingCart className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{totalInvoices}</p>
          <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <DollarSign className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
          <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(totalProfit)}</p>
          <p className="text-xs text-muted-foreground">إجمالي الأرباح</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">لا توجد بيانات في الفترة المحددة</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-right">#</th>
                  <th className="p-3 text-right">الكاشير</th>
                  <th className="p-3 text-center">الفواتير</th>
                  <th className="p-3 text-center">المبيعات</th>
                  <th className="p-3 text-center">الربح</th>
                  <th className="p-3 text-center">متوسط الفاتورة</th>
                  <th className="p-3 text-center">نقدي</th>
                  <th className="p-3 text-center">آجل</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c, i) => (
                  <tr key={c.name} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-center">{c.invoiceCount}</td>
                    <td className="p-3 text-center font-medium">{formatCurrency(c.totalSales)}</td>
                    <td className="p-3 text-center text-green-600">{formatCurrency(c.totalProfit)}</td>
                    <td className="p-3 text-center">{formatCurrency(c.invoiceCount > 0 ? c.totalSales / c.invoiceCount : 0)}</td>
                    <td className="p-3 text-center">{formatCurrency(c.cashSales)}</td>
                    <td className="p-3 text-center text-amber-600">{formatCurrency(c.debtSales)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-bold">
                <tr>
                  <td className="p-3" colSpan={2}>الإجمالي</td>
                  <td className="p-3 text-center">{totalInvoices}</td>
                  <td className="p-3 text-center">{formatCurrency(totalSales)}</td>
                  <td className="p-3 text-center text-green-600">{formatCurrency(totalProfit)}</td>
                  <td className="p-3" colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Bar chart visualization */}
      {data.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h3 className="text-base font-semibold mb-4">مقارنة المبيعات</h3>
          <div className="space-y-3">
            {data.map((c, i) => {
              const maxSales = Math.max(...data.map(d => d.totalSales), 1);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm w-24 truncate font-medium">{c.name}</span>
                  <div className="flex-1 h-7 bg-muted/60 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-l from-primary to-primary/70 rounded-lg transition-all"
                      style={{ width: `${(c.totalSales / maxSales) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-20 text-left">{formatCurrency(c.totalSales)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
