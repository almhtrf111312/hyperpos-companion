import { AlertTriangle, Clock } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';

export function TrialBanner() {
  const { isTrial, remainingDays, isValid } = useLicense();
  const { t, isRTL } = useLanguage();

  if (!isValid || !isTrial || remainingDays === null) return null;

  const isUrgent = remainingDays <= 7;
  const isCritical = remainingDays <= 3;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium transition-colors ${
        isCritical 
          ? 'bg-destructive text-destructive-foreground' 
          : isUrgent 
            ? 'bg-orange-500 text-white' 
            : 'bg-primary text-primary-foreground'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-center gap-2">
        {isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        <span>
          {`${t('license.trialPeriod')} ${remainingDays} ${remainingDays === 1 ? t('license.days') : t('license.daysPlural')}`}
        </span>
      </div>
    </div>
  );
}
