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
  Lock
} from 'lucide-react';
import { encryptBackup, decryptBackup, isEncryptedBackup, getBackupFileExtension } from '@/lib/backup-encryption';
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

const sanitizeNumberText = (value: string) => value.replace(/[^\\d.]/g, '');

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

      // Create encrypted backup payload with ALL localStorage data
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

      // Encrypt the backup data
      const encryptedData = encryptBackup(payload);
      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Generate filename with store email and date
      const storeEmail = storeSettings.email.replace(/[^a-zA-Z0-9@._-]/g, '_') || 'hyperpos';
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `${storeEmail}_${dateStr}${getBackupFileExtension()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "تم النسخ الاحتياطي المشفر",
        description: "تم إنشاء نسخة احتياطية مشفرة وتنزيلها بنجاح",
      });
    }, 800);
  };

  // Import encrypted backup file
  const handleImportEncryptedBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        
        // Check if it's an encrypted backup
        if (!isEncryptedBackup(fileContent)) {
          toast({
            title: "خطأ",
            description: "الملف غير صالح أو غير مشفر بتنسيق HyperPOS",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }

        // Decrypt the backup
        const decryptedData = decryptBackup(fileContent);
        
        if (!decryptedData) {
          toast({
            title: "خطأ في فك التشفير",
            description: "فشل في فك تشفير الملف. تأكد من أن الملف صحيح.",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }

        // Restore the data
        const data = decryptedData as any;
        
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
          description: `تم استعادة النسخة الاحتياطية من ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('ar-SA') : 'تاريخ غير معروف'}`,
        });
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
                ... (file continues unchanged)
  }
}
