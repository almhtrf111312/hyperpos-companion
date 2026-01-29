import { ReactNode, useEffect, useState } from 'react';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { useDeviceBinding } from '@/hooks/use-device-binding';
import { useNotifications } from '@/hooks/use-notifications';
import { ActivationScreen } from './ActivationScreen';
import { DeviceBlockedScreen } from '@/components/auth/DeviceBlockedScreen';
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
  const { language } = useLanguage();
  const { signOut } = useAuth();
  const isRTL = language === 'ar';
  const [developerPhone, setDeveloperPhone] = useState<string>('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Fetch developer phone
  useEffect(() => {
    const fetchDeveloperPhone = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'developer_phone')
          .maybeSingle();
        
        if (!error && data?.value) {
          setDeveloperPhone(data.value);
        }
      } catch (err) {
        console.error('Failed to fetch developer phone:', err);
      }
    };
    
    fetchDeveloperPhone();
  }, []);

  const handleContactDeveloper = () => {
    if (!developerPhone) return;
    
    const message = encodeURIComponent(
      isRTL 
        ? 'أريد الحصول على كود تفعيل لتطبيق FlowPOS Pro'
        : 'I want to get an activation code for FlowPOS Pro'
    );
    
    const cleanPhone = developerPhone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

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

          {/* Contact Developer Button */}
          {developerPhone && (
            <div className="pt-4 border-t space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                {isRTL ? 'للحصول على كود التفعيل، تواصل معنا:' : 'To get an activation code, contact us:'}
              </p>
              <Button 
                variant="secondary" 
                className="w-full gap-2" 
                onClick={handleContactDeveloper}
              >
                <MessageCircle className="w-4 h-4" />
                {isRTL ? 'التواصل مع المطور' : 'Contact Developer'}
              </Button>
            </div>
          )}

          {/* Sign Out Button */}
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground hover:text-foreground gap-2" 
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {isRTL ? 'تسجيل الخروج والدخول بحساب آخر' : 'Sign out and use another account'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading, isValid, hasLicense, needsActivation, startTrial, isTrial, checkLicense, expiresAt, remainingDays, ownerNeedsActivation, role } = useLicense();
  const { isChecking: isCheckingDevice, isDeviceBlocked } = useDeviceBinding();
  const { checkLicenseStatus } = useNotifications();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  const isFullyLoading = authLoading || isLoading || isCheckingDevice;

  // Update license notification when license data changes
  useEffect(() => {
    if (isValid && hasLicense && expiresAt && remainingDays !== null) {
      checkLicenseStatus(expiresAt, remainingDays, isTrial);
    }
  }, [isValid, hasLicense, expiresAt, remainingDays, isTrial, checkLicenseStatus]);

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
    return <>{children}</>;
  }

  // If cashier and owner hasn't activated yet, show waiting message
  if (ownerNeedsActivation && role === 'cashier') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir="rtl">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-xl">
              في انتظار تفعيل المالك
            </CardTitle>
            <CardDescription>
              صاحب الحساب لم يقم بتفعيل الترخيص بعد. يرجى التواصل معه لتفعيل الحساب.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => checkLicense()}
            >
              إعادة التحقق
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              تسجيل الخروج
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user has no license and hasn't made a choice yet, show choice screen
  // But only for admin/owner users - cashiers should never see this
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

  // License is valid - show the app
  return <>{children}</>;
}
