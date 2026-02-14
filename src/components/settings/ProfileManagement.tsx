import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Lock, 
  Edit, 
  Save, 
  X, 
  Crown,
  Shield,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

export function ProfileManagement() {
  const { user, profile, refreshProfile } = useAuth();
  const { isBoss, isAdmin } = useUserRole();
  const { t } = useLanguage();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setNewName(profile.full_name);
    }
  }, [profile]);

  const handleSaveName = async () => {
    if (!newName.trim()) {
      toast.error(t('profile.nameRequired'));
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName.trim() })
        .eq('user_id', user?.id);

      if (error) throw error;

      await refreshProfile();
      toast.success(t('profile.nameUpdated'));
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error(t('profile.nameUpdateFailed'));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!newEmail.trim()) {
      toast.error(t('profile.emailRequired'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error(t('profile.invalidEmail'));
      return;
    }

    if (newEmail === user?.email) {
      setIsEditingEmail(false);
      return;
    }

    setIsSavingEmail(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error(t('profile.loginAgain'));
        return;
      }

      const response = await supabase.functions.invoke('update-boss-email', {
        body: { newEmail: newEmail.trim() },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || t('profile.emailUpdateFailed'));
      }

      if (response.data?.error) {
        if (response.data.error === 'Email already in use') {
          toast.error(t('profile.emailInUse'));
        } else {
          throw new Error(response.data.error);
        }
        return;
      }

      toast.success(t('profile.emailUpdated'));
      setIsEditingEmail(false);
      await supabase.auth.refreshSession();
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || t('profile.emailUpdateFailed'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      toast.error(t('password.currentRequired'));
      return;
    }
    if (!passwordForm.newPassword) {
      toast.error(t('password.newRequired'));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(t('password.minLength'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('password.mismatch'));
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        toast.error(t('password.currentWrong'));
        setIsChangingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast.success(t('password.changeSuccess'));
      setShowPasswordDialog(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(t('password.changeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleBadge = () => {
    if (isBoss) {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
          <Crown className="w-3 h-3 me-1" />
          {t('profile.role.boss')}
        </Badge>
      );
    }
    if (isAdmin) {
      return (
        <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
          <Shield className="w-3 h-3 me-1" />
          {t('profile.role.admin')}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <User className="w-3 h-3 me-1" />
        {t('profile.role.cashier')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {t('profile.title')}
              </CardTitle>
              <CardDescription>{t('profile.description')}</CardDescription>
            </div>
            {getRoleBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              {t('profile.name')}
            </Label>
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('profile.enterName')}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSaveName} disabled={isSavingName}>
                  {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => { setIsEditingName(false); setNewName(profile?.full_name || ''); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span>{profile?.full_name || t('profile.notSet')}</span>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingName(true)}>
                  <Edit className="w-4 h-4 me-1" />
                  {t('profile.edit')}
                </Button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {t('profile.email')}
              {!isBoss && (
                <Badge variant="outline" className="text-xs">{t('profile.readOnly')}</Badge>
              )}
            </Label>
            {isBoss && isEditingEmail ? (
              <div className="flex gap-2">
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('profile.enterNewEmail')} className="flex-1" dir="ltr" />
                <Button size="icon" onClick={handleSaveEmail} disabled={isSavingEmail}>
                  {isSavingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => { setIsEditingEmail(false); setNewEmail(user?.email || ''); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span dir="ltr">{user?.email}</span>
                {isBoss && (
                  <Button size="sm" variant="ghost" onClick={() => { setNewEmail(user?.email || ''); setIsEditingEmail(true); }}>
                    <Edit className="w-4 h-4 me-1" />
                    {t('profile.edit')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Password */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              {t('profile.password')}
            </Label>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">••••••••</span>
              <Button size="sm" variant="ghost" onClick={() => setShowPasswordDialog(true)}>
                <Lock className="w-4 h-4 me-1" />
                {t('profile.changeBtn')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('password.change')}</DialogTitle>
            <DialogDescription>{t('profile.enterCurrentAndNew')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('password.currentPassword')}</Label>
              <div className="relative">
                <Input type={showPasswords.current ? 'text' : 'password'} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="••••••••" className="pe-10" />
                <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground">
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('password.newPassword')}</Label>
              <div className="relative">
                <Input type={showPasswords.new ? 'text' : 'password'} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="••••••••" className="pe-10" />
                <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground">
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('password.confirmPassword')}</Label>
              <div className="relative">
                <Input type={showPasswords.confirm ? 'text' : 'password'} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} placeholder="••••••••" className="pe-10" />
                <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground">
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              {t('password.cancel')}
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  {t('profile.changingPassword')}
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 me-2" />
                  {t('password.changeBtn')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
