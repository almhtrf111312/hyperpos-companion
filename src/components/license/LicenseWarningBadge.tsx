import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function LicenseWarningBadge() {
  const { user } = useAuth();
  const { isTrial, remainingDays, isValid, expiringWarning, isLoading } = useLicense();
  const { language } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);
  
  const isRTL = language === 'ar';

  // Reset dismissed state when app loads (component mounts)
  useEffect(() => {
    setIsDismissed(false);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('[LicenseWarningBadge] State:', {
      user: !!user,
      isLoading,
      isValid, 
      isTrial, 
      remainingDays, 
      expiringWarning, 
      isDismissed
    });
  }, [user, isLoading, isValid, isTrial, remainingDays, expiringWarning, isDismissed]);

  // Don't show if no user or still loading
  if (!user || isLoading) {
    return null;
  }

  // Determine if we should show the badge
  const shouldShow = isValid && !isDismissed && remainingDays !== null && (
    // Show for trial licenses
    isTrial || 
    // Show when 30 days or less remaining (expiringWarning from backend)
    expiringWarning ||
    // Fallback: show if remaining days <= 30
    remainingDays <= 30
  );

  if (!shouldShow) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  const isCritical = remainingDays <= 7;
  const isUrgent = remainingDays <= 14;

  return (
    <div 
      className={cn(
        "fixed z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-300 hover:scale-105",
        isRTL ? "top-4 left-4" : "top-4 left-4",
        isCritical 
          ? "bg-destructive text-destructive-foreground animate-pulse" 
          : isUrgent 
            ? "bg-orange-500 text-white" 
            : "bg-amber-500 text-white"
      )}
      onClick={handleDismiss}
      dir={isRTL ? 'rtl' : 'ltr'}
      title={isRTL ? 'انقر للإخفاء' : 'Click to dismiss'}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium whitespace-nowrap">
        {isRTL 
          ? `${isTrial ? 'تجريبي: ' : ''}${remainingDays} ${remainingDays === 1 ? 'يوم' : 'يوم'} متبقي`
          : `${isTrial ? 'Trial: ' : ''}${remainingDays} ${remainingDays === 1 ? 'day' : 'days'} left`
        }
      </span>
      <X className="w-3 h-3 flex-shrink-0 opacity-70 hover:opacity-100" />
    </div>
  );
}
