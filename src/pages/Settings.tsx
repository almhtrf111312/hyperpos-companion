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
  Banknote,
  Package,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { downloadJSON, isNativePlatform } from '@/lib/file-download';
import GoogleDriveSection from '@/components/settings/GoogleDriveSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { ThemeSection } from '@/components/settings/ThemeSection';
import { ActivityLogSection } from '@/components/settings/ActivityLogSection';
import { PasswordChangeDialog } from '@/components/settings/PasswordChangeDialog';
import { LicenseManagement } from '@/components/settings/LicenseManagement';
import { ActivationCodeInput } from '@/components/settings/ActivationCodeInput';
import { ProductFieldsSection } from '@/components/settings/ProductFieldsSection';
import DataResetSection from '@/components/settings/DataResetSection';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useUsersManagement, UserData } from '@/hooks/use-users-management';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { emitEvent, EVENTS } from '@/lib/events';
import { saveStoreSettings } from '@/lib/supabase-store';
import { useNavigate } from 'react-router-dom';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

// Type-safe settings interfaces
interface SyncSettingsType {
  interval: number;
  showSuccessNotification: boolean;
  showErrorNotification: boolean;
  showSyncStatus: boolean;
  lastSync: string;
}

interface NotificationSettingsType {
  sound: boolean;
  newSale: boolean;
  lowStock: boolean;
  newDebt: boolean;
  paymentReceived: boolean;
  dailyReport: boolean;
}

interface PrintSettingsType {
  autoPrint: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  paperSize: string;
  copies: string;
  footer: string;
}

interface BackupSettingsType {
  autoBackup: boolean;
  interval: string;
  keepDays: string;
}

type PersistedSettings = {
  storeSettings?: Partial<{ name: string; type: string; phone: string; email: string; address: string; logo: string }>;
  exchangeRates?: Partial<{ TRY: string; SYP: string }>;
  syncSettings?: Partial<SyncSettingsType>;
  notificationSettings?: Partial<NotificationSettingsType>;
  printSettings?: Partial<PrintSettingsType>;
  backupSettings?: Partial<BackupSettingsType>;
  currencySymbol?: string;
};

const sanitizeNumberText = (value: string) => value.replace(/[^\d.]/g, '');

const loadPersistedSettings = (): PersistedSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PersistedSettings) : null;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return null;
  }
};

const savePersistedSettings = (data: PersistedSettings): boolean => {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
    // Emit standardized event so other components update in same-tab
    emitEvent(EVENTS.SETTINGS_UPDATED, data);
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
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
  const { t, isRTL } = useLanguage();
  const { user: currentUser } = useAuth();
  const { users, isLoading: usersLoading, addUser, updateUserRole, updateUserProfile, deleteUser } = useUsersManagement();
  const [activeTab, setActiveTab] = useState('store');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const navigate = useNavigate();
  const { isBoss, isAdmin: isOwnerAdmin } = useUserRole();

  const settingsTabs = [
    { id: 'store', label: t('settings.store'), icon: Store },
    { id: 'productFields', label: t('settings.productFields'), icon: Package },
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'theme', label: t('settings.theme'), icon: Palette },
    { id: 'currencies', label: t('settings.currencies'), icon: DollarSign },
    { id: 'sync', label: t('settings.sync'), icon: RefreshCw },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
    { id: 'printing', label: t('settings.printing'), icon: Printer },
    { id: 'users', label: t('settings.users'), icon: User, adminOnly: true },
    { id: 'activity', label: t('settings.activityLog'), icon: Activity },
    { id: 'backup', label: t('settings.backup'), icon: Database, adminOnly: true },
    { id: 'license', label: t('settings.license'), icon: Key },
    { id: 'licenses', label: t('settings.licenseManagement'), icon: Shield, bossOnly: true },
    { id: 'reset', label: t('settings.resetData'), icon: AlertTriangle, adminOnly: true },
  ];

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
          title: t('common.error'),
          description: t('settings.invalidImageType'),
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: t('common.error'),
          description: t('settings.imageTooLarge'),
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setStoreSettings(prev => ({ ...prev, logo: base64 }));
        toast({
          title: t('common.success'),
          description: t('settings.logoUploaded'),
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setStoreSettings(prev => ({ ...prev, logo: '' }));
    toast({
      title: t('common.deleted'),
      description: t('settings.logoRemoved'),
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

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Handlers
  const handleSaveSettings = async () => {
    const tryRate = Number(exchangeRates.TRY);
    const sypRate = Number(exchangeRates.SYP);
    const copies = Number(printSettings.copies);
    const keepDays = Number(backupSettings.keepDays);

    if (!Number.isFinite(tryRate) || tryRate <= 0 || !Number.isFinite(sypRate) || sypRate <= 0) {
      toast({
        title: t('common.error'),
        description: t('settings.invalidExchangeRates'),
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(copies) || copies < 1 || copies > 5) {
      toast({
        title: t('common.error'),
        description: t('settings.invalidCopies'),
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(keepDays) || keepDays < 7 || keepDays > 365) {
      toast({
        title: t('common.error'),
        description: t('settings.invalidKeepDays'),
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSettings(true);

    // Save to localStorage for local caching
    savePersistedSettings({
      storeSettings,
      exchangeRates,
      syncSettings,
      notificationSettings,
      printSettings,
      backupSettings,
    });

    // Save to cloud
    const cloudSuccess = await saveStoreSettings({
      name: storeSettings.name,
      store_type: storeSettings.type,
      phone: storeSettings.phone,
      address: storeSettings.address,
      logo_url: storeSettings.logo,
      exchange_rates: { USD: 1, TRY: tryRate, SYP: sypRate },
      sync_settings: syncSettings,
      notification_settings: notificationSettings,
      print_settings: printSettings,
    });

    setIsSavingSettings(false);

    if (cloudSuccess) {
      toast({
        title: t('common.saved'),
        description: t('settings.settingsSaved'),
      });
    } else {
      toast({
        title: t('common.saved'),
        description: 'تم الحفظ محلياً. قد يكون هناك مشكلة في المزامنة السحابية.',
      });
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSettings(prev => ({ ...prev, lastSync: new Date().toLocaleString('ar-SA') }));
      toast({
        title: t('settings.syncComplete'),
        description: t('settings.dataSynced'),
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
        title: t('common.error'),
        description: t('settings.enterUsername'),
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
          title: t('common.error'),
          description: t('settings.enterEmailPassword'),
          variant: "destructive",
        });
        setIsSavingUser(false);
        return;
      }

      if (userForm.password.length < 6) {
        toast({
          title: t('common.error'),
          description: t('settings.passwordTooShort'),
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
    setTimeout(async () => {
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

      // Generate filename with store name and date
      const storeName = storeSettings.name.replace(/[^a-zA-Z0-9أ-ي\s_-]/g, '').trim() || 'hyperpos';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `backup_${storeName}_${dateStr}.json`;

      // Use cross-platform download utility
      const success = await downloadJSON(filename, payload);

      if (success) {
        toast({
          title: t('settings.backupComplete'),
          description: isNativePlatform() 
            ? t('settings.backupSavedDevice') 
            : t('settings.backupDownloaded'),
        });
      } else {
        toast({
          title: t('common.error'),
          description: t('settings.backupFailed'),
          variant: 'destructive',
        });
      }
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
            title: t('common.error'),
            description: t('settings.invalidBackupFile'),
            variant: 'destructive',
          });
          setIsImporting(false);
          return;
        }

        // Validate backup structure
        if (!data.version || !data.exportedAt) {
          toast({
            title: t('common.error'),
            description: t('settings.invalidBackupFormat'),
            variant: 'destructive',
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
          title: t('settings.restoreComplete'),
          description: t('settings.pageReloading'),
        });
        
        // Reload the page after a short delay to apply all changes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import error:', error);
        toast({
          title: t('common.error'),
          description: t('settings.importFailed'),
          variant: 'destructive',
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
        title: t('common.error'),
        description: t('settings.fileReadError'),
        variant: 'destructive',
      });
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleRestoreBackup = (backup: BackupData) => {
    toast({
      title: t('settings.restoring'),
      description: `${t('settings.restoringFrom')} ${backup.date}`,
    });
  };

  const handleDeleteBackup = (backup: BackupData) => {
    setBackups(backups.filter(b => b.id !== backup.id));
    toast({
      title: t('common.deleted'),
      description: t('settings.backupDeleted'),
    });
  };

  const handleExportData = async () => {
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

    const filename = `hyperpos_export_${new Date().toISOString().split('T')[0]}.json`;
    const success = await downloadJSON(filename, payload);

    if (success) {
      toast({
        title: t('settings.exportComplete'),
        description: isNativePlatform() 
          ? t('settings.dataSavedDevice') 
          : t('settings.dataDownloaded'),
      });
    } else {
      toast({
        title: t('common.error'),
        description: t('settings.exportFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleImportData = () => {
    toast({
      title: t('settings.importing'),
      description: t('settings.importingData'),
    });
  };

  const handleTestPrint = () => {
    toast({
      title: t('settings.testPrint'),
      description: t('settings.testPrintSent'),
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'productFields':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
            <ProductFieldsSection storeType={storeSettings.type} />
          </div>
        );
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
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">{t('settings.storeInfo')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('settings.storeName')}</label>
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
                  <label className="text-sm font-medium text-foreground">{t('settings.storeType')}</label>
                  <select
                    value={storeSettings.type}
                    onChange={(e) => setStoreSettings({ ...storeSettings, type: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  >
                    <option value="phones">{t('settings.storeTypes.phones')}</option>
                    <option value="grocery">{t('settings.storeTypes.grocery')}</option>
                    <option value="pharmacy">{t('settings.storeTypes.pharmacy')}</option>
                    <option value="clothing">{t('settings.storeTypes.clothing')}</option>
                    <option value="general">{t('settings.storeTypes.general')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('common.phone')}</label>
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
                  <label className="text-sm font-medium text-foreground">{t('common.email')}</label>
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
                  <label className="text-sm font-medium text-foreground">{t('settings.address')}</label>
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
              <h3 className="text-base font-semibold text-foreground">{t('settings.storeLogo')}</h3>
              <div className="flex items-center gap-4">
                {storeSettings.logo ? (
                  <div className="relative">
                    <img 
                      src={storeSettings.logo} 
                      alt={t('settings.storeLogo')} 
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
                        {t('settings.uploadLogo')}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">{t('settings.logoRequirements')}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'currencies':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">{t('settings.exchangeRates')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('settings.turkishLira')}</label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={exchangeRates.TRY}
                    onChange={(e) => setExchangeRates({ ...exchangeRates, TRY: sanitizeNumberText(e.target.value) })}
                    className="pr-10 bg-muted border-0"
                    placeholder="32"
                  />
                </div>
                <p className="text-xs text-muted-foreground">1 {t('settings.dollar')} = {exchangeRates.TRY} {t('settings.turkishLiraShort')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('settings.syrianPound')}</label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={exchangeRates.SYP}
                    onChange={(e) => setExchangeRates({ ...exchangeRates, SYP: sanitizeNumberText(e.target.value) })}
                    className="pr-10 bg-muted border-0"
                    placeholder="14500"
                  />
                </div>
                <p className="text-xs text-muted-foreground">1 {t('settings.dollar')} = {exchangeRates.SYP} {t('settings.syrianPoundShort')}</p>
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
              <h3 className="text-base font-semibold text-foreground mb-4">{t('settings.localSync')}</h3>
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">{t('settings.lastSync')}</p>
                  <p className="text-sm text-muted-foreground">{syncSettings.lastSync}</p>
                </div>
                <Button onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 ml-2" />
                  )}
                  {t('settings.syncNow')}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-4">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">{t('settings.notifications')}</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  {notificationSettings.sound ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground">{t('settings.sound')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.soundDesc')}</p>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.sound}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, sound: checked })}
                />
              </div>
              {[
                { key: 'newSale', label: t('settings.newSale'), icon: CheckCircle2 },
                { key: 'lowStock', label: t('settings.lowStock'), icon: AlertCircle },
                { key: 'newDebt', label: t('settings.newDebt'), icon: FileText },
                { key: 'paymentReceived', label: t('settings.paymentReceived'), icon: DollarSign },
                { key: 'dailyReport', label: t('settings.dailyReport'), icon: Clock },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <p className="font-medium text-foreground">{item.label}</p>
                  </div>
                  <Switch
                    checked={notificationSettings[item.key as keyof NotificationSettingsType] as boolean}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [item.key]: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'printing':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">{t('settings.printing')}</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">{t('settings.autoPrint')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.autoPrintDesc')}</p>
                </div>
                <Switch
                  checked={printSettings.autoPrint}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, autoPrint: checked })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('settings.paperSize')}</label>
                  <select
                    value={printSettings.paperSize}
                    onChange={(e) => setPrintSettings({ ...printSettings, paperSize: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                    <option value="A4">A4</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('settings.copies')}</label>
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
                <label className="text-sm font-medium text-foreground">{t('settings.receiptFooter')}</label>
                <Input
                  value={printSettings.footer}
                  onChange={(e) => setPrintSettings({ ...printSettings, footer: e.target.value })}
                  className="bg-muted border-0"
                />
              </div>
              <Button variant="outline" onClick={handleTestPrint}>
                <Printer className="w-4 h-4 ml-2" />
                {t('settings.testPrint')}
              </Button>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-foreground">{t('settings.userManagement')}</h2>
              <Button onClick={handleAddUser}>
                <Plus className="w-4 h-4 ml-2" />
                {t('settings.addUser')}
              </Button>
            </div>
            <div className="space-y-3">
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('settings.noUsers')}
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
                          {user.role === 'admin' ? t('settings.admin') : t('settings.cashier')}
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
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">{t('settings.backup')}</h2>
            
            {/* Backup Section */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{t('settings.backup')}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.backupDescription')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleBackupNow} disabled={isBackingUp} className="flex-1 min-w-[140px]">
                  {isBackingUp ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ml-2" />
                  )}
                  {t('settings.downloadBackup')}
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
                        {t('settings.importBackup')}
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
                  <p className="font-medium text-foreground">{t('settings.autoBackup')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.autoBackupDesc')}</p>
                </div>
                <Switch
                  checked={backupSettings.autoBackup}
                  onCheckedChange={(checked) => setBackupSettings({ ...backupSettings, autoBackup: checked })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('settings.backupInterval')}</label>
                  <select
                    value={backupSettings.interval}
                    onChange={(e) => setBackupSettings({ ...backupSettings, interval: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  >
                    <option value="daily">{t('settings.daily')}</option>
                    <option value="weekly">{t('settings.weekly')}</option>
                    <option value="monthly">{t('settings.monthly')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('settings.keepDays')}</label>
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
              <h3 className="text-base font-semibold text-foreground mb-3">{t('settings.exportDataJson')}</h3>
              <Button variant="outline" onClick={handleExportData}>
                <Download className="w-4 h-4 ml-2" />
                {t('settings.exportJson')}
              </Button>
            </div>

            {/* Recent Backups */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-base font-semibold text-foreground mb-3">{t('settings.recentBackups')}</h3>
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{backup.date}</p>
                        <p className="text-xs text-muted-foreground">
                          {backup.size} • {backup.type === 'auto' ? t('settings.auto') : t('settings.manual')}
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
        return (
          <div className="space-y-6">
            {/* Quick link to Boss Panel */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div>
                <h3 className="font-medium text-foreground">{t('settings.bossPanel')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.goToBossPanel')}</p>
              </div>
              <Button onClick={() => navigate('/boss')} variant="outline" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                {isRTL ? 'فتح' : 'Open'}
              </Button>
            </div>
            <LicenseManagement />
          </div>
        );

      case 'reset':
        return <DataResetSection />;

      default:
        return null;
    }
  };

  const isAdmin = users.find(u => u.user_id === currentUser?.id)?.role === 'admin';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between gap-4 pr-14 md:pr-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        </div>
        
        <Button size="lg" className="px-6 md:px-8 py-3 text-base shrink-0" onClick={handleSaveSettings}>
          <Save className="w-5 h-5 ml-2" />
          <span className="hidden sm:inline">{t('common.save')}</span>
        </Button>
      </div>

      {/* Tabs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {settingsTabs
          .filter(tab => {
            // Boss sees everything
            if (isBoss) return true;
            // Admin sees everything except bossOnly
            if (isOwnerAdmin && !(tab as any).bossOnly) return true;
            // Others see only non-admin and non-boss tabs
            return !tab.adminOnly && !(tab as any).bossOnly;
          })
          .map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
              activeTab === tab.id
                ? "border-primary bg-primary/10 shadow-lg scale-[1.02]"
                : "border-border bg-card hover:bg-muted hover:border-primary/50 hover:scale-[1.01]"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
              activeTab === tab.id 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            )}>
              <tab.icon className="w-6 h-6" />
            </div>
            <span className={cn(
              "font-medium text-sm text-center leading-tight",
              activeTab === tab.id ? "text-primary" : "text-foreground"
            )}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
        {renderTabContent()}
      </div>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? t('settings.editUser') : t('settings.addNewUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.name')}</label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder={t('settings.usernamePlaceholder')}
              />
            </div>
            {!selectedUser && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('common.email')}</label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('auth.password')}</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder={t('auth.password')}
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
              <label className="text-sm font-medium">{t('settings.role')}</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'cashier' })}
                className="w-full h-10 px-3 rounded-md bg-muted border-0"
              >
                <option value="cashier">{t('settings.cashier')}</option>
                <option value="admin">{t('settings.admin')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="py-4">{t('settings.confirmDeleteUser')} "{selectedUser?.name}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDeleteUser} disabled={isSavingUser}>
              {isSavingUser ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
              {t('common.delete')}
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
