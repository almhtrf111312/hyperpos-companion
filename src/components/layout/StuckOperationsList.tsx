/**
 * Stuck Operations List
 * =====================
 * يعرض العمليات العالقة في طابور المزامنة مع سبب الفشل الحقيقي،
 * ويتيح إعادة المحاولة أو إلغاء العملية غير المكتملة.
 */
import { useCallback, useEffect, useState, useContext } from 'react';
import { AlertTriangle, Clock, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { EVENTS } from '@/lib/events';
import { cn } from '@/lib/utils';
import { CloudSyncContext } from '@/providers/CloudSyncProvider';
import {
  getStuckOperations,
  discardStuckOperation,
  retryStuckOperation,
  StuckOperation,
} from '@/lib/sync-recovery';

const statusLabel = (op: StuckOperation) => {
  if (op.errorClass === 'terminal' || op.retryCount >= op.maxRetries) return 'فشل نهائي';
  if (op.status === 'processing') return 'جاري الرفع';
  if (op.status === 'failed') return `إعادة محاولة ${op.retryCount}/${op.maxRetries}`;
  return 'بانتظار المزامنة';
};

export function StuckOperationsList() {
  const [operations, setOperations] = useState<StuckOperation[]>(() => getStuckOperations());
  const [busyId, setBusyId] = useState<string | null>(null);
  const cloudContext = useContext(CloudSyncContext);
  const syncNow = cloudContext?.syncNow;
  const isCloudSyncing = cloudContext?.isSyncing ?? false;

  const refresh = useCallback(() => setOperations(getStuckOperations()), []);

  useEffect(() => {
    window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, refresh);
    const interval = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, refresh);
      clearInterval(interval);
    };
  }, [refresh]);

  if (operations.length === 0) return null;

  const handleDiscard = async (op: StuckOperation) => {
    setBusyId(op.id);
    try {
      const done = await discardStuckOperation(op.id);
      toast[done ? 'success' : 'error'](
        done ? 'تم إلغاء العملية غير المكتملة وإرجاع حجز المخزون' : 'تعذر إلغاء العملية',
        { id: `discard-${op.id}` },
      );
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const handleRetry = async (op: StuckOperation) => {
    setBusyId(op.id);
    try {
      // 1. إعادة العملية إلى حالة الانتظار ونقلها فوراً لمقدمة الطابور
      retryStuckOperation(op.id);
      refresh();

      // 2. تشغيل المزامنة الفورية وربطها بنفس دالة زر المزامنة العلوي
      if (syncNow) {
        const result = await syncNow(true, op.id);
        if (result && (result.targetSuccess || result.processed > 0)) {
          toast.success('تمت مزامنة الفاتورة بنجاح ✓', { id: `retry-${op.id}` });
        } else if (result && result.failed > 0) {
          toast.error('تعذرت المزامنة - تحقق من الاتصال بالإنترنت', { id: `retry-${op.id}` });
        } else {
          toast.info('تم فحص الطابور وتحديث حالة المزامنة', { id: `retry-${op.id}` });
        }
      } else {
        toast.info('تمت إعادة جدولة العملية للمزامنة', { id: `retry-${op.id}` });
      }
    } catch (err) {
      console.error('Retry error:', err);
      toast.error('حدث خطأ أثناء محاولة المزامنة', { id: `retry-${op.id}` });
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  return (
    <div className="border-t border-border">
      <div className="px-4 py-2 flex items-center gap-2 bg-destructive/5">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        <span className="text-xs font-medium text-destructive">
          عمليات غير مُزامنة ({operations.length})
        </span>
      </div>
      <div className="divide-y divide-border">
        {operations.map(op => {
          const terminal = op.errorClass === 'terminal' || op.retryCount >= op.maxRetries;
          return (
            <div key={op.id} className="px-4 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                {terminal
                  ? <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  : <Clock className="h-3.5 w-3.5 text-warning shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {op.label}
                    {op.customerName ? ` · ${op.customerName}` : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {op.itemsCount > 0 ? `${op.itemsCount} صنف · ` : ''}
                    {new Date(op.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Badge variant={terminal ? 'destructive' : 'outline'} className="text-[10px] px-1.5 py-0 shrink-0">
                  {statusLabel(op)}
                </Badge>
              </div>

              {op.error && (
                <p className="text-[10px] text-destructive break-words leading-snug bg-destructive/5 rounded px-2 py-1">
                  {op.error}
                </p>
              )}

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1 text-primary hover:text-primary font-medium"
                  disabled={busyId === op.id || op.status === 'processing' || isCloudSyncing}
                  onClick={() => handleRetry(op)}
                  title="إعادة مزامنة هذه الفاتورة الآن"
                >
                  <RefreshCw className={cn("h-3 w-3", (busyId === op.id || op.status === 'processing') && "animate-spin")} />
                  {busyId === op.id ? 'جاري الرفع...' : 'إعادة المزامنة'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                  disabled={busyId === op.id}
                  onClick={() => handleDiscard(op)}
                >
                  <Trash2 className="h-3 w-3" />
                  إلغاء العملية
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
