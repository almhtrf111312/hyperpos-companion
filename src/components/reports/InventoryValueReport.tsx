import { useEffect, useMemo, useState } from 'react';
import { Wallet, Package, TrendingUp, Layers } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ReportShell } from './ReportShell';
import { Card, CardContent } from '@/components/ui/card';
import { loadProductsLocalFirst, refreshProductsFromCloud, type Product } from '@/lib/cloud/products-cloud';
import { exportGenericToExcel, exportGenericToPDF } from '@/lib/reports/dataset-builder';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

interface Props { dateRange: { from: string; to: string } }

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function InventoryValueReport({ dateRange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await loadProductsLocalFirst();
      if (!cancelled) { setProducts(p); setLoading(false); }
      refreshProductsFromCloud().then(f => { if (!cancelled) setProducts(f); }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const totalCost = products.reduce((s, p) => s + (p.quantity || 0) * (p.costPrice || 0), 0);
    const totalSale = products.reduce((s, p) => s + (p.quantity || 0) * (p.salePrice || 0), 0);
    const totalUnits = products.reduce((s, p) => s + (p.quantity || 0), 0);
    return { totalCost, totalSale, potentialProfit: totalSale - totalCost, totalUnits, skus: products.length };
  }, [products]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const c = p.category || 'بدون تصنيف';
      const v = (p.quantity || 0) * (p.costPrice || 0);
      map.set(c, (map.get(c) || 0) + v);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [products]);

  const handleExport = (kind: 'pdf' | 'excel') => {
    const opts = {
      title: 'تقرير قيمة العهدة',
      subtitle: `${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { key: 'name', label: 'التصنيف' },
        { key: 'value', label: 'قيمة العهدة (تكلفة)' },
      ],
      rows: byCategory,
      summary: [
        { label: 'إجمالي قيمة المخزون (تكلفة)', value: formatCurrency(stats.totalCost) },
        { label: 'قيمة بيع متوقعة', value: formatCurrency(stats.totalSale) },
        { label: 'الربح الكامن', value: formatCurrency(stats.potentialProfit) },
        { label: 'عدد القطع', value: formatNumber(stats.totalUnits) },
        { label: 'عدد الأصناف', value: formatNumber(stats.skus) },
      ],
      fileName: `inventory-value-${dateRange.to}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`,
    };
    if (kind === 'pdf') exportGenericToPDF(opts); else exportGenericToExcel(opts);
  };

  const KPI = ({ icon: Icon, label, value, color, bg }: { icon: typeof Wallet; label: string; value: string; color: string; bg: string }) => (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={cn('w-3.5 h-3.5', color)} />
        </div>
      </div>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </CardContent></Card>
  );

  return (
    <ReportShell
      icon={<Wallet className="w-5 h-5" />}
      title="تقرير قيمة العهدة"
      subtitle="رأس المال المجمد في البضاعة، الربح الكامن، توزيع القيمة على التصنيفات"
      onExportPDF={() => handleExport('pdf')}
      onExportExcel={() => handleExport('excel')}
      exportDisabled={loading}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPI icon={Wallet} label="قيمة العهدة (تكلفة)" value={formatCurrency(stats.totalCost)} color="text-primary" bg="bg-primary/10" />
        <KPI icon={TrendingUp} label="قيمة بيع متوقعة" value={formatCurrency(stats.totalSale)} color="text-emerald-600" bg="bg-emerald-500/10" />
        <KPI icon={TrendingUp} label="الربح الكامن" value={formatCurrency(stats.potentialProfit)} color="text-amber-600" bg="bg-amber-500/10" />
        <KPI icon={Package} label="القطع / الأصناف" value={`${formatNumber(stats.totalUnits)} / ${formatNumber(stats.skus)}`} color="text-blue-600" bg="bg-blue-500/10" />
      </div>

      {byCategory.length > 0 && (
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold">توزيع قيمة العهدة على التصنيفات</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}`} labelLine={false}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      )}
    </ReportShell>
  );
}
