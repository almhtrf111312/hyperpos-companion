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

    if (isSyncing) {
      return (
        <div ref={ref} className={cn("flex items-center gap-2 text-primary", className)}>
          <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          {showLabel && <span className="text-xs truncate">{t('sync.syncing' as any) || 'جاري المزامنة...'}</span>}
        </div>
      );
    }

    if (isOnline) {
      return (
        <div ref={ref} className={cn("flex items-center gap-2 text-success", className)}>
          <Wifi className="w-4 h-4 flex-shrink-0" />
          {showLabel && <span className="text-xs truncate">{t('network.online' as any) || 'متصل بالإنترنت'}</span>}
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-2 text-destructive", className)}>
        <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
        {showLabel && <span className="text-xs truncate">{t('network.offline' as any) || 'غير متصل بالإنترنت'}</span>}
      </div>
    );
  }
);

NetworkStatusIndicator.displayName = 'NetworkStatusIndicator';
