import { ReactNode, useEffect, useState } from 'react';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { ActivationScreen } from './ActivationScreen';
import { TrialBanner } from './TrialBanner';
import { Loader2 } from 'lucide-react';

interface LicenseGuardProps {
  children: ReactNode;
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading, isValid, hasLicense, needsActivation, startTrial, isTrial } = useLicense();
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  useEffect(() => {
    // Auto-start trial for new users who don't have a license
    const autoStartTrial = async () => {
      if (!authLoading && user && !isLoading && !hasLicense && !isStartingTrial) {
        setIsStartingTrial(true);
        await startTrial();
        setIsStartingTrial(false);
      }
    };

    autoStartTrial();
  }, [user, authLoading, isLoading, hasLicense, startTrial, isStartingTrial]);

  // Show loading while checking auth or license
  if (authLoading || isLoading || isStartingTrial) {
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
