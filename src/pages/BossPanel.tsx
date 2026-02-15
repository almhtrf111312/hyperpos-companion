import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/use-user-role';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  RotateCcw,
  Mail,
  Ticket,
  Send,
  Pencil,
  MessageCircle,
  MoreVertical,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Wrench,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SystemDiagnostics } from '@/components/settings/SystemDiagnostics';

interface CashierInfo {
  user_id: string;
  email: string | null;
  full_name: string | null;
  user_type: string;
  is_active: boolean;
}

interface Owner {
  user_id: string;
  email: string | null;
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
  is_trial?: boolean;
  activation_code?: string | null;
  cashiers?: CashierInfo[];
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
  const { user } = useAuth();
  const { t, direction } = useLanguage();
  const isMobile = useIsMobile();

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

  // Edit Code Dialog
  const [editCodeDialog, setEditCodeDialog] = useState<ActivationCode | null>(null);
  const [editCodeForm, setEditCodeForm] = useState({
    duration_days: 30,
    max_uses: 1,
    max_cashiers: 1,
    license_tier: 'basic',
    note: '',
  });

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'owner' | 'code'; id: string; name: string } | null>(null);

  // Edit Name Dialog
  const [editNameDialog, setEditNameDialog] = useState<{ owner: Owner } | null>(null);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Remote Activation Dialog
  const [activationDialog, setActivationDialog] = useState<{ owner: Owner } | null>(null);
  const [activationType, setActivationType] = useState<'new' | 'existing' | 'whatsapp' | 'manual'>('new');
  const [activationSettings, setActivationSettings] = useState({
    duration_days: 180,
    max_cashiers: 1,
    license_tier: 'basic',
    selected_code_id: '',
    manual_code: '',
  });
  const [isActivating, setIsActivating] = useState(false);

  // Edit License Dialog
  const [editLicenseDialog, setEditLicenseDialog] = useState<{ owner: Owner } | null>(null);
  const [editLicenseSettings, setEditLicenseSettings] = useState({
    duration_days: 180,
    max_cashiers: 1,
    license_tier: 'basic',
    generated_code: '',
  });
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isSavingLicense, setIsSavingLicense] = useState(false);

  // Contact Links Settings
  const [contactLinks, setContactLinks] = useState<Record<string, string>>({
    whatsapp: '', facebook: '', tiktok: '', telegram: '',
    youtube: '', twitter: '', email: '', olx: '',
  });
  const [showContactLinksDialog, setShowContactLinksDialog] = useState(false);
  const [isSavingContactLinks, setIsSavingContactLinks] = useState(false);

  // Create Owner Dialog
  const [showCreateOwnerDialog, setShowCreateOwnerDialog] = useState(false);
  const [createOwnerForm, setCreateOwnerForm] = useState({ email: '', password: '', fullName: '' });
  const [showCreateOwnerPassword, setShowCreateOwnerPassword] = useState(false);
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);

  // Create Boss Dialog
  const [showCreateBossDialog, setShowCreateBossDialog] = useState(false);
  const [createBossForm, setCreateBossForm] = useState({ email: '', password: '', fullName: '', bossPassword: '' });
  const [showCreateBossPasswords, setShowCreateBossPasswords] = useState({ new: false, boss: false });
  const [isCreatingBoss, setIsCreatingBoss] = useState(false);

  // Delete Boss with password
  const [deleteBossConfirm, setDeleteBossConfirm] = useState<{ user_id: string; name: string } | null>(null);
  const [deleteBossPassword, setDeleteBossPassword] = useState('');
  const [showDeleteBossPassword, setShowDeleteBossPassword] = useState(false);
  const [isDeletingBoss, setIsDeletingBoss] = useState(false);

  // Cashier password change
  const [cashierPasswordDialog, setCashierPasswordDialog] = useState<{ userId: string; name: string } | null>(null);
  const [cashierNewPassword, setCashierNewPassword] = useState('');
  const [showCashierNewPassword, setShowCashierNewPassword] = useState(false);
  const [isChangingCashierPassword, setIsChangingCashierPassword] = useState(false);

  // Cashier edit name
  const [editCashierNameDialog, setEditCashierNameDialog] = useState<{ userId: string; name: string } | null>(null);
  const [cashierNewName, setCashierNewName] = useState('');
  const [isSavingCashierName, setIsSavingCashierName] = useState(false);

  // Expanded owners (to show/hide cashier list)
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roleLoading && !isBoss) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول لهذه الصفحة');
    }
  }, [isBoss, roleLoading, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch owners with emails from edge function
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        const response = await supabase.functions.invoke('get-users-with-emails', {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (response.error) {
          console.error('Error fetching users:', response.error);
          // Fallback to view if edge function fails
          const { data: ownersData } = await supabase
            .from('boss_owners_view')
            .select('*');
          setOwners((ownersData || []).map(o => ({ ...o, email: null })));
        } else {
          setOwners(response.data.users || []);
        }
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

  // Fetch contact links settings
  const fetchContactLinksSettings = async () => {
    try {
      const { data: linksData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'contact_links')
        .maybeSingle();

      if (linksData?.value) {
        const parsed = JSON.parse(linksData.value);
        setContactLinks(prev => ({ ...prev, ...parsed }));
      } else {
        // Fallback: read old developer_phone
        const { data: phoneData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'developer_phone')
          .maybeSingle();
        if (phoneData?.value) {
          setContactLinks(prev => ({ ...prev, whatsapp: phoneData.value || '' }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch contact links:', err);
    }
  };

  // Save contact links
  const handleSaveContactLinks = async () => {
    setIsSavingContactLinks(true);
    try {
      const now = new Date().toISOString();
      // Save contact_links JSON
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'contact_links', value: JSON.stringify(contactLinks), updated_at: now }, { onConflict: 'key' });
      if (error) throw error;

      // Also save developer_phone for backward compatibility
      if (contactLinks.whatsapp) {
        await supabase
          .from('app_settings')
          .upsert({ key: 'developer_phone', value: contactLinks.whatsapp, updated_at: now }, { onConflict: 'key' });
      }

      toast.success('تم حفظ إعدادات التواصل بنجاح');
      setShowContactLinksDialog(false);
    } catch (err) {
      console.error('Error saving contact links:', err);
      toast.error('فشل في حفظ إعدادات التواصل');
    } finally {
      setIsSavingContactLinks(false);
    }
  };

  useEffect(() => {
    if (isBoss) {
      fetchData();
      fetchContactLinksSettings();
    }
  }, [isBoss]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    let code = 'FP-';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        code += chars.charAt(array[i * 4 + j] % chars.length);
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

  const handleEditCode = async () => {
    if (!editCodeDialog) return;

    try {
      const { error } = await supabase
        .from('activation_codes')
        .update({
          duration_days: editCodeForm.duration_days,
          max_uses: editCodeForm.max_uses,
          max_cashiers: editCodeForm.max_cashiers,
          license_tier: editCodeForm.license_tier,
          note: editCodeForm.note || null,
        })
        .eq('id', editCodeDialog.id);

      if (error) throw error;

      toast.success('تم تحديث الكود بنجاح');
      setEditCodeDialog(null);
      fetchData();
    } catch (error) {
      console.error('Error updating code:', error);
      toast.error('فشل في تحديث الكود');
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
      // Check if this code is used by a Boss account
      const codeToDelete = codes.find(c => c.id === codeId);
      if (codeToDelete) {
        // Check if any boss user has used this code
        const { data: bossLicenses } = await supabase
          .from('app_licenses')
          .select('user_id, activation_code_id')
          .eq('activation_code_id', codeId);

        if (bossLicenses && bossLicenses.length > 0) {
          // Check if any of these users are boss
          for (const license of bossLicenses) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', license.user_id)
              .single();

            if (roleData?.role === 'boss') {
              toast.error('لا يمكن حذف كود تفعيل مستخدم من قبل حساب Boss');
              setDeleteConfirm(null);
              return;
            }
          }
        }
      }

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
      // IMPORTANT: deleting an owner must remove the auth account too (email reuse)
      // so we call the backend delete-user function in "owner" mode.
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: ownerId, deleteType: 'owner' },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to delete owner');

      toast.success('تم حذف المالك بالكامل من النظام');
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

  // Create Owner handler
  const handleCreateOwner = async () => {
    if (!createOwnerForm.email || !createOwnerForm.password || !createOwnerForm.fullName) {
      toast.error('جميع الحقول مطلوبة');
      return;
    }
    if (createOwnerForm.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsCreatingOwner(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: createOwnerForm.email,
          password: createOwnerForm.password,
          fullName: createOwnerForm.fullName,
          role: 'admin',
        },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) throw new Error(error.message || 'فشل في إنشاء الحساب');
      if (data?.error) throw new Error(data.error);

      toast.success('تم إنشاء حساب المالك بنجاح');
      setShowCreateOwnerDialog(false);
      setCreateOwnerForm({ email: '', password: '', fullName: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating owner:', error);
      toast.error(error.message || 'فشل في إنشاء الحساب');
    } finally {
      setIsCreatingOwner(false);
    }
  };

  // Create Boss handler (with password verification)
  const handleCreateBoss = async () => {
    if (!createBossForm.email || !createBossForm.password || !createBossForm.fullName || !createBossForm.bossPassword) {
      toast.error('جميع الحقول مطلوبة');
      return;
    }
    if (createBossForm.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsCreatingBoss(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userEmail = session?.session?.user?.email;
      if (!userEmail || !session?.session?.access_token) {
        toast.error('يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      // Verify boss password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: createBossForm.bossPassword,
      });

      if (signInError) {
        toast.error('كلمة مرور البوس غير صحيحة');
        setIsCreatingBoss(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-boss-account', {
        body: {
          email: createBossForm.email,
          password: createBossForm.password,
          fullName: createBossForm.fullName,
        },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) throw new Error(error.message || 'فشل في إنشاء الحساب');
      if (data?.error) throw new Error(data.error);

      toast.success('تم إنشاء حساب Boss جديد بنجاح');
      setShowCreateBossDialog(false);
      setCreateBossForm({ email: '', password: '', fullName: '', bossPassword: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating boss:', error);
      toast.error(error.message || 'فشل في إنشاء الحساب');
    } finally {
      setIsCreatingBoss(false);
    }
  };

  // Delete Boss handler (with password verification)
  const handleDeleteBoss = async () => {
    if (!deleteBossConfirm || !deleteBossPassword) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setIsDeletingBoss(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userEmail = session?.session?.user?.email;
      if (!userEmail || !session?.session?.access_token) {
        toast.error('يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      // Verify boss password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: deleteBossPassword,
      });

      if (signInError) {
        toast.error('كلمة المرور غير صحيحة');
        setIsDeletingBoss(false);
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteBossConfirm.user_id, deleteType: 'boss' },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || 'فشل في حذف الحساب');
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('تم حذف حساب Boss بنجاح');
      setDeleteBossConfirm(null);
      setDeleteBossPassword('');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting boss:', error);
      toast.error(error.message || 'فشل في حذف الحساب');
    } finally {
      setIsDeletingBoss(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ الكود');
  };

  const handleRemoteActivation = async () => {
    if (!activationDialog) return;

    setIsActivating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      if (activationType === 'whatsapp') {
        // Generate code and send via WhatsApp
        const selectedCode = codes.find(c => c.id === activationSettings.selected_code_id);
        if (!selectedCode) {
          toast.error('يرجى اختيار كود');
          return;
        }

        const phone = activationDialog.owner.email?.includes('@')
          ? ''
          : activationDialog.owner.email;

        const message = encodeURIComponent(
          `مرحباً ${activationDialog.owner.full_name || 'عزيزي العميل'}!\n\n` +
          `كود تفعيل FlowPOS Pro الخاص بك:\n` +
          `${selectedCode.code}\n\n` +
          `مدة الترخيص: ${selectedCode.duration_days} يوم\n` +
          `عدد الكاشيرات: ${selectedCode.max_cashiers}\n\n` +
          `رابط التطبيق: https://propos.lovable.app`
        );

        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        toast.success('تم فتح واتساب');
        setActivationDialog(null);
        return;
      }

      // Manual code entry activation
      if (activationType === 'manual') {
        if (!activationSettings.manual_code.trim()) {
          toast.error('يرجى إدخال كود التفعيل');
          return;
        }

        // Validate the code first
        const code = activationSettings.manual_code.trim().toUpperCase();
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .maybeSingle();

        if (codeError || !codeData) {
          toast.error('الكود غير صالح أو غير موجود');
          return;
        }

        if (codeData.current_uses >= codeData.max_uses) {
          toast.error('تم استنفاذ عدد استخدامات هذا الكود');
          return;
        }

        const response = await supabase.functions.invoke('remote-activate-user', {
          body: {
            target_user_id: activationDialog.owner.user_id,
            activation_code_id: codeData.id
          },
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to activate');
        }

        toast.success(`تم تفعيل حساب "${activationDialog.owner.full_name || activationDialog.owner.email}" بنجاح باستخدام الكود ${code}`);
        setActivationDialog(null);
        setActivationSettings(prev => ({ ...prev, manual_code: '' }));
        fetchData();
        return;
      }

      const payload = activationType === 'existing'
        ? { target_user_id: activationDialog.owner.user_id, activation_code_id: activationSettings.selected_code_id }
        : {
          target_user_id: activationDialog.owner.user_id,
          duration_days: activationSettings.duration_days,
          max_cashiers: activationSettings.max_cashiers,
          license_tier: activationSettings.license_tier,
        };

      const response = await supabase.functions.invoke('remote-activate-user', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to activate');
      }

      toast.success(`تم تفعيل حساب "${activationDialog.owner.full_name || activationDialog.owner.email}" بنجاح`);
      setActivationDialog(null);
      fetchData();
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error('فشل في تفعيل الحساب');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSaveName = async () => {
    if (!editNameDialog || !newName.trim()) return;

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName.trim() })
        .eq('user_id', editNameDialog.owner.user_id);

      if (error) throw error;

      toast.success('تم تحديث الاسم بنجاح');
      setEditNameDialog(null);
      setNewName('');
      fetchData();
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('فشل في تحديث الاسم');
    } finally {
      setIsSavingName(false);
    }
  };

  // Cashier password change handler
  const handleChangeCashierPassword = async () => {
    if (!cashierPasswordDialog || !cashierNewPassword) return;
    if (cashierNewPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsChangingCashierPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-change-password', {
        body: { userId: cashierPasswordDialog.userId, newPassword: cashierNewPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`تم تغيير كلمة مرور "${cashierPasswordDialog.name}" بنجاح`);
      setCashierPasswordDialog(null);
      setCashierNewPassword('');
    } catch (error: any) {
      console.error('Error changing cashier password:', error);
      toast.error(error.message || 'فشل في تغيير كلمة المرور');
    } finally {
      setIsChangingCashierPassword(false);
    }
  };

  // Cashier edit name handler
  const handleSaveCashierName = async () => {
    if (!editCashierNameDialog || !cashierNewName.trim()) return;

    setIsSavingCashierName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: cashierNewName.trim() })
        .eq('user_id', editCashierNameDialog.userId);

      if (error) throw error;

      toast.success('تم تحديث اسم الحساب التابع بنجاح');
      setEditCashierNameDialog(null);
      setCashierNewName('');
      fetchData();
    } catch (error) {
      console.error('Error updating cashier name:', error);
      toast.error('فشل في تحديث الاسم');
    } finally {
      setIsSavingCashierName(false);
    }
  };

  // Delete cashier handler
  const handleDeleteCashier = async (cashierUserId: string, cashierName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: cashierUserId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');

      toast.success(`تم حذف "${cashierName}" بنجاح`);
      fetchData();
    } catch (error) {
      console.error('Error deleting cashier:', error);
      toast.error('فشل في حذف الحساب التابع');
    }
  };

  // Reset cashier device handler
  const handleResetCashierDevice = async (cashierUserId: string, cashierName: string) => {
    try {
      const { error } = await supabase.rpc('reset_user_device', { _target_user_id: cashierUserId });
      if (error) throw error;
      toast.success(`تم إعادة تعيين جهاز "${cashierName}" بنجاح`);
      fetchData();
    } catch (error) {
      console.error('Error resetting cashier device:', error);
      toast.error('فشل في إعادة تعيين الجهاز');
    }
  };

  const toggleOwnerExpanded = (ownerId: string) => {
    setExpandedOwners(prev => {
      const next = new Set(prev);
      if (next.has(ownerId)) next.delete(ownerId);
      else next.add(ownerId);
      return next;
    });
  };

  const generateCodeForEditLicense = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    let code = 'FP-';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        code += chars.charAt(array[i * 4 + j] % chars.length);
      }
      if (i < 3) code += '-';
    }
    setEditLicenseSettings(prev => ({ ...prev, generated_code: code }));
  };

  // Save generated code and apply to user
  const handleSaveEditLicense = async () => {
    if (!editLicenseDialog || !editLicenseSettings.generated_code) {
      toast.error('يرجى إنشاء كود أولاً');
      return;
    }

    setIsSavingLicense(true);
    try {
      // First create the activation code
      const { data: codeData, error: codeError } = await supabase
        .from('activation_codes')
        .insert({
          code: editLicenseSettings.generated_code,
          duration_days: editLicenseSettings.duration_days,
          max_uses: 1,
          max_cashiers: editLicenseSettings.max_cashiers,
          license_tier: editLicenseSettings.license_tier,
          note: `تم إنشاؤه لـ ${editLicenseDialog.owner.full_name || editLicenseDialog.owner.email}`,
          is_active: true,
        })
        .select()
        .single();

      if (codeError) {
        if (codeError.code === '23505') {
          toast.error('هذا الكود موجود مسبقاً، جرب إنشاء كود جديد');
        } else {
          throw codeError;
        }
        return;
      }

      // Now apply the code to the user via the remote activation function
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      const response = await supabase.functions.invoke('remote-activate-user', {
        body: {
          target_user_id: editLicenseDialog.owner.user_id,
          activation_code_id: codeData.id
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to activate');
      }

      toast.success(`تم تفعيل/تمديد حساب "${editLicenseDialog.owner.full_name || editLicenseDialog.owner.email}" بنجاح`);
      setEditLicenseDialog(null);
      setEditLicenseSettings({
        duration_days: 180,
        max_cashiers: 1,
        license_tier: 'basic',
        generated_code: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error saving license:', error);
      toast.error('فشل في حفظ التفعيل');
    } finally {
      setIsSavingLicense(false);
    }
  };

  const filteredOwners = owners
    .filter(owner => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      return (
        owner.full_name?.toLowerCase().includes(term) ||
        owner.email?.toLowerCase().includes(term) ||
        owner.user_id.includes(searchTerm) ||
        owner.activation_code?.toLowerCase().includes(term) ||
        owner.cashiers?.some(c =>
          c.full_name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term)
        )
      );
    })
    .sort((a, b) => {
      if (a.role === 'boss' && b.role !== 'boss') return -1;
      if (a.role !== 'boss' && b.role === 'boss') return 1;
      return 0;
    });

  const totalSubAccounts = owners.reduce((sum, o) => sum + (o.cashiers?.length || 0), 0);
  const totalUsers = owners.length + totalSubAccounts;

  const filteredCodes = codes.filter(code =>
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.note?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableCodes = codes.filter(c => c.is_active && c.current_uses < c.max_uses);

  // Build a map of activation_code_id -> owner email for codes section
  const codeToOwnerMap = new Map<string, { email: string | null; name: string | null }>();
  for (const owner of owners) {
    if (owner.activation_code) {
      const matchedCode = codes.find(c => c.code === owner.activation_code);
      if (matchedCode) {
        codeToOwnerMap.set(matchedCode.id, { email: owner.email, name: owner.full_name });
      }
    }
  }

  // License issues: owners with expired, revoked, or no license
  const licenseIssueOwners = owners.filter(o => {
    if (o.role === 'boss') return false;
    return !o.license_expires || new Date(o.license_expires) <= new Date() || o.license_revoked;
  });

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
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 pt-12 md:pt-3" dir={direction}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-foreground truncate">لوحة التحكم الرئيسية</h1>
              <p className="text-xs md:text-sm text-muted-foreground">إدارة التراخيص والمستخدمين</p>
            </div>
          </div>
          {isLoading && (
            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="users" className="text-xs md:text-sm py-2 gap-1">
              <Users className="w-3.5 h-3.5 hidden md:inline" />
              المستخدمين
            </TabsTrigger>
            <TabsTrigger value="codes" className="text-xs md:text-sm py-2 gap-1">
              <Key className="w-3.5 h-3.5 hidden md:inline" />
              أكواد التفعيل
            </TabsTrigger>
            <TabsTrigger value="issues" className="text-xs md:text-sm py-2 gap-1 relative">
              <AlertTriangle className="w-3.5 h-3.5 hidden md:inline" />
              مشاكل التراخيص
              {licenseIssueOwners.length > 0 && (
                <span className="absolute -top-1 -end-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                  {licenseIssueOwners.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs md:text-sm py-2 gap-1">
              <Wrench className="w-3.5 h-3.5 hidden md:inline" />
              النظام
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Users */}
          <TabsContent value="users" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
              <Card className="overflow-hidden bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg md:text-2xl font-bold">{totalUsers}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">إجمالي المستخدمين</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="overflow-hidden bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 md:w-5 md:h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg md:text-2xl font-bold">{totalSubAccounts}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">الحسابات التابعة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="overflow-hidden bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg md:text-2xl font-bold">{owners.filter(o => o.license_expires && new Date(o.license_expires) > new Date() && !o.license_revoked).length}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">تراخيص فعالة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="overflow-hidden bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <XCircle className="w-4 h-4 md:w-5 md:h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg md:text-2xl font-bold">{licenseIssueOwners.length}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">تراخيص بها مشاكل</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الإيميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-10"
              />
            </div>

            {/* Owners List */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 md:px-6 bg-gradient-to-br from-primary/5 to-primary/0">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  المستخدمين المسجلين
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowCreateOwnerDialog(true)} size="sm" variant="outline" className="text-xs md:text-sm">
                    <UserPlus className="w-3 h-3 md:w-4 md:h-4 me-1" />
                    {isMobile ? 'مالك' : 'إضافة مالك'}
                  </Button>
                  <Button onClick={() => setShowCreateBossDialog(true)} size="sm" className="text-xs md:text-sm bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                    <Crown className="w-3 h-3 md:w-4 md:h-4 me-1" />
                    {isMobile ? 'Boss' : 'إضافة Boss'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6">
                <div className="space-y-3 md:space-y-4">
                  {filteredOwners.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 md:py-8 text-sm">لا يوجد مستخدمين مسجلين</p>
                  ) : (
                    filteredOwners.map((owner) => {
                      const isLicenseValid = owner.license_expires && new Date(owner.license_expires) > new Date() && !owner.license_revoked;
                      const daysRemaining = owner.license_expires
                        ? Math.ceil((new Date(owner.license_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const isBossUser = owner.role === 'boss';

                      return (
                        <div key={owner.user_id} className={`relative p-3 md:p-4 rounded-lg space-y-2 md:space-y-3 border-s-4 ${
                          isBossUser ? 'border-s-amber-500 bg-amber-500/5' :
                          owner.license_revoked ? 'border-s-destructive bg-destructive/5' :
                          !isLicenseValid ? 'border-s-destructive bg-destructive/5' :
                          owner.is_trial ? 'border-s-orange-400 bg-orange-400/5' :
                          'border-s-emerald-500 bg-emerald-500/5'
                        }`}>
                          {/* User Header with Action Menu */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center flex-wrap gap-1 md:gap-2">
                                <span className="font-medium text-sm md:text-lg">{owner.full_name || 'بدون اسم'}</span>
                                {isBossUser && (
                                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-[10px] md:text-xs">
                                    <Crown className="w-2.5 h-2.5 md:w-3 md:h-3 me-1" />
                                    Boss
                                  </Badge>
                                )}
                                {isBossUser ? (
                                  <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-[10px] md:text-xs">
                                    ترخيص دائم ∞
                                  </Badge>
                                ) : (
                                  <Badge variant={isLicenseValid ? 'default' : 'destructive'} className="text-[10px] md:text-xs">
                                    {isLicenseValid
                                      ? (owner.is_trial ? 'تجريبي' : 'فعال')
                                      : owner.license_revoked ? 'ملغى' : 'منتهي'
                                    }
                                  </Badge>
                                )}
                                {owner.license_tier && !isBossUser && (
                                  <Badge variant="outline" className="text-[10px] md:text-xs">{owner.license_tier}</Badge>
                                )}
                              </div>

                              {/* Email */}
                              {owner.email && (
                                <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  <span className="font-mono break-all">{owner.email}</span>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => copyToClipboard(owner.email!)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}

                              {/* Activation Code */}
                              {owner.activation_code && !isBossUser && (
                                <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                                  <Key className="w-3 h-3 flex-shrink-0" />
                                  <span className="font-mono break-all">{owner.activation_code}</span>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => copyToClipboard(owner.activation_code!)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Action Menu */}
                            {isBossUser ? (
                              owner.user_id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteBossConfirm({ user_id: owner.user_id, name: owner.full_name || 'هذا البوس' })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel>إدارة الحساب</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => { setEditNameDialog({ owner }); setNewName(owner.full_name || ''); }}>
                                    <Pencil className="w-4 h-4 me-2" />
                                    تعديل الاسم
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>إدارة الترخيص</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => {
                                    setEditLicenseDialog({ owner });
                                    setEditLicenseSettings({
                                      duration_days: 180,
                                      max_cashiers: owner.max_cashiers || 1,
                                      license_tier: owner.license_tier || 'basic',
                                      generated_code: '',
                                    });
                                  }}>
                                    <Pencil className="w-4 h-4 me-2" />
                                    تعديل التفعيل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setActivationDialog({ owner })}>
                                    <Ticket className="w-4 h-4 me-2" />
                                    تفعيل عن بعد
                                  </DropdownMenuItem>
                                  {isLicenseValid && (
                                    <DropdownMenuItem onClick={() => handleRevokeLicense(owner.user_id)} className="text-orange-600">
                                      <Ban className="w-4 h-4 me-2" />
                                      إلغاء الترخيص
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>إدارة الجهاز</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleToggleMultiDevice(owner.user_id, owner.allow_multi_device || false)}>
                                    <Smartphone className="w-4 h-4 me-2" />
                                    {owner.allow_multi_device ? 'إلغاء تعدد الأجهزة ✓' : 'تفعيل تعدد الأجهزة'}
                                  </DropdownMenuItem>
                                  {!owner.allow_multi_device && (
                                    <DropdownMenuItem onClick={() => handleResetDevice(owner.user_id, owner.full_name || 'هذا المستخدم')}>
                                      <RotateCcw className="w-4 h-4 me-2" />
                                      إعادة تعيين الجهاز
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteConfirm({ type: 'owner', id: owner.user_id, name: owner.full_name || 'هذا المستخدم' })}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 me-2" />
                                    حذف الحساب
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                          {/* User Details */}
                          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                            {!isBossUser && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {owner.cashier_count}/{owner.max_cashiers || 1} كاشير
                              </span>
                            )}
                            {!isBossUser && owner.license_expires && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                                daysRemaining <= 7 ? 'bg-destructive/10 text-destructive font-medium' :
                                daysRemaining <= 30 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                'bg-muted'
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {isLicenseValid ? `${daysRemaining} يوم متبقي` : 'منتهي'}
                              </span>
                            )}
                            {isBossUser && (
                              <span className="flex items-center gap-1 text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                <Calendar className="w-3 h-3" />
                                ترخيص لا ينتهي
                              </span>
                            )}
                            {owner.device_id ? (
                              <span className="flex items-center gap-1 font-mono text-[10px] md:text-xs bg-background px-1.5 md:px-2 py-0.5 rounded">
                                <Smartphone className="w-3 h-3 flex-shrink-0" />
                                {owner.device_id.substring(0, 8)}...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground/60 text-[10px] md:text-xs">
                                <Smartphone className="w-3 h-3" />
                                لا جهاز
                              </span>
                            )}
                          </div>

                          {/* Cashiers Tree View */}
                          {owner.cashiers && owner.cashiers.length > 0 && (
                            <div className="mt-2 border-t pt-2">
                              <button
                                onClick={() => toggleOwnerExpanded(owner.user_id)}
                                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                              >
                                {expandedOwners.has(owner.user_id) ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                <Users className="w-3 h-3" />
                                <span>{owner.cashiers.length} حساب تابع</span>
                              </button>

                              {expandedOwners.has(owner.user_id) && (
                                <div className="mt-2 space-y-1.5 ms-4 border-s-2 border-muted ps-3">
                                  {owner.cashiers.map((cashier) => {
                                    const typeLabel = cashier.user_type === 'distributor' ? 'موزع' :
                                      cashier.user_type === 'pos' ? 'نقطة بيع' : 'كاشير';
                                    const typeColor = cashier.user_type === 'distributor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                      cashier.user_type === 'pos' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                      'bg-muted text-muted-foreground';

                                    return (
                                      <div key={cashier.user_id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium truncate">{cashier.full_name || 'بدون اسم'}</span>
                                            {cashier.email && (
                                              <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">{cashier.email}</span>
                                            )}
                                          </div>
                                          <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${typeColor}`}>{typeLabel}</Badge>
                                          {!cashier.is_active && (
                                            <Badge variant="destructive" className="text-[10px]">معطل</Badge>
                                          )}
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                              <MoreVertical className="w-3.5 h-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuLabel>إدارة الحساب التابع</DropdownMenuLabel>
                                            {cashier.email && (
                                              <DropdownMenuItem onClick={() => copyToClipboard(cashier.email!)}>
                                                <Mail className="w-4 h-4 me-2" />
                                                نسخ الإيميل
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => {
                                              setEditCashierNameDialog({ userId: cashier.user_id, name: cashier.full_name || '' });
                                              setCashierNewName(cashier.full_name || '');
                                            }}>
                                              <Pencil className="w-4 h-4 me-2" />
                                              تعديل الاسم
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              setCashierPasswordDialog({ userId: cashier.user_id, name: cashier.full_name || cashier.email || '' });
                                              setCashierNewPassword('');
                                            }}>
                                              <KeyRound className="w-4 h-4 me-2" />
                                              تغيير كلمة المرور
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleResetCashierDevice(cashier.user_id, cashier.full_name || 'هذا الحساب')}>
                                              <RotateCcw className="w-4 h-4 me-2" />
                                              إعادة تعيين الجهاز
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => setDeleteConfirm({ type: 'owner', id: cashier.user_id, name: cashier.full_name || 'هذا الحساب' })}
                                              className="text-destructive focus:text-destructive"
                                            >
                                              <Trash2 className="w-4 h-4 me-2" />
                                              حذف الحساب
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Activation Codes */}
          <TabsContent value="codes" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 md:px-6 bg-gradient-to-br from-primary/5 to-primary/0">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  أكواد التفعيل ({codes.length})
                </CardTitle>
                <Button onClick={() => setShowNewCodeDialog(true)} size="sm" className="text-xs md:text-sm">
                  <Plus className="w-3 h-3 md:w-4 md:h-4 me-1 md:me-2" />
                  {isMobile ? 'جديد' : 'كود جديد'}
                </Button>
              </CardHeader>
              <CardContent className="px-3 md:px-6">
                <div className="space-y-2 md:space-y-3">
                  {filteredCodes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 md:py-8 text-sm">لا توجد أكواد</p>
                  ) : (
                    filteredCodes.map((code) => {
                      const linkedOwner = codeToOwnerMap.get(code.id);
                      const createdDate = new Date(code.created_at);
                      const remainingDays = code.expires_at
                        ? Math.ceil((new Date(code.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;

                      return (
                        <div key={code.id} className={`p-2 md:p-3 rounded-lg space-y-2 border-s-4 ${
                          !code.is_active ? 'border-s-muted bg-muted/30' :
                          code.current_uses >= code.max_uses ? 'border-s-orange-400 bg-orange-400/5' :
                          'border-s-emerald-500 bg-emerald-500/5'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => copyToClipboard(code.code)}
                              className="font-mono text-xs md:text-sm bg-background px-2 py-1 rounded border hover:bg-muted transition-colors truncate max-w-[140px] md:max-w-none"
                            >
                              {isMobile ? code.code.slice(0, 12) + '...' : code.code}
                              <Copy className="w-3 h-3 inline ms-1 md:ms-2 text-muted-foreground" />
                            </button>
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                setEditCodeDialog(code);
                                setEditCodeForm({ duration_days: code.duration_days, max_uses: code.max_uses, max_cashiers: code.max_cashiers, license_tier: code.license_tier, note: code.note || '' });
                              }}>
                                <Pencil className="w-4 h-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleCode(code.id, code.is_active)}>
                                {code.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirm({ type: 'code', id: code.id, name: code.code })}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 md:gap-2">
                            <Badge variant={code.is_active ? 'default' : 'secondary'} className="text-[10px] md:text-xs">{code.is_active ? 'نشط' : 'معطل'}</Badge>
                            <Badge variant="outline" className="text-[10px] md:text-xs">{code.duration_days} يوم</Badge>
                            <Badge variant="outline" className="text-[10px] md:text-xs">{code.current_uses}/{code.max_uses} استخدام</Badge>
                            <Badge variant="outline" className="text-[10px] md:text-xs">{code.max_cashiers} كاشير</Badge>
                            <Badge variant="outline" className="text-[10px] md:text-xs">{code.license_tier}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              أُنشئ: {createdDate.toLocaleDateString('ar-EG')}
                            </span>
                            {remainingDays !== null && (
                              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                remainingDays <= 0 ? 'bg-destructive/10 text-destructive' :
                                remainingDays <= 7 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                'bg-muted'
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {remainingDays > 0 ? `${remainingDays} يوم متبقي` : 'منتهي الصلاحية'}
                              </span>
                            )}
                            {linkedOwner && (
                              <span className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                                <Mail className="w-3.5 h-3.5" />
                                مرتبط بـ: {linkedOwner.name || 'بدون اسم'}
                                {linkedOwner.email && (
                                  <span className="font-mono text-[11px] opacity-80">({linkedOwner.email})</span>
                                )}
                              </span>
                            )}
                          </div>
                          {code.note && (
                            <p className="text-xs text-muted-foreground italic">📝 {code.note}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: License Issues */}
          <TabsContent value="issues" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 md:px-6 bg-gradient-to-br from-destructive/5 to-destructive/0">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
                  </div>
                  مشاكل التراخيص ({licenseIssueOwners.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 md:px-6">
                {licenseIssueOwners.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                    <p className="text-muted-foreground">لا توجد مشاكل في التراخيص حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {licenseIssueOwners.map((owner) => {
                      const isRevoked = owner.license_revoked;
                      const isExpired = owner.license_expires && new Date(owner.license_expires) <= new Date();
                      const noLicense = !owner.license_expires;

                      return (
                        <div key={owner.user_id} className="p-3 rounded-lg border-s-4 border-s-destructive bg-destructive/5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{owner.full_name || 'بدون اسم'}</span>
                                <Badge variant="destructive" className="text-[10px]">
                                  {isRevoked ? 'ملغى' : isExpired ? 'منتهي' : 'بدون ترخيص'}
                                </Badge>
                              </div>
                              {owner.email && (
                                <p className="text-xs text-muted-foreground font-mono mt-1">{owner.email}</p>
                              )}
                              {owner.license_expires && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  انتهى في: {new Date(owner.license_expires).toLocaleDateString('ar-EG')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => setActivationDialog({ owner })}
                              >
                                <Ticket className="w-3 h-3 me-1" />
                                تفعيل
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => {
                                  setEditLicenseDialog({ owner });
                                  setEditLicenseSettings({
                                    duration_days: 180,
                                    max_cashiers: owner.max_cashiers || 1,
                                    license_tier: owner.license_tier || 'basic',
                                    generated_code: '',
                                  });
                                }}
                              >
                                <Pencil className="w-3 h-3 me-1" />
                                تعديل
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: System */}
          <TabsContent value="system" className="space-y-4">
            {/* System Diagnostics */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <SystemDiagnostics />
              </CardContent>
            </Card>

            {/* Contact Links Settings */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 md:px-6 bg-gradient-to-br from-primary/5 to-primary/0">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  إعدادات التواصل
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 md:px-6">
                <p className="text-sm text-muted-foreground mb-3">
                  إدارة قنوات التواصل التي تظهر للمستخدمين في الإعدادات وشاشات التفعيل
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(contactLinks).filter(([, v]) => v?.trim()).map(([key]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key === 'whatsapp' ? '💬 واتساب' :
                       key === 'facebook' ? '📘 فيسبوك' :
                       key === 'tiktok' ? '🎵 تيك توك' :
                       key === 'telegram' ? '✈️ تليجرام' :
                       key === 'youtube' ? '▶️ يوتيوب' :
                       key === 'twitter' ? '𝕏 تويتر' :
                       key === 'email' ? '📧 بريد' :
                       key === 'olx' ? '🛒 OLX' : key}
                    </Badge>
                  ))}
                  {!Object.values(contactLinks).some(v => v?.trim()) && (
                    <span className="text-xs text-muted-foreground">لم يتم إضافة أي قناة بعد</span>
                  )}
                </div>
                <Button onClick={() => setShowContactLinksDialog(true)} variant="outline" className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  تعديل قنوات التواصل
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* All Dialogs remain the same */}
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

        {/* Edit Code Dialog */}
        <Dialog open={!!editCodeDialog} onOpenChange={() => setEditCodeDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل كود التفعيل</DialogTitle>
              <DialogDescription>
                تعديل خصائص كود التفعيل {editCodeDialog?.code}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>مدة الترخيص (أيام)</Label>
                  <Input
                    type="number"
                    value={editCodeForm.duration_days}
                    onChange={(e) => setEditCodeForm(prev => ({ ...prev, duration_days: parseInt(e.target.value) || 30 }))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد الاستخدامات</Label>
                  <Input
                    type="number"
                    value={editCodeForm.max_uses}
                    onChange={(e) => setEditCodeForm(prev => ({ ...prev, max_uses: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>عدد الكاشيرات المسموح</Label>
                  <Input
                    type="number"
                    value={editCodeForm.max_cashiers}
                    onChange={(e) => setEditCodeForm(prev => ({ ...prev, max_cashiers: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>فئة الترخيص</Label>
                  <Select
                    value={editCodeForm.license_tier}
                    onValueChange={(value) => setEditCodeForm(prev => ({ ...prev, license_tier: value }))}
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
                  value={editCodeForm.note}
                  onChange={(e) => setEditCodeForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="ملاحظة للكود..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCodeDialog(null)}>
                إلغاء
              </Button>
              <Button onClick={handleEditCode}>
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remote Activation Dialog */}
        <Dialog open={!!activationDialog} onOpenChange={() => setActivationDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-emerald-600" />
                تفعيل حساب المستخدم
              </DialogTitle>
              <DialogDescription>
                تفعيل ترخيص لـ {activationDialog?.owner.full_name || activationDialog?.owner.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* User Info */}
              <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                <p className="font-medium">{activationDialog?.owner.full_name || 'بدون اسم'}</p>
                {activationDialog?.owner.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {activationDialog.owner.email}
                  </p>
                )}
              </div>

              {/* Activation Type */}
              <RadioGroup value={activationType} onValueChange={(v) => setActivationType(v as any)}>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="cursor-pointer">إنشاء ترخيص جديد وتفعيله مباشرة</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="cursor-pointer">استخدام كود موجود من القائمة</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="cursor-pointer">إدخال كود تفعيل يدوياً</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="whatsapp" id="whatsapp" />
                  <Label htmlFor="whatsapp" className="cursor-pointer">إرسال كود عبر واتساب</Label>
                </div>
              </RadioGroup>

              {/* Options based on type */}
              {activationType === 'new' && (
                <div className="space-y-3 border-t pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">مدة الترخيص (أيام)</Label>
                      <Select
                        value={activationSettings.duration_days.toString()}
                        onValueChange={(v) => setActivationSettings(prev => ({ ...prev, duration_days: parseInt(v) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 يوم</SelectItem>
                          <SelectItem value="90">90 يوم</SelectItem>
                          <SelectItem value="180">180 يوم</SelectItem>
                          <SelectItem value="365">سنة</SelectItem>
                          <SelectItem value="730">سنتين</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">عدد الكاشيرات</Label>
                      <Select
                        value={activationSettings.max_cashiers.toString()}
                        onValueChange={(v) => setActivationSettings(prev => ({ ...prev, max_cashiers: parseInt(v) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 كاشير</SelectItem>
                          <SelectItem value="2">2 كاشير</SelectItem>
                          <SelectItem value="3">3 كاشير</SelectItem>
                          <SelectItem value="5">5 كاشير</SelectItem>
                          <SelectItem value="10">10 كاشير</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">فئة الترخيص</Label>
                    <Select
                      value={activationSettings.license_tier}
                      onValueChange={(v) => setActivationSettings(prev => ({ ...prev, license_tier: v }))}
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
              )}

              {(activationType === 'existing' || activationType === 'whatsapp') && (
                <div className="space-y-2 border-t pt-4">
                  <Label>اختر الكود</Label>
                  {availableCodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد أكواد متاحة. أنشئ كوداً جديداً أولاً.</p>
                  ) : (
                    <Select
                      value={activationSettings.selected_code_id}
                      onValueChange={(v) => setActivationSettings(prev => ({ ...prev, selected_code_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر كود..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCodes.map(code => (
                          <SelectItem key={code.id} value={code.id}>
                            {code.code} ({code.duration_days} يوم - {code.max_cashiers} كاشير)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {activationType === 'manual' && (
                <div className="space-y-2 border-t pt-4">
                  <Label>أدخل كود التفعيل</Label>
                  <Input
                    value={activationSettings.manual_code}
                    onChange={(e) => setActivationSettings(prev => ({
                      ...prev,
                      manual_code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
                    }))}
                    placeholder="HYPER-XXXX-XXXX-XXXX-XXXX"
                    className="font-mono text-center"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    أدخل الكود كما هو، سيتم التحقق منه وتطبيقه على حساب المستخدم
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActivationDialog(null)}>
                إلغاء
              </Button>
              <Button
                onClick={handleRemoteActivation}
                disabled={isActivating || (
                  (activationType === 'existing' || activationType === 'whatsapp') && !activationSettings.selected_code_id
                ) || (
                    activationType === 'manual' && !activationSettings.manual_code.trim()
                  )}
              >
                {isActivating ? (
                  <RefreshCw className="w-4 h-4 me-2 animate-spin" />
                ) : activationType === 'whatsapp' ? (
                  <Send className="w-4 h-4 me-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 me-2" />
                )}
                {activationType === 'whatsapp' ? 'إرسال عبر واتساب' : activationType === 'manual' ? 'تفعيل بالكود' : 'تفعيل'}
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

        {/* Edit Name Dialog */}
        <Dialog open={!!editNameDialog} onOpenChange={() => setEditNameDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                تعديل اسم المستخدم
              </DialogTitle>
              <DialogDescription>
                تعديل اسم {editNameDialog?.owner.email || 'المستخدم'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="أدخل الاسم الجديد..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditNameDialog(null)}>
                إلغاء
              </Button>
              <Button onClick={handleSaveName} disabled={isSavingName || !newName.trim()}>
                {isSavingName && <RefreshCw className="w-4 h-4 me-2 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit License Dialog */}
        <Dialog open={!!editLicenseDialog} onOpenChange={() => setEditLicenseDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                تعديل التفعيل
              </DialogTitle>
              <DialogDescription>
                تعديل/تمديد ترخيص {editLicenseDialog?.owner.full_name || editLicenseDialog?.owner.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Current Status */}
              <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                <p className="font-medium text-sm">الحالة الحالية:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {editLicenseDialog?.owner.activation_code && (
                    <Badge variant="outline" className="font-mono">
                      الكود: {editLicenseDialog.owner.activation_code}
                    </Badge>
                  )}
                  {editLicenseDialog?.owner.license_expires && (
                    <Badge variant={new Date(editLicenseDialog.owner.license_expires) > new Date() ? 'default' : 'destructive'}>
                      {new Date(editLicenseDialog.owner.license_expires) > new Date() 
                        ? `متبقي ${Math.ceil((new Date(editLicenseDialog.owner.license_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم`
                        : 'منتهي'
                      }
                    </Badge>
                  )}
                </div>
              </div>

              {/* License Settings */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>مدة الترخيص الجديد (أيام)</Label>
                  <Input
                    type="number"
                    value={editLicenseSettings.duration_days}
                    onChange={(e) => setEditLicenseSettings(prev => ({ ...prev, duration_days: parseInt(e.target.value) || 30 }))}
                    min={1}
                    placeholder="مثال: 180"
                  />
                  <p className="text-xs text-muted-foreground">
                    يمكنك كتابة أي عدد أيام (مثلاً: 50، 100، 365)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>عدد الكاشيرات</Label>
                    <Input
                      type="number"
                      value={editLicenseSettings.max_cashiers}
                      onChange={(e) => setEditLicenseSettings(prev => ({ ...prev, max_cashiers: parseInt(e.target.value) || 1 }))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>فئة الترخيص</Label>
                    <Select
                      value={editLicenseSettings.license_tier}
                      onValueChange={(v) => setEditLicenseSettings(prev => ({ ...prev, license_tier: v }))}
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

                {/* Generated Code Section */}
                <div className="space-y-2 pt-3 border-t">
                  <Label>كود التفعيل</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editLicenseSettings.generated_code}
                      onChange={(e) => setEditLicenseSettings(prev => ({ ...prev, generated_code: e.target.value.toUpperCase() }))}
                      placeholder="اضغط 'إنشاء كود' أولاً"
                      className="font-mono text-center"
                      dir="ltr"
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateCodeForEditLicense}
                    >
                      إنشاء كود
                    </Button>
                  </div>
                  {editLicenseSettings.generated_code && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">
                        تم إنشاء الكود - اضغط "حفظ" لتطبيقه على المستخدم
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditLicenseDialog(null)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSaveEditLicense}
                disabled={isSavingLicense || !editLicenseSettings.generated_code}
              >
                {isSavingLicense ? (
                  <RefreshCw className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 me-2" />
                )}
                حفظ وتفعيل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Owner Dialog */}
        <Dialog open={showCreateOwnerDialog} onOpenChange={setShowCreateOwnerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                إضافة مالك جديد
              </DialogTitle>
              <DialogDescription>
                سيتم إنشاء حساب مالك مستقل بترخيص منفصل
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={createOwnerForm.fullName}
                  onChange={(e) => setCreateOwnerForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="أدخل الاسم"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={createOwnerForm.email}
                  onChange={(e) => setCreateOwnerForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <div className="relative">
                  <Input
                    type={showCreateOwnerPassword ? 'text' : 'password'}
                    value={createOwnerForm.password}
                    onChange={(e) => setCreateOwnerForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateOwnerPassword(!showCreateOwnerPassword)}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                  >
                    {showCreateOwnerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateOwnerDialog(false)}>إلغاء</Button>
              <Button onClick={handleCreateOwner} disabled={isCreatingOwner}>
                {isCreatingOwner ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Plus className="w-4 h-4 me-2" />}
                إنشاء الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Boss Dialog (with password verification) */}
        <Dialog open={showCreateBossDialog} onOpenChange={setShowCreateBossDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                إضافة حساب Boss جديد
              </DialogTitle>
              <DialogDescription>
                سيتم إنشاء حساب Boss بصلاحيات كاملة. يتطلب تأكيد كلمة مرورك.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={createBossForm.fullName}
                  onChange={(e) => setCreateBossForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="أدخل الاسم"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={createBossForm.email}
                  onChange={(e) => setCreateBossForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة مرور الحساب الجديد</Label>
                <div className="relative">
                  <Input
                    type={showCreateBossPasswords.new ? 'text' : 'password'}
                    value={createBossForm.password}
                    onChange={(e) => setCreateBossForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateBossPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                  >
                    {showCreateBossPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t">
                <Label className="flex items-center gap-2 text-amber-600">
                  <Lock className="w-4 h-4" />
                  كلمة مرورك الحالية (للتأكيد)
                </Label>
                <div className="relative">
                  <Input
                    type={showCreateBossPasswords.boss ? 'text' : 'password'}
                    value={createBossForm.bossPassword}
                    onChange={(e) => setCreateBossForm(prev => ({ ...prev, bossPassword: e.target.value }))}
                    placeholder="أدخل كلمة مرورك"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateBossPasswords(prev => ({ ...prev, boss: !prev.boss }))}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                  >
                    {showCreateBossPasswords.boss ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateBossDialog(false)}>إلغاء</Button>
              <Button onClick={handleCreateBoss} disabled={isCreatingBoss} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                {isCreatingBoss ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Crown className="w-4 h-4 me-2" />}
                إنشاء حساب Boss
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Boss Confirmation with Password */}
        <Dialog open={!!deleteBossConfirm} onOpenChange={() => { setDeleteBossConfirm(null); setDeleteBossPassword(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                حذف حساب Boss
              </DialogTitle>
              <DialogDescription>
                هذا الإجراء لا يمكن التراجع عنه. أدخل كلمة مرورك للتأكيد.
              </DialogDescription>
            </DialogHeader>
            {deleteBossConfirm && (
              <div className="p-4 bg-muted/30 rounded-lg border my-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="font-medium">{deleteBossConfirm.name}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-destructive">
                <Lock className="w-4 h-4" />
                كلمة مرورك الحالية
              </Label>
              <div className="relative">
                <Input
                  type={showDeleteBossPassword ? 'text' : 'password'}
                  value={deleteBossPassword}
                  onChange={(e) => setDeleteBossPassword(e.target.value)}
                  placeholder="أدخل كلمة مرورك للتأكيد"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDeleteBossPassword(!showDeleteBossPassword)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                >
                  {showDeleteBossPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteBossConfirm(null); setDeleteBossPassword(''); }}>إلغاء</Button>
              <Button variant="destructive" onClick={handleDeleteBoss} disabled={isDeletingBoss || !deleteBossPassword}>
                {isDeletingBoss ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Trash2 className="w-4 h-4 me-2" />}
                حذف الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contact Links Dialog */}
        <Dialog open={showContactLinksDialog} onOpenChange={setShowContactLinksDialog}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                إعدادات قنوات التواصل
              </DialogTitle>
              <DialogDescription>
                أضف روابط التواصل التي ستظهر للمستخدمين في الإعدادات وشاشات التفعيل
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">💬 رقم واتساب</Label>
                <Input value={contactLinks.whatsapp} onChange={(e) => setContactLinks(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="+970599000000" dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">📘 فيسبوك</Label>
                <Input value={contactLinks.facebook} onChange={(e) => setContactLinks(prev => ({ ...prev, facebook: e.target.value }))} placeholder="https://facebook.com/..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">🎵 تيك توك</Label>
                <Input value={contactLinks.tiktok} onChange={(e) => setContactLinks(prev => ({ ...prev, tiktok: e.target.value }))} placeholder="https://tiktok.com/@..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">✈️ تليجرام</Label>
                <Input value={contactLinks.telegram} onChange={(e) => setContactLinks(prev => ({ ...prev, telegram: e.target.value }))} placeholder="https://t.me/..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">▶️ يوتيوب</Label>
                <Input value={contactLinks.youtube} onChange={(e) => setContactLinks(prev => ({ ...prev, youtube: e.target.value }))} placeholder="https://youtube.com/@..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">𝕏 تويتر / X</Label>
                <Input value={contactLinks.twitter} onChange={(e) => setContactLinks(prev => ({ ...prev, twitter: e.target.value }))} placeholder="https://x.com/..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">📧 بريد إلكتروني</Label>
                <Input value={contactLinks.email} onChange={(e) => setContactLinks(prev => ({ ...prev, email: e.target.value }))} placeholder="support@example.com" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">🛒 OLX</Label>
                <Input value={contactLinks.olx} onChange={(e) => setContactLinks(prev => ({ ...prev, olx: e.target.value }))} placeholder="https://olx.com/..." dir="ltr" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowContactLinksDialog(false)}>إلغاء</Button>
              <Button onClick={handleSaveContactLinks} disabled={isSavingContactLinks}>
                {isSavingContactLinks && <RefreshCw className="w-4 h-4 me-2 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cashier Password Change Dialog */}
        <Dialog open={!!cashierPasswordDialog} onOpenChange={() => { setCashierPasswordDialog(null); setCashierNewPassword(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                تغيير كلمة المرور
              </DialogTitle>
              <DialogDescription>
                تغيير كلمة مرور الحساب التابع: {cashierPasswordDialog?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    type={showCashierNewPassword ? 'text' : 'password'}
                    value={cashierNewPassword}
                    onChange={(e) => setCashierNewPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCashierNewPassword(!showCashierNewPassword)}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                  >
                    {showCashierNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCashierPasswordDialog(null); setCashierNewPassword(''); }}>إلغاء</Button>
              <Button onClick={handleChangeCashierPassword} disabled={isChangingCashierPassword || cashierNewPassword.length < 6}>
                {isChangingCashierPassword ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <KeyRound className="w-4 h-4 me-2" />}
                تغيير كلمة المرور
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cashier Edit Name Dialog */}
        <Dialog open={!!editCashierNameDialog} onOpenChange={() => setEditCashierNameDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                تعديل اسم الحساب التابع
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={cashierNewName}
                  onChange={(e) => setCashierNewName(e.target.value)}
                  placeholder="أدخل الاسم الجديد..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCashierNameDialog(null)}>إلغاء</Button>
              <Button onClick={handleSaveCashierName} disabled={isSavingCashierName || !cashierNewName.trim()}>
                {isSavingCashierName && <RefreshCw className="w-4 h-4 me-2 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}