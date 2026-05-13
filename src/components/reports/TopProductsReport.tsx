import { useEffect, useMemo, useState } from 'react';
import { Trophy, Package } from 'lucide-react';
import { ReportShell } from './ReportShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadInvoicesCloud, type Invoice } from '@/lib/cloud/invoices-cloud';
import { loadProductsLocalFirst, type Product } from '@/lib/cloud/products-cloud';
import { exportGenericToExcel, exportGenericToPDF } from '@/lib/reports/dataset-builder';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

interface Props { dateRange: { from: string; to: string } }

type Mode = 'qty' | 'revenue' | 'profit';

export function TopProductsReport({ dateRange }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mode, setMode] = useState<Mode>('qty');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [inv, p] = await Promise.all([loadInvoicesCloud(), loadProductsLocalFirst()]);
        if (cancelled) return;
        setInvoices(inv); setProducts(p);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const ranking = useMemo(() => {
    const fromTs = new Date(dateRange.from + 'T00:00:00').getTime();
    const toTs = new Date(dateRange.to + 'T23:59:59').getTime();
    const map = new Map<string, { id: string; name: string; qty: number; revenue: number; cost: number; profit: number }>();
    invoices.forEach(inv => {
      const ts = new Date(inv.createdAt).getTime();
      if (ts < fromTs || ts > toTs) return;
      if (inv.status === 'cancelled' || inv.status === 'refunded') return;
      inv.items.forEach(it => {
        const p = products.find(x => x.id === it.id);
        const cost = (p?.costPrice || 0) * it.quantity;
        const revenue = it.price * it.quantity;
        const cur = map.get(it.id) || { id: it.id, name: it.name, qty: 0, revenue: 0, cost: 0, profit: 0 };
        cur.qty += it.quantity;
        cur.revenue += revenue;
        cur.cost += cost;
        cur.profit += revenue - cost;
        map.set(it.id, cur);
      });
    });
    const arr = Array.from(map.values());
    const key = mode === 'qty' ? 'qty' : mode === 'revenue' ? 'revenue' : 'profit';
    return arr.sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 50);
  }, [invoices, products, mode, dateRange.from, dateRange.to]);

  const handleExport = (kind: 'pdf' | 'excel') => {
    const opts = {
      title: `الأكثر ${mode === 'qty' ? 'مبيعاً' : mode === 'revenue' ? 'إيراداً' : 'ربحاً'}`,
      subtitle: `${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { key: 'name', label: 'المنتج' },
        { key: 'qty', label: 'الكمية' },
        { key: 'revenue', label: 'الإيراد' },
        { key: 'cost', label: 'التكلفة' },
        { key: 'profit', label: 'الربح' },
        { key: 'margin', label: 'الهامش %' },
      ],
      rows: ranking.map(r => ({
        ...r,
        margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) + '%' : '—',
      })),
      totals: {
        qty: ranking.reduce((s, r) => s + r.qty, 0),
        revenue: ranking.reduce((s, r) => s + r.revenue, 0),
        profit: ranking.reduce((s, r) => s + r.profit, 0),
      },
      fileName: `top-products-${mode}-${dateRange.to}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`,
    };
    if (kind === 'pdf') exportGenericToPDF(opts); else exportGenericToExcel(opts);
  };

  return (
    <ReportShell
      icon={<Trophy className="w-5 h-5" />}
      title="المنتجات الأكثر مبيعاً وربحية"
      subtitle="ترتيب المنتجات حسب الكمية، الإيراد أو الربح خلال الفترة"
      onExportPDF={() => handleExport('pdf')}
      onExportExcel={() => handleExport('excel')}
      exportDisabled={loading || ranking.length === 0}
      filters={
        <div className="flex gap-1.5">
          {([
            { id: 'qty', label: 'الأكثر كمية' },
            { id: 'revenue', label: 'الأكثر إيراداً' },
            { id: 'profit', label: 'الأكثر ربحاً' },
          ] as { id: Mode; label: string }[]).map(t => (
            <Button
              key={t.id}
              variant={mode === t.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode(t.id)}
              className="h-8 text-[11px] rounded-xl flex-1"
            >{t.label}</Button>
          ))}
        </div>
      }
    >
      {ranking.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          لا توجد مبيعات في هذه الفترة
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {ranking.map((r, idx) => {
              const margin = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
              return (
                <div key={r.id} className="flex items-center gap-2 p-2.5">
                  <div className={cn('w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold',
                    idx < 3 ? 'bg-amber-500/15 text-amber-700' : 'bg-muted text-muted-foreground')}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      كمية: {formatNumber(r.qty)} • إيراد: {formatCurrency(r.revenue)}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className={cn('text-xs font-bold', r.profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {formatCurrency(r.profit)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{margin.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}
    </ReportShell>
  );
}
