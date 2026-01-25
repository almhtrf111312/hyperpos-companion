// Network Status Indicator - shows offline/online icon in sidebar
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NetworkStatusIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function NetworkStatusIndicator({ compact = false, className }: NetworkStatusIndicatorProps) {
  const { isSyncing, syncNow } = useCloudSyncContext();
  
  // This hook handles toasts and auto-sync on reconnect
  const { isOnline } = useNetworkStatus(() => {
    // Auto-sync when coming back online
    syncNow();
  });

  if (isOnline && !isSyncing) {
    // Online and not syncing - show green wifi or hide
    if (compact) return null;
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1 text-success", className)}>
            <Wifi className="w-4 h-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent>متصل بالإنترنت</TooltipContent>
      </Tooltip>
    );
  }

  if (isSyncing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1 text-primary", className)}>
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
        </TooltipTrigger>
        <TooltipContent>جاري المزامنة...</TooltipContent>
      </Tooltip>
    );
  }

  // Offline
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1 text-destructive animate-pulse", className)}>
          <WifiOff className="w-4 h-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>غير متصل بالإنترنت</TooltipContent>
    </Tooltip>
  );
}
