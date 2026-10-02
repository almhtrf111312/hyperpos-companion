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
      <div className="px-3 py-2 flex items-center justify-between bg-destructive/10 border-b border-destructive/20">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs font-semibold text-destructive">
            عمليات غير مُزامنة ({operations.length})
          </span>
        </div>
        <span className="text-[10px] text-destructive/80 font-medium">بحاجة للمزامنة أو الإلغاء</span>
      </div>

      <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
        {operations.map(op => {
          const terminal = op.errorClass === 'terminal' || op.retryCount >= op.maxRetries;
          const isProcessingThis = busyId === op.id || op.status === 'processing';
          return (
            <div
              key={op.id}
              className="p-2.5 rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/10 space-y-2 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {terminal ? (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground leading-snug break-words">
                      {op.label}
                      {op.customerName ? ` · ${op.customerName}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {op.total !== undefined && (
                        <span className="font-bold text-foreground">
                          ${op.total.toFixed(2)}
                        </span>
                      )}
                      {op.itemsCount > 0 && <span>{op.itemsCount} صنف</span>}
                      <span>•</span>
                      <span>
                        {new Date(op.createdAt).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={terminal ? 'destructive' : 'outline'}
                  className="text-[10px] px-1.5 py-0 shrink-0 font-medium whitespace-nowrap"
                >
                  {statusLabel(op)}
                </Badge>
              </div>

              {op.error && (
                <p className="text-[10px] text-destructive break-words leading-tight bg-destructive/10 border border-destructive/20 rounded-md p-1.5 font-mono">
                  {op.error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 font-medium justify-center w-full"
                  disabled={isProcessingThis || isCloudSyncing}
                  onClick={() => handleRetry(op)}
                  title="إعادة مزامنة هذه العملية الآن"
                >
                  <RefreshCw
                    className={cn(
                      'h-3 w-3 shrink-0',
                      isProcessingThis && 'animate-spin'
                    )}
                  />
                  <span className="truncate">
                    {isProcessingThis ? 'جاري الرفع...' : 'إعادة المزامنة'}
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 font-medium justify-center w-full"
                  disabled={busyId === op.id}
                  onClick={() => handleDiscard(op)}
                  title="إلغاء العملية غير المكتملة وإرجاع المخزون"
                >
                  <Trash2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">إلغاء العملية</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
