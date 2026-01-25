/**
 * مؤشر المزامنة في الخلفية - يظهر حالة المعالجة
 */
import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';
import { getQueueStatus, SyncQueueStatus } from '@/lib/sync-queue';

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
      case 'syncing':
        const count = queueStatus.processingCount + queueStatus.pendingCount;
        return isRTL ? `جاري المزامنة... (${count})` : `Syncing... (${count})`;
      case 'success':
        return isRTL ? 'تمت المزامنة ✓' : 'Synced ✓';
      case 'error':
        return isRTL ? `فشل (${queueStatus.failedCount})` : `Failed (${queueStatus.failedCount})`;
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
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'offline':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-all",
        getStateStyles(),
        className
      )}
    >
      {getIcon()}
      <span>{getMessage()}</span>
    </div>
  );
}

// Hook للاستخدام في CartPanel
export function useSyncState() {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');

  const startSync = (message?: string) => {
    setSyncState('syncing');
    setSyncMessage(message || '');
  };

  const completeSync = () => {
    setSyncState('success');
    setSyncMessage('');
    setTimeout(() => setSyncState('idle'), 3000);
  };

  const failSync = (error?: string) => {
    setSyncState('error');
    setSyncMessage(error || '');
  };

  return {
    syncState,
    syncMessage,
    startSync,
    completeSync,
    failSync,
    setSyncState,
  };
}
