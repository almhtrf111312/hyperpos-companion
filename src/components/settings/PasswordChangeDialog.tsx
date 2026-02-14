import { useState } from 'react';
import { Eye, EyeOff, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';

interface PasswordChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userName?: string;
  isOwnPassword?: boolean;
}

export function PasswordChangeDialog({
  open,
  onOpenChange,
  userId,
  userName,
  isOwnPassword = false,
}: PasswordChangeDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const resetForm = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (isOwnPassword && !form.currentPassword) {
      toast({ title: t('password.error'), description: t('password.currentRequired'), variant: 'destructive' });
      return;
    }
    if (!form.newPassword) {
      toast({ title: t('password.error'), description: t('password.newRequired'), variant: 'destructive' });
      return;
    }
    if (form.newPassword.length < 6) {
      toast({ title: t('password.error'), description: t('password.minLength'), variant: 'destructive' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: t('password.error'), description: t('password.mismatch'), variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      if (isOwnPassword) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('User not found');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: form.currentPassword,
        });
        if (signInError) {
          toast({ title: t('password.error'), description: t('password.currentWrong'), variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password: form.newPassword });
        if (error) throw error;
      } else {
        if (!userId) {
          toast({ title: t('password.error'), description: t('password.userNotFound'), variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({ title: t('password.error'), description: t('profile.loginAgain'), variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('admin-change-password', {
          body: {
            targetUserId: userId,
            newPassword: form.newPassword,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || t('password.changeFailed'));
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }
      }

      toast({ title: t('password.changeSuccess'), description: t('password.changeSuccess') });
      handleClose();
    } catch (error: any) {
      toast({ title: t('password.error'), description: error.message || t('password.changeFailed'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            {isOwnPassword ? t('password.change') : t('password.changeUser')}
          </DialogTitle>
        </DialogHeader>

        {!isOwnPassword && userName && (
          <p className="text-sm text-muted-foreground">{t('password.changingFor')} <strong>{userName}</strong></p>
        )}

        <div className="space-y-4 py-4">
          {isOwnPassword && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('password.currentPassword')}</label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10"
                  disabled={isLoading}
                />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('password.newPassword')}</label>
            <div className="relative">
              <Input type={showNewPassword ? 'text' : 'password'} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="••••••••" className="pl-10" disabled={isLoading} />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('password.confirmPassword')}</label>
            <div className="relative">
              <Input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••••" className="pl-10" disabled={isLoading} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto" disabled={isLoading}>{t('password.cancel')}</Button>
          <Button onClick={handleSubmit} className="w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t('password.saving')}</> : t('password.changeBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
