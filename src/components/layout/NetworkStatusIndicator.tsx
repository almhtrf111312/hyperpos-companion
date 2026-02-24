// Network Status Indicator - shows offline/online status
import { forwardRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import { useLanguage } from '@/hooks/use-language';

interface NetworkStatusIndicatorProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const NetworkStatusIndicator = forwardRef<HTMLDivElement, NetworkStatusIndicatorProps>(
  ({ compact = false, showLabel = false, className }, ref) => {
    const { isSyncing, syncNow } = useCloudSyncContext();
    const { t } = useLanguage();
    
    const { isOnline } = useNetworkStatus(() => {
      syncNow();
    });

    const onlineLabel = t('nav.pos' as any) ? 'متصل بالإنترنت' : 'Online';
    const offlineLabel = t('nav.pos' as any) ? 'غير متصل بالإنترنت' : 'Offline';
    const syncingLabel = t('nav.pos' as any) ? 'جاري المزامنة...' : 'Syncing...';

    if (isSyncing) {
      return (
        <div ref={ref} className={cn("flex items-center gap-2", className)} style={{ color: 'hsl(var(--primary))' }}>
          <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          {showLabel && <span className="text-xs truncate">{syncingLabel}</span>}
        </div>
      );
    }

    if (isOnline) {
      return (
        <div ref={ref} className={cn("flex items-center gap-2", className)} style={{ color: 'hsl(var(--success))' }}>
          <Wifi className="w-4 h-4 flex-shrink-0" />
          {showLabel && <span className="text-xs truncate">{onlineLabel}</span>}
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)} style={{ color: 'hsl(var(--destructive))' }}>
        <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
        {showLabel && <span className="text-xs truncate">{offlineLabel}</span>}
      </div>
    );
  }
);

NetworkStatusIndicator.displayName = 'NetworkStatusIndicator';
