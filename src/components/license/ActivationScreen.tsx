import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Key, MessageCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';

export function ActivationScreen() {
  const { activateCode, isTrial, isExpired } = useLicense();
  const { language } = useLanguage();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isRTL = language === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(isRTL ? 'يرجى إدخال كود التفعيل' : 'Please enter activation code');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await activateCode(code.trim());

    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || (isRTL ? 'كود التفعيل غير صالح' : 'Invalid activation code'));
    }
  };

  const formatCode = (value: string) => {
    // Remove non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Add dashes every 4 characters for better readability
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join('-');
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setError(null);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {isRTL ? 'تم التفعيل بنجاح!' : 'Activation Successful!'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {isRTL ? 'يمكنك الآن استخدام التطبيق بالكامل' : 'You can now use the full application'}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              {isRTL ? 'متابعة' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {isTrial && isExpired
              ? (isRTL ? 'انتهت الفترة التجريبية' : 'Trial Period Ended')
              : isExpired
                ? (isRTL ? 'انتهت صلاحية الترخيص' : 'License Expired')
                : (isRTL ? 'التطبيق يحتاج تفعيل' : 'Activation Required')
            }
          </CardTitle>
          <CardDescription>
            {isTrial && isExpired
              ? (isRTL ? 'لقد استمتعت بالتطبيق لمدة 30 يوماً مجاناً!' : 'You enjoyed 30 days of free trial!')
              : (isRTL ? 'يرجى إدخال كود التفعيل للمتابعة' : 'Please enter your activation code to continue')
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Key className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                <Input
                  type="text"
                  placeholder={isRTL ? 'XXXX-XXXX-XXXX-XXXX' : 'XXXX-XXXX-XXXX-XXXX'}
                  value={code}
                  onChange={handleCodeChange}
                  className={`${isRTL ? 'pr-10 text-right' : 'pl-10'} text-center font-mono tracking-wider`}
                  maxLength={19}
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !code.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className={isRTL ? 'mr-2' : 'ml-2'}>
                    {isRTL ? 'جاري التحقق...' : 'Verifying...'}
                  </span>
                </>
              ) : (
                isRTL ? 'تفعيل التطبيق' : 'Activate Application'
              )}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center mb-3">
              {isRTL ? 'للحصول على كود التفعيل، تواصل معنا:' : 'To get an activation code, contact us:'}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a 
                href="https://wa.me/+970000000000?text=أريد الحصول على كود تفعيل لتطبيق HyperPOS" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4" />
                <span className={isRTL ? 'mr-2' : 'ml-2'}>WhatsApp</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
