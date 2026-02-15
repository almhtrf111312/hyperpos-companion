/**
 * Sync Status Menu - Shows sync state with history dropdown
 * Displays in header: Online/Offline/Syncing with last 10 operations
 */
import { useState, useEffect, useContext } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle, Clock, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { CloudSyncContext } from '@/providers/CloudSyncProvider';
import { getQueueStatus, SyncQueueStatus } from '@/lib/sync-queue';
import { loadHistory, SyncHistoryItem, SYNC_HISTORY_UPDATED, cleanupSyncedItems } from '@/lib/sync-history';
import { EVENTS } from '@/lib/events';
import { loadRecentBackups, formatBackupSize, BACKUP_UPDATED_EVENT, LocalBackup } from '@/lib/local-auto-backup';

export function SyncStatusMenu() {
  const { isRTL, t, language } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const cloudContext = useContext(CloudSyncContext);
  const isSyncing = cloudContext?.isSyncing ?? false;
  const syncNow = cloudContext?.syncNow ?? (async () => {});

  const [queueStatus, setQueueStatus] = useState<SyncQueueStatus>(getQueueStatus());
  const [history, setHistory] = useState<SyncHistoryItem[]>(loadHistory());
  const [recentBackups, setRecentBackups] = useState<LocalBackup[]>(loadRecentBackups());

  useEffect(() => {
    const handleQueueUpdate = () => setQueueStatus(getQueueStatus());
    const handleHistoryUpdate = (e: Event) => {
      const ce = e as CustomEvent<SyncHistoryItem[]>;
      setHistory(ce.detail || loadHistory());
    };
    const handleBackupUpdate = (e: Event) => {
      const ce = e as CustomEvent<LocalBackup[]>;
      setRecentBackups(ce.detail || loadRecentBackups());
    };

    window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleQueueUpdate);
    window.addEventListener(SYNC_HISTORY_UPDATED, handleHistoryUpdate);
    window.addEventListener(BACKUP_UPDATED_EVENT, handleBackupUpdate);

    const cleanup = setInterval(cleanupSyncedItems, 5 * 60 * 1000);

    return () => {
      window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleQueueUpdate);
      window.removeEventListener(SYNC_HISTORY_UPDATED, handleHistoryUpdate);
      window.removeEventListener(BACKUP_UPDATED_EVENT, handleBackupUpdate);
      clearInterval(cleanup);
    };
  }, []);

  const pendingCount = queueStatus.pendingCount + queueStatus.processingCount;
  const hasIssues = queueStatus.failedCount > 0;

  const getStatus = () => {
    if (!isOnline) return 'offline';
    if (isSyncing || queueStatus.isProcessing) return 'syncing';
    if (hasIssues) return 'error';
    if (pendingCount > 0) return 'pending';
    return 'synced';
  };

  const status = getStatus();

  const statusConfig = {
    offline: {
      icon: CloudOff,
      color: 'text-destructive',
      label: t('sync.offline'),
      animate: 'animate-pulse',
    },
    syncing: {
      icon: RefreshCw,
      color: 'text-primary',
      label: t('sync.syncing'),
      animate: 'animate-spin',
    },
    error: {
      icon: AlertTriangle,
      color: 'text-destructive',
      label: t('sync.error'),
      animate: '',
    },
    pending: {
      icon: Clock,
      color: 'text-warning',
      label: t('sync.pending'),
      animate: '',
    },
    synced: {
      icon: Cloud,
      color: 'text-green-500',
      label: t('sync.synced'),
      animate: '',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getItemStatusIcon = (itemStatus: SyncHistoryItem['status']) => {
    switch (itemStatus) {
      case 'synced':
        return <Check className="h-3.5 w-3.5 text-green-500" />;
      case 'pending':
        return <Clock className="h-3.5 w-3.5 text-warning" />;
      case 'syncing':
        return <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    }
  };

  const getItemStatusLabel = (itemStatus: SyncHistoryItem['status']) => {
    const labels = {
      synced: t('sync.synced'),
      pending: t('sync.pending'),
      syncing: t('sync.syncing'),
      failed: t('sync.error'),
    };
    return labels[itemStatus];
  };

  const getLocale = () => {
    if (language === 'ar') return 'ar';
    if (language === 'tr') return 'tr-TR';
    if (language === 'fa') return 'fa-IR';
    if (language === 'ku') return 'ku';
    return 'en';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortedHistory = [...history].sort((a, b) => {
    const priority = { failed: 0, pending: 1, syncing: 2, synced: 3 };
    const pDiff = priority[a.status] - priority[b.status];
    if (pDiff !== 0) return pDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9", config.color)}
        >
          <StatusIcon className={cn("h-4.5 w-4.5", config.animate)} />
          {(pendingCount > 0 || hasIssues) && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center",
              hasIssues
                ? "bg-destructive text-destructive-foreground"
                : "bg-warning text-warning-foreground"
            )}>
              {hasIssues ? queueStatus.failedCount : pendingCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0"
        align={isRTL ? 'start' : 'end'}
        side="bottom"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-4 w-4", config.color, config.animate)} />
            <span className="font-medium text-sm">{config.label}</span>
          </div>
          {isOnline && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => syncNow()}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("h-3 w-3", isRTL ? "ml-1" : "mr-1", isSyncing && "animate-spin")} />
              {t('sync.syncBtn')}
            </Button>
          )}
        </div>

        {/* History List */}
        <ScrollArea className="max-h-64">
          {sortedHistory.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('sync.noRecentOperations')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedHistory.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  {getItemStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(item.timestamp)}
                    </p>
                  </div>
                  <Badge
                    variant={item.status === 'failed' ? 'destructive' : item.status === 'synced' ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {getItemStatusLabel(item.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Local Backups Section */}
        {recentBackups.length > 0 && (
          <div className="border-t border-border">
            <div className="px-4 py-2 flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('sync.localBackups')}
              </span>
            </div>
            <div className="divide-y divide-border">
              {recentBackups.slice(0, 3).map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2">
                  <Database className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{b.reason}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTime(b.timestamp)} · {formatBackupSize(b.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer stats */}
        {(pendingCount > 0 || hasIssues) && (
          <div className="px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
            {pendingCount > 0 && (
              <span>{t('sync.pendingOps').replace('{count}', String(pendingCount))}</span>
            )}
            {pendingCount > 0 && hasIssues && ' • '}
            {hasIssues && (
              <span className="text-destructive">
                {t('sync.failedOps').replace('{count}', String(queueStatus.failedCount))}
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}