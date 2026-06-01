import { useMemo, useState } from 'react';
import { ShoppingCart, Receipt, TrendingUp, Users } from 'lucide-react';
import { ReportShell } from './ReportShell';
import { EntityPicker, PickableEntity } from './EntityPicker';
import { Invoice } from '@/lib/cloud/invoices-cloud';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { toLocalDateString, isDateInRange } from '@/lib/date-utils';
import { exportGenericToPDF, exportGenericToExcel } from '@/lib/reports/dataset-builder';
import { toast } from 'sonner';

interface Props {
  invoices: Invoice[];
  dateRange: { from: string; to: string };
  cashierFilter: string;
  paymentFilter: string;
  statusFilter: string;
}

type ScopeMode = 'all' | 'customer' | 'cashier' | 'invoice';

export function SalesDetailedReport({ invoices, dateRange, cashierFilter, paymentFilter, statusFilter }: Props) {
  const [scope, setScope] = useState<ScopeMode>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const baseFiltered = useMemo(() => {
    return invoices.filter(inv => {
      const d = toLocalDateString(inv.createdAt);
      if (!isDateInRange(d, dateRange.from, dateRange.to)) return false;
      if (inv.type !== 'sale') return false;
      if (inv.status === 'refunded') return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (cashierFilter !== 'all' && (inv.cashierName || 'غير محدد') !== cashierFilter) return false;
      if (paymentFilter !== 'all' && inv.paymentType !== paymentFilter) return false;
      return true;
    });
  }, [invoices, dateRange, statusFilter, cashierFilter, paymentFilter]);

  const customers: PickableEntity[] = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    baseFiltered.forEach(inv => {
      const name = inv.customerName || 'زبون نقدي';
      const cur = m.get(name) || { name, total: 0, count: 0 };
      cur.total += inv.total;
      cur.count += 1;
      m.set(name, cur);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]) => ({ id, name: v.name, subtitle: `${v.count} فاتورة • ${formatCurrency(v.total)}` }));
  }, [baseFiltered]);

  const cashiers: PickableEntity[] = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    baseFiltered.forEach(inv => {
      const name = inv.cashierName || 'غير محدد';
      const cur = m.get(name) || { name, total: 0, count: 0 };
      cur.total += inv.total;
      cur.count += 1;
      m.set(name, cur);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]) => ({ id, name: v.name, subtitle: `${v.count} فاتورة • ${formatCurrency(v.total)}` }));
  }, [baseFiltered]);

  const invoicePicks: PickableEntity[] = useMemo(() => {
    return baseFiltered
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map(inv => ({
        id: inv.id,
        name: `فاتورة #${inv.invoiceNumber || inv.id.slice(0, 8)}`,
        subtitle: `${inv.customerName || 'نقدي'} • ${formatCurrency(inv.total)} • ${toLocalDateString(inv.createdAt)}`,
      }));
  }, [baseFiltered]);

  // Apply scope filtering
  const scoped = useMemo(() => {
    if (scope === 'all' || !selectedId) return baseFiltered;
    if (scope === 'customer') return baseFiltered.filter(i => (i.customerName || 'زبون نقدي') === selectedId);
    if (scope === 'cashier') return baseFiltered.filter(i => (i.cashierName || 'غير محدد') === selectedId);
    if (scope === 'invoice') return baseFiltered.filter(i => i.id === selectedId);
    return baseFiltered;
  }, [baseFiltered, scope, selectedId]);

  const stats = useMemo(() => {
    const totalSales = scoped.reduce((s, i) => s + i.total, 0);
    const totalProfit = scoped.reduce((s, i) => s + (i.profit || 0), 0);
    const totalDiscount = scoped.reduce((s, i) => s + (i.discount || 0), 0);
    const cashTotal = scoped.filter(i => i.paymentType === 'cash').reduce((s, i) => s + i.total, 0);
    const debtTotal = scoped.filter(i => i.paymentType === 'debt').reduce((s, i) => s + i.total, 0);
    const avg = scoped.length > 0 ? totalSales / scoped.length : 0;
    return { count: scoped.length, totalSales, totalProfit, totalDiscount, cashTotal, debtTotal, avg };
  }, [scoped]);

  const rows = useMemo(() => scoped
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(inv => ({
      number: inv.invoiceNumber || inv.id.slice(0, 8),
      date: toLocalDateString(inv.createdAt),
      customer: inv.customerName || 'زبون نقدي',
      cashier: inv.cashierName || 'غير محدد',
      payment: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
      items: inv.items?.length || 0,
      discount: inv.discount || 0,
      profit: inv.profit || 0,
      total: inv.total,
    })), [scoped]);

  const handleExport = async (kind: 'pdf' | 'excel') => {
    if (rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const scopeLabel = scope === 'all' ? 'الكل' : selectedId || '';
    const opts = {
      title: 'تقرير المبيعات التفصيلي',
      subtitle: `${dateRange.from} → ${dateRange.to} • ${scopeLabel}`,
      sheetName: 'مبيعات',
      columns: [
        { key: 'number', label: 'رقم الفاتورة' },
        { key: 'date', label: 'التاريخ' },
        { key: 'customer', label: 'العميل' },
        { key: 'cashier', label: 'الكاشير' },
        { key: 'payment', label: 'الدفع' },
        { key: 'items', label: 'الأصناف' },
        { key: 'discount', label: 'الخصم' },
        { key: 'profit', label: 'الربح' },
        { key: 'total', label: 'الإجمالي' },
      ],
      rows,
      totals: { discount: stats.totalDiscount, profit: stats.totalProfit, total: stats.totalSales },
      summary: [
        { label: 'عدد الفواتير', value: stats.count },
        { label: 'إجمالي المبيعات', value: formatCurrency(stats.totalSales) },
        { label: 'إجمالي الأرباح', value: formatCurrency(stats.totalProfit) },
        { label: 'متوسط الفاتورة', value: formatCurrency(stats.avg) },
      ],
      fileName: `sales_detailed_${dateRange.from}_${dateRange.to}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`,
    };
    if (kind === 'pdf') await exportGenericToPDF(opts); else await exportGenericToExcel(opts);
    toast.success(`تم تصدير ${kind === 'pdf' ? 'PDF' : 'Excel'} بنجاح`);
  };

  const pickerItems = scope === 'customer' ? customers : scope === 'cashier' ? cashiers : scope === 'invoice' ? invoicePicks : [];

  return (
    <ReportShell
      icon={<ShoppingCart className="w-5 h-5" />}
      title="تقرير المبيعات التفصيلي"
      subtitle={`من ${dateRange.from} إلى ${dateRange.to}`}
      onExportPDF={() => handleExport('pdf')}
      onExportExcel={() => handleExport('excel')}
      exportDisabled={rows.length === 0}
      filters={
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { id: 'all', label: 'الكل' },
              { id: 'customer', label: 'حسب العميل' },
              { id: 'cashier', label: 'حسب الكاشير' },
              { id: 'invoice', label: 'فاتورة محددة' },
            ] as { id: ScopeMode; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => { setScope(opt.id); setSelectedId(null); }}
                className={`text-[11px] py-1.5 rounded-lg border transition-colors ${
                  scope === opt.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                }`}
              >{opt.label}</button>
            ))}
          </div>
          {scope !== 'all' && (
            <EntityPicker
              label={scope === 'customer' ? 'اختر العميل' : scope === 'cashier' ? 'اختر الكاشير' : 'اختر الفاتورة'}
              placeholder="اضغط للاختيار..."
              items={pickerItems}
              value={selectedId}
              onChange={setSelectedId}
            />
          )}
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi icon={<Receipt className="w-4 h-4" />} label="الفواتير" value={formatNumber(stats.count)} color="text-blue-500" />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="المبيعات" value={formatCurrency(stats.totalSales)} color="text-emerald-500" />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="الأرباح" value={formatCurrency(stats.totalProfit)} color="text-green-500" />
        <Kpi icon={<Users className="w-4 h-4" />} label="متوسط الفاتورة" value={formatCurrency(stats.avg)} color="text-violet-500" />
      </div>

      {/* Cash vs Debt */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/40 bg-card p-3">
          <p className="text-[11px] text-muted-foreground">نقدي</p>
          <p className="text-sm font-bold text-emerald-600">{formatCurrency(stats.cashTotal)}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card p-3">
          <p className="text-[11px] text-muted-foreground">آجل</p>
          <p className="text-sm font-bold text-amber-600">{formatCurrency(stats.debtTotal)}</p>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">لا توجد فواتير ضمن الفلاتر الحالية</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-right">الفاتورة</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">العميل</th>
                  <th className="p-2 text-right">الكاشير</th>
                  <th className="p-2 text-center">الدفع</th>
                  <th className="p-2 text-center">الأصناف</th>
                  <th className="p-2 text-center">الربح</th>
                  <th className="p-2 text-center">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="p-2 font-mono">#{r.number}</td>
                    <td className="p-2 text-muted-foreground">{r.date}</td>
                    <td className="p-2">{r.customer}</td>
                    <td className="p-2 text-muted-foreground">{r.cashier}</td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.payment === 'نقدي' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>{r.payment}</span>
                    </td>
                    <td className="p-2 text-center">{r.items}</td>
                    <td className="p-2 text-center text-green-600">{formatCurrency(r.profit)}</td>
                    <td className="p-2 text-center font-bold">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-bold">
                <tr>
                  <td className="p-2" colSpan={6}>الإجمالي ({stats.count} فاتورة)</td>
                  <td className="p-2 text-center text-green-600">{formatCurrency(stats.totalProfit)}</td>
                  <td className="p-2 text-center">{formatCurrency(stats.totalSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length > 200 && (
            <p className="text-center text-[10px] text-muted-foreground py-2 border-t border-border/40">
              يعرض أول 200 من {rows.length} • قم بالتصدير لرؤية الكامل
            </p>
          )}
        </div>
      )}
    </ReportShell>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-2.5">
      <div className={`flex items-center gap-1 ${color}`}>{icon}<span className="text-[10px] text-muted-foreground">{label}</span></div>
      <p className="text-sm font-bold mt-1 truncate">{value}</p>
    </div>
  );
}
