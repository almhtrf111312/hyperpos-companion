/**
 * Stuck Operations List
 * =====================
 * يعرض العمليات العالقة في طابور المزامنة مع سبب الفشل الحقيقي،
 * ويتيح إعادة المحاولة، أو استرداد الفاتورة إلى سلة نقطة البيع، أو حذفها.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { EVENTS } from '@/lib/events';
import {
  getStuckOperations,
  recoverOperationToCart,
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
  const navigate = useNavigate();
  const [operations, setOperations] = useState<StuckOperation[]>(() => getStuckOperations());
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const handleRecover = async (op: StuckOperation) => {
    setBusyId(op.id);
    try {
      const result = await recoverOperationToCart(op.id);
      if (result.success) {
        toast.success(result.message, { id: `recover-${op.id}` });
        navigate('/pos');
      } else {
        toast.error(result.message, { id: `recover-${op.id}` });
      }
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const handleDiscard = async (op: StuckOperation) => {
    setBusyId(op.id);
    try {
      const done = await discardStuckOperation(op.id);
      toast[done ? 'success' : 'error'](
        done ? 'تم حذف العملية وإرجاع المخزون المحجوز' : 'تعذر حذف العملية',
        { id: `discard-${op.id}` },
      );
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const handleRetry = (op: StuckOperation) => {
    retryStuckOperation(op.id);
    toast.info('ستتم إعادة محاولة رفع العملية', { id: `retry-${op.id}` });
    refresh();
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
                {op.canRestoreToCart && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1 flex-1"
                    disabled={busyId === op.id}
                    onClick={() => handleRecover(op)}
                  >
                    {busyId === op.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RotateCcw className="h-3 w-3" />}
                    استرداد للسلة
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1"
                  disabled={busyId === op.id}
                  onClick={() => handleRetry(op)}
                >
                  <RefreshCw className="h-3 w-3" />
                  إعادة
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                  disabled={busyId === op.id}
                  onClick={() => handleDiscard(op)}
                >
                  <Trash2 className="h-3 w-3" />
                  حذف
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
