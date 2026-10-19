import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Package, X, CheckCheck, Trash2, CalendarX, Key, Shield, Pin, Loader2, CheckCircle, Archive, Receipt, Wallet, HandCoins, PackageCheck, Cloud, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/hooks/use-language';
import { useLicense } from '@/hooks/use-license';

const notificationConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  debt_overdue: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  debt_due_today: { icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
  low_stock: { icon: Package, color: 'text-warning', bgColor: 'bg-warning/10' },
  out_of_stock: { icon: Package, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  expired: { icon: CalendarX, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  expiring_soon: { icon: CalendarX, color: 'text-warning', bgColor: 'bg-warning/10' },
  license_status: { icon: Key, color: 'text-primary', bgColor: 'bg-primary/10' },
  license_expiring: { icon: Shield, color: 'text-warning', bgColor: 'bg-warning/10' },
  sale: { icon: Receipt, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20' },
  expense: { icon: Wallet, color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-500/10 dark:bg-rose-500/20' },
  debt: { icon: HandCoins, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10 dark:bg-blue-500/20' },
  inventory: { icon: PackageCheck, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500/10 dark:bg-purple-500/20' },
  purchase: { icon: Package, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10 dark:bg-amber-500/20' },
  sync: { icon: Cloud, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/20' },
  system: { icon: Bell, color: 'text-primary', bgColor: 'bg-primary/10' },
};

function getNotificationVisuals(notification: Notification) {
  const cat = notification.category;
  if (cat && notificationConfig[cat]) {
    return notificationConfig[cat];
  }
  if (notificationConfig[notification.type]) {
    return notificationConfig[notification.type];
  }
  return notificationConfig.system;
}

function formatTimeAgo(date: Date, language: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (language === 'ar') {
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffDays} يوم`;
  } else if (language === 'tr') {
    if (diffMins < 1) return 'Şimdi';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    return `${diffDays} gün önce`;
  } else if (language === 'fa') {
    if (diffMins < 1) return 'الان';
    if (diffMins < 60) return `${diffMins} دقیقه پیش`;
    if (diffHours < 24) return `${diffHours} ساعت پیش`;
    return `${diffDays} روز پیش`;
  } else if (language === 'ku') {
    if (diffMins < 1) return 'ئێستا';
    if (diffMins < 60) return `پێش ${diffMins} خولەک`;
    if (diffHours < 24) return `پێش ${diffHours} کاتژمێر`;
    return `پێش ${diffDays} ڕۆژ`;
  } else {
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  }
}

interface NotificationBellProps {
  compact?: boolean;
}

export const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  ({ compact = false }, ref) => {
    const navigate = useNavigate();
    const { isRTL, t, language } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
    const [showActivationDialog, setShowActivationDialog] = useState(false);
    const [activationCode, setActivationCode] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [activationError, setActivationError] = useState<string | null>(null);
    const [activationSuccess, setActivationSuccess] = useState(false);
    
    const { 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      clearAllNotifications,
      archiveNotification,
    } = useNotifications();
    
    const { activateCode, isTrial, isExpired, expiresAt, remainingDays } = useLicense();

    const formatCode = (value: string) => {
      let cleaned = value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
      if (cleaned.startsWith('HYPER-')) {
        const afterPrefix = cleaned.slice(6).replace(/-/g, '');
        const parts = afterPrefix.match(/.{1,4}/g) || [];
        return 'HYPER-' + parts.join('-');
      }
      cleaned = cleaned.replace(/-/g, '');
      const parts = cleaned.match(/.{1,4}/g) || [];
      return parts.join('-');
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCode(e.target.value);
      setActivationCode(formatted);
      setActivationError(null);
    };

    const handleActivate = async () => {
      if (!activationCode.trim()) {
        setActivationError(t('license.enterCode'));
        return;
      }
      setIsActivating(true);
      setActivationError(null);
      const result = await activateCode(activationCode.trim());
      setIsActivating(false);
      if (result.success) {
        setActivationSuccess(true);
        setActivationCode('');
      } else {
        setActivationError(result.error || t('license.invalidCode'));
      }
    };

    const handleCloseActivationDialog = () => {
      setShowActivationDialog(false);
      setActivationCode('');
      setActivationError(null);
      setActivationSuccess(false);
    };

    const getLocale = () => {
      if (language === 'ar') return 'ar-SA';
      if (language === 'tr') return 'tr-TR';
      if (language === 'fa') return 'fa-IR';
      return 'en-US';
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString(getLocale(), {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    };

    const handleNotificationClick = (notification: Notification) => {
      markAsRead(notification.id);
      if (notification.type === 'license_status' || notification.type === 'license_expiring') {
        setIsOpen(false);
        setShowActivationDialog(true);
        return;
      }
      if (notification.type === 'debt_overdue' || notification.type === 'debt_due_today') {
        navigate('/debts');
      } else if (notification.type === 'low_stock' || notification.type === 'out_of_stock' || 
                 notification.type === 'expired' || notification.type === 'expiring_soon') {
        navigate('/products');
      }
      setIsOpen(false);
    };

    return (
      <>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button 
              ref={ref}
              className={cn(
                "relative rounded-xl bg-muted hover:bg-muted/80 transition-colors",
                compact ? "p-2" : "p-3"
              )}
            >
              <Bell className={cn("text-muted-foreground", compact ? "w-4 h-4" : "w-5 h-5")} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 md:w-96 p-0 bg-card border-border" align="end" sideOffset={8}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {t('notification.notifications')}
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {unreadCount} {t('notification.new')}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
                  <CheckCheck className="w-4 h-4" />
                  {t('notification.markAllRead')}
                </Button>
              )}
            </div>

            {/* Notifications List */}
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <div className="p-4 rounded-full bg-muted mb-3">
                    <Bell className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {t('notification.noNotifications')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => {
                    const visuals = getNotificationVisuals(notification);
                    const Icon = visuals.icon;
                    const isExpanded = expandedNotificationId === notification.id;
                    const hasDetails = Boolean(notification.meta?.details);
                    const titleText = notification.meta?.operationTitle || notification.title;
                    const syncState = notification.meta?.syncState;

                    // Summary line (line 2)
                    const summaryLine = notification.meta
                      ? [notification.meta.partyOrItem, notification.meta.amountText].filter(Boolean).join(' • ')
                      : notification.message;

                    return (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-3 hover:bg-muted/50 transition-colors cursor-pointer relative border-b border-border/40 last:border-b-0",
                          !notification.read && "bg-primary/5"
                        )}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (hasDetails) {
                            setExpandedNotificationId(prev => prev === notification.id ? null : notification.id);
                          } else {
                            handleNotificationClick(notification);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (hasDetails) {
                              setExpandedNotificationId(prev => prev === notification.id ? null : notification.id);
                            } else {
                              handleNotificationClick(notification);
                            }
                          }
                        }}
                      >
                        <div className="flex gap-2.5 items-start">
                          {/* 1. Category Icon */}
                          <div className={cn("p-2 rounded-xl flex-shrink-0 mt-0.5", visuals.bgColor)}>
                            <Icon className={cn("w-4 h-4", visuals.color)} />
                          </div>

                          {/* 2. Compact 2-Line Body */}
                          <div className="flex-1 min-w-0">
                            {/* السطر الأول: العنوان المحاسبي + شارة المزامنة + الوقت */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className={cn(
                                  "font-semibold text-xs sm:text-sm text-foreground truncate",
                                  !notification.read && "font-bold text-primary"
                                )}>
                                  {titleText}
                                </p>
                                {notification.persistent && (
                                  <Pin className="w-3 h-3 text-muted-foreground shrink-0" />
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {syncState && (
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.2 rounded font-mono font-medium",
                                    syncState === 'synced' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : syncState === 'pending' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-destructive/10 text-destructive"
                                  )}>
                                    {syncState === 'synced' ? 'تمت' : syncState === 'pending' ? 'معلق' : 'فشل'}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatTimeAgo(notification.timestamp, language)}
                                </span>
                              </div>
                            </div>

                            {/* السطر الثاني: الطرف / البند • المبلغ (أو نص الإشعار الموجز) */}
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate" dir="auto">
                                {summaryLine}
                              </p>
                              {!notification.persistent && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archiveNotification(notification.id);
                                  }}
                                  className="text-[10px] text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors shrink-0 ml-1"
                                  title={t('notification.hide')}
                                >
                                  <Archive className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* القسم القابل للتوسيع: تفاصيل إضافية عند النقر */}
                            {isExpanded && notification.meta?.details && (
                              <div 
                                className="text-[11px] bg-muted/50 rounded-lg p-2 mt-2 border border-border/50 text-muted-foreground leading-relaxed animate-in fade-in duration-150"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationClick(notification);
                                }}
                              >
                                <div>{notification.meta.details}</div>
                                <div className="mt-1 text-[10px] text-primary hover:underline cursor-pointer font-medium">
                                  انقر للانتقال للقسم المعني ←
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-border">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={clearAllNotifications}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('notification.clearAll')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* License Activation Dialog */}
        <Dialog open={showActivationDialog} onOpenChange={handleCloseActivationDialog}>
          <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                {t('license.licenseStatus')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {t('license.currentStatus')}
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium",
                    isExpired 
                      ? 'bg-destructive/10 text-destructive' 
                      : isTrial 
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                  )}>
                    {isExpired 
                      ? t('license.expired')
                      : isTrial 
                        ? t('license.trial')
                        : t('license.activated')
                    }
                  </span>
                </div>
                
                {expiresAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('license.expiresAt')}</span>
                    <span className={isExpired ? 'text-destructive' : 'text-foreground'}>{formatDate(expiresAt)}</span>
                  </div>
                )}
                
                {remainingDays !== null && remainingDays > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{t('license.remainingDays')}</span>
                    <span className="text-foreground font-medium">{remainingDays} {t('license.daysPlural')}</span>
                  </div>
                )}
              </div>

              {activationSuccess ? (
                <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-success">
                    {t('license.activationSuccess')}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t('license.enterCodeLabel')}
                  </label>
                  <div className="relative">
                    <Key className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
                      isRTL ? 'right-3' : 'left-3'
                    )} />
                    <Input
                      type="text"
                      placeholder="HYPER-XXXX-XXXX-XXXX-XXXX"
                      value={activationCode}
                      onChange={handleCodeChange}
                      className={cn("font-mono tracking-wider text-center", isRTL ? 'pr-10' : 'pl-10')}
                      maxLength={25}
                      disabled={isActivating}
                    />
                  </div>
                  
                  {activationError && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{activationError}</span>
                    </div>
                  )}
                  
                  <Button onClick={handleActivate} className="w-full" disabled={isActivating || !activationCode.trim()}>
                    {isActivating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="ms-2">{t('license.verifying')}</span>
                      </>
                    ) : (
                      <>{t('license.activateApp')}</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

NotificationBell.displayName = 'NotificationBell';