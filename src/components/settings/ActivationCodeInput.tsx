import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Key, Loader2, CheckCircle, AlertCircle, Calendar, Shield } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';

export function ActivationCodeInput() {
  const { activateCode, isTrial, isExpired, expiresAt, remainingDays } = useLicense();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formatCode = (value: string) => {
    // Remove non-alphanumeric characters and convert to uppercase
    let cleaned = value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
    
    // If starts with HYPER-, preserve it
    if (cleaned.startsWith('HYPER-')) {
      const afterPrefix = cleaned.slice(6).replace(/-/g, '');
      const parts = afterPrefix.match(/.{1,4}/g) || [];
      return 'HYPER-' + parts.join('-');
    }
    
    // Otherwise format normally with dashes every 4 chars
    cleaned = cleaned.replace(/-/g, '');
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join('-');
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setError(null);
    setSuccess(false);
  };

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
      setCode('');
    } else {
      setError(result.error || (isRTL ? 'كود التفعيل غير صالح' : 'Invalid activation code'));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isRTL ? 'حالة الترخيص' : 'License Status'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'معلومات الترخيص وتفعيل الكود' : 'License information and code activation'}
          </p>
        </div>
      </div>

      {/* Current License Status */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {isRTL ? 'الترخيص الحالي' : 'Current License'}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full ${
            isExpired 
              ? 'bg-destructive/10 text-destructive' 
              : isTrial 
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {isExpired 
              ? (isRTL ? 'منتهي' : 'Expired')
              : isTrial 
                ? (isRTL ? 'تجريبي' : 'Trial')
                : (isRTL ? 'مفعّل' : 'Active')
            }
          </span>
        </div>
        
        <div className="space-y-2 text-sm">
          {expiresAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isRTL ? 'تاريخ الانتهاء:' : 'Expires on:'}
              </span>
              <span className={isExpired ? 'text-destructive' : 'text-foreground'}>
                {formatDate(expiresAt)}
              </span>
            </div>
          )}
          {remainingDays !== null && remainingDays > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isRTL ? 'الأيام المتبقية:' : 'Days remaining:'}
              </span>
              <span className="text-foreground font-medium">
                {remainingDays} {isRTL ? 'يوم' : 'days'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Activation Code Input */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" />
          {isRTL ? 'تفعيل كود جديد' : 'Activate New Code'}
        </h3>
        
        {success ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">
              {isRTL ? 'تم تفعيل الكود بنجاح!' : 'Code activated successfully!'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Key className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                type="text"
                placeholder="HYPER-XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={handleCodeChange}
                className={`${isRTL ? 'pr-10' : 'pl-10'} font-mono tracking-wider`}
                maxLength={25}
                disabled={isLoading}
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading || !code.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className={isRTL ? 'mr-2' : 'ml-2'}>
                    {isRTL ? 'جاري التحقق...' : 'Verifying...'}
                  </span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span className={isRTL ? 'mr-2' : 'ml-2'}>
                    {isRTL ? 'تفعيل الكود' : 'Activate Code'}
                  </span>
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
