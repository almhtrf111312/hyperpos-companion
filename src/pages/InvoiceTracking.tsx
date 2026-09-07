/**
 * Invoice Tracking - FlowPOS Pro
 * ==============================
 * شاشة تتبع الفواتير: تفاصيل الفاتورة، تقدّم المزامنة،
 * وحالة كل بند (مقصوص من المخزون / تمت المزامنة / عالق) مع إشعار عند الاكتمال.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, PackageMinus, RefreshCw, Trash2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EVENTS } from '@/lib/events';
import { loadQueue, QueuedOperation } from '@/lib/sync-queue';
import { discardStuckOperation, retryStuckOperation } from '@/lib/sync-recovery';
import { getPendingStockDeductions, PendingStockDeduction } from '@/lib/indexeddb-cache';
import { loadInvoicesCloud } from '@/lib/cloud/invoices-cloud';
import type { Invoice } from '@/lib/cloud/invoices-cloud';

type ItemState = 'deducted' | 'synced' | 'stuck';

interface TrackedItem {
  productId: string;
  name: string;
  quantity: number;
  state: ItemState;
}

interface TrackedInvoice {
  key: string;
  operationId?: string;
  queueId?: string;
  title: string;
  customerName: string;
  total: number;
  currency: string;
  paymentLabel: string;
  createdAt: string;
  progress: number;
  state: 'pending' | 'syncing' | 'stuck' | 'synced';
  error?: string;
  items: TrackedItem[];
}

const SALE_TYPES = new Set(['invoice_create', 'debt_sale_bundle', 'sale']);

const stateMeta: Record<TrackedInvoice['state'], { label: string; className: string }> = {
  pending: { label: 'بانتظار المزامنة', className: 'bg-warning/10 text-warning border-warning/30' },
  syncing: { label: 'جاري الرفع', className: 'bg-primary/10 text-primary border-primary/30' },
  stuck: { label: 'عالقة', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  synced: { label: 'مكتملة ومزامنة', className: 'bg-success/10 text-success border-success/30' },
};

const itemMeta: Record<ItemState, { label: string; icon: typeof CheckCircle2; className: string }> = {
  deducted: { label: 'مقصوص من المخزون', icon: PackageMinus, className: 'text-warning' },
  synced: { label: 'تمت المزامنة', icon: CheckCircle2, className: 'text-success' },
  stuck: { label: 'عالق', icon: AlertTriangle, className: 'text-destructive' },
};

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBundle = (op: QueuedOperation): Record<string, unknown> => {
  const data = op.data || {};
  const bundle = (data.bundle as Record<string, unknown>) || data;
  return bundle;
};

const mapQueueOperation = (
  op: QueuedOperation,
  pending: PendingStockDeduction[],
): TrackedInvoice => {
  const bundle = readBundle(op);
  const operationId = String(op.data?.operationId || op.data?.uniqueKey || op.data?.localId || '');
  const terminal = op.errorClass === 'terminal' || op.retryCount >= op.maxRetries;
  const state: TrackedInvoice['state'] =
    terminal ? 'stuck' : op.status === 'processing' ? 'syncing' : 'pending';

  const deduction = pending.find(entry => entry.operationId === operationId);
  const deductedIds = new Set((deduction?.items || []).map(item => item.productId));

  const rawItems = Array.isArray(bundle.items) ? (bundle.items as Record<string, unknown>[]) : [];
  const items: TrackedItem[] = rawItems.map(item => {
    const productId = String(item.id ?? item.productId ?? '');
    return {
      productId,
      name: String(item.name ?? item.productName ?? 'منتج'),
      quantity: num(item.quantity, 1),
      state: state === 'stuck' ? 'stuck' : deductedIds.has(productId) ? 'deducted' : 'deducted',
    };
  });

  return {
    key: op.id,
    operationId: operationId || undefined,
    queueId: op.id,
    title: op.type === 'debt_sale_bundle' ? 'فاتورة بيع مؤجل' : 'فاتورة بيع نقدي',
    customerName: String(bundle.customerName || 'عميل'),
    total: num(bundle.total),
    currency: String(bundle.currency || 'USD'),
    paymentLabel: op.type === 'debt_sale_bundle' ? 'بيع مؤجل' : 'نقدي',
    createdAt: op.createdAt || op.timestamp,
    progress: state === 'stuck' ? 40 : state === 'syncing' ? 70 : 35,
    state,
    error: op.error,
    items,
  };
};

const mapCloudInvoice = (invoice: Invoice): TrackedInvoice => ({
  key: `invoice-${invoice.id}`,
  title: `فاتورة ${invoice.id}`,
  customerName: invoice.customerName || 'عميل',
  total: num(invoice.total),
  currency: invoice.currency || 'USD',
  paymentLabel: invoice.paymentType === 'debt' ? 'بيع مؤجل' : 'نقدي',
  createdAt: invoice.createdAt,
  progress: 100,
  state: 'synced',
  items: (invoice.items || []).map(item => ({
    productId: String(item.id ?? ''),
    name: item.name || 'منتج',
    quantity: num(item.quantity, 1),
    state: 'synced' as ItemState,
  })),
});

export default function InvoiceTracking() {
  const [queueOps, setQueueOps] = useState<QueuedOperation[]>([]);
  const [pending, setPending] = useState<PendingStockDeduction[]>([]);
  const [cloudInvoices, setCloudInvoices] = useState<Invoice[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const previousKeys = useRef<Set<string>>(new Set());

  const refreshQueue = useCallback(async () => {
    const ops = loadQueue().filter(op => SALE_TYPES.has(op.type));
    setQueueOps(ops);
    try {
      setPending(await getPendingStockDeductions());
    } catch {
      setPending([]);
    }
  }, []);

  const refreshCloud = useCallback(async () => {
    try {
      const invoices = await loadInvoicesCloud();
      setCloudInvoices(invoices.slice(0, 15));
    } catch {
      /* offline: keep what we have */
    }
  }, []);

  useEffect(() => {
    refreshQueue();
    refreshCloud();
    const onQueue = () => { refreshQueue(); };
    const onInvoices = () => { refreshCloud(); };
    window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, onQueue);
    window.addEventListener(EVENTS.INVOICES_UPDATED, onInvoices);
    const interval = setInterval(() => { refreshQueue(); }, 5000);
    return () => {
      window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, onQueue);
      window.removeEventListener(EVENTS.INVOICES_UPDATED, onInvoices);
      clearInterval(interval);
    };
  }, [refreshQueue, refreshCloud]);

  const tracked = useMemo(() => {
    const live = queueOps.map(op => mapQueueOperation(op, pending));
    const done = cloudInvoices.map(mapCloudInvoice);
    return [...live, ...done];
  }, [queueOps, pending, cloudInvoices]);

  // Notify when a tracked (pending) invoice finishes syncing
  useEffect(() => {
    const currentPendingKeys = new Set(
      queueOps.filter(op => op.status !== 'failed').map(op => op.id),
    );
    previousKeys.current.forEach(key => {
      if (!currentPendingKeys.has(key)) {
        toast.success('تمت مزامنة الفاتورة بنجاح', { id: `tracking-done-${key}` });
        refreshCloud();
      }
    });
    previousKeys.current = currentPendingKeys;
  }, [queueOps, refreshCloud]);

  const liveCount = queueOps.length;
  const stuckCount = queueOps.filter(op => op.errorClass === 'terminal' || op.retryCount >= op.maxRetries).length;

  const handleRetry = (queueId: string) => {
    retryStuckOperation(queueId);
    toast.info('ستتم إعادة محاولة رفع الفاتورة', { id: `retry-${queueId}` });
    refreshQueue();
  };

  const handleDiscard = async (queueId: string) => {
    setBusyId(queueId);
    try {
      const done = await discardStuckOperation(queueId);
      toast[done ? 'success' : 'error'](
        done ? 'تم إلغاء الفاتورة غير المكتملة وإرجاع حجز المخزون' : 'تعذر إلغاء الفاتورة',
        { id: `discard-${queueId}` },
      );
    } finally {
      setBusyId(null);
      refreshQueue();
    }
  };

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <header className="space-y-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          تتبع الفواتير
        </h1>
        <p className="text-sm text-muted-foreground">
          تفاصيل كل فاتورة، تقدّم المزامنة، وحالة كل بند فيها.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">قيد المزامنة</p>
          <p className="text-lg font-bold">{liveCount - stuckCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">عالقة</p>
          <p className="text-lg font-bold text-destructive">{stuckCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">مكتملة</p>
          <p className="text-lg font-bold text-success">{cloudInvoices.length}</p>
        </CardContent></Card>
      </div>

      <ScrollArea className="h-[calc(100vh-16rem)] pl-1">
        <div className="space-y-3">
          {tracked.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد فواتير لعرضها حالياً.
            </CardContent></Card>
          )}

          {tracked.map(entry => {
            const meta = stateMeta[entry.state];
            return (
              <Card key={entry.key} className="overflow-hidden">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm truncate">{entry.title}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.customerName} · {entry.paymentLabel}
                      </p>
                    </div>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      {new Date(entry.createdAt).toLocaleString('ar-EG', { numberingSystem: 'latn' })}
                    </span>
                    <span className="font-semibold">
                      {entry.total.toFixed(2)} {entry.currency}
                    </span>
                  </div>

                  <Progress value={entry.progress} className="h-1.5" />

                  <div className="space-y-1.5">
                    {entry.items.map((item, index) => {
                      const im = itemMeta[item.state];
                      const Icon = im.icon;
                      return (
                        <div key={`${entry.key}-${item.productId}-${index}`} className="flex items-center gap-2 text-xs">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${im.className}`} />
                          <span className="flex-1 truncate">{item.name}</span>
                          <span className="text-muted-foreground">×{item.quantity}</span>
                          <span className={im.className}>{im.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {entry.error && (
                    <p className="text-xs text-destructive bg-destructive/5 rounded-md p-2 break-words">
                      {entry.error}
                    </p>
                  )}

                  {entry.queueId && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs flex-1"
                        disabled={busyId === entry.queueId}
                        onClick={() => handleRetry(entry.queueId!)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 ml-1" />
                        إعادة المحاولة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs flex-1 text-destructive"
                        disabled={busyId === entry.queueId}
                        onClick={() => handleDiscard(entry.queueId!)}
                      >
                        <Trash2 className="h-3.5 w-3.5 ml-1" />
                        إلغاء
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {liveCount > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          يتم تحديث الحالة تلقائياً كل خمس ثوانٍ.
        </p>
      )}
    </div>
  );
}
