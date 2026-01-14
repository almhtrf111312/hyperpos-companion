import { AlertTriangle, Clock } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';

export function TrialBanner() {
  const { isTrial, remainingDays, isValid } = useLicense();
  const { language } = useLanguage();
  
  const isRTL = language === 'ar';

  // Only show for valid trial licenses
  if (!isValid || !isTrial || remainingDays === null) {
    return null;
  }

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
        {isUrgent ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
        <span>
          {isRTL 
            ? `فترة تجريبية: متبقي ${remainingDays} ${remainingDays === 1 ? 'يوم' : 'أيام'}`
            : `Trial: ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'} remaining`
          }
        </span>
      </div>
    </div>
  );
}
