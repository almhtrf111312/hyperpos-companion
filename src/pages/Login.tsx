import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Store, Eye, EyeOff, Smartphone, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device-fingerprint';

// Google Icon Component
import { NativeMLKitScanner } from '@/components/barcode/NativeMLKitScanner';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showDeviceBlockedDialog, setShowDeviceBlockedDialog] = useState(false);
  const [isResettingDevice, setIsResettingDevice] = useState(false);

  // Scanner Test State
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');

  const { signIn, signInWithGoogle } = useAuth();
  const { t, direction } = useLanguage();
  const navigate = useNavigate();

  // Check if device is blocked for a user
  const checkDeviceBinding = async (userId: string): Promise<{ blocked: boolean; allowMultiDevice: boolean }> => {
    try {
      const currentDeviceId = await getDeviceId();
      console.log('[DeviceCheck] Current device ID:', currentDeviceId);
      console.log('[DeviceCheck] Checking for user:', userId);

      // Check if user is Boss - Boss has unlimited device access
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('[DeviceCheck] Role data:', roleData, 'Error:', roleError);

      if (roleData?.role === 'boss') {
        console.log('[DeviceCheck] User is boss, skipping device check');
        return { blocked: false, allowMultiDevice: true };
      }

      // Get user's license with device info
      const { data: license, error: licenseError } = await supabase
        .from('app_licenses')
        .select('device_id, allow_multi_device')
        .eq('user_id', userId)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[DeviceCheck] License data:', license, 'Error:', licenseError);

      // No license = no blocking
      if (!license) {
        console.log('[DeviceCheck] No license found, allowing access');
        return { blocked: false, allowMultiDevice: false };
      }

      // Multi-device allowed
      if (license.allow_multi_device === true) {
        console.log('[DeviceCheck] Multi-device allowed');
        return { blocked: false, allowMultiDevice: true };
      }

      // No device registered yet
      if (!license.device_id) {
        console.log('[DeviceCheck] No device registered yet, allowing access');
        return { blocked: false, allowMultiDevice: false };
      }

      // Check if device matches
      const blocked = license.device_id !== currentDeviceId;
      console.log('[DeviceCheck] Device comparison:', {
        registered: license.device_id,
        current: currentDeviceId,
        blocked
      });
      return { blocked, allowMultiDevice: false };
    } catch (error) {
      console.error('[DeviceCheck] Error:', error);
      return { blocked: false, allowMultiDevice: false };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error, data } = await signIn(email, password, stayLoggedIn);

    if (error) {
      toast.error(t('auth.invalidCredentials'));
      setIsLoading(false);
      return;
    }

    // Check device binding after successful login
    if (data?.user) {
      const { blocked } = await checkDeviceBinding(data.user.id);

      if (blocked) {
        // Sign out first, then show dialog
        // Important: Don't navigate away, just show the dialog
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.log('Sign out during device block:', e);
        }
        setIsLoading(false);
        setShowDeviceBlockedDialog(true);
        return;
      }
    }

    setIsLoading(false);
    toast.success(t('auth.loginSuccess'));
    navigate('/');
  };

  const handleResetDevice = async () => {
    if (!email || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsResettingDevice(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-own-device', {
        body: { email, password }
      });

      if (error) {
        console.error('Reset device error:', error);
        toast.error('فشل في إعادة تعيين الجهاز');
        setIsResettingDevice(false);
        return;
      }

      if (data?.success) {
        toast.success(data.message || 'تم إعادة تعيين الجهاز بنجاح');
        setShowDeviceBlockedDialog(false);

        // Now try to login again
        setIsLoading(true);
        const { error: loginError } = await signIn(email, password, stayLoggedIn);

        if (loginError) {
          toast.error(t('auth.invalidCredentials'));
          setIsLoading(false);
          return;
        }

        toast.success(t('auth.loginSuccess'));
        navigate('/');
      } else {
        toast.error(data?.error || 'فشل في إعادة تعيين الجهاز');
      }
    } catch (err) {
      console.error('Reset device exception:', err);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setIsResettingDevice(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();

    if (error) {
      toast.error('فشل تسجيل الدخول بـ Google');
      setIsGoogleLoading(false);
    }
    // Note: On success, the page will redirect to Google OAuth
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4 ${showScanner ? 'bg-transparent' : ''}`} dir={direction}>
      {/* Hide Card during scanning to prevent UI bleed-through */}
      <Card className={`w-full max-w-md shadow-2xl border-border/50 backdrop-blur-sm ${showScanner ? 'hidden' : 'block'}`}>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{t('auth.welcome')}</CardTitle>
            <CardDescription className="mt-2">{t('auth.loginSubtitle')}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50 transition-all"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            تسجيل الدخول باستخدام Google
          </Button>

          <div className="relative">
            <Separator className="my-4" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-sm text-muted-foreground">
              أو
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isGoogleLoading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || isGoogleLoading}
                  className="h-11 pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Stay Logged In Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="stayLoggedIn"
                checked={stayLoggedIn}
                onCheckedChange={(checked) => setStayLoggedIn(checked === true)}
                disabled={isLoading || isGoogleLoading}
              />
              <Label
                htmlFor="stayLoggedIn"
                className="text-sm font-normal cursor-pointer select-none"
              >
                تذكرني على هذا الجهاز
              </Label>
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading || isGoogleLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {t('auth.loading')}
                </>
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <div className="w-full space-y-2 border-t pt-4">
            <Label className="text-xs text-muted-foreground">Scanner Test (Debug)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 gap-2"
                onClick={() => setShowScanner(true)}
              >
                <Smartphone className="w-4 h-4" />
                Test Scanner
              </Button>
              <Input
                readOnly
                placeholder="Scanned code..."
                value={scannedCode}
                className="flex-[2] bg-muted/50 font-mono text-sm"
              />
            </div>
            <NativeMLKitScanner
              isOpen={showScanner}
              onClose={() => setShowScanner(false)}
              onScan={(code) => {
                setScannedCode(code);
                toast.success(`Scanned: ${code}`);
                // Don't close immediately here, let the scanner component handle its own lifecycle/delay
              }}
            />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              {t('auth.signup')}
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Device Blocked Dialog */}
      <Dialog open={showDeviceBlockedDialog} onOpenChange={setShowDeviceBlockedDialog}>
        <DialogContent className="sm:max-w-md" dir={direction}>
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mb-3">
              <Smartphone className="w-7 h-7 text-destructive" />
            </div>
            <DialogTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              جهاز جديد تم اكتشافه
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              هذا الحساب مرتبط بجهاز آخر. هل تريد نقل الحساب إلى هذا الجهاز؟
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3 my-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              عند إعادة تعيين الجهاز، سيتم فصل الحساب عن الجهاز السابق وربطه بهذا الجهاز.
            </p>
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>لن تتمكن من استخدام الحساب على الجهاز السابق بعد هذا الإجراء.</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeviceBlockedDialog(false)}
              className="w-full sm:w-auto"
              disabled={isResettingDevice}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleResetDevice}
              disabled={isResettingDevice}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            >
              {isResettingDevice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  جاري النقل...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 me-2" />
                  نقل الحساب لهذا الجهاز
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
