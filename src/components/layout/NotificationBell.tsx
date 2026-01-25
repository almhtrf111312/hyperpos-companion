import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Package, X, CheckCheck, Trash2, CalendarX, Key, Shield, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/hooks/use-language';

const notificationConfig: Record<Notification['type'], { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  debt_overdue: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  debt_due_today: {
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  low_stock: {
    icon: Package,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  out_of_stock: {
    icon: Package,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  expired: {
    icon: CalendarX,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  expiring_soon: {
    icon: CalendarX,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  license_status: {
    icon: Key,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  license_expiring: {
    icon: Shield,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
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
    const { isRTL, t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const { 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      clearNotification,
      clearAllNotifications 
    } = useNotifications();

    const handleNotificationClick = (notification: Notification) => {
      markAsRead(notification.id);
      
      // Navigate based on notification type
      if (notification.type === 'license_status' || notification.type === 'license_expiring') {
        navigate('/settings?tab=license');
      } else if (notification.type === 'debt_overdue' || notification.type === 'debt_due_today') {
        navigate('/debts');
      } else if (notification.type === 'low_stock' || notification.type === 'out_of_stock' || 
                 notification.type === 'expired' || notification.type === 'expiring_soon') {
        navigate('/products');
      }
      
      setIsOpen(false);
    };

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button 
            ref={ref}
            className={cn(
              "relative rounded-xl bg-muted hover:bg-muted/80 transition-colors",
              compact ? "p-2" : "p-3"
            )}
          >
            <Bell className={cn(
              "text-muted-foreground",
              compact ? "w-4 h-4" : "w-5 h-5"
            )} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 md:w-96 p-0 bg-card border-border" 
          align="end"
          sideOffset={8}
        >
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
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="w-4 h-4 me-1" />
                  {isRTL ? 'قراءة الكل' : 'Mark all read'}
                </Button>
              )}
            </div>
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
                        "p-4 hover:bg-muted/50 transition-colors cursor-pointer relative group",
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(notification.timestamp, isRTL)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Delete button - only show for non-persistent notifications */}
                      {!notification.persistent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                          className={cn(
                            "absolute top-2 p-1.5 rounded-lg bg-muted hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all",
                            isRTL ? "left-2" : "right-2"
                          )}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
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
    );
  }
);

NotificationBell.displayName = 'NotificationBell';
