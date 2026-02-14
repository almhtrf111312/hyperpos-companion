import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { loadDebtsCloud, Debt } from '@/lib/cloud/debts-cloud';
import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';
import { toast } from 'sonner';

interface Props {
  dateRange: { from: string; to: string };
}

export function DebtsReport({ dateRange }: Props) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDebtsCloud().then(data => {
      setDebts(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return debts.filter(d => {
      const date = d.createdAt?.split('T')[0] || '';
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [debts, dateRange]);

  const stats = useMemo(() => {
    const totalDebt = filtered.reduce((s, d) => s + d.totalDebt, 0);
    const totalPaid = filtered.reduce((s, d) => s + d.totalPaid, 0);
    const totalRemaining = filtered.reduce((s, d) => s + d.remainingDebt, 0);
    const overdue = filtered.filter(d => d.status === 'overdue').length;
    const fullyPaid = filtered.filter(d => d.status === 'fully_paid').length;
    const partial = filtered.filter(d => d.status === 'partially_paid').length;
    const due = filtered.filter(d => d.status === 'due').length;
    return { totalDebt, totalPaid, totalRemaining, overdue, fullyPaid, partial, due, count: filtered.length };
  }, [filtered]);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'fully_paid': return 'مسدد';
      case 'partially_paid': return 'مسدد جزئياً';
      case 'overdue': return 'متأخر';
      default: return 'مستحق';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'fully_paid': return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
      case 'partially_paid': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
      case 'overdue': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    }
  };

  const handleExportExcel = async () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    await exportToExcel({
      sheetName: 'الديون',
      fileName: `تقرير_ديون_${dateRange.from}_${dateRange.to}.xlsx`,
      columns: [
        { header: 'العميل', key: 'customerName', width: 20 },
        { header: 'الهاتف', key: 'customerPhone', width: 15 },
        { header: 'إجمالي الدين', key: 'totalDebt', width: 12 },
        { header: 'المدفوع', key: 'totalPaid', width: 12 },
        { header: 'المتبقي', key: 'remainingDebt', width: 12 },
        { header: 'الحالة', key: 'status_label', width: 12 },
        { header: 'التاريخ', key: 'date', width: 12 },
      ],
      data: filtered.map(d => ({
        customerName: d.customerName,
        customerPhone: d.customerPhone || '-',
        totalDebt: d.totalDebt,
        totalPaid: d.totalPaid,
        remainingDebt: d.remainingDebt,
        status_label: statusLabel(d.status),
        date: d.createdAt?.split('T')[0] || '',
      })),
      totals: { totalDebt: stats.totalDebt, totalPaid: stats.totalPaid, remainingDebt: stats.totalRemaining },
      title: 'تقرير الديون',
      reportType: 'تقرير الديون',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      summary: [
        { label: 'عدد الديون', value: stats.count },
        { label: 'إجمالي الديون', value: stats.totalDebt },
        { label: 'المدفوع', value: stats.totalPaid },
        { label: 'المتبقي', value: stats.totalRemaining },
      ],
    });
    toast.success('تم تصدير Excel بنجاح');
  };

  const handleExportPDF = async () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    await exportToPDF({
      title: 'تقرير الديون',
      reportType: 'تقرير الديون',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { header: 'العميل', key: 'customerName' },
        { header: 'الهاتف', key: 'customerPhone' },
        { header: 'إجمالي الدين', key: 'totalDebt' },
        { header: 'المدفوع', key: 'totalPaid' },
        { header: 'المتبقي', key: 'remainingDebt' },
        { header: 'الحالة', key: 'status_label' },
      ],
      data: filtered.map(d => ({
        customerName: d.customerName,
        customerPhone: d.customerPhone || '-',
        totalDebt: d.totalDebt,
        totalPaid: d.totalPaid,
        remainingDebt: d.remainingDebt,
        status_label: statusLabel(d.status),
      })),
      totals: { totalDebt: stats.totalDebt, totalPaid: stats.totalPaid, remainingDebt: stats.totalRemaining },
      summary: [
        { label: 'عدد الديون', value: stats.count },
        { label: 'إجمالي الديون', value: stats.totalDebt },
        { label: 'المتبقي', value: stats.totalRemaining },
      ],
      fileName: `تقرير_ديون_${dateRange.from}_${dateRange.to}.pdf`,
      orientation: 'landscape',
    });
    toast.success('تم تصدير PDF بنجاح');
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="w-3.5 h-3.5 ml-1" />PDF</Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="w-3.5 h-3.5 ml-1" />Excel</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <DollarSign className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalRemaining)}</p>
          <p className="text-xs text-muted-foreground">الديون المتبقية</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-xs text-muted-foreground">المدفوع</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold">{stats.overdue}</p>
          <p className="text-xs text-muted-foreground">متأخرة</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <Clock className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold">{stats.count}</p>
          <p className="text-xs text-muted-foreground">إجمالي الديون</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">لا توجد ديون في الفترة المحددة</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-right">العميل</th>
                  <th className="p-3 text-right">الهاتف</th>
                  <th className="p-3 text-center">إجمالي الدين</th>
                  <th className="p-3 text-center">المدفوع</th>
                  <th className="p-3 text-center">المتبقي</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{d.customerName}</td>
                    <td className="p-3 text-muted-foreground">{d.customerPhone || '-'}</td>
                    <td className="p-3 text-center">{formatCurrency(d.totalDebt)}</td>
                    <td className="p-3 text-center text-green-600">{formatCurrency(d.totalPaid)}</td>
                    <td className="p-3 text-center font-bold text-red-600">{formatCurrency(d.remainingDebt)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(d.status)}`}>
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{d.createdAt?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-bold">
                <tr>
                  <td className="p-3" colSpan={2}>الإجمالي</td>
                  <td className="p-3 text-center">{formatCurrency(stats.totalDebt)}</td>
                  <td className="p-3 text-center text-green-600">{formatCurrency(stats.totalPaid)}</td>
                  <td className="p-3 text-center text-red-600">{formatCurrency(stats.totalRemaining)}</td>
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
