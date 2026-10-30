/**
 * Sync Status Menu & Drawer - Shows sync state with comprehensive operations history
 * Full-height responsive Sheet overlay replacing legacy small popover
 */
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertTriangle,
  Clock,
  Pause,
  Play,
  WifiOff,
  History,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn, formatCurrency } from '@/lib/utils';
import { getDueExpenses, RecurringExpense } from '@/lib/recurring-expenses-store';
import { useLanguage } from '@/hooks/use-language';
import { CloudSyncContext } from '@/providers/CloudSyncProvider';
import { getQueueStatus, SyncQueueStatus } from '@/lib/sync-queue';
import { loadHistory, SyncHistoryItem, SYNC_HISTORY_UPDATED, cleanupSyncedItems } from '@/lib/sync-history';
import { EVENTS } from '@/lib/events';
import { StuckOperationsList } from './StuckOperationsList';

// Helper to format date and time as: 25 تشرين الأول | 03:15 م
function formatLastSyncTime(timestamp: string | null | undefined, isRTL: boolean): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const day = date.getDate();
  const monthsAr = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
  ];
  const monthsEn = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = isRTL ? (hours >= 12 ? 'م' : 'ص') : (hours >= 12 ? 'PM' : 'AM');
  hours = hours % 12 || 12;
  const hoursStr = hours.toString().padStart(2, '0');

  if (isRTL) {
    const month = monthsAr[date.getMonth()];
    return `${day} ${month} | ${hoursStr}:${minutes} ${period}`;
  } else {
    const month = monthsEn[date.getMonth()];
    return `${day} ${month} | ${hoursStr}:${minutes} ${period}`;
  }
}

export function SyncStatusMenu() {
  const { isRTL, t, language } = useLanguage();
  const navigate = useNavigate();
  const cloudContext = useContext(CloudSyncContext);
  const isOnline = cloudContext?.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isSyncing = cloudContext?.isSyncing ?? false;
  const isPaused = cloudContext?.isPaused ?? false;
  const hasInternetAccess = cloudContext?.hasInternetAccess ?? true;
  const syncNow = cloudContext?.syncNow ?? (async () => ({ success: false, processed: 0, failed: 0 }));
  const pauseSync = cloudContext?.pauseSync ?? (() => {});
  const resumeSync = cloudContext?.resumeSync ?? (() => {});

  const [queueStatus, setQueueStatus] = useState<SyncQueueStatus>(getQueueStatus());
  const [history, setHistory] = useState<SyncHistoryItem[]>(loadHistory());
  const [isOpen, setIsOpen] = useState(false);
  const [dueExpenses, setDueExpenses] = useState<RecurringExpense[]>(() => getDueExpenses());

  useEffect(() => {
    const handleQueueUpdate = () => setQueueStatus(getQueueStatus());
    const handleHistoryUpdate = (e: Event) => {
      const ce = e as CustomEvent<SyncHistoryItem[]>;
      setHistory(ce.detail || loadHistory());
    };

    window.addEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleQueueUpdate);
    window.addEventListener(SYNC_HISTORY_UPDATED, handleHistoryUpdate);
    const handleRecurringUpdate = () => setDueExpenses(getDueExpenses());
    window.addEventListener(EVENTS.RECURRING_EXPENSES_UPDATED, handleRecurringUpdate);

    const cleanup = setInterval(cleanupSyncedItems, 5 * 60 * 1000);

    return () => {
      window.removeEventListener(EVENTS.SYNC_QUEUE_UPDATED, handleQueueUpdate);
      window.removeEventListener(SYNC_HISTORY_UPDATED, handleHistoryUpdate);
      window.removeEventListener(EVENTS.RECURRING_EXPENSES_UPDATED, handleRecurringUpdate);
      clearInterval(cleanup);
    };
  }, []);

  const pendingCount = queueStatus.pendingCount + queueStatus.processingCount;
  const hasIssues = queueStatus.failedCount > 0;

  const getStatus = () => {
    if (!isOnline) return 'offline';
    if (isOnline && !hasInternetAccess) return 'noInternet';
    if (isPaused) return 'paused';
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
      label: t('sync.offline') || 'غير متصل بالإنترنت',
      animate: 'animate-pulse',
    },
    noInternet: {
      icon: WifiOff,
      color: 'text-destructive',
      label: isRTL ? 'متصل بالشبكة بدون إنترنت' : 'No Internet Access',
      animate: 'animate-pulse',
    },
    paused: {
      icon: Pause,
      color: 'text-warning',
      label: isRTL ? 'المزامنة متوقفة مؤقتاً' : 'Sync Paused',
      animate: '',
    },
    syncing: {
      icon: RefreshCw,
      color: 'text-primary',
      label: t('sync.syncing') || 'جاري المزامنة...',
      animate: 'animate-spin',
    },
    error: {
      icon: AlertTriangle,
      color: 'text-destructive',
      label: t('sync.error') || 'تعذر المزامنة',
      animate: '',
    },
    pending: {
      icon: Clock,
      color: 'text-warning',
      label: t('sync.pending') || 'في انتظار المزامنة',
      animate: '',
    },
    synced: {
      icon: Cloud,
      color: 'text-green-500',
      label: t('sync.synced') || 'تمت المزامنة',
      animate: '',
    },
  } as const;

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getItemStatusIcon = (itemStatus: SyncHistoryItem['status']) => {
    switch (itemStatus) {
      case 'synced':
        return (
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Check className="h-4 w-4" />
          </div>
        );
      case 'pending':
        return (
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Clock className="h-4 w-4" />
          </div>
        );
      case 'syncing':
        return (
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        );
      case 'failed':
        return (
          <div className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0 border border-destructive/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
    }
  };

  const getItemStatusLabel = (itemStatus: SyncHistoryItem['status']) => {
    const labels = {
      synced: t('sync.synced') || 'مكتمل',
      pending: t('sync.pending') || 'بالانتظار',
      syncing: t('sync.syncing') || 'جاري الرفع',
      failed: t('sync.error') || 'فشل',
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

  const effectiveLastSyncTime = cloudContext?.lastSyncTime || queueStatus.lastSyncTime || (typeof window !== 'undefined' ? localStorage.getItem('hyperpos_last_sync_time') : null);
  const formattedLastSync = formatLastSyncTime(effectiveLastSyncTime, isRTL);

  const sortedHistory = [...history].sort((a, b) => {
    const priority = { failed: 0, pending: 1, syncing: 2, synced: 3 };
    const pDiff = priority[a.status] - priority[b.status];
    if (pDiff !== 0) return pDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const handleManualFullSync = async () => {
    // 1. إعادة تنشيط كافة الفواتير والعمليات المتعثرة دفعة واحدة
    const { retryFailedOperations } = await import('@/lib/sync-queue');
    retryFailedOperations();

    // 2. إطلاق المزامنة المتسلسلة
    await syncNow(true);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9 cursor-pointer", config.color)}
          title={config.label}
        >
          <StatusIcon className={cn("h-4.5 w-4.5", config.animate)} />
          {(pendingCount > 0 || hasIssues || dueExpenses.length > 0) && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs",
              hasIssues
                ? "bg-destructive text-destructive-foreground"
                : dueExpenses.length > 0
                ? "bg-amber-500 text-white animate-pulse"
                : "bg-warning text-warning-foreground"
            )}>
              {hasIssues ? queueStatus.failedCount : dueExpenses.length > 0 ? dueExpenses.length : pendingCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side={isRTL ? "left" : "right"}
        className="w-full sm:max-w-md p-0 flex flex-col bg-background border-border shadow-2xl h-full max-h-[100dvh] overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3.5 border-b border-border/70 shrink-0 bg-muted/20 text-start">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-border/50", config.color, "bg-muted/60")}>
                <StatusIcon className={cn("h-5 w-5", config.animate)} />
              </div>
              <div className="min-w-0 text-start">
                <SheetTitle className="text-sm sm:text-base font-bold text-foreground truncate leading-tight">
                  {config.label}
                </SheetTitle>
                {status === 'synced' && formattedLastSync ? (
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {formattedLastSync}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {pendingCount > 0 ? `عمليات بالانتظار: ${pendingCount}` : hasIssues ? `أخطاء مزامنة: ${queueStatus.failedCount}` : (isRTL ? 'سجل وحالة المزامنة السحابية' : 'Cloud sync status')}
                  </p>
                )}
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0 rtl:ml-8 ltr:mr-8">
              {isPaused ? (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-xl" onClick={resumeSync}>
                  <Play className="h-3.5 w-3.5" />
                  <span>استئناف</span>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-xl" onClick={pauseSync} title="إيقاف المزامنة مؤقتاً">
                  <Pause className="h-3.5 w-3.5" />
                  <span>إيقاف</span>
                </Button>
              )}
              {isOnline && !isPaused && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs gap-1 rounded-xl bg-primary text-primary-foreground font-bold shadow-xs"
                  onClick={handleManualFullSync}
                  disabled={isSyncing}
                  title="مزامنة شاملة لكافة العمليات المعلقة والمتعثرة"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  <span className="hidden sm:inline">مزامنة</span>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {status === 'noInternet' && (
            <div className="px-4 py-2.5 text-xs text-destructive bg-destructive/10 border-b border-destructive/20 font-medium">
              متصل بالشبكة لكن لا يوجد إنترنت فعلي. يتم استخدام البيانات المحلية المخزّنة.
            </div>
          )}

          {/* Due Recurring Expenses Alert Card */}
          {dueExpenses.length > 0 && (
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/25">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t('expenses.dueTodayTitle')} ({dueExpenses.length})</span>
                </div>
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0 font-mono">
                  {formatCurrency(dueExpenses.reduce((sum, e) => sum + e.amount, 0))}
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {dueExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between bg-card border border-amber-500/20 rounded-xl p-2 gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs truncate text-foreground">{expense.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        <span className="font-bold text-foreground">{formatCurrency(expense.amount)}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shrink-0 gap-1"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/expenses?payRecurringId=${expense.id}`);
                      }}
                    >
                      <Check className="h-3 w-3" />
                      <span>{t('expenses.payNowButton')}</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <StuckOperationsList />

          {/* Section Header */}
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-primary" />
              <span>{isRTL ? 'سجل العمليات المزامنة' : 'Sync History'}</span>
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {sortedHistory.length} {isRTL ? 'عملية' : 'items'}
            </span>
          </div>

          {/* History List */}
          {sortedHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
              <Cloud className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="font-bold">{t('sync.noRecentOperations') || 'لا توجد عمليات مزامنة حديثة'}</p>
              <p className="text-xs text-muted-foreground/80">العمليات الجديدة ستظهر هنا فور إجرائها</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {sortedHistory.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="mt-0.5 shrink-0">
                    {getItemStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{item.label}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <span className="font-mono">{formatTime(item.timestamp)}</span>
                      {item.meta?.partyOrItem && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[14rem] text-foreground/80 font-medium">{item.meta.partyOrItem}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={item.status === 'failed' ? 'destructive' : item.status === 'synced' ? 'secondary' : 'outline'}
                    className="text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0"
                  >
                    {getItemStatusLabel(item.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 shrink-0 bg-muted/20 space-y-2">
          {(pendingCount > 0 || hasIssues) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              {pendingCount > 0 && (
                <span>{t('sync.pendingOps').replace('{count}', String(pendingCount))}</span>
              )}
              {hasIssues && (
                <span className="text-destructive font-bold">
                  {t('sync.failedOps').replace('{count}', String(queueStatus.failedCount))}
                </span>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center text-xs h-9 rounded-xl font-bold border-border/80 hover:bg-muted"
            onClick={() => {
              setIsOpen(false);
              navigate('/invoice-tracking');
            }}
          >
            <Receipt className="h-3.5 w-3.5 ml-1.5" />
            <span>شاشة تتبع الفواتير</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
