import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Crown, 
  Users, 
  Key, 
  Shield, 
  Trash2, 
  Plus, 
  Copy, 
  Ban,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  Search,
  AlertTriangle,
  Smartphone,
  RotateCcw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Owner {
  user_id: string;
  role: string;
  role_created_at: string;
  is_active: boolean;
  full_name: string | null;
  license_expires: string | null;
  license_revoked: boolean | null;
  max_cashiers: number | null;
  license_tier: string | null;
  cashier_count: number;
  device_id?: string | null;
  allow_multi_device?: boolean;
}

interface ActivationCode {
  id: string;
  code: string;
  duration_days: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  max_cashiers: number;
  license_tier: string;
  note: string | null;
  created_at: string;
}

export default function BossPanel() {
  const navigate = useNavigate();
  const { isBoss, isLoading: roleLoading } = useUserRole();
  const { t, direction } = useLanguage();
  
  const [owners, setOwners] = useState<Owner[]>([]);
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Code Dialog
  const [showNewCodeDialog, setShowNewCodeDialog] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    duration_days: 30,
    max_uses: 1,
    max_cashiers: 1,
    license_tier: 'basic',
    note: '',
  });
  
  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'owner' | 'code'; id: string; name: string } | null>(null);

  useEffect(() => {
    if (!roleLoading && !isBoss) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول لهذه الصفحة');
    }
  }, [isBoss, roleLoading, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch owners from view
      const { data: ownersData, error: ownersError } = await supabase
        .from('boss_owners_view')
        .select('*');

      // Get multi-device status for each owner from app_licenses
      const { data: licensesData } = await supabase
        .from('app_licenses')
        .select('user_id, allow_multi_device')
        .eq('is_revoked', false);

      const multiDeviceMap = new Map(
        (licensesData || []).map(l => [l.user_id, l.allow_multi_device])
      );

      if (ownersError) {
        console.error('Error fetching owners:', ownersError);
      } else {
        // Merge allow_multi_device into owners
        const enrichedOwners = (ownersData || []).map(owner => ({
          ...owner,
          allow_multi_device: multiDeviceMap.get(owner.user_id) || false,
        }));
        setOwners(enrichedOwners);
      }

      // Fetch activation codes
      const { data: codesData, error: codesError } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (codesError) {
        console.error('Error fetching codes:', codesError);
      } else {
        setCodes(codesData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isBoss) {
      fetchData();
    }
  }, [isBoss]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'FP-';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) code += '-';
    }
    setNewCode(prev => ({ ...prev, code }));
  };

  const handleCreateCode = async () => {
    if (!newCode.code) {
      toast.error('يرجى إدخال كود التفعيل');
      return;
    }

    try {
      const { error } = await supabase
        .from('activation_codes')
        .insert({
          code: newCode.code.toUpperCase(),
          duration_days: newCode.duration_days,
          max_uses: newCode.max_uses,
          max_cashiers: newCode.max_cashiers,
          license_tier: newCode.license_tier,
          note: newCode.note || null,
          is_active: true,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('هذا الكود موجود مسبقاً');
        } else {
          throw error;
        }
        return;
      }

      toast.success('تم إنشاء كود التفعيل بنجاح');
      setShowNewCodeDialog(false);
      setNewCode({
        code: '',
        duration_days: 30,
        max_uses: 1,
        max_cashiers: 1,
        license_tier: 'basic',
        note: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating code:', error);
      toast.error('فشل في إنشاء كود التفعيل');
    }
  };

  const handleToggleCode = async (codeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('activation_codes')
        .update({ is_active: !currentStatus })
        .eq('id', codeId);

      if (error) throw error;

      toast.success(currentStatus ? 'تم تعطيل الكود' : 'تم تفعيل الكود');
      fetchData();
    } catch (error) {
      console.error('Error toggling code:', error);
      toast.error('فشل في تحديث حالة الكود');
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('activation_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;

      toast.success('تم حذف كود التفعيل');
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast.error('فشل في حذف الكود');
    }
  };

  const handleRevokeLicense = async (ownerId: string) => {
    try {
      const { error } = await supabase
        .from('app_licenses')
        .update({ 
          is_revoked: true, 
          revoked_at: new Date().toISOString(),
          revoked_reason: 'Revoked by admin'
        })
        .eq('user_id', ownerId);

      if (error) throw error;

      toast.success('تم إلغاء ترخيص المالك');
      fetchData();
    } catch (error) {
      console.error('Error revoking license:', error);
      toast.error('فشل في إلغاء الترخيص');
    }
  };

  const handleDeleteOwner = async (ownerId: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_owner_cascade', { _owner_id: ownerId });

      if (error) throw error;

      toast.success('تم حذف المالك وجميع بياناته');
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting owner:', error);
      toast.error('فشل في حذف المالك');
    }
  };

  const handleResetDevice = async (ownerId: string, ownerName: string) => {
    try {
      const { error } = await supabase.rpc('reset_user_device', { _target_user_id: ownerId });

      if (error) throw error;

      toast.success(`تم إعادة تعيين جهاز "${ownerName}" بنجاح`);
      fetchData();
    } catch (error) {
      console.error('Error resetting device:', error);
      toast.error('فشل في إعادة تعيين الجهاز');
    }
  };

  const handleToggleMultiDevice = async (ownerId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('app_licenses')
        .update({ allow_multi_device: !currentValue })
        .eq('user_id', ownerId)
        .eq('is_revoked', false);

      if (error) throw error;

      toast.success(!currentValue 
        ? 'تم تفعيل تعدد الأجهزة - يمكن الآن تسجيل الدخول من أي جهاز' 
        : 'تم إلغاء تعدد الأجهزة - سيتم قفل الجهاز عند تسجيل الدخول التالي'
      );
      fetchData();
    } catch (error) {
      console.error('Error toggling multi-device:', error);
      toast.error('فشل في تحديث إعدادات تعدد الأجهزة');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ الكود');
  };

  const filteredOwners = owners.filter(owner =>
    owner.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    owner.user_id.includes(searchTerm)
  );

  const filteredCodes = codes.filter(code =>
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.note?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (roleLoading || !isBoss) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6" dir={direction}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">لوحة التحكم الرئيسية</h1>
              <p className="text-sm text-muted-foreground">إدارة التراخيص والمستخدمين</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="icon">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{owners.length}</p>
                  <p className="text-xs text-muted-foreground">إجمالي الملاك</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Key className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{codes.filter(c => c.is_active).length}</p>
                  <p className="text-xs text-muted-foreground">أكواد نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{owners.filter(o => o.license_expires && new Date(o.license_expires) > new Date() && !o.license_revoked).length}</p>
                  <p className="text-xs text-muted-foreground">تراخيص فعالة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{owners.filter(o => !o.license_expires || new Date(o.license_expires) <= new Date() || o.license_revoked).length}</p>
                  <p className="text-xs text-muted-foreground">تراخيص منتهية</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ps-10"
          />
        </div>

        {/* Activation Codes Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              أكواد التفعيل
            </CardTitle>
            <Button onClick={() => setShowNewCodeDialog(true)} size="sm">
              <Plus className="w-4 h-4 me-2" />
              كود جديد
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredCodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد أكواد</p>
              ) : (
                filteredCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="font-mono text-sm bg-background px-2 py-1 rounded border hover:bg-muted transition-colors"
                      >
                        {code.code}
                        <Copy className="w-3 h-3 inline ms-2 text-muted-foreground" />
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'نشط' : 'معطل'}
                        </Badge>
                        <Badge variant="outline">{code.duration_days} يوم</Badge>
                        <Badge variant="outline">{code.current_uses}/{code.max_uses} استخدام</Badge>
                        <Badge variant="outline">{code.max_cashiers} كاشير</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleCode(code.id, code.is_active)}
                      >
                        {code.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm({ type: 'code', id: code.id, name: code.code })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Owners Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              الملاك المسجلين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredOwners.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا يوجد ملاك مسجلين</p>
              ) : (
                filteredOwners.map((owner) => {
                  const isLicenseValid = owner.license_expires && new Date(owner.license_expires) > new Date() && !owner.license_revoked;
                  const daysRemaining = owner.license_expires 
                    ? Math.ceil((new Date(owner.license_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : 0;

                  return (
                    <div key={owner.user_id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{owner.full_name || 'بدون اسم'}</span>
                          <Badge variant={isLicenseValid ? 'default' : 'destructive'}>
                            {isLicenseValid ? 'ترخيص فعال' : owner.license_revoked ? 'ملغى' : 'منتهي'}
                          </Badge>
                          {owner.license_tier && (
                            <Badge variant="outline">{owner.license_tier}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {owner.cashier_count}/{owner.max_cashiers || 1} كاشير
                          </span>
                          {owner.license_expires && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {isLicenseValid ? `${daysRemaining} يوم متبقي` : 'منتهي'}
                            </span>
                          )}
                          {owner.device_id && (
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              جهاز مسجل
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Multi-device toggle button */}
                        <Button
                          variant={owner.allow_multi_device ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleMultiDevice(owner.user_id, owner.allow_multi_device || false)}
                          title={owner.allow_multi_device ? 'تعدد الأجهزة مفعّل' : 'السماح بتعدد الأجهزة'}
                        >
                          <Smartphone className="w-4 h-4 me-2" />
                          {owner.allow_multi_device ? 'تعدد الأجهزة ✓' : 'تعدد الأجهزة'}
                        </Button>
                        {owner.device_id && !owner.allow_multi_device && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetDevice(owner.user_id, owner.full_name || 'هذا المالك')}
                            title="إعادة تعيين الجهاز"
                          >
                            <RotateCcw className="w-4 h-4 me-2" />
                            إعادة تعيين الجهاز
                          </Button>
                        )}
                        {isLicenseValid && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeLicense(owner.user_id)}
                          >
                            <Ban className="w-4 h-4 me-2" />
                            إلغاء الترخيص
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteConfirm({ type: 'owner', id: owner.user_id, name: owner.full_name || 'هذا المالك' })}
                        >
                          <Trash2 className="w-4 h-4 me-2" />
                          حذف
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* New Code Dialog */}
        <Dialog open={showNewCodeDialog} onOpenChange={setShowNewCodeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء كود تفعيل جديد</DialogTitle>
              <DialogDescription>
                أنشئ كود تفعيل جديد للمستخدمين
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>كود التفعيل</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCode.code}
                    onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="FP-XXXX-XXXX-XXXX"
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={generateRandomCode}>
                    توليد
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>مدة الترخيص (أيام)</Label>
                  <Input
                    type="number"
                    value={newCode.duration_days}
                    onChange={(e) => setNewCode(prev => ({ ...prev, duration_days: parseInt(e.target.value) || 30 }))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد الاستخدامات</Label>
                  <Input
                    type="number"
                    value={newCode.max_uses}
                    onChange={(e) => setNewCode(prev => ({ ...prev, max_uses: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>عدد الكاشيرات المسموح</Label>
                  <Input
                    type="number"
                    value={newCode.max_cashiers}
                    onChange={(e) => setNewCode(prev => ({ ...prev, max_cashiers: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>فئة الترخيص</Label>
                  <Select
                    value={newCode.license_tier}
                    onValueChange={(value) => setNewCode(prev => ({ ...prev, license_tier: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">أساسي</SelectItem>
                      <SelectItem value="pro">احترافي</SelectItem>
                      <SelectItem value="enterprise">مؤسسات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>ملاحظة (اختياري)</Label>
                <Input
                  value={newCode.note}
                  onChange={(e) => setNewCode(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="ملاحظة للكود..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCodeDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleCreateCode}>
                إنشاء الكود
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                تأكيد الحذف
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm?.type === 'owner' 
                  ? `هل أنت متأكد من حذف "${deleteConfirm.name}"؟ سيتم حذف جميع بياناته وكاشيراته نهائياً.`
                  : `هل أنت متأكد من حذف الكود "${deleteConfirm?.name}"؟`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteConfirm?.type === 'owner') {
                    handleDeleteOwner(deleteConfirm.id);
                  } else if (deleteConfirm?.type === 'code') {
                    handleDeleteCode(deleteConfirm.id);
                  }
                }}
              >
                حذف نهائياً
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
