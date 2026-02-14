import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function LicenseWarningBadge() {
  const { user } = useAuth();
  const { isTrial, remainingDays, isValid, expiringWarning, isLoading } = useLicense();
  const { t, isRTL } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => { setIsDismissed(false); }, []);

  if (!user || isLoading) return null;

  const shouldShow = isValid && !isDismissed && remainingDays !== null && (
    isTrial || expiringWarning || remainingDays <= 30
  );

  if (!shouldShow) return null;

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
        "top-4 left-4",
        isCritical 
          ? "bg-destructive text-destructive-foreground animate-pulse" 
          : isUrgent 
            ? "bg-orange-500 text-white" 
            : "bg-amber-500 text-white"
      )}
      onClick={handleDismiss}
      dir={isRTL ? 'rtl' : 'ltr'}
      title={t('license.clickToDismiss')}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium whitespace-nowrap">
        {`${isTrial ? t('license.trialPrefix') : ''}${remainingDays} ${remainingDays === 1 ? t('license.days') : t('license.daysPlural')} ${t('license.daysLeft')}`}
      </span>
      <X className="w-3 h-3 flex-shrink-0 opacity-70 hover:opacity-100" />
    </div>
  );
}
