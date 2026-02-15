import { useState } from 'react';
import { Lock, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/hooks/use-language';
import { useLicense } from '@/hooks/use-license';

export function DataEncryptedScreen() {
  const { t, direction } = useLanguage();
  const { checkLicense } = useLicense();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await checkLicense();
    } finally {
      // Small delay so user sees loading state
      setTimeout(() => setIsRetrying(false), 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={direction}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            {t('offlineProtection.encryptedTitle')}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {t('offlineProtection.encryptedDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground flex items-start gap-3">
            <Wifi className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('offlineProtection.connectHint')}</span>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {t('offlineProtection.retryBtn')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
