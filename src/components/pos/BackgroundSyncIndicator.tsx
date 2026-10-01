/**
 * مؤشر المزامنة في الخلفية - يظهر حالة المعالجة
 */
import { useEffect, useState, useContext } from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';
import { getQueueStatus, SyncQueueStatus, loadQueue, resetOperationForRetry, QueuedOperation } from '@/lib/sync-queue';
import { showToast } from '@/lib/toast-config';
import { CloudSyncContext } from '@/providers/CloudSyncProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface BackgroundSyncIndicatorProps {
  state?: SyncState;
  message?: string;
  className?: string;
}

export function BackgroundSyncIndicator({ 
  state: externalState, 
  message: externalMessage,
  className 
}: BackgroundSyncIndicatorProps) {
  const { isRTL } = useLanguage();
  const [internalState, setInternalState] = useState<SyncState>('idle');
  const [queueStatus, setQueueStatus] = useState<SyncQueueStatus>(getQueueStatus());
  const syncContext = useContext(CloudSyncContext);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [failedOps, setFailedOps] = useState<QueuedOperation[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Listen to sync queue updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SyncQueueStatus>;
      if (customEvent.detail) {
        setQueueStatus(customEvent.detail);
        
        // Update state based on queue
        if (customEvent.detail.isProcessing || customEvent.detail.processingCount > 0) {
          setInternalState('syncing');
        } else if (customEvent.detail.failedCount > 0) {
          setInternalState('error');
        } else if (customEvent.detail.pendingCount === 0) {
          setInternalState('success');
          // Reset to idle after 3 seconds
          setTimeout(() => setInternalState('idle'), 3000);
        }
      }
    };

    window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleUpdate);
    
    // Check online status
    const handleOnline = () => {
      if (internalState === 'offline') setInternalState('idle');
    };
    const handleOffline = () => setInternalState('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial offline check
    if (!navigator.onLine) setInternalState('offline');

    return () => {
      window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [internalState]);

  const state = externalState || internalState;
  
  // Don't show if idle and no queue items
  if (state === 'idle' && queueStatus.pendingCount === 0 && queueStatus.failedCount === 0) {
    return null;
  }

  const handleOpenDialog = () => {
    const queue = loadQueue();
    const ops = queue.filter(op => op.status === 'failed' || !!op.error || op.status === 'pending');
    setFailedOps(ops);
    setDialogOpen(true);
  };

  const handleRetryAll = async () => {
    setIsRetrying(true);
    try {
      const queue = loadQueue();
      for (const op of queue) {
        if (op.status === 'failed') {
          resetOperationForRetry(op.id);
        }
      }
      showToast.info('جاري إعادة المحاولة', 'يتم رفع العمليات المعلقة الآن...');
      if (syncContext?.syncNow) {
        await syncContext.syncNow();
      }
      const updatedQueue = loadQueue();
      const remainingFailed = updatedQueue.filter(op => op.status === 'failed' || !!op.error);
      setFailedOps(remainingFailed);
      if (remainingFailed.length === 0) {
        setDialogOpen(false);
      }
    } catch {
      showToast.error('فشل بدء إعادة المحاولة');
    } finally {
      setIsRetrying(false);
    }
  };

  const getOpTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice_create': return 'فاتورة مبيعات نقدية';
      case 'debt_sale_bundle': return 'فاتورة مبيعات ذمة (آجلة)';
      case 'invoice_refund': return 'استرداد فاتورة';
      case 'invoice_refund_partial': return 'استرداد جزئي';
      case 'quick_purchase': return 'شراء سريع';
      case 'purchase_invoice': return 'فاتورة مشتريات';
      case 'stock_update': return 'تحديث مخزون';
      default: return type;
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <Check className="h-4 w-4" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      case 'offline':
        return <CloudOff className="h-4 w-4" />;
      default:
        return <Cloud className="h-4 w-4" />;
    }
  };

  const getMessage = () => {
    if (externalMessage) return externalMessage;
    
    switch (state) {
      case 'syncing': {
        const count = queueStatus.processingCount + queueStatus.pendingCount;
        return isRTL ? `جاري المزامنة... (${count})` : `Syncing... (${count})`;
      }
      case 'success':
        return isRTL ? 'تمت المزامنة ✓' : 'Synced ✓';
      case 'error':
        return isRTL ? `فشل (${queueStatus.failedCount}) - انقر للتفاصيل` : `Failed (${queueStatus.failedCount}) - Click details`;
      case 'offline':
        return isRTL ? 'غير متصل' : 'Offline';
      default:
        if (queueStatus.pendingCount > 0) {
          return isRTL ? `معلق (${queueStatus.pendingCount})` : `Pending (${queueStatus.pendingCount})`;
        }
        return '';
    }
  };

  const getStateStyles = () => {
    switch (state) {
      case 'syncing':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'success':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20 cursor-pointer hover:bg-destructive/20';
      case 'offline':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-border cursor-pointer hover:bg-muted/80';
    }
  };

  const isClickable = queueStatus.failedCount > 0 || queueStatus.pendingCount > 0;

  return (
    <>
      <div
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? handleOpenDialog : undefined}
        onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleOpenDialog() : undefined}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-all select-none",
          getStateStyles(),
          className
        )}
        title={isClickable ? (isRTL ? "انقر لعرض تفاصيل العمليات المعلقة" : "Click to view queue details") : undefined}
      >
        {getIcon()}
        <span>{getMessage()}</span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[85vh] flex flex-col p-4 sm:p-6" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <span>{isRTL ? 'حالة طابور المزامنة والعمليات المعلقة' : 'Sync Queue & Pending Operations'}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2.5 py-2 max-h-[50vh]">
            {failedOps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRTL ? 'لا توجد عمليات معلقة أو فاشلة حالياً' : 'No pending or failed operations'}
              </p>
            ) : (
              failedOps.map((op) => (
                <div key={op.id} className="p-3 rounded-lg border border-border bg-muted/40 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-foreground">{getOpTypeLabel(op.type)}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px]",
                      op.status === 'failed' ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
                    )}>
                      {op.status === 'failed' ? (isRTL ? 'فشلت' : 'Failed') : (isRTL ? 'قيد الانتظار' : 'Pending')}
                    </span>
                  </div>
                  {op.error && (
                    <div className="bg-destructive/10 text-destructive p-2 rounded text-[11px] font-mono break-words leading-tight">
                      <strong>{isRTL ? 'سبب الرفض: ' : 'Reason: '}</strong>
                      {op.error}
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
                    <span>{new Date(op.createdAt).toLocaleTimeString('ar-SA')}</span>
                    {op.retryCount > 0 && (
                      <span>{isRTL ? `محاولات: ${op.retryCount}/${op.maxRetries}` : `Retries: ${op.retryCount}/${op.maxRetries}`}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex flex-row justify-between gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
            {failedOps.some(op => op.status === 'failed') && (
              <Button size="sm" onClick={handleRetryAll} disabled={isRetrying} className="gap-1.5">
                <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
                <span>{isRTL ? 'إعادة المحاولة الآن' : 'Retry Now'}</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook للاستخدام في CartPanel
export function useSyncState() {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [delayTimer, setDelayTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const startSync = (message?: string, showImmediateToast = false) => {
    // إلغاء أي تأخير سابق
    if (delayTimer) {
      clearTimeout(delayTimer);
      setDelayTimer(null);
    }
    
    setSyncState('syncing');
    setSyncMessage(message || '');
    
    // إظهار toast فوري فقط إذا طُلب (للعمليات الطويلة)
    if (showImmediateToast && message) {
      showToast.info(message);
    }
  };

  const completeSync = (message = 'تمت المزامنة بنجاح', delay = 5000) => {
    // تأخير 5 ثوانٍ للتأكد من اكتمال المزامنة
    const timer = setTimeout(() => {
      setSyncState('success');
      setSyncMessage('');
      showToast.success(message);
      
      // العودة لـ idle بعد 3 ثوانٍ
      setTimeout(() => setSyncState('idle'), 3000);
    }, delay);
    
    setDelayTimer(timer);
  };

  const failSync = (error = 'فشلت المزامنة', delay = 5000) => {
    // تأخير 5 ثوانٍ للتأكد من الفشل النهائي
    const timer = setTimeout(() => {
      setSyncState('error');
      setSyncMessage(error);
      showToast.error(error);
    }, delay);
    
    setDelayTimer(timer);
  };
  
  // تنظيف التأخيرات عند unmount
  useEffect(() => {
    return () => {
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, [delayTimer]);

  return {
    syncState,
    syncMessage,
    startSync,
    completeSync,
    failSync,
    setSyncState,
  };
}
