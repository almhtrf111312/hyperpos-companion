import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
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
  const { t, isRTL } = useLanguage();
  const { user: currentUser } = useAuth();
  const { isBoss, isAdmin } = useUserRole();

  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // إذا تم تحديد مستخدم آخر أو كان المستخدم الحالي Boss/Admin يغير كلمة مرور مستخدم، لا نطلب كلمة المرور القديمة إطلاقاً
  const isTargetingOtherUser = Boolean(userId && currentUser?.id && userId !== currentUser.id);
  const isPrivilegedManager = isBoss || isAdmin;
  const requireCurrentPassword = isOwnPassword && !isTargetingOtherUser && !isPrivilegedManager;

  const resetForm = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    // التحقق من كلمة المرور الحالية فقط في حال كانت مطلوبة (للمستخدم العادي لنفسه)
    if (requireCurrentPassword && !form.currentPassword) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال كلمة المرور الحالية',
        variant: 'destructive',
      });
      return;
    }

    if (!form.newPassword) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال كلمة المرور الجديدة',
        variant: 'destructive',
      });
      return;
    }

    if (form.newPassword.length < 6) {
      toast({
        title: 'خطأ',
        description: 'يجب أن لا تقل كلمة المرور عن 6 أحرف أو أرقام',
        variant: 'destructive',
      });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمتا المرور غير متطابقتين',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      if (requireCurrentPassword) {
        // تغيير كلمة المرور الشخصية للمستخدم العادي بعد التحقق من كلمة المرور الحالية
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('تعذر العثور على بيانات المستخدم');

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: form.currentPassword,
        });

        if (signInError) {
          toast({
            title: 'خطأ',
            description: 'كلمة المرور الحالية غير صحيحة',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password: form.newPassword });
        if (error) throw error;

        toast({
          title: 'تم بنجاح',
          description: 'تم تحديث كلمة المرور بنجاح',
        });
      } else if (!isTargetingOtherUser && (!userId || userId === currentUser?.id)) {
        // المستخدم Boss/Admin يغير كلمة مروره الشخصية مباشرة دون الحاجة للقديمة
        const { error } = await supabase.auth.updateUser({ password: form.newPassword });
        if (error) throw error;

        toast({
          title: 'تم بنجاح',
          description: 'تم تحديث كلمة المرور بنجاح',
        });
      } else {
        // تعيين كلمة المرور لكاشير / مستخدم آخر بواسطة Boss/Admin عبر admin-change-password
        const targetId = userId;
        if (!targetId) {
          toast({
            title: 'خطأ',
            description: 'لم يتم تحديد المستخدم المستهدف',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({
            title: 'خطأ في المصادقة',
            description: 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً للمتابعة',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('admin-change-password', {
          body: {
            targetUserId: targetId,
            newPassword: form.newPassword,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          let errorMsg = response.error.message || 'فشل في تغيير كلمة المرور';
          if (errorMsg.includes('Forbidden') || errorMsg.includes('Admin access required')) {
            errorMsg = 'غير مصرح لك بتغيير كلمة مرور هذا المستخدم';
          } else if (errorMsg.includes('at least 6 characters')) {
            errorMsg = 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل';
          }
          throw new Error(errorMsg);
        }

        if (response.data?.error) {
          let errorMsg = response.data.error;
          if (errorMsg.includes('Forbidden')) {
            errorMsg = 'غير مصرح لك بتغيير كلمة مرور هذا المستخدم';
          } else if (errorMsg.includes('at least 6 characters')) {
            errorMsg = 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل';
          } else if (errorMsg.includes('Use the regular password change')) {
            errorMsg = 'يرجى تغيير كلمة مرور حسابك الشخصي من قسم الملف الشخصي';
          }
          throw new Error(errorMsg);
        }

        toast({
          title: 'تم بنجاح',
          description: userName 
            ? `تم تعيين وتحديث كلمة المرور للمستخدم "${userName}" بنجاح`
            : 'تم تعيين كلمة المرور الجديدة بنجاح',
        });
      }

      handleClose();
    } catch (error: any) {
      console.error('Password change error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تغيير كلمة المرور، يرجى المحاولة لاحقاً',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dialogTitle = (
    <div className="flex items-center gap-2">
      <Key className="w-5 h-5 text-primary" />
      <span>
        {requireCurrentPassword
          ? (t('password.change') || 'تغيير كلمة المرور')
          : (userName ? `تعيين كلمة مرور لـ ${userName}` : (t('password.changeUser') || 'تعيين كلمة مرور جديدة'))}
      </span>
    </div>
  );

  const dialogFooter = (
    <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
      <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto min-h-11" disabled={isLoading}>
        {t('password.cancel') || 'إلغاء'}
      </Button>
      <Button onClick={handleSubmit} className="w-full sm:w-auto min-h-11" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin ms-2" />
            {t('password.saving') || 'جاري الحفظ...'}
          </>
        ) : (
          (t('password.changeBtn') || 'حفظ كلمة المرور')
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title={dialogTitle}
      footer={dialogFooter}
      className="max-w-md"
    >
      {!requireCurrentPassword && (
        <div className="bg-primary/10 text-primary p-3 rounded-xl text-xs sm:text-sm font-medium border border-primary/20 flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 shrink-0" />
          <span>
            {userName 
              ? `تعيين كلمة مرور جديدة مباشرة للمستخدم: ${userName}`
              : 'أدخل كلمة المرور الجديدة مباشرة دون الحاجة لكلمة المرور القديمة'}
          </span>
        </div>
      )}

      <div className="space-y-4">
        {requireCurrentPassword && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('password.currentPassword') || 'كلمة المرور الحالية'}
            </label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="••••••••"
                className="pe-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('password.newPassword') || 'كلمة المرور الجديدة'}
          </label>
          <div className="relative">
            <Input
              type={showNewPassword ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="••••••••"
              className="pe-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('password.confirmPassword') || 'تأكيد كلمة المرور الجديدة'}
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="pe-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
