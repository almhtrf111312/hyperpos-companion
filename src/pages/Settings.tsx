import { useState, useEffect } from 'react';
import { 
  Store,
  DollarSign,
  RefreshCw,
  Bell,
  Printer,
  Database,
  Save,
  User,
  Mail,
  Phone,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Check,
  X,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  FileText,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle2,
  Cloud,
  Globe,
  Loader2,
  Palette,
  Activity,
  Key
} from 'lucide-react';
import GoogleDriveSection from '@/components/settings/GoogleDriveSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { ThemeSection } from '@/components/settings/ThemeSection';
import { ActivityLogSection } from '@/components/settings/ActivityLogSection';
import { PasswordChangeDialog } from '@/components/settings/PasswordChangeDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useUsersManagement, UserData } from '@/hooks/use-users-management';
import { useAuth } from '@/hooks/use-auth';

const settingsTabs = [
  { id: 'store', label: 'المحل', labelKey: 'settings.general', icon: Store },
  { id: 'language', label: 'اللغة', labelKey: 'settings.language', icon: Globe },
  { id: 'theme', label: 'المظهر', labelKey: 'settings.theme', icon: Palette },
  { id: 'currencies', label: 'العملات', labelKey: 'settings.general', icon: DollarSign },
  { id: 'sync', label: 'التزامن', labelKey: 'settings.general', icon: RefreshCw },
  { id: 'notifications', label: 'الإشعارات', labelKey: 'settings.general', icon: Bell },
  { id: 'printing', label: 'الطباعة', labelKey: 'settings.general', icon: Printer },
  { id: 'users', label: 'المستخدمين', labelKey: 'settings.users', icon: User },
  { id: 'activity', label: 'سجل النشاط', labelKey: 'settings.activityLog', icon: Activity },
  { id: 'backup', label: 'النسخ الاحتياطي', labelKey: 'settings.backup', icon: Database },
];

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

type PersistedSettings = {
  storeSettings?: Partial<{ name: string; type: string; phone: string; email: string; address: string; logo: string }>;
  exchangeRates?: Partial<{ TRY: string; SYP: string }>;
  syncSettings?: any;
  notificationSettings?: any;
  printSettings?: any;
  backupSettings?: any;
};

const sanitizeNumberText = (value: string) => value.replace(/[^\d.]/g, '');

const loadPersistedSettings = (): PersistedSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PersistedSettings) : null;
  } catch {
    return null;
  }
};

const savePersistedSettings = (data: PersistedSettings) => {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore write errors
  }
};

// UserData interface is now imported from use-users-management hook

interface BackupData {
  id: string;
  date: string;
  size: string;
  type: 'auto' | 'manual';
}

export default function Settings() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { users, isLoading: usersLoading, addUser, updateUserRole, updateUserProfile, deleteUser } = useUsersManagement();
  const [activeTab, setActiveTab] = useState('store');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const persisted = loadPersistedSettings();
  
  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    name: persisted?.storeSettings?.name ?? 'HyperPOS Store',
    type: persisted?.storeSettings?.type ?? 'phones',
    phone: persisted?.storeSettings?.phone ?? '+963 912 345 678',
    email: persisted?.storeSettings?.email ?? 'store@hyperpos.com',
    address: persisted?.storeSettings?.address ?? 'دمشق، شارع النيل',
    logo: persisted?.storeSettings?.logo ?? '',
  });

  // Logo upload handler
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'خطأ',
          description: 'يرجى اختيار ملف صورة صالح',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: 'حجم الصورة يجب أن يكون أقل من 2 ميغابايت',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setStoreSettings(prev => ({ ...prev, logo: base64 }));
        toast({
          title: 'تم الرفع',
          description: 'تم رفع الشعار بنجاح',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setStoreSettings(prev => ({ ...prev, logo: '' }));
    toast({
      title: 'تم الحذف',
      description: 'تم حذف الشعار',
    });
  };

  // Exchange rates (string to avoid mobile keyboard/focus issues)
  const [exchangeRates, setExchangeRates] = useState({
    TRY: persisted?.exchangeRates?.TRY ?? '32',
    SYP: persisted?.exchangeRates?.SYP ?? '14500',
  });

  // Sync settings
  const [syncSettings, setSyncSettings] = useState({
    interval: 10,
    showSuccessNotification: true,
    showErrorNotification: true,
    showSyncStatus: true,
    lastSync: '2024-01-15 14:30',
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    sound: true,
    newSale: true,
    lowStock: true,
    newDebt: true,
    paymentReceived: true,
    dailyReport: false,
  });

  // Printing settings
  const [printSettings, setPrintSettings] = useState({
    autoPrint: true,
    showLogo: true,
    showAddress: true,
    showPhone: true,
    paperSize: '80mm',
    copies: String(persisted?.printSettings?.copies ?? 1),
    footer: 'شكراً لتسوقكم معنا!',
  });

  // Users are now managed by useUsersManagement hook

  // Backups
  const [backups, setBackups] = useState<BackupData[]>([
    { id: '1', date: '2024-01-15 10:00', size: '2.5 MB', type: 'auto' },
    { id: '2', date: '2024-01-14 10:00', size: '2.4 MB', type: 'auto' },
    { id: '3', date: '2024-01-13 15:30', size: '2.3 MB', type: 'manual' },
  ]);

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: persisted?.backupSettings?.autoBackup ?? true,
    interval: persisted?.backupSettings?.interval ?? 'daily',
    keepDays: String(persisted?.backupSettings?.keepDays ?? 30),
  });

  // Dialogs
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordChangeUserId, setPasswordChangeUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier' as 'admin' | 'cashier',
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Handlers
  const handleSaveSettings = () => {
    const tryRate = Number(exchangeRates.TRY);
    const sypRate = Number(exchangeRates.SYP);
    const copies = Number(printSettings.copies);
    const keepDays = Number(backupSettings.keepDays);

    if (!Number.isFinite(tryRate) || tryRate <= 0 || !Number.isFinite(sypRate) || sypRate <= 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال أسعار صرف صحيحة',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(copies) || copies < 1 || copies > 5) {
      toast({
        title: 'خطأ',
        description: 'عدد النسخ يجب أن يكون بين 1 و 5',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(keepDays) || keepDays < 7 || keepDays > 365) {
      toast({
        title: 'خطأ',
        description: 'الاحتفاظ بالنسخ يجب أن يكون بين 7 و 365 يوم',
        variant: 'destructive',
      });
      return;
    }

    savePersistedSettings({
      storeSettings,
      exchangeRates,
      syncSettings,
      notificationSettings,
      printSettings,
      backupSettings,
    });

    toast({
      title: 'تم الحفظ',
      description: 'تم حفظ الإعدادات بنجاح',
    });
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSettings(prev => ({ ...prev, lastSync: new Date().toLocaleString('ar-SA') }));
      toast({
        title: "تم التزامن",
        description: "تم تزامن البيانات بنجاح",
      });
    }, 2000);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setUserForm({ name: '', email: '', password: '', role: 'cashier' });
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: UserData) => {
    setSelectedUser(user);
    setUserForm({ name: user.name, email: '', password: '', role: user.role });
    setUserDialogOpen(true);
  };

  const handleDeleteUser = (user: UserData) => {
    setSelectedUser(user);
    setDeleteUserDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (selectedUser) {
      setIsSavingUser(true);
      const success = await deleteUser(selectedUser.user_id, selectedUser.id);
      setIsSavingUser(false);
      if (success) {
        setDeleteUserDialogOpen(false);
        setSelectedUser(null);
      }
    }
  };

  const handleSaveUser = async () => {
    if (!userForm.name) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المستخدم",
        variant: "destructive",
      });
      return;
    }

    setIsSavingUser(true);

    if (selectedUser) {
      // Update existing user
      let success = true;
      
      if (userForm.name !== selectedUser.name) {
        success = await updateUserProfile(selectedUser.user_id, userForm.name);
      }
      
      if (success && userForm.role !== selectedUser.role) {
        success = await updateUserRole(selectedUser.user_id, userForm.role);
      }
      
      if (success) {
        setUserDialogOpen(false);
      }
    } else {
      // Add new user
      if (!userForm.email || !userForm.password) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
          variant: "destructive",
        });
        setIsSavingUser(false);
        return;
      }

      if (userForm.password.length < 6) {
        toast({
          title: "خطأ",
          description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
          variant: "destructive",
        });
        setIsSavingUser(false);
        return;
      }

      const success = await addUser(userForm.email, userForm.password, userForm.name, userForm.role);
      if (success) {
        setUserDialogOpen(false);
      }
    }
    
    setIsSavingUser(false);
  };

  const handleBackupNow = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      const newBackup: BackupData = {
        id: Date.now().toString(),
        date: new Date().toLocaleString('ar-SA'),
        size: '2.6 MB',
        type: 'manual',
      };
      setBackups([newBackup, ...backups]);
      setIsBackingUp(false);

      // Download a local backup file (offline)
      const payload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        settings: {
          storeSettings,
          exchangeRates,
          syncSettings,
          notificationSettings,
          printSettings,
          backupSettings,
        },
        users,
        backups: [newBackup, ...backups],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hyperpos_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "تم النسخ الاحتياطي",
        description: "تم إنشاء نسخة احتياطية وتنزيلها بنجاح",
      });
    }, 800);
  };

  const handleRestoreBackup = (backup: BackupData) => {
    toast({
      title: "جاري الاستعادة",
      description: `جاري استعادة النسخة من ${backup.date}`,
    });
  };

  const handleDeleteBackup = (backup: BackupData) => {
    setBackups(backups.filter(b => b.id !== backup.id));
    toast({
      title: "تم الحذف",
      description: "تم حذف النسخة الاحتياطية",
    });
  };

  const handleExportData = () => {
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: {
        storeSettings,
        exchangeRates,
        syncSettings,
        notificationSettings,
        printSettings,
        backupSettings,
      },
      users,
      backups,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hyperpos_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'تم التصدير',
      description: 'تم تنزيل ملف البيانات بنجاح',
    });
  };

  const handleImportData = () => {
    toast({
      title: "جاري الاستيراد",
      description: "جاري استيراد البيانات...",
    });
  };

  const handleTestPrint = () => {
    toast({
      title: "طباعة تجريبية",
      description: "تم إرسال صفحة تجريبية للطابعة",
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'language':
        return <LanguageSection />;
      case 'theme':
        return <ThemeSection />;
      case 'activity':
        return <ActivityLogSection />;
      case 'store':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">معلومات المحل</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">اسم المحل</label>
                  <div className="relative">
                    <Store className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.name}
                      onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                      className="pr-10 bg-muted border-0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">نوع المحل</label>
                  <select 
                    className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                    value={storeSettings.type}
                    onChange={(e) => setStoreSettings({ ...storeSettings, type: e.target.value })}
                  >
                    <option value="phones">متجر هواتف</option>
                    <option value="grocery">بقالة</option>
                    <option value="pharmacy">صيدلية</option>
                    <option value="clothing">ملابس</option>
                    <option value="restaurant">مطعم/كافيه</option>
                    <option value="repair">ورشة إصلاح</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">رقم الهاتف</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      value={storeSettings.phone}
                      onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                      className="flex h-10 w-full rounded-md px-3 py-2 text-sm pr-10 bg-muted border-0 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.email}
                      onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                      className="pr-10 bg-muted border-0"
                    />
                  </div>
                </div>
              <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">العنوان</label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.address}
                      onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                      className="pr-10 bg-muted border-0"
                    />
                  </div>
                </div>

                {/* Logo Upload */}
                <div className="space-y-3 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">شعار المحل</label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {storeSettings.logo ? (
                      <div className="relative">
                        <img 
                          src={storeSettings.logo} 
                          alt="شعار المحل" 
                          className="w-20 h-20 object-contain rounded-lg border border-border bg-muted p-1"
                        />
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -left-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted">
                        <Store className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors w-fit">
                          <Upload className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {storeSettings.logo ? 'تغيير الشعار' : 'رفع شعار'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-muted-foreground mt-2">
                        PNG أو JPG - بحد أقصى 2 ميغابايت
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'currencies':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-2">أسعار الصرف</h2>
              <p className="text-muted-foreground text-sm mb-6">تحديث أسعار الصرف اليومية (العملة الأساسية: الدولار الأمريكي)</p>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">$</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">الدولار الأمريكي (USD)</p>
                      <p className="text-sm text-muted-foreground">العملة الأساسية</p>
                    </div>
                  </div>
                  <span className="font-bold text-foreground text-left sm:text-right">1.00</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-500 font-bold">₺</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">الليرة التركية (TRY)</p>
                      <p className="text-sm text-muted-foreground">1 USD = {exchangeRates.TRY || '0'} TRY</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={exchangeRates.TRY}
                    onChange={(e) => setExchangeRates({ ...exchangeRates, TRY: sanitizeNumberText(e.target.value) })}
                    className="flex h-10 w-full sm:w-32 rounded-md px-3 py-2 text-sm bg-background border-0 text-foreground text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-500 font-bold">ل.س</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">الليرة السورية (SYP)</p>
                      <p className="text-sm text-muted-foreground">1 USD = {Number(exchangeRates.SYP || 0).toLocaleString()} SYP</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={exchangeRates.SYP}
                    onChange={(e) => setExchangeRates({ ...exchangeRates, SYP: sanitizeNumberText(e.target.value) })}
                    className="flex h-10 w-full sm:w-32 rounded-md px-3 py-2 text-sm bg-background border-0 text-foreground text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="w-full mt-6">
                <Save className="w-4 h-4 ml-2" />
                حفظ أسعار الصرف
              </Button>
            </div>
          </div>
        );

      case 'sync':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">إعدادات التزامن</h2>
              
              {/* Last sync status */}
              <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl mb-6">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">آخر تزامن ناجح</p>
                  <p className="text-sm text-muted-foreground">{syncSettings.lastSync}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">تكرار التزامن التلقائي</label>
                  <select 
                    className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                    value={syncSettings.interval}
                    onChange={(e) => setSyncSettings({ ...syncSettings, interval: Number(e.target.value) })}
                  >
                    <option value={1}>كل دقيقة</option>
                    <option value={5}>كل 5 دقائق</option>
                    <option value={10}>كل 10 دقائق</option>
                    <option value={30}>كل 30 دقيقة</option>
                    <option value={60}>كل ساعة</option>
                    <option value={0}>يدوي فقط</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">إشعارات التزامن</h3>
                  
                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex-1 ml-4">
                      <p className="font-medium text-foreground">إشعار التزامن الناجح</p>
                      <p className="text-sm text-muted-foreground">عرض رسالة عند نجاح التزامن</p>
                    </div>
                    <Switch 
                      checked={syncSettings.showSuccessNotification}
                      onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, showSuccessNotification: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex-1 ml-4">
                      <p className="font-medium text-foreground">إشعار فشل التزامن</p>
                      <p className="text-sm text-muted-foreground">عرض تحذير عند فشل التزامن</p>
                    </div>
                    <Switch 
                      checked={syncSettings.showErrorNotification}
                      onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, showErrorNotification: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex-1 ml-4">
                      <p className="font-medium text-foreground">إظهار حالة التزامن</p>
                      <p className="text-sm text-muted-foreground">عرض حالة التزامن في الشريط العلوي</p>
                    </div>
                    <Switch 
                      checked={syncSettings.showSyncStatus}
                      onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, showSyncStatus: checked })}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSync} 
                  disabled={isSyncing}
                  className="w-full"
                >
                  <RefreshCw className={cn("w-4 h-4 ml-2", isSyncing && "animate-spin")} />
                  {isSyncing ? 'جاري التزامن...' : 'تزامن الآن'}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">إعدادات الإشعارات</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3 flex-1 ml-4">
                    {notificationSettings.sound ? (
                      <Volume2 className="w-5 h-5 text-primary flex-shrink-0" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">صوت الإشعارات</p>
                      <p className="text-sm text-muted-foreground">تشغيل صوت عند وصول إشعار</p>
                    </div>
                  </div>
                  <Switch 
                    checked={notificationSettings.sound}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, sound: checked })}
                  />
                </div>

                <h3 className="text-sm font-medium text-foreground pt-2">أنواع الإشعارات</h3>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">بيع جديد</p>
                    <p className="text-sm text-muted-foreground">إشعار عند إتمام عملية بيع</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.newSale}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newSale: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">نفاد المخزون</p>
                    <p className="text-sm text-muted-foreground">تنبيه عند انخفاض كمية منتج</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.lowStock}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, lowStock: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">دين جديد</p>
                    <p className="text-sm text-muted-foreground">إشعار عند تسجيل دين جديد</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.newDebt}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newDebt: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">استلام دفعة</p>
                    <p className="text-sm text-muted-foreground">إشعار عند تسديد دفعة من دين</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.paymentReceived}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, paymentReceived: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">التقرير اليومي</p>
                    <p className="text-sm text-muted-foreground">إرسال ملخص يومي بالمبيعات</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.dailyReport}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, dailyReport: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'printing':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">إعدادات الطباعة</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">حجم الورق</label>
                    <select 
                      className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                      value={printSettings.paperSize}
                      onChange={(e) => setPrintSettings({ ...printSettings, paperSize: e.target.value })}
                    >
                      <option value="58mm">58mm (صغير)</option>
                      <option value="80mm">80mm (قياسي)</option>
                      <option value="A4">A4</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">عدد النسخ</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={printSettings.copies}
                      onChange={(e) => setPrintSettings({ ...printSettings, copies: sanitizeNumberText(e.target.value) })}
                      className="bg-muted border-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">نص التذييل</label>
                  <Input
                    value={printSettings.footer}
                    onChange={(e) => setPrintSettings({ ...printSettings, footer: e.target.value })}
                    className="bg-muted border-0"
                    placeholder="شكراً لتسوقكم معنا!"
                  />
                </div>

                <h3 className="text-sm font-medium text-foreground pt-2">محتوى الفاتورة</h3>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">طباعة تلقائية</p>
                    <p className="text-sm text-muted-foreground">طباعة الفاتورة تلقائياً بعد البيع</p>
                  </div>
                  <Switch 
                    checked={printSettings.autoPrint}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, autoPrint: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">إظهار الشعار</p>
                    <p className="text-sm text-muted-foreground">عرض شعار المحل في الفاتورة</p>
                  </div>
                  <Switch 
                    checked={printSettings.showLogo}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showLogo: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">إظهار العنوان</p>
                    <p className="text-sm text-muted-foreground">عرض عنوان المحل في الفاتورة</p>
                  </div>
                  <Switch 
                    checked={printSettings.showAddress}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showAddress: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">إظهار رقم الهاتف</p>
                    <p className="text-sm text-muted-foreground">عرض رقم الهاتف في الفاتورة</p>
                  </div>
                  <Switch 
                    checked={printSettings.showPhone}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showPhone: checked })}
                  />
                </div>

                <Button onClick={handleTestPrint} variant="outline" className="w-full">
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة تجريبية
                </Button>
              </div>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg md:text-xl font-bold text-foreground">إدارة المستخدمين</h2>
              <Button onClick={handleAddUser} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 ml-2" />
                إضافة مستخدم
              </Button>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="mr-2 text-muted-foreground">جاري تحميل المستخدمين...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا يوجد مستخدمين. قم بإضافة مستخدم جديد.
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        user.role === 'admin' ? "bg-primary text-primary-foreground" : "bg-blue-500/20 text-blue-500"
                      )}>
                        <span className="font-bold">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.user_id === currentUser?.id && '(أنت)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium",
                        user.role === 'admin' ? "bg-green-500/20 text-green-500" : "bg-blue-500/20 text-blue-500"
                      )}>
                        {user.role === 'admin' ? 'مشرف' : 'كاشير'}
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setPasswordChangeUserId(user.user_id);
                            setPasswordDialogOpen(true);
                          }}
                          title="تغيير كلمة المرور"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {user.user_id !== currentUser?.id && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );



      case 'backup':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">النسخ الاحتياطي</h2>
              
              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <Button 
                  onClick={handleBackupNow} 
                  disabled={isBackingUp}
                  className="w-full"
                >
                  <Database className={cn("w-4 h-4 ml-2", isBackingUp && "animate-pulse")} />
                  {isBackingUp ? 'جاري النسخ...' : 'نسخ احتياطي الآن'}
                </Button>
                <Button variant="outline" onClick={handleExportData} className="w-full">
                  <Download className="w-4 h-4 ml-2" />
                  تصدير البيانات
                </Button>
              </div>

              {/* Google Drive Section */}
              <div className="mb-6 p-4 bg-muted/50 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Cloud className="w-5 h-5 text-blue-500" />
                  <h3 className="text-sm font-medium text-foreground">النسخ الاحتياطي السحابي</h3>
                </div>
                <GoogleDriveSection
                  getBackupData={() => ({
                    version: '1.0',
                    exportedAt: new Date().toISOString(),
                    settings: {
                      storeSettings,
                      exchangeRates,
                      syncSettings,
                      notificationSettings,
                      printSettings,
                      backupSettings,
                    },
                    users,
                    backups,
                  })}
                  onRestoreBackup={(data: any) => {
                    if (data?.settings) {
                      if (data.settings.storeSettings) setStoreSettings(data.settings.storeSettings);
                      if (data.settings.exchangeRates) setExchangeRates(data.settings.exchangeRates);
                      if (data.settings.syncSettings) setSyncSettings(data.settings.syncSettings);
                      if (data.settings.notificationSettings) setNotificationSettings(data.settings.notificationSettings);
                      if (data.settings.printSettings) setPrintSettings(data.settings.printSettings);
                      if (data.settings.backupSettings) setBackupSettings(data.settings.backupSettings);
                    }
                    // Note: Users are managed by database, not local backup
                    if (data?.backups) setBackups(data.backups);
                    
                    toast({
                      title: 'تمت الاستعادة',
                      description: 'تم استعادة البيانات من النسخة الاحتياطية',
                    });
                  }}
                />
              </div>

              {/* Auto backup settings */}
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-medium text-foreground">إعدادات النسخ التلقائي</h3>
                
                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-medium text-foreground">النسخ الاحتياطي التلقائي</p>
                    <p className="text-sm text-muted-foreground">إنشاء نسخة احتياطية تلقائياً</p>
                  </div>
                  <Switch 
                    checked={backupSettings.autoBackup}
                    onCheckedChange={(checked) => setBackupSettings({ ...backupSettings, autoBackup: checked })}
                  />
                </div>

                {backupSettings.autoBackup && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">تكرار النسخ</label>
                      <select 
                        className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                        value={backupSettings.interval}
                        onChange={(e) => setBackupSettings({ ...backupSettings, interval: e.target.value })}
                      >
                        <option value="hourly">كل ساعة</option>
                        <option value="daily">يومياً</option>
                        <option value="weekly">أسبوعياً</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">الاحتفاظ بالنسخ (أيام)</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={backupSettings.keepDays}
                        onChange={(e) => setBackupSettings({ ...backupSettings, keepDays: sanitizeNumberText(e.target.value) })}
                        className="bg-muted border-0"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Backup history */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">سجل النسخ الاحتياطية المحلية</h3>
                
                {backups.map((backup) => (
                  <div key={backup.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        backup.type === 'auto' ? "bg-blue-500/20" : "bg-green-500/20"
                      )}>
                        {backup.type === 'auto' ? (
                          <Clock className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Database className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{backup.date}</p>
                        <p className="text-sm text-muted-foreground">
                          {backup.size} • {backup.type === 'auto' ? 'تلقائي' : 'يدوي'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleRestoreBackup(backup)}>
                        <Upload className="w-4 h-4 ml-1" />
                        استعادة
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBackup(backup)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">الإعدادات</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">إدارة إعدادات النظام</p>
        </div>
        <Button onClick={handleSaveSettings} className="hidden sm:flex">
          <Save className="w-5 h-5 ml-2" />
          حفظ التغييرات
        </Button>
        <Button onClick={handleSaveSettings} size="icon" className="sm:hidden">
          <Save className="w-5 h-5" />
        </Button>
      </div>

      {/* Windows-style Tabs */}
      <div className="mb-6">
        {/* Desktop Tabs */}
        <div className="hidden md:flex items-end gap-0 border-b-2 border-border">
          {settingsTabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all rounded-t-lg border-2 border-b-0",
                activeTab === tab.id
                  ? "bg-card text-foreground border-border -mb-[2px] z-10"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground -mb-[2px]",
                index > 0 && "-mr-1"
              )}
              style={{
                boxShadow: activeTab === tab.id ? '0 -2px 8px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile Tabs - Horizontal Scroll */}
        <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex items-end gap-0 border-b-2 border-border min-w-max">
            {settingsTabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all rounded-t-lg border-2 border-b-0",
                  activeTab === tab.id
                    ? "bg-card text-foreground border-border -mb-[2px] z-10"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted -mb-[2px]",
                  index > 0 && "-mr-0.5"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0">
        {renderTabContent()}
      </div>

      {/* Add/Edit User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">الاسم</label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="أدخل اسم المستخدم"
              />
            </div>
            {!selectedUser && (
              <div className="space-y-2">
                <label className="text-sm font-medium">البريد الإلكتروني</label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="example@email.com"
                  disabled={isSavingUser}
                />
              </div>
            )}
            {!selectedUser && (
              <div className="space-y-2">
                <label className="text-sm font-medium">كلمة المرور</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="pl-10"
                    disabled={isSavingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">الصلاحية</label>
              <select
                className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'cashier' })}
                disabled={isSavingUser}
              >
                <option value="cashier">كاشير</option>
                <option value="admin">مشرف</option>
              </select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setUserDialogOpen(false)} className="w-full sm:w-auto" disabled={isSavingUser}>
              إلغاء
            </Button>
            <Button onClick={handleSaveUser} className="w-full sm:w-auto" disabled={isSavingUser}>
              {isSavingUser ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                selectedUser ? 'حفظ التغييرات' : 'إضافة المستخدم'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">
            هل أنت متأكد من حذف المستخدم "{selectedUser?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)} className="w-full sm:w-auto" disabled={isSavingUser}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser} className="w-full sm:w-auto" disabled={isSavingUser}>
              {isSavingUser ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                'حذف المستخدم'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <PasswordChangeDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        userId={passwordChangeUserId}
      />
    </div>
  );
}
