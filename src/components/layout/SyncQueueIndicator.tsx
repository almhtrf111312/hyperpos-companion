/**
 * Sync Queue Status Indicator
 * يعرض حالة طابور التزامن مع إمكانية إعادة المحاولة
 */
import { useState, useEffect, forwardRef, useContext } from 'react';
import { Cloud, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getQueueStatus, retryFailedOperations, SyncQueueStatus } from '@/lib/sync-queue';
import { EVENTS } from '@/lib/events';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

// Import the context directly to check if it exists
import { CloudSyncContext } from '@/providers/CloudSyncProvider';

// Safe hook that returns null when used outside provider
const useSafeCloudSyncContext = () => {
  const context = useContext(CloudSyncContext);
  return context; // May be null if outside provider
};

export const SyncQueueIndicator = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    const [status, setStatus] = useState<SyncQueueStatus>(getQueueStatus());
    const [isRetrying, setIsRetrying] = useState(false);
    const cloudContext = useSafeCloudSyncContext();
    const { isRTL, t, language } = useLanguage();
    
    const isSyncing = cloudContext?.isSyncing ?? false;
    const syncNow = cloudContext?.syncNow ?? (async () => {});

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

    if (totalPending === 0 && failedCount === 0 && !isActive) {
      return null;
    }

    const getLocale = () => {
      if (language === 'ar') return 'ar';
      if (language === 'tr') return 'tr-TR';
      if (language === 'fa') return 'fa-IR';
      return 'en';
    };

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
                  {t('sync.status')}
                </span>
                {getStatusIcon()}
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                {totalPending > 0 && (
                  <div className="flex items-center justify-between">
                    <span>{t('sync.pendingCount')}</span>
                    <Badge variant="secondary">{totalPending}</Badge>
                  </div>
                )}
                {failedCount > 0 && (
                  <div className="flex items-center justify-between text-destructive">
                    <span>{t('sync.failedCount')}</span>
                    <Badge variant="destructive">{failedCount}</Badge>
                  </div>
                )}
                {status.lastSyncTime && (
                  <div className="text-xs text-muted-foreground/70">
                    {t('sync.lastSyncTime')}
                    {new Date(status.lastSyncTime).toLocaleTimeString(getLocale())}
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
                    {t('sync.retry')}
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
                  {t('sync.syncNow')}
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