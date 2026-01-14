import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  Calendar,
  Users,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

interface ActivationCode {
  id: string;
  code: string;
  duration_days: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  expires_at: string | null;
}

interface License {
  id: string;
  user_id: string;
  activated_at: string;
  expires_at: string;
  is_trial: boolean;
  profiles?: {
    full_name: string | null;
  };
}

export function LicenseManagement() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCodeCreated, setNewCodeCreated] = useState<string | null>(null);
  
  const [newCodeForm, setNewCodeForm] = useState({
    durationDays: 180,
    maxUses: 1,
    note: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch activation codes
      const { data: codesData, error: codesError } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (codesError) throw codesError;
      setCodes(codesData || []);

      // Fetch licenses
      const { data: licensesData, error: licensesError } = await supabase
        .from('app_licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (licensesError) throw licensesError;

      // Fetch profile names separately
      if (licensesData && licensesData.length > 0) {
        const userIds = licensesData.map(l => l.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const licensesWithProfiles = licensesData.map(license => ({
          ...license,
          profiles: profilesData?.find(p => p.user_id === license.user_id) || null,
        }));
        setLicenses(licensesWithProfiles);
      } else {
        setLicenses([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const parts = [];
    for (let i = 0; i < 4; i++) {
      let part = '';
      for (let j = 0; j < 4; j++) {
        part += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      parts.push(part);
    }
    return `HYPER-${parts.join('-')}`;
  };

  const handleCreateCode = async () => {
    setIsCreating(true);
    try {
      const code = generateCode();
      
      const { error } = await supabase
        .from('activation_codes')
        .insert({
          code,
          duration_days: newCodeForm.durationDays,
          max_uses: newCodeForm.maxUses,
          note: newCodeForm.note || null,
        });

      if (error) throw error;

      setNewCodeCreated(code);
      fetchData();
      
      toast({
        title: isRTL ? 'تم الإنشاء' : 'Created',
        description: isRTL ? 'تم إنشاء كود التفعيل بنجاح' : 'Activation code created successfully',
      });
    } catch (error) {
      console.error('Error creating code:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في إنشاء الكود' : 'Failed to create code',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: isRTL ? 'تم النسخ' : 'Copied',
        description: isRTL ? 'تم نسخ الكود' : 'Code copied to clipboard',
      });
    } catch {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في نسخ الكود' : 'Failed to copy code',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('activation_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchData();
      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف الكود' : 'Code deleted',
      });
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حذف الكود' : 'Failed to delete code',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDurationLabel = (days: number) => {
    if (days === 180) return isRTL ? '6 أشهر' : '6 months';
    if (days === 365) return isRTL ? 'سنة' : '1 year';
    return `${days} ${isRTL ? 'يوم' : 'days'}`;
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewCodeCreated(null);
    setNewCodeForm({ durationDays: 180, maxUses: 1, note: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isRTL ? 'إدارة التراخيص' : 'License Management'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'إنشاء وإدارة أكواد التفعيل' : 'Create and manage activation codes'}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          <span className={isRTL ? 'mr-2' : 'ml-2'}>
            {isRTL ? 'إنشاء كود' : 'Create Code'}
          </span>
        </Button>
      </div>

      {/* Activation Codes */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" />
          {isRTL ? 'أكواد التفعيل' : 'Activation Codes'}
        </h3>
        
        {codes.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {isRTL ? 'لا توجد أكواد بعد' : 'No codes yet'}
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map((code) => (
              <div 
                key={code.id} 
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <code className="font-mono text-sm bg-background px-2 py-1 rounded">
                    {code.code}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {getDurationLabel(code.duration_days)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {code.current_uses}/{code.max_uses} {isRTL ? 'استخدام' : 'uses'}
                  </span>
                  {code.note && (
                    <span className="text-xs text-muted-foreground">
                      ({code.note})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {code.current_uses < code.max_uses && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleCopyCode(code.code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCode(code.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Licenses */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          {isRTL ? 'التراخيص النشطة' : 'Active Licenses'}
        </h3>
        
        {licenses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {isRTL ? 'لا توجد تراخيص بعد' : 'No licenses yet'}
          </p>
        ) : (
          <div className="space-y-2">
            {licenses.map((license) => {
              const isExpired = new Date(license.expires_at) < new Date();
              return (
                <div 
                  key={license.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isExpired ? 'bg-destructive/10' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {license.profiles?.full_name || (isRTL ? 'مستخدم' : 'User')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      license.is_trial 
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {license.is_trial ? (isRTL ? 'تجريبي' : 'Trial') : (isRTL ? 'مفعّل' : 'Active')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {isRTL ? 'ينتهي:' : 'Expires:'} {formatDate(license.expires_at)}
                    </span>
                    {isExpired && (
                      <span className="text-destructive font-medium">
                        ({isRTL ? 'منتهي' : 'Expired'})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Code Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={closeCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newCodeCreated 
                ? (isRTL ? 'تم إنشاء الكود' : 'Code Created')
                : (isRTL ? 'إنشاء كود تفعيل جديد' : 'Create New Activation Code')
              }
            </DialogTitle>
          </DialogHeader>

          {newCodeCreated ? (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <code className="block text-lg font-mono bg-muted px-4 py-2 rounded-lg mb-4">
                {newCodeCreated}
              </code>
              <Button onClick={() => handleCopyCode(newCodeCreated)} className="w-full">
                <Copy className="w-4 h-4" />
                <span className={isRTL ? 'mr-2' : 'ml-2'}>
                  {isRTL ? 'نسخ الكود' : 'Copy Code'}
                </span>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {isRTL ? 'مدة الصلاحية' : 'Duration'}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={newCodeForm.durationDays === 180 ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setNewCodeForm({ ...newCodeForm, durationDays: 180 })}
                    >
                      {isRTL ? '6 أشهر' : '6 months'}
                    </Button>
                    <Button
                      type="button"
                      variant={newCodeForm.durationDays === 365 ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setNewCodeForm({ ...newCodeForm, durationDays: 365 })}
                    >
                      {isRTL ? 'سنة كاملة' : '1 year'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {isRTL ? 'عدد مرات الاستخدام' : 'Max Uses'}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newCodeForm.maxUses}
                    onChange={(e) => setNewCodeForm({ ...newCodeForm, maxUses: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {isRTL ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                  </label>
                  <Input
                    placeholder={isRTL ? 'مثال: للصديق أحمد' : 'e.g., For friend Ahmed'}
                    value={newCodeForm.note}
                    onChange={(e) => setNewCodeForm({ ...newCodeForm, note: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleCreateCode} disabled={isCreating}>
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span className={isRTL ? 'mr-2' : 'ml-2'}>
                    {isRTL ? 'إنشاء الكود' : 'Create Code'}
                  </span>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
