/**
 * Sync Queue Status Indicator
 * يعرض حالة طابور التزامن مع إمكانية إعادة المحاولة
 */
import { useState, useEffect, forwardRef } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getQueueStatus, retryFailedOperations, SyncQueueStatus } from '@/lib/sync-queue';
import { EVENTS } from '@/lib/events';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

export const SyncQueueIndicator = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    const [status, setStatus] = useState<SyncQueueStatus>(getQueueStatus());
    const [isRetrying, setIsRetrying] = useState(false);
    const { isSyncing, syncNow } = useCloudSyncContext();
    const { t, isRTL } = useLanguage();

    useEffect(() => {
      const handleUpdate = (e: Event) => {
        const customEvent = e as CustomEvent<SyncQueueStatus>;
        if (customEvent.detail) {
          setStatus(customEvent.detail);
        } else {
          setStatus(getQueueStatus());
        }
      };

      window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleUpdate);
      
      // تحديث الحالة كل 30 ثانية
      const interval = setInterval(() => {
        setStatus(getQueueStatus());
      }, 30000);

      return () => {
        window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleUpdate);
        clearInterval(interval);
      };
    }, []);

    const handleRetry = async () => {
      setIsRetrying(true);
      try {
        retryFailedOperations();
        await syncNow();
        setStatus(getQueueStatus());
      } finally {
        setIsRetrying(false);
      }
    };

    const handleManualSync = async () => {
      await syncNow();
      setStatus(getQueueStatus());
    };

    const { pendingCount, failedCount, processingCount, isProcessing } = status;
    const totalPending = pendingCount + processingCount;
    const hasIssues = failedCount > 0;
    const isActive = isSyncing || isProcessing || isRetrying;

    // لا تعرض شيء إذا كان كل شيء مزامن
    if (totalPending === 0 && failedCount === 0 && !isActive) {
      return null;
    }

    const getStatusIcon = () => {
      if (isActive) {
        return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
      }
      if (hasIssues) {
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      }
      if (totalPending > 0) {
        return <Cloud className="h-4 w-4 text-warning" />;
      }
      return <Check className="h-4 w-4 text-green-500" />;
    };

    const getStatusText = () => {
      if (isActive) {
        return isRTL ? 'جاري المزامنة...' : 'Syncing...';
      }
      if (hasIssues) {
        return isRTL ? `${failedCount} عملية فاشلة` : `${failedCount} failed`;
      }
      if (totalPending > 0) {
        return isRTL ? `${totalPending} بانتظار المزامنة` : `${totalPending} pending`;
      }
      return isRTL ? 'تمت المزامنة' : 'Synced';
    };

    return (
      <div ref={ref} className={className}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "relative h-8 gap-1.5 px-2",
                hasIssues && "text-destructive hover:text-destructive"
              )}
            >
              {getStatusIcon()}
              {(totalPending > 0 || hasIssues) && (
                <Badge 
                  variant={hasIssues ? "destructive" : "secondary"} 
                  className="h-5 min-w-5 px-1 text-xs"
                >
                  {hasIssues ? failedCount : totalPending}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64" 
            align={isRTL ? "start" : "end"}
            side="bottom"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {isRTL ? 'حالة المزامنة' : 'Sync Status'}
                </span>
                {getStatusIcon()}
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                {totalPending > 0 && (
                  <div className="flex items-center justify-between">
                    <span>{isRTL ? 'عمليات معلقة:' : 'Pending:'}</span>
                    <Badge variant="secondary">{totalPending}</Badge>
                  </div>
                )}
                {failedCount > 0 && (
                  <div className="flex items-center justify-between text-destructive">
                    <span>{isRTL ? 'عمليات فاشلة:' : 'Failed:'}</span>
                    <Badge variant="destructive">{failedCount}</Badge>
                  </div>
                )}
                {status.lastSyncTime && (
                  <div className="text-xs text-muted-foreground/70">
                    {isRTL ? 'آخر مزامنة: ' : 'Last sync: '}
                    {new Date(status.lastSyncTime).toLocaleTimeString(isRTL ? 'ar' : 'en')}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                {hasIssues && (
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={handleRetry}
                    disabled={isActive}
                    className="flex-1"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRTL ? "ml-1" : "mr-1", isRetrying && "animate-spin")} />
                    {isRTL ? 'إعادة المحاولة' : 'Retry'}
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={isActive}
                  className="flex-1"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRTL ? "ml-1" : "mr-1", isSyncing && "animate-spin")} />
                  {isRTL ? 'مزامنة الآن' : 'Sync Now'}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

SyncQueueIndicator.displayName = 'SyncQueueIndicator';
