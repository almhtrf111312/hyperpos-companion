import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Package, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { loadPurchaseInvoicesCloud, PurchaseInvoice } from '@/lib/cloud/purchase-invoices-cloud';
import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';
import { toast } from 'sonner';

interface Props {
  dateRange: { from: string; to: string };
}

export function PurchaseInvoicesReport({ dateRange }: Props) {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPurchaseInvoicesCloud().then(data => {
      setInvoices(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.invoice_date;
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [invoices, dateRange]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, i) => s + (i.actual_grand_total || 0), 0);
    const expected = filtered.reduce((s, i) => s + i.expected_grand_total, 0);
    const finalized = filtered.filter(i => i.status === 'finalized').length;
    const draft = filtered.filter(i => i.status === 'draft').length;
    return { total, expected, finalized, draft, count: filtered.length };
  }, [filtered]);

  const handleExportExcel = async () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    await exportToExcel({
      sheetName: 'فواتير المشتريات',
      fileName: `فواتير_مشتريات_${dateRange.from}_${dateRange.to}.xlsx`,
      columns: [
        { header: 'رقم الفاتورة', key: 'invoice_number', width: 15 },
        { header: 'المورد', key: 'supplier_name', width: 20 },
        { header: 'الشركة', key: 'supplier_company', width: 20 },
        { header: 'التاريخ', key: 'invoice_date', width: 12 },
        { header: 'عدد الأصناف', key: 'actual_items_count', width: 12 },
        { header: 'الكمية', key: 'actual_total_quantity', width: 12 },
        { header: 'الإجمالي الفعلي', key: 'actual_grand_total', width: 15 },
        { header: 'الإجمالي المتوقع', key: 'expected_grand_total', width: 15 },
        { header: 'الحالة', key: 'status_label', width: 12 },
      ],
      data: filtered.map(inv => ({
        ...inv,
        supplier_company: inv.supplier_company || '-',
        status_label: inv.status === 'finalized' ? 'مؤكدة' : inv.status === 'reconciled' ? 'مراجعة' : 'مسودة',
      })),
      totals: { actual_grand_total: stats.total, expected_grand_total: stats.expected },
      title: 'تقرير فواتير المشتريات',
      reportType: 'تقرير المشتريات',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      summary: [
        { label: 'عدد الفواتير', value: stats.count },
        { label: 'الإجمالي الفعلي', value: stats.total },
        { label: 'الإجمالي المتوقع', value: stats.expected },
        { label: 'فواتير مؤكدة', value: stats.finalized },
        { label: 'مسودات', value: stats.draft },
      ],
    });
    toast.success('تم تصدير Excel بنجاح');
  };

  const handleExportPDF = async () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    await exportToPDF({
      title: 'تقرير فواتير المشتريات',
      reportType: 'تقرير المشتريات',
      subtitle: `من ${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { header: 'رقم الفاتورة', key: 'invoice_number' },
        { header: 'المورد', key: 'supplier_name' },
        { header: 'التاريخ', key: 'invoice_date' },
        { header: 'الأصناف', key: 'actual_items_count' },
        { header: 'الإجمالي', key: 'actual_grand_total' },
        { header: 'الحالة', key: 'status_label' },
      ],
      data: filtered.map(inv => ({
        ...inv,
        status_label: inv.status === 'finalized' ? 'مؤكدة' : inv.status === 'reconciled' ? 'مراجعة' : 'مسودة',
      })),
      totals: { actual_grand_total: stats.total },
      summary: [
        { label: 'عدد الفواتير', value: stats.count },
        { label: 'الإجمالي الفعلي', value: stats.total },
        { label: 'فواتير مؤكدة', value: stats.finalized },
      ],
      fileName: `فواتير_مشتريات_${dateRange.from}_${dateRange.to}.pdf`,
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
          <Package className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{stats.count}</p>
          <p className="text-xs text-muted-foreground">عدد الفواتير</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <DollarSign className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
          <p className="text-xs text-muted-foreground">الإجمالي الفعلي</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{stats.finalized}</p>
          <p className="text-xs text-muted-foreground">فواتير مؤكدة</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <Clock className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold">{stats.draft}</p>
          <p className="text-xs text-muted-foreground">مسودات</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">لا توجد فواتير مشتريات في الفترة المحددة</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-right">رقم الفاتورة</th>
                  <th className="p-3 text-right">المورد</th>
                  <th className="p-3 text-center">التاريخ</th>
                  <th className="p-3 text-center">الأصناف</th>
                  <th className="p-3 text-center">الكمية</th>
                  <th className="p-3 text-center">الإجمالي</th>
                  <th className="p-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="p-3 font-medium">{inv.supplier_name}</td>
                    <td className="p-3 text-center">{inv.invoice_date}</td>
                    <td className="p-3 text-center">{inv.actual_items_count}</td>
                    <td className="p-3 text-center">{inv.actual_total_quantity}</td>
                    <td className="p-3 text-center font-medium">{formatCurrency(inv.actual_grand_total || 0)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === 'finalized' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                        inv.status === 'reconciled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}>
                        {inv.status === 'finalized' ? 'مؤكدة' : inv.status === 'reconciled' ? 'مراجعة' : 'مسودة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-bold">
                <tr>
                  <td className="p-3" colSpan={5}>الإجمالي</td>
                  <td className="p-3 text-center">{formatCurrency(stats.total)}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
