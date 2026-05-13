import { useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardCheck, Save, X, AlertTriangle } from 'lucide-react';
import { ReportShell } from './ReportShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { loadProductsLocalFirst, refreshProductsFromCloud, type Product } from '@/lib/cloud/products-cloud';
import { loadWarehousesCloud, type Warehouse } from '@/lib/cloud/warehouses-cloud';
import { saveStockCount, listStockCounts, type StockCount } from '@/lib/cloud/stock-counts-cloud';
import { exportGenericToExcel, exportGenericToPDF } from '@/lib/reports/dataset-builder';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props { dateRange: { from: string; to: string } }

export function InventoryStockReport({ dateRange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [history, setHistory] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Stock count session
  const [counting, setCounting] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, w, h] = await Promise.all([
          loadProductsLocalFirst(),
          loadWarehousesCloud(),
          listStockCounts(),
        ]);
        if (cancelled) return;
        setProducts(p); setWarehouses(w); setHistory(h);
        refreshProductsFromCloud().then(f => { if (!cancelled) setProducts(f); }).catch(() => {});
      } catch { toast.error('تعذر تحميل المخزون'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.barcode || '').toLowerCase().includes(s) ||
      (p.category || '').toLowerCase().includes(s)
    );
  }, [products, search]);

  const totalVarianceValue = useMemo(() => {
    return Object.entries(actuals).reduce((sum, [pid, actual]) => {
      const p = products.find(x => x.id === pid);
      if (!p) return sum;
      const variance = actual - (p.quantity || 0);
      return sum + variance * (p.costPrice || 0);
    }, 0);
  }, [actuals, products]);

  const handleStartCount = () => {
    setCounting(true);
    setActuals({});
    setNotes('');
  };
  const handleCancelCount = () => { setCounting(false); setActuals({}); };

  const handleSaveCount = async (status: 'draft' | 'completed') => {
    setSaving(true);
    try {
      const items = Object.entries(actuals)
        .filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(v))
        .map(([pid, actual]) => {
          const p = products.find(x => x.id === pid)!;
          const expected = p.quantity || 0;
          const variance = actual - expected;
          return {
            product_id: pid,
            product_name: p.name,
            expected_qty: expected,
            actual_qty: actual,
            variance,
            unit_cost: p.costPrice || 0,
            variance_value: variance * (p.costPrice || 0),
          };
        });
      if (items.length === 0) { toast.error('أدخل قيم الجرد لمنتج واحد على الأقل'); return; }
      const id = await saveStockCount({
        warehouse_id: warehouseId,
        notes,
        status,
        items,
        applyAdjustments: status === 'completed',
      });
      if (id) {
        toast.success(status === 'completed' ? 'تم حفظ الجرد وتسوية المخزون' : 'تم حفظ الجرد كمسودة');
        setCounting(false); setActuals({});
        const [p, h] = await Promise.all([refreshProductsFromCloud(), listStockCounts()]);
        setProducts(p); setHistory(h);
      } else toast.error('تعذر حفظ الجرد');
    } finally { setSaving(false); }
  };

  const handleExport = (kind: 'pdf' | 'excel') => {
    const rows = filtered.map(p => ({
      name: p.name,
      barcode: p.barcode || '-',
      category: p.category || '-',
      quantity: p.quantity || 0,
      cost: p.costPrice || 0,
      value: (p.quantity || 0) * (p.costPrice || 0),
    }));
    const totals = {
      quantity: rows.reduce((s, r) => s + r.quantity, 0),
      value: rows.reduce((s, r) => s + r.value, 0),
    };
    const opts = {
      title: 'تقرير المخزون والجرد',
      subtitle: `${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { key: 'name', label: 'المنتج' },
        { key: 'barcode', label: 'الباركود' },
        { key: 'category', label: 'التصنيف' },
        { key: 'quantity', label: 'الرصيد' },
        { key: 'cost', label: 'تكلفة الوحدة' },
        { key: 'value', label: 'قيمة المخزون' },
      ],
      rows, totals,
      fileName: `inventory-stock-${dateRange.to}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`,
    };
    if (kind === 'pdf') exportGenericToPDF(opts); else exportGenericToExcel(opts);
  };

  return (
    <ReportShell
      icon={<Boxes className="w-5 h-5" />}
      title="تقرير المخزون والجرد"
      subtitle="عرض الكميات الحالية وإجراء جرد فعلي مع تسوية تلقائية"
      onExportPDF={() => handleExport('pdf')}
      onExportExcel={() => handleExport('excel')}
      exportDisabled={loading || filtered.length === 0}
      filters={
        <div className="space-y-2">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم، الباركود، التصنيف..." className="h-9 text-sm" />
          {warehouses.length > 0 && (
            <select
              value={warehouseId || ''}
              onChange={e => setWarehouseId(e.target.value || null)}
              className="w-full h-9 text-sm rounded-xl border border-border bg-card px-3"
            >
              <option value="">كل المستودعات</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
        </div>
      }
    >
      {!counting ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartCount} className="h-9 text-xs rounded-xl gap-1.5">
              <ClipboardCheck className="w-4 h-4" /> بدء جرد فعلي
            </Button>
            <div className="text-[11px] text-muted-foreground self-center">
              إجمالي الأصناف: {formatNumber(filtered.length)} • إجمالي القيمة: {formatCurrency(filtered.reduce((s, p) => s + (p.quantity || 0) * (p.costPrice || 0), 0))}
            </div>
          </div>

          <Card><CardContent className="p-0">
            <div className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
              {filtered.slice(0, 200).map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.barcode || '—'} • {p.category || '—'}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className={cn('text-xs font-bold', (p.quantity || 0) <= (p.minStockLevel || 0) ? 'text-red-600' : 'text-foreground')}>
                      {formatNumber(p.quantity || 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatCurrency((p.quantity || 0) * (p.costPrice || 0))}</p>
                  </div>
                </div>
              ))}
              {filtered.length > 200 && (
                <p className="text-[10px] text-center text-muted-foreground py-2">عرض 200 / {filtered.length} — استخدم البحث للتدقيق</p>
              )}
            </div>
          </CardContent></Card>

          {history.length > 0 && (
            <Card><CardContent className="p-3">
              <p className="text-xs font-bold mb-2">عمليات الجرد السابقة</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history.slice(0, 20).map(h => (
                  <div key={h.id} className="flex items-center justify-between text-[11px] py-1 border-b border-border/30 last:border-0">
                    <span>{new Date(h.created_at).toLocaleDateString('en-GB')} • {h.items_count} صنف</span>
                    <span className={cn('font-semibold', h.total_variance_value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {h.total_variance_value >= 0 ? '+' : ''}{formatCurrency(h.total_variance_value)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </>
      ) : (
        <>
          <Card><CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">جلسة جرد فعلي</p>
              <Button variant="ghost" size="sm" onClick={handleCancelCount} className="h-7 text-[11px]">
                <X className="w-3.5 h-3.5 ml-1" /> إلغاء
              </Button>
            </div>
            <div className={cn('flex items-center gap-2 text-xs rounded-lg p-2', totalVarianceValue < 0 ? 'bg-red-500/10 text-red-700' : totalVarianceValue > 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted/50 text-muted-foreground')}>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>إجمالي قيمة الفروقات: <strong>{formatCurrency(totalVarianceValue)}</strong></span>
            </div>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات الجرد (اختياري)" className="h-16 text-xs" />
          </CardContent></Card>

          <Card><CardContent className="p-0">
            <div className="divide-y divide-border/40 max-h-[55vh] overflow-y-auto">
              {filtered.slice(0, 200).map(p => {
                const expected = p.quantity || 0;
                const actual = actuals[p.id];
                const variance = (actual ?? expected) - expected;
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">رصيد: {formatNumber(expected)}</p>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={actual ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : Number(e.target.value);
                        setActuals(prev => {
                          const next = { ...prev };
                          if (v === undefined) delete next[p.id]; else next[p.id] = v;
                          return next;
                        });
                      }}
                      placeholder={String(expected)}
                      className="h-8 w-20 text-xs text-center"
                    />
                    <span className={cn('text-xs font-bold w-12 text-center', variance < 0 ? 'text-red-600' : variance > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                      {actual === undefined ? '—' : (variance > 0 ? '+' : '') + formatNumber(variance)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent></Card>

          <div className="flex gap-2 sticky bottom-0 bg-background/85 backdrop-blur py-2">
            <Button variant="outline" disabled={saving} onClick={() => handleSaveCount('draft')} className="flex-1 h-9 text-xs rounded-xl">
              حفظ كمسودة
            </Button>
            <Button disabled={saving} onClick={() => handleSaveCount('completed')} className="flex-1 h-9 text-xs rounded-xl gap-1.5">
              <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : 'إغلاق وتسوية'}
            </Button>
          </div>
        </>
      )}
    </ReportShell>
  );
}
