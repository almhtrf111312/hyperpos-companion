import { useState } from 'react';
import { Shield, AlertTriangle, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { ContactLinksSection } from '@/components/settings/ContactLinksSection';
import { ActivationScreen } from '@/components/license/ActivationScreen';

export function DeviceBlockedScreen() {
  const { t, direction } = useLanguage();
  const { signOut } = useAuth();
  const [showActivation, setShowActivation] = useState(false);

  if (showActivation) return <ActivationScreen />;

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir={direction}>
      <Card className="w-full max-w-md shadow-2xl border-destructive/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {t('deviceBlocked.title')}
          </CardTitle>
          <CardDescription className="text-base mt-2">{t('deviceBlocked.description')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{t('deviceBlocked.reason')}</p>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">{t('deviceBlocked.action')}</p>
              <p className="text-sm text-muted-foreground">{t('deviceBlocked.actionDesc')}</p>
            </div>
          </div>

          <Button onClick={() => setShowActivation(true)} className="w-full gap-2" size="lg">
            <Key className="w-5 h-5" />
            {t('license.activateApp')}
          </Button>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">{t('license.getCodeContact')}</p>
            <ContactLinksSection />
          </div>

          <Button variant="outline" onClick={handleSignOut} className="w-full">
            {t('deviceBlocked.signOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
