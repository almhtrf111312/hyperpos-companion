import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Package, X, CheckCheck, Trash2, CalendarX, Key, Shield, Pin, Loader2, CheckCircle, Archive } from 'lucide-react';
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

const notificationConfig: Record<Notification['type'], { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  debt_overdue: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  debt_due_today: { icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
  low_stock: { icon: Package, color: 'text-warning', bgColor: 'bg-warning/10' },
  out_of_stock: { icon: Package, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  expired: { icon: CalendarX, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  expiring_soon: { icon: CalendarX, color: 'text-warning', bgColor: 'bg-warning/10' },
  license_status: { icon: Key, color: 'text-primary', bgColor: 'bg-primary/10' },
  license_expiring: { icon: Shield, color: 'text-warning', bgColor: 'bg-warning/10' },
};

function formatTimeAgo(date: Date, isRTL: boolean): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (isRTL) {
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffDays} يوم`;
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
    const { isRTL } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
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
        setActivationError(isRTL ? 'يرجى إدخال كود التفعيل' : 'Please enter activation code');
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
        setActivationError(result.error || (isRTL ? 'كود التفعيل غير صالح' : 'Invalid activation code'));
      }
    };

    const handleCloseActivationDialog = () => {
      setShowActivationDialog(false);
      setActivationCode('');
      setActivationError(null);
      setActivationSuccess(false);
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
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
                  {isRTL ? 'الإشعارات' : 'Notifications'}
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {unreadCount} {isRTL ? 'جديد' : 'new'}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
                  <CheckCheck className="w-4 h-4 me-1" />
                  {isRTL ? 'قراءة الكل' : 'Mark all read'}
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
                    {isRTL ? 'لا توجد إشعارات' : 'No notifications'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => {
                    const config = notificationConfig[notification.type];
                    const Icon = config.icon;
                    
                    return (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-muted/50 transition-colors cursor-pointer relative",
                          !notification.read && "bg-primary/5"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex gap-3">
                          <div className={cn("p-2 rounded-lg flex-shrink-0", config.bgColor)}>
                            <Icon className={cn("w-5 h-5", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1">
                                <p className={cn(
                                  "font-medium text-sm text-foreground",
                                  !notification.read && "font-semibold"
                                )}>
                                  {notification.title}
                                </p>
                                {notification.persistent && (
                                  <Pin className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(notification.timestamp, isRTL)}
                              </p>
                              {/* Always-visible Archive button */}
                              {!notification.persistent && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archiveNotification(notification.id);
                                  }}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>{isRTL ? 'إخفاء' : 'Hide'}</span>
                                </button>
                              )}
                            </div>
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
                  <Trash2 className="w-4 h-4 me-2" />
                  {isRTL ? 'مسح جميع الإشعارات' : 'Clear all notifications'}
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
                {isRTL ? 'حالة الترخيص والتفعيل' : 'License Status & Activation'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {isRTL ? 'الحالة الحالية:' : 'Current Status:'}
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
                      ? (isRTL ? 'منتهي' : 'Expired')
                      : isTrial 
                        ? (isRTL ? 'تجريبي' : 'Trial')
                        : (isRTL ? 'مفعّل' : 'Active')
                    }
                  </span>
                </div>
                
                {expiresAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isRTL ? 'تاريخ الانتهاء:' : 'Expires:'}</span>
                    <span className={isExpired ? 'text-destructive' : 'text-foreground'}>{formatDate(expiresAt)}</span>
                  </div>
                )}
                
                {remainingDays !== null && remainingDays > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{isRTL ? 'الأيام المتبقية:' : 'Days remaining:'}</span>
                    <span className="text-foreground font-medium">{remainingDays} {isRTL ? 'يوم' : 'days'}</span>
                  </div>
                )}
              </div>

              {activationSuccess ? (
                <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-success">
                    {isRTL ? 'تم تفعيل الكود بنجاح!' : 'Code activated successfully!'}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {isRTL ? 'أدخل كود التفعيل:' : 'Enter activation code:'}
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
                        <span className={isRTL ? 'mr-2' : 'ml-2'}>{isRTL ? 'جاري التحقق...' : 'Verifying...'}</span>
                      </>
                    ) : (
                      <>{isRTL ? 'تفعيل الكود' : 'Activate Code'}</>
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
