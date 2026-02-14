import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Key, Loader2, CheckCircle, AlertCircle, Calendar, Shield } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { useLanguage } from '@/hooks/use-language';

export function ActivationCodeInput() {
  const { activateCode, isTrial, isExpired, expiresAt, remainingDays } = useLicense();
  const { t, language } = useLanguage();
  
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formatCode = (value: string) => {
    let cleaned = value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
    if (cleaned.startsWith('HYPER-')) {
      const afterPrefix = cleaned.slice(6).replace(/-/g, '');
      const parts = afterPrefix.match(/.{1,4}/g) || [];
      return 'HYPER-' + parts.join('-');
    }
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
      setError(t('license.enterCode'));
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
      setError(result.error || t('license.invalidCode'));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('license.status')}</h2>
          <p className="text-sm text-muted-foreground">{t('license.info')}</p>
        </div>
      </div>

      {/* Current License Status */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('license.currentLicense')}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full ${
            isExpired 
              ? 'bg-destructive/10 text-destructive' 
              : isTrial 
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {isExpired ? t('license.expired') : isTrial ? t('license.trial') : t('license.active')}
          </span>
        </div>
        
        <div className="space-y-2 text-sm">
          {expiresAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('license.expiresOn')}</span>
              <span className={isExpired ? 'text-destructive' : 'text-foreground'}>{formatDate(expiresAt)}</span>
            </div>
          )}
          {remainingDays !== null && remainingDays > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('license.daysRemaining')}</span>
              <span className="text-foreground font-medium">{remainingDays} {t('license.days')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Activation Code Input */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" />
          {t('license.activateNewCode')}
        </h3>
        
        {success ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">{t('license.codeActivated')}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Key className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${language === 'ar' || language === 'fa' || language === 'ku' ? 'right-3' : 'left-3'}`} />
              <Input
                type="text"
                placeholder="HYPER-XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={handleCodeChange}
                className={`${language === 'ar' || language === 'fa' || language === 'ku' ? 'pr-10' : 'pl-10'} font-mono tracking-wider`}
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
                  <span className="ms-2">{t('license.verifying')}</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span className="ms-2">{t('license.activateCode')}</span>
                </>
              )}
            </Button>
          </form>
        )}
      </div>

    </div>
  );
}
