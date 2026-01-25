import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, Loader2, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { clearAllDataCompletely } from '@/lib/clear-demo-data';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import { useLanguage } from '@/hooks/use-language';

export default function DataResetSection() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const dataToBeDeleted = [
    t('common.products', language),
    t('common.invoices', language),
    t('common.customers', language),
    t('common.debts', language),
    t('common.expenses', language),
    t('common.partners', language),
    t('common.services', language),
    t('common.categories', language),
  ];

  const handleResetClick = () => {
    setShowConfirmDialog(true);
    setPassword('');
    setError('');
  };

  const handleConfirmReset = async () => {
    if (!user?.email) {
      setError(t('settings.loginRequired', language));
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (signInError) {
        setError(t('settings.wrongPassword', language));
        setIsVerifying(false);
        return;
      }

      // Password verified, proceed with data reset
      // This now clears local immediately and schedules cloud clear if offline
      const success = await clearAllDataCompletely();

      if (success) {
        toast.success(t('settings.resetDataSuccess', language), {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          description: navigator.onLine 
            ? undefined 
            : 'سيتم مسح البيانات السحابية عند عودة الإنترنت',
        });
        setShowConfirmDialog(false);
        
        // Reload the page to refresh all data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(t('settings.resetDataFailed', language));
      }
    } catch (err) {
      console.error('Reset error:', err);
      setError(t('settings.resetDataFailed', language));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Card */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.resetDataWarning', language)}
          </CardTitle>
          <CardDescription className="text-destructive/80">
            {t('settings.resetDataDescription', language)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{t('settings.dataToBeDeleted', language)}:</h4>
              <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                {dataToBeDeleted.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                variant="destructive" 
                onClick={handleResetClick}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 me-2" />
                {t('settings.resetAllData', language)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('settings.resetDataConfirm', language)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.resetDataConfirmDescription', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                {t('settings.enterPasswordToConfirm', language)}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isVerifying}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifying}>
              {t('common.cancel', language)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmReset();
              }}
              disabled={!password || isVerifying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('settings.verifying', language)}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 me-2" />
                  {t('settings.confirmReset', language)}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
