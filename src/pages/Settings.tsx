import { useState, useEffect, useRef } from 'react';
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
  Key,
  FileUp,
  Lock,
  Banknote
} from 'lucide-react';
// Backup encryption removed - using plain JSON now
import GoogleDriveSection from '@/components/settings/GoogleDriveSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { ThemeSection } from '@/components/settings/ThemeSection';
import { ActivityLogSection } from '@/components/settings/ActivityLogSection';
import { PasswordChangeDialog } from '@/components/settings/PasswordChangeDialog';
import { LicenseManagement } from '@/components/settings/LicenseManagement';
import { ActivationCodeInput } from '@/components/settings/ActivationCodeInput';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useUsersManagement, UserData } from '@/hooks/use-users-management';
import { useAuth } from '@/hooks/use-auth';
import { emitEvent, EVENTS } from '@/lib/events';

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
  { id: 'license', label: 'الترخيص', labelKey: 'settings.license', icon: Key },
  { id: 'licenses', label: 'إدارة التراخيص', labelKey: 'settings.licenses', icon: Shield, adminOnly: true },
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
    // Emit standardized event so other components update in same-tab
    emitEvent(EVENTS.SETTINGS_UPDATED, data);
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
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

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

      // Create backup payload with ALL localStorage data
      const allData: Record<string, unknown> = {};
      
      // Get all localStorage keys and their values
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              // Try to parse JSON, if fails store as string
              try {
                allData[key] = JSON.parse(value);
              } catch {
                allData[key] = value;
              }
            }
          } catch {
            // skip problematic keys
          }
        }
      }

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
        // Include all localStorage data
        localStorageData: allData,
      };

      // Create JSON backup (no encryption)
      const jsonData = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Generate filename with store name and date
      const storeName = storeSettings.name.replace(/[^a-zA-Z0-9أ-ي\s_-]/g, '').trim() || 'hyperpos';
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `backup_${storeName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "تم النسخ الاحتياطي",
        description: "تم تنزيل النسخة الاحتياطية في مجلد التنزيلات",
      });
    }, 800);
  };

  // Import backup file (JSON format)
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        
        // Parse JSON backup
        let data: any;
        try {
          data = JSON.parse(fileContent);
        } catch {
          toast({
            title: "خطأ",
            description: "الملف غير صالح. يجب أن يكون ملف JSON صحيح",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }

        // Validate backup structure
        if (!data.version || !data.exportedAt) {
          toast({
            title: "خطأ",
            description: "صيغة ملف النسخة الاحتياطية غير صحيحة",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }

        // Restore ALL localStorage data if available
        if (data.localStorageData && typeof data.localStorageData === 'object') {
          Object.entries(data.localStorageData).forEach(([key, value]) => {
            try {
              if (typeof value === 'string') {
                localStorage.setItem(key, value);
              } else {
                localStorage.setItem(key, JSON.stringify(value));
              }
            } catch {
              // skip problematic keys
            }
          });
        }
        
        if (data.settings) {
          if (data.settings.storeSettings) setStoreSettings(data.settings.storeSettings);
          if (data.settings.exchangeRates) setExchangeRates(data.settings.exchangeRates);
          if (data.settings.syncSettings) setSyncSettings(data.settings.syncSettings);
          if (data.settings.notificationSettings) setNotificationSettings(data.settings.notificationSettings);
          if (data.settings.printSettings) setPrintSettings(data.settings.printSettings);
          if (data.settings.backupSettings) setBackupSettings(data.settings.backupSettings);
        }
        
        if (data.backups) setBackups(data.backups);

        // Save to local storage
        savePersistedSettings({
          storeSettings: data.settings?.storeSettings || storeSettings,
          exchangeRates: data.settings?.exchangeRates || exchangeRates,
          syncSettings: data.settings?.syncSettings || syncSettings,
          notificationSettings: data.settings?.notificationSettings || notificationSettings,
          printSettings: data.settings?.printSettings || printSettings,
          backupSettings: data.settings?.backupSettings || backupSettings,
        });
        
        // Dispatch standardized events to update all components
        emitEvent(EVENTS.CUSTOMERS_UPDATED);
        emitEvent(EVENTS.DEBTS_UPDATED);
        emitEvent(EVENTS.INVOICES_UPDATED);
        emitEvent(EVENTS.PRODUCTS_UPDATED);

        toast({
          title: "تمت الاستعادة بنجاح",
          description: `تم استعادة النسخة الاحتياطية. سيتم إعادة تحميل الصفحة...`,
        });
        
        // Reload the page after a short delay to apply all changes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import error:', error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء استيراد النسخة الاحتياطية",
          variant: "destructive",
        });
      }
      
      setIsImporting(false);
      // Reset the input
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      toast({
        title: "خطأ",
        description: "فشل في قراءة الملف",
        variant: "destructive",
      });
      setIsImporting(false);
    };

    reader.readAsText(file);
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
                    value={storeSettings.type}
                    onChange={(e) => setStoreSettings({ ...storeSettings, type: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  >
                    <option value="phones">هواتف وإلكترونيات</option>
                    <option value="grocery">بقالة ومواد غذائية</option>
                    <option value="pharmacy">صيدلية</option>
                    <option value="clothing">ملابس وأزياء</option>
                    <option value="general">متجر عام</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">رقم الهاتف</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.phone}
                      onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                      className="pr-10 bg-muted border-0"
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
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">شعار المحل</h3>
              <div className="flex items-center gap-4">
                {storeSettings.logo ? (
                  <div className="relative">
                    <img 
                      src={storeSettings.logo} 
                      alt="شعار المحل" 
                      className="w-20 h-20 rounded-lg object-cover border border-border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -left-2 h-6 w-6"
                      onClick={handleRemoveLogo}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
                    <Store className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload">
                    <Button variant="outline" asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 ml-2" />
                        رفع شعار
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG أقل من 2 ميغابايت</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'currencies':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">أسعار الصرف</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">الليرة التركية (TRY)</label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={exchangeRates.TRY}
                    onChange={(e) => setExchangeRates({ ...exchangeRates, TRY: sanitizeNumberText(e.target.value) })}
                    className="pr-10 bg-muted border-0"
                    placeholder="32"
                  />
                </div>
                <p className="text-xs text-muted-foreground">1 دولار = {exchangeRates.TRY} ليرة تركية</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">الليرة السورية (SYP)</label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={exchangeRates.SYP}
                    onChange={(e) => setExchangeRates({ ...exchangeRates, SYP: sanitizeNumberText(e.target.value) })}
                    className="pr-10 bg-muted border-0"
                    placeholder="14500"
                  />
                </div>
                <p className="text-xs text-muted-foreground">1 دولار = {exchangeRates.SYP} ليرة سورية</p>
              </div>
            </div>
          </div>
        );

      case 'sync':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <GoogleDriveSection 
              getBackupData={() => {
                const data: Record<string, any> = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key?.startsWith('hyperpos_')) {
                    try {
                      data[key] = JSON.parse(localStorage.getItem(key) || '');
                    } catch {
                      data[key] = localStorage.getItem(key);
                    }
                  }
                }
                return data;
              }}
              onRestoreBackup={(data) => {
                Object.entries(data).forEach(([key, value]) => {
                  localStorage.setItem(key, JSON.stringify(value));
                });
                window.dispatchEvent(new Event('productsUpdated'));
                window.dispatchEvent(new Event('customersUpdated'));
                window.dispatchEvent(new Event('debtsUpdated'));
                window.dispatchEvent(new Event('invoicesUpdated'));
              }}
            />
            <div className="pt-4 border-t border-border">
              <h3 className="text-base font-semibold text-foreground mb-4">التزامن المحلي</h3>
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">آخر تزامن</p>
                  <p className="text-sm text-muted-foreground">{syncSettings.lastSync}</p>
                </div>
                <Button onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 ml-2" />
                  )}
                  تزامن الآن
                </Button>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-4">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">الإشعارات</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  {notificationSettings.sound ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground">الصوت</p>
                    <p className="text-sm text-muted-foreground">تشغيل صوت عند الإشعارات</p>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.sound}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, sound: checked })}
                />
              </div>
              {[
                { key: 'newSale', label: 'عملية بيع جديدة', icon: CheckCircle2 },
                { key: 'lowStock', label: 'نفاذ المخزون', icon: AlertCircle },
                { key: 'newDebt', label: 'دين جديد', icon: FileText },
                { key: 'paymentReceived', label: 'استلام دفعة', icon: Banknote },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{label}</span>
                  </div>
                  <Switch
                    checked={notificationSettings[key as keyof typeof notificationSettings] as boolean}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [key]: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'printing':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">إعدادات الطباعة</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">الطباعة التلقائية</p>
                  <p className="text-sm text-muted-foreground">طباعة الفاتورة تلقائياً بعد كل عملية</p>
                </div>
                <Switch
                  checked={printSettings.autoPrint}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, autoPrint: checked })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">حجم الورق</label>
                  <select
                    value={printSettings.paperSize}
                    onChange={(e) => setPrintSettings({ ...printSettings, paperSize: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  >
                    <option value="80mm">80mm (حراري)</option>
                    <option value="58mm">58mm (صغير)</option>
                    <option value="A4">A4</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">عدد النسخ</label>
                  <Input
                    type="number"
                    value={printSettings.copies}
                    onChange={(e) => setPrintSettings({ ...printSettings, copies: e.target.value })}
                    min="1"
                    max="5"
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
              <Button variant="outline" className="w-full" onClick={handleTestPrint}>
                <Printer className="w-4 h-4 ml-2" />
                طباعة تجريبية
              </Button>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-foreground">إدارة المستخدمين</h2>
              <Button onClick={handleAddUser}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة مستخدم
              </Button>
            </div>
            <div className="space-y-3">
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  جاري التحميل...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا يوجد مستخدمين
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.role === 'admin' ? 'مدير' : 'كاشير'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setPasswordChangeUserId(user.user_id);
                          setPasswordDialogOpen(true);
                        }}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.user_id === currentUser?.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'backup':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">النسخ الاحتياطي</h2>
            
            {/* Backup Section */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">النسخ الاحتياطي</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                قم بإنشاء نسخة احتياطية تحتوي على جميع بيانات المحل
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleBackupNow} disabled={isBackingUp} className="flex-1 min-w-[140px]">
                  {isBackingUp ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ml-2" />
                  )}
                  تنزيل نسخة احتياطية
                </Button>
                <div className="flex-1 min-w-[140px]">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                    id="import-backup"
                    ref={importInputRef}
                  />
                  <label htmlFor="import-backup" className="w-full">
                    <Button variant="outline" className="w-full" asChild disabled={isImporting}>
                      <span className="cursor-pointer">
                        {isImporting ? (
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        ) : (
                          <FileUp className="w-4 h-4 ml-2" />
                        )}
                        استيراد نسخة احتياطية
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            {/* Auto Backup Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">النسخ التلقائي</p>
                  <p className="text-sm text-muted-foreground">نسخ احتياطي تلقائي للبيانات</p>
                </div>
                <Switch
                  checked={backupSettings.autoBackup}
                  onCheckedChange={(checked) => setBackupSettings({ ...backupSettings, autoBackup: checked })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">فترة النسخ</label>
                  <select
                    value={backupSettings.interval}
                    onChange={(e) => setBackupSettings({ ...backupSettings, interval: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  >
                    <option value="daily">يومياً</option>
                    <option value="weekly">أسبوعياً</option>
                    <option value="monthly">شهرياً</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">الاحتفاظ (أيام)</label>
                  <Input
                    type="number"
                    value={backupSettings.keepDays}
                    onChange={(e) => setBackupSettings({ ...backupSettings, keepDays: e.target.value })}
                    min="7"
                    max="365"
                    className="bg-muted border-0"
                  />
                </div>
              </div>
            </div>

            {/* Export JSON */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-base font-semibold text-foreground mb-3">تصدير البيانات (JSON)</h3>
              <Button variant="outline" onClick={handleExportData}>
                <Download className="w-4 h-4 ml-2" />
                تصدير JSON
              </Button>
            </div>

            {/* Recent Backups */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-base font-semibold text-foreground mb-3">النسخ الأخيرة</h3>
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{backup.date}</p>
                        <p className="text-xs text-muted-foreground">
                          {backup.size} • {backup.type === 'auto' ? 'تلقائي' : 'يدوي'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleRestoreBackup(backup)}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteBackup(backup)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'license':
        return <ActivationCodeInput />;

      case 'licenses':
        return <LicenseManagement />;

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">إدارة إعدادات التطبيق والمحل</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-card rounded-2xl border border-border p-2">
            <nav className="space-y-1">
              {settingsTabs
                .filter(tab => !tab.adminOnly || users.find(u => u.user_id === currentUser?.id)?.role === 'admin')
                .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {renderTabContent()}
          
          {/* Save Button */}
          <div className="mt-6">
            <Button className="w-full md:w-auto" onClick={handleSaveSettings}>
              <Save className="w-4 h-4 ml-2" />
              حفظ الإعدادات
            </Button>
          </div>
        </div>
      </div>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">الاسم</label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="اسم المستخدم"
              />
            </div>
            {!selectedUser && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">كلمة المرور</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="كلمة المرور"
                      className="pr-10"
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
              </>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">الصلاحية</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'cashier' })}
                className="w-full h-10 px-3 rounded-md bg-muted border-0"
              >
                <option value="cashier">كاشير</option>
                <option value="admin">مدير</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="py-4">هل أنت متأكد من حذف المستخدم "{selectedUser?.name}"؟</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={confirmDeleteUser} disabled={isSavingUser}>
              {isSavingUser ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <PasswordChangeDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) setPasswordChangeUserId(null);
        }}
        userId={passwordChangeUserId || undefined}
      />
    </div>
  );
}
