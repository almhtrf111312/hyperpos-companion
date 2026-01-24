import { ReactNode, useEffect, useState } from 'react';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { useDeviceBinding } from '@/hooks/use-device-binding';
import { ActivationScreen } from './ActivationScreen';
import { TrialBanner } from './TrialBanner';
import { DeviceBlockedScreen } from '@/components/auth/DeviceBlockedScreen';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Clock } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface LicenseGuardProps {
  children: ReactNode;
}

function LicenseChoiceScreen({ onChooseActivation, onChooseTrial, isStartingTrial }: {
  onChooseActivation: () => void;
  onChooseTrial: () => void;
  isStartingTrial: boolean;
}) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">
            {isRTL ? 'مرحباً بك في FlowPOS Pro' : 'Welcome to FlowPOS Pro'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'اختر طريقة تفعيل التطبيق' : 'Choose how to activate the application'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            variant="default"
            className="w-full h-auto py-4 flex flex-col items-center gap-2"
            onClick={onChooseActivation}
          >
            <Key className="w-6 h-6" />
            <span className="font-semibold">
              {isRTL ? 'لدي كود تفعيل' : 'I have an activation code'}
            </span>
            <span className="text-xs opacity-80">
              {isRTL ? 'أدخل كود التفعيل للحصول على ترخيص كامل' : 'Enter your code for full license'}
            </span>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-center gap-2"
            onClick={onChooseTrial}
            disabled={isStartingTrial}
          >
            {isStartingTrial ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
            <span className="font-semibold">
              {isRTL ? 'تجربة مجانية 30 يوم' : '30-day free trial'}
            </span>
            <span className="text-xs opacity-80">
              {isRTL ? 'جرب التطبيق مجاناً قبل الشراء' : 'Try the app free before purchasing'}
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading, isValid, hasLicense, needsActivation, startTrial, isTrial, checkLicense } = useLicense();
  const { isChecking: isCheckingDevice, isDeviceBlocked } = useDeviceBinding();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  const isFullyLoading = authLoading || isLoading || isCheckingDevice;

  // Timeout to detect stuck loading state (prevents UI blocking on rotation)
  useEffect(() => {
    if (isFullyLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000); // 5 seconds timeout

      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isFullyLoading]);

  // Show loading with retry button if stuck
  if (isFullyLoading && loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري التحميل...</p>
          <Button 
            variant="outline" 
            onClick={() => {
              setLoadingTimeout(false);
              checkLicense();
            }}
          >
            إعادة المحاولة
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            إعادة تحميل التطبيق
          </Button>
        </div>
      </div>
    );
  }

  // Show loading while checking auth, license, or device
  if (isFullyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // If user is not logged in, don't guard - let the auth flow handle it
  if (!user) {
    return <>{children}</>;
  }

  // Check if device is blocked (SECURITY: This check is critical)
  if (isDeviceBlocked) {
    return <DeviceBlockedScreen />;
  }

  // If there was a network error but user is authenticated, allow access
  if (isValid && hasLicense) {
    return (
      <>
        {isTrial && <TrialBanner />}
        <div className={isTrial ? 'pt-10' : ''}>
          {children}
        </div>
      </>
    );
  }

  // If user has no license and hasn't made a choice yet, show choice screen
  if (!hasLicense && !isStartingTrial) {
    if (showActivation) {
      return <ActivationScreen />;
    }

    return (
      <LicenseChoiceScreen
        onChooseActivation={() => setShowActivation(true)}
        onChooseTrial={async () => {
          setIsStartingTrial(true);
          await startTrial();
          setIsStartingTrial(false);
        }}
        isStartingTrial={isStartingTrial}
      />
    );
  }

  // Show loading while starting trial
  if (isStartingTrial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري بدء الفترة التجريبية...</p>
        </div>
      </div>
    );
  }

  // If license is invalid or needs activation, show activation screen
  if (needsActivation || (!isValid && hasLicense)) {
    return <ActivationScreen />;
  }

  // License is valid - show the app with trial banner if applicable
  return (
    <>
      {isTrial && <TrialBanner />}
      <div className={isTrial ? 'pt-10' : ''}>
        {children}
      </div>
    </>
  );
}
