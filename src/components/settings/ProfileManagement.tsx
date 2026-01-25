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
  Plus, 
  Trash2, 
  Crown, 
  Shield,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

interface BossAccount {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export function ProfileManagement() {
  const { user, profile, refreshProfile } = useAuth();
  const { isBoss, isAdmin } = useUserRole();
  const { t } = useLanguage();
  
  // Profile editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  // Password change
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
  
  // Boss accounts management
  const [bossAccounts, setBossAccounts] = useState<BossAccount[]>([]);
  const [showAddBossDialog, setShowAddBossDialog] = useState(false);
  const [newBossForm, setNewBossForm] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [showNewBossPassword, setShowNewBossPassword] = useState(false);
  const [isAddingBoss, setIsAddingBoss] = useState(false);
  const [isLoadingBossAccounts, setIsLoadingBossAccounts] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setNewName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (isBoss) {
      fetchBossAccounts();
    }
  }, [isBoss]);

  const fetchBossAccounts = async () => {
    if (!isBoss) return;
    
    setIsLoadingBossAccounts(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await supabase.functions.invoke('get-users-with-emails', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) throw response.error;

      const bosses = (response.data?.users || []).filter(
        (u: any) => u.role === 'boss'
      );
      
      setBossAccounts(bosses.map((b: any) => ({
        user_id: b.user_id,
        email: b.email || '',
        full_name: b.full_name,
        created_at: b.role_created_at
      })));
    } catch (error) {
      console.error('Error fetching boss accounts:', error);
    } finally {
      setIsLoadingBossAccounts(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      toast.error('الاسم مطلوب');
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
      toast.success('تم تحديث الاسم بنجاح');
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('فشل في تحديث الاسم');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      toast.error('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (!passwordForm.newPassword) {
      toast.error('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        toast.error('كلمة المرور الحالية غير صحيحة');
        setIsChangingPassword(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast.success('تم تغيير كلمة المرور بنجاح');
      setShowPasswordDialog(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('فشل في تغيير كلمة المرور');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAddBossAccount = async () => {
    if (!newBossForm.email || !newBossForm.password || !newBossForm.fullName) {
      toast.error('جميع الحقول مطلوبة');
      return;
    }

    if (newBossForm.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsAddingBoss(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      // Call edge function to create new boss account
      const response = await supabase.functions.invoke('create-boss-account', {
        body: {
          email: newBossForm.email,
          password: newBossForm.password,
          fullName: newBossForm.fullName
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'فشل في إنشاء الحساب');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('تم إنشاء حساب Boss جديد بنجاح');
      setShowAddBossDialog(false);
      setNewBossForm({ email: '', password: '', fullName: '' });
      fetchBossAccounts();
    } catch (error: any) {
      console.error('Error creating boss account:', error);
      toast.error(error.message || 'فشل في إنشاء الحساب');
    } finally {
      setIsAddingBoss(false);
    }
  };

  const getRoleBadge = () => {
    if (isBoss) {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
          <Crown className="w-3 h-3 me-1" />
          Boss
        </Badge>
      );
    }
    if (isAdmin) {
      return (
        <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
          <Shield className="w-3 h-3 me-1" />
          مشرف
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <User className="w-3 h-3 me-1" />
        كاشير
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Personal Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                الملف الشخصي
              </CardTitle>
              <CardDescription>إدارة معلومات حسابك</CardDescription>
            </div>
            {getRoleBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              الاسم
            </Label>
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="أدخل اسمك"
                  className="flex-1"
                />
                <Button 
                  size="icon" 
                  onClick={handleSaveName}
                  disabled={isSavingName}
                >
                  {isSavingName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </Button>
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={() => {
                    setIsEditingName(false);
                    setNewName(profile?.full_name || '');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span>{profile?.full_name || 'غير محدد'}</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setIsEditingName(true)}
                >
                  <Edit className="w-4 h-4 me-1" />
                  تعديل
                </Button>
              </div>
            )}
          </div>

          {/* Email - Read Only for non-boss */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              البريد الإلكتروني
              {!isBoss && (
                <Badge variant="outline" className="text-xs">للقراءة فقط</Badge>
              )}
            </Label>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span>{user?.email}</span>
            </div>
          </div>

          <Separator />

          {/* Password Change */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              كلمة المرور
            </Label>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">••••••••</span>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setShowPasswordDialog(true)}
              >
                <Lock className="w-4 h-4 me-1" />
                تغيير
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boss Accounts Management - Only visible to Boss */}
      {isBoss && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  حسابات Boss
                </CardTitle>
                <CardDescription>
                  إدارة حسابات المسؤولين الرئيسيين (يمكن أن يكون هناك أكثر من حساب Boss)
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddBossDialog(true)}>
                <Plus className="w-4 h-4 me-1" />
                إضافة Boss
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingBossAccounts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : bossAccounts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                لا توجد حسابات Boss أخرى
              </p>
            ) : (
              <div className="space-y-3">
                {bossAccounts.map((boss) => (
                  <div 
                    key={boss.user_id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium">{boss.full_name || 'بدون اسم'}</p>
                        <p className="text-sm text-muted-foreground">{boss.email}</p>
                      </div>
                    </div>
                    {boss.user_id === user?.id && (
                      <Badge variant="outline">حسابك</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
            <DialogDescription>
              أدخل كلمة المرور الحالية والجديدة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>كلمة المرور الحالية</Label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>تأكيد كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  جارٍ التغيير...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 me-2" />
                  تغيير كلمة المرور
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Boss Account Dialog */}
      <Dialog open={showAddBossDialog} onOpenChange={setShowAddBossDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              إضافة حساب Boss جديد
            </DialogTitle>
            <DialogDescription>
              سيتم إنشاء حساب Boss جديد بصلاحيات كاملة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input
                value={newBossForm.fullName}
                onChange={(e) => setNewBossForm({ ...newBossForm, fullName: e.target.value })}
                placeholder="أدخل الاسم"
              />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={newBossForm.email}
                onChange={(e) => setNewBossForm({ ...newBossForm, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={showNewBossPassword ? 'text' : 'password'}
                  value={newBossForm.password}
                  onChange={(e) => setNewBossForm({ ...newBossForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewBossPassword(!showNewBossPassword)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                >
                  {showNewBossPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBossDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddBossAccount} disabled={isAddingBoss}>
              {isAddingBoss ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  جارٍ الإنشاء...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 me-2" />
                  إنشاء الحساب
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
