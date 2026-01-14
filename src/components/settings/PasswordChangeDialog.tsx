import { useState } from 'react';
import { Eye, EyeOff, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
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
      toast({ title: 'خطأ', description: 'يرجى إدخال كلمة المرور الحالية', variant: 'destructive' });
      return;
    }
    if (!form.newPassword) {
      toast({ title: 'خطأ', description: 'يرجى إدخال كلمة المرور الجديدة', variant: 'destructive' });
      return;
    }
    if (form.newPassword.length < 6) {
      toast({ title: 'خطأ', description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', variant: 'destructive' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: 'خطأ', description: 'كلمة المرور غير متطابقة', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      if (isOwnPassword) {
        // For own password change, verify current password first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('User not found');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: form.currentPassword,
        });
        if (signInError) {
          toast({ title: 'خطأ', description: 'كلمة المرور الحالية غير صحيحة', variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password: form.newPassword });
        if (error) throw error;
      } else {
        // For admin changing other user's password, use secure edge function
        if (!userId) {
          toast({ title: 'خطأ', description: 'معرف المستخدم غير موجود', variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({ title: 'خطأ', description: 'يرجى تسجيل الدخول مرة أخرى', variant: 'destructive' });
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
          throw new Error(response.error.message || 'فشل في تغيير كلمة المرور');
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }
      }

      toast({ title: 'تم بنجاح', description: 'تم تغيير كلمة المرور بنجاح' });
      handleClose();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'فشل في تغيير كلمة المرور', variant: 'destructive' });
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
            {isOwnPassword ? 'تغيير كلمة المرور' : 'تغيير كلمة مرور المستخدم'}
          </DialogTitle>
        </DialogHeader>

        {!isOwnPassword && userName && (
          <p className="text-sm text-muted-foreground">تغيير كلمة مرور: <strong>{userName}</strong></p>
        )}

        <div className="space-y-4 py-4">
          {isOwnPassword && (
            <div className="space-y-2">
              <label className="text-sm font-medium">كلمة المرور الحالية</label>
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
            <label className="text-sm font-medium">كلمة المرور الجديدة</label>
            <div className="relative">
              <Input type={showNewPassword ? 'text' : 'password'} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="••••••••" className="pl-10" disabled={isLoading} />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">تأكيد كلمة المرور</label>
            <div className="relative">
              <Input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••••" className="pl-10" disabled={isLoading} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto" disabled={isLoading}>إلغاء</Button>
          <Button onClick={handleSubmit} className="w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الحفظ...</> : 'تغيير كلمة المرور'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
