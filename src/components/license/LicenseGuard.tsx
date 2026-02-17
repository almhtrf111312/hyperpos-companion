import { ReactNode, useEffect, useState } from 'react';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { useDeviceBinding } from '@/hooks/use-device-binding';
import { useNotifications } from '@/hooks/use-notifications';
import { ActivationScreen } from './ActivationScreen';
import { DeviceBlockedScreen } from '@/components/auth/DeviceBlockedScreen';
import { DataEncryptedScreen } from './DataEncryptedScreen';
import { Loader2, MessageCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Clock } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';

interface LicenseGuardProps {
  children: ReactNode;
}

function LicenseChoiceScreen({ onChooseActivation, onChooseTrial, isStartingTrial }: {
  onChooseActivation: () => void;
  onChooseTrial: () => void;
  isStartingTrial: boolean;
}) {
  const { t, direction } = useLanguage();
  const { signOut } = useAuth();
  const [developerPhone, setDeveloperPhone] = useState<string>('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const { data: linksData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'contact_links')
          .maybeSingle();

        if (linksData?.value) {
          const parsed = JSON.parse(linksData.value);
          if (parsed.whatsapp) {
            setDeveloperPhone(parsed.whatsapp);
            return;
          }
        }
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'developer_phone')
          .maybeSingle();
        if (!error && data?.value) setDeveloperPhone(data.value);
      } catch (err) {
        console.error('Failed to fetch contact info:', err);
      }
    };
    fetchContactInfo();
  }, []);

  const handleContactDeveloper = () => {
    if (!developerPhone) return;
    const message = encodeURIComponent(t('license.wantCode'));
    const cleanPhone = developerPhone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={direction}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">
            {t('license.welcome')}
          </CardTitle>
          <CardDescription>
            {t('license.chooseActivation')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="default" className="w-full h-auto py-4 flex flex-col items-center gap-2" onClick={onChooseActivation}>
            <Key className="w-6 h-6" />
            <span className="font-semibold">{t('license.haveCode')}</span>
            <span className="text-xs opacity-80">{t('license.haveCodeDesc')}</span>
          </Button>
          <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" onClick={onChooseTrial} disabled={isStartingTrial}>
            {isStartingTrial ? <Loader2 className="w-6 h-6 animate-spin" /> : <Clock className="w-6 h-6" />}
            <span className="font-semibold">{t('license.freeTrial')}</span>
            <span className="text-xs opacity-80">{t('license.freeTrialDesc')}</span>
          </Button>
          {developerPhone && (
            <div className="pt-4 border-t space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                {t('license.getCodeContact')}
              </p>
              <Button variant="secondary" className="w-full gap-2" onClick={handleContactDeveloper}>
                <MessageCircle className="w-4 h-4" />
                {t('license.contactDeveloper')}
              </Button>
            </div>
          )}
          <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground gap-2" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t('license.signOutOther')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading, isValid, hasLicense, needsActivation, startTrial, isTrial, checkLicense, expiresAt, remainingDays, ownerNeedsActivation, role, dataEncrypted } = useLicense();
  const { isChecking: isCheckingDevice, isDeviceBlocked } = useDeviceBinding();
  const { checkLicenseStatus } = useNotifications();
  const { t, direction } = useLanguage();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  
  const isFullyLoading = authLoading || isLoading || isCheckingDevice;

  useEffect(() => {
    if (isValid && hasLicense && expiresAt && remainingDays !== null) {
      checkLicenseStatus(expiresAt, remainingDays, isTrial);
    }
  }, [isValid, hasLicense, expiresAt, remainingDays, isTrial, checkLicenseStatus]);

  useEffect(() => {
    if (isFullyLoading) {
      const retryTimer = setTimeout(() => setLoadingTimeout(true), 3000);
      const skipTimer = setTimeout(() => setShowSkipButton(true), 6000);
      return () => { clearTimeout(retryTimer); clearTimeout(skipTimer); };
    } else {
      setLoadingTimeout(false);
      setShowSkipButton(false);
    }
  }, [isFullyLoading]);

  if (skipLoading) {
    return <>{children}</>;
  }

  if (isFullyLoading && loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground" style={{ color: '#a1a1aa' }}>{t('license.loading')}</p>
          <Button variant="outline" onClick={() => { setLoadingTimeout(false); checkLicense(); }}>
            {t('license.retry')}
          </Button>
          {showSkipButton && (
            <Button variant="default" size="sm" onClick={() => setSkipLoading(true)}>
              {t('license.skipAndEnter')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            {t('license.reloadApp')}
          </Button>
        </div>
      </div>
    );
  }

  if (isFullyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground" style={{ color: '#a1a1aa' }}>{t('license.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return <>{children}</>;
  if (dataEncrypted) return <DataEncryptedScreen />;
  if (isDeviceBlocked) return <DeviceBlockedScreen />;
  if (isValid && hasLicense) return <>{children}</>;

  if (ownerNeedsActivation && role === 'cashier') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={direction}>
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-xl">{t('license.ownerNotActivated')}</CardTitle>
            <CardDescription>{t('license.ownerNotActivatedDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => checkLicense()}>{t('license.recheck')}</Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={async () => { await supabase.auth.signOut(); }}>{t('license.signOut')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasLicense && !isStartingTrial) {
    if (showActivation) return <ActivationScreen />;
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

  if (isStartingTrial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground" style={{ color: '#a1a1aa' }}>{t('license.startingTrial')}</p>
        </div>
      </div>
    );
  }

  if (needsActivation || (!isValid && hasLicense)) return <ActivationScreen />;

  return <>{children}</>;
}
