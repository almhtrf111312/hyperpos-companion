import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Store, Eye, EyeOff, Smartphone, RefreshCw, AlertTriangle, Mail, Sparkles, Send, KeyRound, ShieldCheck, CheckCircle2, ArrowRight, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LanguageQuickSelector } from '@/components/auth/LanguageQuickSelector';
import { getDeviceId } from '@/lib/device-fingerprint';
import { getDeviceKey } from '@/lib/secure-storage';
import { CHANNELS, type ContactLinks } from '@/components/settings/ContactLinksSection';
import { getAuthErrorMessage, isValidEmailFormat } from '@/lib/auth-errors';
import { injectGuestDemoData, clearGuestDemoData } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

interface PasswordCriteria {
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  hasMinLength: boolean;
}

const checkPasswordStrength = (pwd: string): PasswordCriteria => ({
  hasUpper: /[A-Z]/.test(pwd),
  hasLower: /[a-z]/.test(pwd),
  hasNumber: /[0-9]/.test(pwd),
  hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  hasMinLength: pwd.length >= 8,
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeviceBlockedDialog, setShowDeviceBlockedDialog] = useState(false);
  const [isResettingDevice, setIsResettingDevice] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [contactLinks, setContactLinks] = useState<ContactLinks | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Telegram Password Recovery State
  const [recoveryMethod, setRecoveryMethod] = useState<'telegram' | 'email'>('telegram');
  const [telegramStep, setTelegramStep] = useState<1 | 2>(1);
  const [tgIdentifier, setTgIdentifier] = useState('');
  const [tgCode, setTgCode] = useState('');
  const [tgNewPassword, setTgNewPassword] = useState('');
  const [tgConfirmPassword, setTgConfirmPassword] = useState('');
  const [tgShowNewPassword, setTgShowNewPassword] = useState(false);
  const [tgShowConfirmPassword, setTgShowConfirmPassword] = useState(false);
  const [isTgLoading, setIsTgLoading] = useState(false);
  const [tgBotLink, setTgBotLink] = useState<string | null>(null);
  const [tgNotLinkedError, setTgNotLinkedError] = useState(false);

  const isPasswordValid = (() => {
    const c = checkPasswordStrength(tgNewPassword);
    return c.hasUpper && c.hasLower && c.hasNumber && c.hasSpecial && c.hasMinLength;
  })();

  const { signIn } = useAuth();
  const { t, direction } = useLanguage();
  const navigate = useNavigate();

  const handleStartDemo = async () => {
    setIsLoading(true);
    try {
      await injectGuestDemoData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('guest-demo-started'));
      }
      toast.success('تم تفعيل وضع التجربة بنجاح (صالح لمدة 24 ساعة)');
      navigate('/');
    } catch (err) {
      console.error('Failed to start demo mode:', err);
      toast.error('فشل في بدء وضع التجربة');
    } finally {
      setIsLoading(false);
    }
  };
  const location = useLocation();

  useEffect(() => {
    if (location.state?.error) {
      toast.error(location.state.error);
    }
  }, [location.state?.error]);

  // جلب بيانات التواصل عند فتح نافذة نسيت كلمة المرور
  useEffect(() => {
    if (!showForgotDialog) return;
    const fetchContactLinks = async () => {
      setIsLoadingContacts(true);
      try {
        const { data: linksData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'contact_links')
          .maybeSingle();

        if (linksData?.value) {
          const parsed = JSON.parse(linksData.value);
          const hasAnyLink = Object.values(parsed).some((v: unknown) => typeof v === 'string' && v.trim());
          setContactLinks(hasAnyLink ? parsed : null);
        } else {
          const { data: phoneData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'developer_phone')
            .maybeSingle();
          setContactLinks(phoneData?.value ? { whatsapp: phoneData.value } : null);
        }
      } catch (err) {
        console.error('Failed to fetch contact links:', err);
        setContactLinks(null);
      } finally {
        setIsLoadingContacts(false);
      }
    };
    fetchContactLinks();

    // Auto-fill identifier from login email if available
    if (email && !tgIdentifier) {
      setTgIdentifier(email);
    }
    if (email && !resetEmail) {
      setResetEmail(email);
    }

    // Fetch Telegram bot info
    const fetchBotInfo = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/telegram-auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: anonKey || '' },
          body: JSON.stringify({ action: 'get_bot_info' }),
        });
        const d = await res.json();
        if (d?.bot_link) {
          setTgBotLink(d.bot_link);
        }
      } catch (err) {
        console.warn('Failed to fetch bot info:', err);
      }
    };
    fetchBotInfo();
  }, [showForgotDialog, email]);

  // Handle Telegram OTP Request (Step 1)
  const handleRequestTelegramOtp = async () => {
    const trimmed = tgIdentifier.trim();
    if (!trimmed) {
      toast.error('يرجى إدخال البريد الإلكتروني أو رقم الهاتف المسجل');
      return;
    }

    setIsTgLoading(true);
    setTgNotLinkedError(false);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/telegram-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey || '',
        },
        body: JSON.stringify({
          action: 'request_otp',
          identifier: trimmed,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData?.success) {
        if (resData?.not_linked) {
          setTgNotLinkedError(true);
          if (resData?.bot_link) {
            setTgBotLink(resData.bot_link);
          }
        }
        toast.error(resData?.error || 'فشل إرسال رمز التحقق إلى تيليغرام');
        return;
      }

      toast.success(resData?.message || 'تم إرسال رمز التحقق إلى تيليغرام بنجاح');
      setTelegramStep(2);
    } catch (err: any) {
      console.error('Request Telegram OTP error:', err);
      toast.error('تعذر الاتصال بخدمة تيليغرام، يرجى المحاولة لاحقاً');
    } finally {
      setIsTgLoading(false);
    }
  };

  // Handle Telegram Verify and Reset Password (Step 2)
  const handleVerifyAndResetPassword = async () => {
    const code = tgCode.trim();
    if (!code || code.length !== 6) {
      toast.error('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    if (!isPasswordValid) {
      toast.error('يرجى استيفاء جميع معايير كلمة المرور (حرف كبير، حرف صغير، رقم، رمز خاص، و8 خانات)');
      return;
    }

    if (tgNewPassword !== tgConfirmPassword) {
      toast.error('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    setIsTgLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/telegram-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey || '',
        },
        body: JSON.stringify({
          action: 'verify_and_reset',
          identifier: tgIdentifier.trim(),
          code: code,
          new_password: tgNewPassword,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData?.success) {
        toast.error(resData?.error || 'فشل التحقق وتغيير كلمة المرور');
        return;
      }

      toast.success(resData?.message || 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.');
      setPassword(tgNewPassword);
      if (tgIdentifier.includes('@')) {
        setEmail(tgIdentifier.trim());
      }
      setShowForgotDialog(false);

      // Reset state for next time
      setTelegramStep(1);
      setTgCode('');
      setTgNewPassword('');
      setTgConfirmPassword('');
    } catch (err: any) {
      console.error('Verify and reset password error:', err);
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsTgLoading(false);
    }
  };

  // Check if device is blocked for a user
  const checkDeviceBinding = async (userId: string): Promise<{ blocked: boolean; allowMultiDevice: boolean }> => {
    try {
      const currentDeviceId = await getDeviceId();
      const currentDeviceKey = getDeviceKey();
      console.log('[DeviceCheck] Current device ID:', currentDeviceId, 'Device Key:', currentDeviceKey);
      console.log('[DeviceCheck] Checking for user:', userId);

      // Check if user is Boss or Admin - Boss and Admin have unlimited device access
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('[DeviceCheck] Role data:', roleData, 'Error:', roleError);

      if (roleData?.role === 'boss' || roleData?.role === 'admin') {
        console.log('[DeviceCheck] User is boss/admin, skipping device check');
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

      // Check if device matches EITHER currentDeviceId OR currentDeviceKey
      const isMatch = license.device_id === currentDeviceId || license.device_id === currentDeviceKey;
      const blocked = !isMatch;
      console.log('[DeviceCheck] Device comparison:', {
        registered: license.device_id,
        currentDeviceId,
        currentDeviceKey,
        isMatch,
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

    // فحص صحة صيغة الإيميل وقوة كلمة المرور
    if (!isValidEmailFormat(email)) {
      toast.error('صيغة البريد الإلكتروني غير صحيحة');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل)');
      return;
    }

    setIsLoading(true);

    const { error, data } = await signIn(email, password, stayLoggedIn);

    if (error) {
      const friendlyMessage = getAuthErrorMessage(error, 'login');
      toast.error(friendlyMessage);
      setIsLoading(false);
      return;
    }

    // Check device binding after successful login
    if (data?.user) {
      const { blocked } = await checkDeviceBinding(data.user.id);

      if (blocked) {
        // Sign out first, then show dialog after a delay to prevent touch event bubbling
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.log('Sign out during device block:', e);
        }
        setIsLoading(false);
        // Delay showing dialog to avoid touch event from login button closing it
        setTimeout(() => {
          setShowDeviceBlockedDialog(true);
        }, 300);
        return;
      }
    }

    // For existing account logins, bypass setup wizard and onboarding tour.
    // If the user arrived here from a new signup flow, preserve hyperpos_just_signed_up intact
    const isNewSignup = (() => {
      try {
        return sessionStorage.getItem('hyperpos_just_signed_up') === 'true';
      } catch { return false; }
    })();

    if (!isNewSignup) {
      try {
        localStorage.setItem('hyperpos_setup_complete', 'true');
        localStorage.setItem('hp_onboarding_complete', 'true');
      } catch {}
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
        await clearGuestDemoData(true);
        const { error: loginError } = await signIn(email, password, stayLoggedIn);

        if (loginError) {
          toast.error(getAuthErrorMessage(loginError, 'login'));
          setIsLoading(false);
          return;
        }

        const isNewSignup = (() => {
          try {
            return sessionStorage.getItem('hyperpos_just_signed_up') === 'true';
          } catch { return false; }
        })();

        if (!isNewSignup) {
          try {
            localStorage.setItem('hyperpos_setup_complete', 'true');
            localStorage.setItem('hp_onboarding_complete', 'true');
          } catch {}
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4 relative" dir={direction}>
      <Card className="w-full max-w-md shadow-2xl border-border/50 bg-card">
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
          {location.state?.error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{location.state.error}</span>
            </div>
          )}
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
                disabled={isLoading}
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
                  disabled={isLoading}
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setResetEmail(email); setShowForgotDialog(true); }}
                className="text-sm text-primary hover:underline"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.loading')}
                </>
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <div className="relative w-full my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-medium">أو</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleStartDemo}
            disabled={isLoading}
            className="w-full h-11 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 text-primary font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            تجربة التطبيق بدون حساب (Demo Mode)
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              {t('auth.signup')}
            </Link>
          </p>
        </CardFooter>
      </Card>

      <LanguageQuickSelector />

      {/* Device Blocked Dialog - Protected from accidental closure on mobile */}
      <Dialog open={showDeviceBlockedDialog} onOpenChange={(open) => { if (!open) return; }}>
        <DialogContent
          className="sm:max-w-md [&>button:last-child]:hidden z-[200]"
          dir={direction}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري النقل...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  نقل الحساب لهذا الجهاز
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog with Telegram & Email Recovery */}
      <Dialog open={showForgotDialog} onOpenChange={(open) => {
        setShowForgotDialog(open);
        if (!open) {
          setTelegramStep(1);
          setTgCode('');
          setTgNewPassword('');
          setTgConfirmPassword('');
          setTgNotLinkedError(false);
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir={direction}>
          <DialogHeader className="text-center sm:text-center pb-1">
            <div className={cn(
              "mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-2.5 transition-colors shadow-xs",
              recoveryMethod === 'telegram' ? "bg-sky-500/10 text-sky-500 border border-sky-500/20" : "bg-primary/10 text-primary border border-primary/20"
            )}>
              {recoveryMethod === 'telegram' ? (
                <Send className="w-7 h-7" />
              ) : (
                <Mail className="w-7 h-7" />
              )}
            </div>
            <DialogTitle className="text-lg font-bold">
              {recoveryMethod === 'telegram' ? 'استعادة كلمة المرور عبر تيليغرام' : t('auth.forgotPasswordTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              اختر الطريقة الأنسب لاستعادة الوصول إلى حسابك بسرعة وأمان
            </DialogDescription>
          </DialogHeader>

          {/* Recovery Method Switcher (Capsule Tabs) */}
          <div className="bg-muted/60 p-1 rounded-2xl flex items-center gap-1 w-full border border-border/40 shadow-xs my-1 select-none">
            <button
              type="button"
              onClick={() => {
                setRecoveryMethod('telegram');
                setTgNotLinkedError(false);
              }}
              className={cn(
                "flex-1 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                recoveryMethod === 'telegram'
                  ? "bg-sky-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>بوت تيليغرام</span>
            </button>
            <button
              type="button"
              onClick={() => setRecoveryMethod('email')}
              className={cn(
                "flex-1 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                recoveryMethod === 'email'
                  ? "bg-gradient-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>البريد والدعم</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: TELEGRAM BOT RECOVERY */}
          {/* ========================================================================= */}
          {recoveryMethod === 'telegram' && (
            <div className="space-y-4 pt-1">
              {telegramStep === 1 ? (
                /* Step 1: Enter Email/Phone & Request OTP */
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="tgIdentifier" className="text-xs font-semibold text-foreground">
                      البريد الإلكتروني أو رقم الهاتف المسجل
                    </Label>
                    <div className="relative">
                      <Input
                        id="tgIdentifier"
                        type="text"
                        placeholder="name@example.com أو 0770..."
                        value={tgIdentifier}
                        onChange={(e) => {
                          setTgIdentifier(e.target.value);
                          setTgNotLinkedError(false);
                        }}
                        disabled={isTgLoading}
                        className="h-11 rounded-xl text-sm"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      أدخل البريد أو رقم الهاتف المسجل في ملفك الشخصي لإرسال رمز التحقق فوراً إلى محادثة البوت.
                    </p>
                  </div>

                  {/* Warning when account is not linked to bot */}
                  {tgNotLinkedError && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2 text-amber-700 dark:text-amber-400">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>حسابك غير مربوط بالبوت بعد</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        لم يتم ربط رقم هاتفك ببوت التحقق حتى الآن. لربطه بثوانٍ: اضغط على الزر أدناه لفتح البوت في تيليغرام واضغط <strong>/start</strong> ثم <strong>«مشاركة رقم الهاتف للتحقق»</strong>.
                      </p>
                      {tgBotLink && (
                        <a
                          href={tgBotLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>فتح بوت تيليغرام الآن للربط</span>
                        </a>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={handleRequestTelegramOtp}
                    disabled={isTgLoading || !tgIdentifier.trim()}
                    className="w-full h-11 rounded-xl font-bold bg-sky-500 hover:bg-sky-600 active:scale-98 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isTgLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري التحقق وإرسال الرمز...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>إرسال رمز التحقق إلى تيليغرام</span>
                      </>
                    )}
                  </Button>

                  {/* Direct Link to Bot for first time linking */}
                  {tgBotLink && !tgNotLinkedError && (
                    <div className="pt-1 text-center">
                      <a
                        href={tgBotLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>لم تربط البوت بعد؟ اضغط هنا للبدء ومشاركة رقم هاتفك</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Enter 6-digit OTP & Set New Password */
                <div className="space-y-3.5">
                  <div className="p-2.5 bg-sky-500/10 border border-sky-500/25 rounded-2xl flex items-center justify-between text-xs text-sky-700 dark:text-sky-300">
                    <span className="font-semibold">تم إرسال رمز التحقق إلى محادثتك في تيليغرام</span>
                    <button
                      type="button"
                      onClick={() => setTelegramStep(1)}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      تغيير
                    </button>
                  </div>

                  {/* OTP Code input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tgCode" className="text-xs font-semibold text-foreground">
                      رمز التحقق (6 أرقام)
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="tgCode"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="------"
                        value={tgCode}
                        onChange={(e) => setTgCode(e.target.value.replace(/\D/g, ''))}
                        disabled={isTgLoading}
                        className="pr-9 h-12 rounded-xl text-center font-mono text-xl tracking-[0.35em] font-black border-2 border-primary/30 focus-visible:border-primary"
                        dir="ltr"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  {/* حقل كلمة المرور الجديدة ومؤشر المعايير */}
                  <div className="space-y-2">
                    <Label htmlFor="tgNewPassword" className="text-xs font-semibold text-foreground">
                      كلمة المرور الجديدة
                    </Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="tgNewPassword"
                        type={tgShowNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={tgNewPassword}
                        onChange={(e) => setTgNewPassword(e.target.value)}
                        disabled={isTgLoading}
                        className="pr-9 pl-9 h-11 rounded-xl text-sm"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setTgShowNewPassword(!tgShowNewPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {tgShowNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* شريط ومؤشرات المعايير الأربعة الحية */}
                    {tgNewPassword.length > 0 && (() => {
                      const criteria = checkPasswordStrength(tgNewPassword);
                      const checks = [
                        { label: 'حرف كبير (A-Z)', valid: criteria.hasUpper },
                        { label: 'حرف صغير (a-z)', valid: criteria.hasLower },
                        { label: 'رقم (0-9)', valid: criteria.hasNumber },
                        { label: 'رمز خاص (@#$%)', valid: criteria.hasSpecial },
                      ];
                      const score = checks.filter(c => c.valid).length + (criteria.hasMinLength ? 1 : 0);

                      return (
                        <div className="p-3 bg-muted/40 rounded-xl border border-border/50 space-y-2 text-xs">
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-muted-foreground">قوة كلمة المرور:</span>
                            <span className={score === 5 ? 'text-emerald-500 font-bold' : score >= 3 ? 'text-amber-500' : 'text-rose-500'}>
                              {score === 5 ? 'ممتازة وقوية' : score >= 3 ? 'متوسطة (أكمل الشروط)' : 'ضعيفة'}
                            </span>
                          </div>

                          {/* شبكة النقاط الأربعة */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {checks.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full transition-colors ${item.valid ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-muted-foreground/30'}`} />
                                <span className={item.valid ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
                                  {item.label}
                                </span>
                              </div>
                            ))}
                          </div>

                          {!criteria.hasMinLength && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
                              * يجب ألا تقل عن 8 أحرف لتفادي رفض الخادم
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tgConfirmPassword" className="text-xs font-semibold text-foreground">
                      تأكيد كلمة المرور الجديدة
                    </Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="tgConfirmPassword"
                        type={tgShowConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={tgConfirmPassword}
                        onChange={(e) => setTgConfirmPassword(e.target.value)}
                        disabled={isTgLoading}
                        className="pr-9 pl-9 h-11 rounded-xl text-sm"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setTgShowConfirmPassword(!tgShowConfirmPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {tgShowConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="button"
                    onClick={handleVerifyAndResetPassword}
                    disabled={isTgLoading || tgCode.length !== 6 || !isPasswordValid || tgNewPassword !== tgConfirmPassword}
                    className="w-full h-11 rounded-xl font-bold bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isTgLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري التحقق وتغيير كلمة المرور...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد وتغيير كلمة المرور</span>
                      </>
                    )}
                  </Button>

                  {/* Resend Code / Back */}
                  <div className="flex items-center justify-between text-xs pt-1 px-1">
                    <button
                      type="button"
                      onClick={handleRequestTelegramOtp}
                      disabled={isTgLoading}
                      className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                    >
                      إعادة إرسال رمز جديد
                    </button>
                    <button
                      type="button"
                      onClick={() => setTelegramStep(1)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      الرجوع للخطوة السابقة
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: EMAIL & SUPPORT RECOVERY */}
          {/* ========================================================================= */}
          {recoveryMethod === 'email' && (
            <div className="space-y-4 pt-1">
              {isLoadingContacts ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : contactLinks && Object.values(contactLinks).some((v) => typeof v === 'string' && v.trim()) ? (
                <div className="space-y-4 my-2">
                  <DialogDescription className="text-center text-sm font-medium">
                    تواصل مع مدير النظام أو الدعم الفني لإعادة تعيين كلمة المرور
                  </DialogDescription>
                  <div className="grid grid-cols-2 gap-3">
                    {CHANNELS.filter(ch => contactLinks[ch.key]?.trim()).map((ch) => (
                      <button
                        key={ch.key}
                        onClick={() => window.open(ch.openUrl(contactLinks[ch.key]!), '_blank')}
                        className={`${ch.color} ${ch.hoverColor} text-white rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-200 hover:shadow-lg active:scale-95`}
                      >
                        <span className="text-xl">{ch.icon}</span>
                        <span className="font-medium text-sm">{t(ch.labelKey as any)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">أو</span>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">إعادة تعيين كلمة المرور برابط إلى بريدك الإلكتروني</p>
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">{t('auth.email')}</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="name@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={isSendingReset}
                      className="h-11 rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!resetEmail) return;
                      setIsSendingReset(true);
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                          redirectTo: `${window.location.origin}/#/reset-password`,
                        });
                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success(t('auth.resetSent'));
                          setShowForgotDialog(false);
                        }
                      } catch (err) {
                        console.error('Reset password error:', err);
                        toast.error(t('common.error'));
                      } finally {
                        setIsSendingReset(false);
                      }
                    }}
                    disabled={isSendingReset || !resetEmail}
                    variant="outline"
                    className="w-full h-11 rounded-xl font-bold cursor-pointer"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('auth.loading')}
                      </>
                    ) : (
                      t('auth.sendResetLink')
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 my-2">
                  <DialogDescription className="text-center text-xs text-muted-foreground">
                    {t('auth.forgotPasswordDesc')}
                  </DialogDescription>
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">{t('auth.email')}</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="name@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={isSendingReset}
                      className="h-11 rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!resetEmail) return;
                      setIsSendingReset(true);
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                          redirectTo: `${window.location.origin}/#/reset-password`,
                        });
                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success(t('auth.resetSent'));
                          setShowForgotDialog(false);
                        }
                      } catch (err) {
                        console.error('Reset password error:', err);
                        toast.error(t('common.error'));
                      } finally {
                        setIsSendingReset(false);
                      }
                    }}
                    disabled={isSendingReset || !resetEmail}
                    className="w-full h-11 rounded-xl font-bold bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground shadow-sm cursor-pointer"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('auth.loading')}
                      </>
                    ) : (
                      t('auth.sendResetLink')
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-border/40 pt-3 mt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForgotDialog(false)}
              className="w-full h-10 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
