import { useEffect, useMemo, useState } from 'react';
import { Activity, Package, ArrowDown, ArrowUp, RotateCcw, Trash2 } from 'lucide-react';
import { ReportShell } from './ReportShell';
import { EntityPicker } from './EntityPicker';
import { Card, CardContent } from '@/components/ui/card';
import { loadProductsLocalFirst, refreshProductsFromCloud, type Product } from '@/lib/cloud/products-cloud';
import { loadInvoicesCloud, type Invoice } from '@/lib/cloud/invoices-cloud';
import { listStockDamages, type StockDamage } from '@/lib/cloud/stock-damages-cloud';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { exportGenericToExcel, exportGenericToPDF } from '@/lib/reports/dataset-builder';
import { toast } from 'sonner';

interface MovementRow {
  date: string;
  type: 'purchase' | 'sale' | 'refund' | 'damage';
  qty: number;
  unitPrice: number;
  total: number;
  reference: string;
  cashier?: string;
}

interface Props {
  dateRange: { from: string; to: string };
}

const TYPE_META: Record<MovementRow['type'], { label: string; icon: typeof ArrowDown; color: string; bg: string }> = {
  purchase: { label: 'شراء', icon: ArrowDown, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  sale:     { label: 'بيع', icon: ArrowUp, color: 'text-blue-600', bg: 'bg-blue-500/10' },
  refund:   { label: 'مرتجع', icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  damage:   { label: 'إتلاف', icon: Trash2, color: 'text-red-600', bg: 'bg-red-500/10' },
};

export function ProductMovementReport({ dateRange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [damages, setDamages] = useState<StockDamage[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, inv, dmg] = await Promise.all([
          loadProductsLocalFirst(),
          loadInvoicesCloud(),
          listStockDamages({ from: dateRange.from, to: dateRange.to + 'T23:59:59' }),
        ]);
        if (cancelled) return;
        setProducts(p);
        setInvoices(inv);
        setDamages(dmg);
        refreshProductsFromCloud().then(fresh => { if (!cancelled) setProducts(fresh); }).catch(() => {});
      } catch (e) {
        console.error(e);
        toast.error('تعذر تحميل بيانات الحركة');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dateRange.from, dateRange.to]);

  const product = useMemo(() => products.find(p => p.id === productId) || null, [products, productId]);

  const movements = useMemo<MovementRow[]>(() => {
    if (!product) return [];
    const rows: MovementRow[] = [];
    const fromTs = new Date(dateRange.from + 'T00:00:00').getTime();
    const toTs = new Date(dateRange.to + 'T23:59:59').getTime();

    // 1) Purchases from product.purchaseHistory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pHist: any[] = (product as any).purchaseHistory || (product as any).purchase_history || [];
    pHist.forEach((h, idx) => {
      const ts = new Date(h.date || h.created_at || 0).getTime();
      if (!ts || ts < fromTs || ts > toTs) return;
      const qty = Number(h.quantity || 0);
      const cost = Number(h.cost_price || h.costPrice || h.unit_cost || 0);
      rows.push({
        date: h.date || h.created_at,
        type: 'purchase',
        qty,
        unitPrice: cost,
        total: qty * cost,
        reference: h.invoice_number || h.invoiceNumber || `شراء #${idx + 1}`,
      });
    });

    // 2) Sales / refunds from invoices
    invoices.forEach(inv => {
      const ts = new Date(inv.createdAt).getTime();
      if (ts < fromTs || ts > toTs) return;
      if (inv.status === 'cancelled') return;
      inv.items.forEach(it => {
        if (it.id !== product.id) return;
        const isRefund = inv.status === 'refunded';
        rows.push({
          date: inv.createdAt,
          type: isRefund ? 'refund' : 'sale',
          qty: it.quantity,
          unitPrice: it.price,
          total: it.quantity * it.price,
          reference: `فاتورة ${inv.id.slice(0, 8)}`,
          cashier: inv.cashierName || undefined,
        });
      });
    });

    // 3) Damages
    damages.forEach(d => {
      if (d.product_id !== product.id) return;
      rows.push({
        date: d.damaged_at,
        type: 'damage',
        qty: d.quantity,
        unitPrice: d.unit_cost,
        total: d.cost_value,
        reference: d.reason || 'إتلاف',
      });
    });

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [product, invoices, damages, dateRange.from, dateRange.to]);

  const summary = useMemo(() => {
    const incoming = movements.filter(m => m.type === 'purchase').reduce((s, m) => s + m.qty, 0);
    const outgoing = movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.qty, 0);
    const refunded = movements.filter(m => m.type === 'refund').reduce((s, m) => s + m.qty, 0);
    const damaged = movements.filter(m => m.type === 'damage').reduce((s, m) => s + m.qty, 0);
    const profit = movements.filter(m => m.type === 'sale').reduce((s, m) => {
      const cost = Number(product?.costPrice || 0);
      return s + (m.unitPrice - cost) * m.qty;
    }, 0) - movements.filter(m => m.type === 'refund').reduce((s, m) => {
      const cost = Number(product?.costPrice || 0);
      return s + (m.unitPrice - cost) * m.qty;
    }, 0);
    return { incoming, outgoing, refunded, damaged, net: incoming - outgoing + refunded - damaged, profit };
  }, [movements, product]);

  const handleExportPDF = () => {
    if (!product) return;
    exportGenericToPDF({
      title: `حركة المنتج - ${product.name}`,
      subtitle: `${dateRange.from} إلى ${dateRange.to}`,
      columns: [
        { key: 'date', label: 'التاريخ' },
        { key: 'typeLabel', label: 'النوع' },
        { key: 'qty', label: 'الكمية' },
        { key: 'unitPrice', label: 'السعر' },
        { key: 'total', label: 'الإجمالي' },
        { key: 'reference', label: 'المرجع' },
      ],
      rows: movements.map(m => ({
        ...m,
        typeLabel: TYPE_META[m.type].label,
        date: new Date(m.date).toLocaleString('en-GB'),
      })),
      fileName: `product-movement-${product.name}-${dateRange.from}.pdf`,
    });
  };

  const handleExportExcel = () => {
    if (!product) return;
    exportGenericToExcel({
      sheetName: 'حركة المنتج',
      title: `حركة المنتج - ${product.name}`,
      columns: [
        { key: 'date', label: 'التاريخ' },
        { key: 'typeLabel', label: 'النوع' },
        { key: 'qty', label: 'الكمية' },
        { key: 'unitPrice', label: 'السعر' },
        { key: 'total', label: 'الإجمالي' },
        { key: 'reference', label: 'المرجع' },
        { key: 'cashier', label: 'الكاشير' },
      ],
      rows: movements.map(m => ({
        ...m,
        typeLabel: TYPE_META[m.type].label,
        date: new Date(m.date).toLocaleString('en-GB'),
      })),
      fileName: `product-movement-${product.name}-${dateRange.from}.xlsx`,
    });
  };

  return (
    <ReportShell
      icon={<Activity className="w-5 h-5" />}
      title="حركة منتج محدد"
      subtitle="سجل كامل لعمليات الشراء، البيع، الإرجاع والإتلاف لمنتج معين"
      onExportPDF={product ? handleExportPDF : undefined}
      onExportExcel={product ? handleExportExcel : undefined}
      exportDisabled={!product || movements.length === 0}
      filters={
        <EntityPicker
          label="اختر المنتج"
          placeholder="اضغط لاختيار منتج..."
          items={products.map(p => ({ id: p.id, name: p.name, subtitle: p.barcode || p.category }))}
          value={productId}
          onChange={setProductId}
        />
      }
    >
      {!product ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          اختر منتجاً لعرض سجل حركاته
        </CardContent></Card>
      ) : loading ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">جاري التحميل...</CardContent></Card>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'وارد', value: summary.incoming, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
              { label: 'صادر', value: summary.outgoing, color: 'text-blue-600', bg: 'bg-blue-500/10' },
              { label: 'مرتجع', value: summary.refunded, color: 'text-amber-600', bg: 'bg-amber-500/10' },
              { label: 'إتلاف', value: summary.damaged, color: 'text-red-600', bg: 'bg-red-500/10' },
            ].map(k => (
              <Card key={k.label}><CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className={cn('text-base font-bold mt-1', k.color)}>{formatNumber(k.value)}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card><CardContent className="p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">صافي الحركة:</span>
              <span className={cn('font-bold', summary.net >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {summary.net >= 0 ? '+' : ''}{formatNumber(summary.net)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-muted-foreground">الربح المحقق:</span>
              <span className="font-bold text-primary">{formatCurrency(summary.profit)}</span>
            </div>
          </CardContent></Card>

          {/* Movement table */}
          <Card><CardContent className="p-0">
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد حركات في هذه الفترة</p>
            ) : (
              <div className="divide-y divide-border/40">
                {movements.map((m, idx) => {
                  const meta = TYPE_META[m.type];
                  const Icon = meta.icon;
                  return (
                    <div key={idx} className="flex items-center gap-2 p-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
                        <Icon className={cn('w-4 h-4', meta.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate">{meta.label} • {formatNumber(m.qty)}</p>
                          <p className="text-xs font-bold whitespace-nowrap">{formatCurrency(m.total)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[10px] text-muted-foreground truncate">{m.reference}{m.cashier ? ` • ${m.cashier}` : ''}</p>
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(m.date).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </>
      )}
    </ReportShell>
  );
}
