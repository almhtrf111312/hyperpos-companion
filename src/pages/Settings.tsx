import { useState, useEffect, useRef } from 'react';
import { Undo2, Smartphone } from 'lucide-react';
import { ArchiveSection } from '@/components/settings/ArchiveSection';
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
  Activity,
  Key,
  FileUp,
  Lock,
  Banknote,
  Package,
  AlertTriangle,
  ExternalLink,
  Wrench,
  Archive
} from 'lucide-react';
import { downloadJSON, isNativePlatform, listNativeBackups, NativeBackupFile, DownloadResult } from '@/lib/file-download';
import { LocalBackupSection } from '@/components/settings/LocalBackupSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
// ThemeSection تم نقله لصفحة مستقلة /appearance
import { ActivityLogSection } from '@/components/settings/ActivityLogSection';
import { SystemDiagnostics } from '@/components/settings/SystemDiagnostics';
import { PasswordChangeDialog } from '@/components/settings/PasswordChangeDialog';
import { LicenseManagement } from '@/components/settings/LicenseManagement';
import { ActivationCodeInput } from '@/components/settings/ActivationCodeInput';
import { ProductFieldsSection } from '@/components/settings/ProductFieldsSection';
import { ProductFieldsConfig, loadProductFieldsConfig, saveProductFieldsConfig, getDefaultFieldsByStoreType, StoreType } from '@/lib/product-fields-config';
import { getDefaultCategories } from '@/lib/store-type-config';
import { saveCategories, Category } from '@/lib/categories-store';
import DataResetSection from '@/components/settings/DataResetSection';
import { ContactLinksSection } from '@/components/settings/ContactLinksSection';
import { ProfileManagement } from '@/components/settings/ProfileManagement';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
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
  currencyNames?: Partial<{ TRY: string; SYP: string }>;
  syncSettings?: Partial<SyncSettingsType>;
  notificationSettings?: Partial<NotificationSettingsType>;
  printSettings?: Partial<PrintSettingsType>;
  backupSettings?: Partial<BackupSettingsType>;
  currencySymbol?: string;
  hideMaintenanceSection?: boolean;
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
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'store', label: t('settings.store'), icon: Store },
    { id: 'productFields', label: t('settings.productFields'), icon: Package },
    { id: 'backup', label: isRTL ? 'النسخ الاحتياطي والمزامنة' : 'Backup & Sync', icon: Database, adminOnly: true },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
    { id: 'printing', label: t('settings.printing'), icon: Printer },
    { id: 'users', label: t('settings.users'), icon: User, adminOnly: true },
    { id: 'activity', label: t('settings.activityLog'), icon: Activity, bossOnly: true },
    
    { id: 'license', label: t('settings.license'), icon: Key },
    { id: 'licenses', label: t('settings.licenseManagement'), icon: Shield, bossOnly: true },
    { id: 'diagnostics', label: t('settings.diagnostics'), icon: Wrench, bossOnly: true },
    { id: 'archive', label: isRTL ? 'الأرشيف' : 'Archive', icon: Archive },
    { id: 'reset', label: t('settings.resetData'), icon: AlertTriangle, adminOnly: true },
  ];

  const persisted = loadPersistedSettings();

  // Store settings - فارغة افتراضياً للحسابات الجديدة
  const [storeSettings, setStoreSettings] = useState({
    name: persisted?.storeSettings?.name ?? '',
    type: persisted?.storeSettings?.type ?? 'phones',
    phone: persisted?.storeSettings?.phone ?? '',
    email: persisted?.storeSettings?.email ?? '',
    address: persisted?.storeSettings?.address ?? '',
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

  // Custom currency names
  const [currencyNames, setCurrencyNames] = useState({
    TRY: persisted?.currencyNames?.TRY ?? t('settings.tryName'),
    SYP: persisted?.currencyNames?.SYP ?? t('settings.sypName'),
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
    footer: t('settings.defaultFooter'),
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

  // POS options
  const [hideMaintenanceSection, setHideMaintenanceSection] = useState(
    persisted?.hideMaintenanceSection ?? false
  );

  // Product fields config state (for unified save)
  const [productFieldsConfig, setProductFieldsConfig] = useState<ProductFieldsConfig | null>(null);
  const [productFieldsChanged, setProductFieldsChanged] = useState(false);

  // Store type change confirmation
  const [storeTypeConfirmOpen, setStoreTypeConfirmOpen] = useState(false);
  const [pendingStoreType, setPendingStoreType] = useState<string | null>(null);

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
    phone: '',
    role: 'cashier' as 'admin' | 'cashier',
    userType: 'cashier' as 'cashier' | 'distributor' | 'pos',
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastBackupResult, setLastBackupResult] = useState<DownloadResult | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Transfer license state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferPassword, setTransferPassword] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferPassword, setShowTransferPassword] = useState(false);

  const handleTransferLicense = async () => {
    if (!transferPassword || !currentUser?.email) return;
    setIsTransferring(true);
    try {
      const { data, error } = await supabase.functions.invoke('transfer-license', {
        body: { email: currentUser.email, password: transferPassword },
      });

      if (error || !data?.success) {
        toast({
          title: isRTL ? 'خطأ' : 'Error',
          description: data?.error || (isRTL ? 'فشل في نقل الترخيص' : 'Failed to transfer license'),
          variant: 'destructive',
        });
        setIsTransferring(false);
        return;
      }

      toast({
        title: isRTL ? 'تم بنجاح' : 'Success',
        description: isRTL ? 'تم فك ارتباط الجهاز بنجاح. يمكنك التفعيل من الجهاز الجديد.' : 'Device unlinked successfully. You can now activate on a new device.',
      });

      // Clear all local data and force sign out
      setTransferDialogOpen(false);
      setTransferPassword('');
      localStorage.clear();
      await supabase.auth.signOut();
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
    setIsTransferring(false);
  };

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Snapshot of settings when page loads - for revert functionality
  const settingsSnapshotRef = useRef<{
    storeSettings: typeof storeSettings;
    exchangeRates: typeof exchangeRates;
    currencyNames: typeof currencyNames;
    notificationSettings: typeof notificationSettings;
    printSettings: typeof printSettings;
    backupSettings: typeof backupSettings;
    hideMaintenanceSection: boolean;
    productFieldsConfig: ProductFieldsConfig | null;
  } | null>(null);

  // Capture snapshot on first render only
  useEffect(() => {
    if (!settingsSnapshotRef.current) {
      settingsSnapshotRef.current = {
        storeSettings: { ...storeSettings },
        exchangeRates: { ...exchangeRates },
        currencyNames: { ...currencyNames },
        notificationSettings: { ...notificationSettings },
        printSettings: { ...printSettings },
        backupSettings: { ...backupSettings },
        hideMaintenanceSection,
        productFieldsConfig: loadProductFieldsConfig(),
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if there are unsaved changes
  const hasUnsavedChanges = (() => {
    const snap = settingsSnapshotRef.current;
    if (!snap) return false;
    return (
      JSON.stringify(storeSettings) !== JSON.stringify(snap.storeSettings) ||
      JSON.stringify(exchangeRates) !== JSON.stringify(snap.exchangeRates) ||
      JSON.stringify(currencyNames) !== JSON.stringify(snap.currencyNames) ||
      JSON.stringify(notificationSettings) !== JSON.stringify(snap.notificationSettings) ||
      JSON.stringify(printSettings) !== JSON.stringify(snap.printSettings) ||
      JSON.stringify(backupSettings) !== JSON.stringify(snap.backupSettings) ||
      hideMaintenanceSection !== snap.hideMaintenanceSection ||
      productFieldsChanged
    );
  })();

  // Revert all settings to snapshot
  const handleRevert = () => {
    const snap = settingsSnapshotRef.current;
    if (!snap) return;
    setStoreSettings({ ...snap.storeSettings });
    setExchangeRates({ ...snap.exchangeRates });
    setCurrencyNames({ ...snap.currencyNames });
    setNotificationSettings({ ...snap.notificationSettings });
    setPrintSettings({ ...snap.printSettings });
    setBackupSettings({ ...snap.backupSettings });
    setHideMaintenanceSection(snap.hideMaintenanceSection);
    setProductFieldsConfig(snap.productFieldsConfig);
    setProductFieldsChanged(false);
    toast({
      title: t('common.success'),
      description: isRTL ? 'تم التراجع عن التغييرات' : 'Changes reverted',
    });
  };

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
      currencyNames,
      syncSettings,
      notificationSettings,
      printSettings,
      backupSettings,
      hideMaintenanceSection,
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

    // Save product fields config if changed
    if (productFieldsChanged && productFieldsConfig) {
      await saveProductFieldsConfig(productFieldsConfig);
      setProductFieldsChanged(false);
    }

    setIsSavingSettings(false);

    // Update snapshot after successful save
    settingsSnapshotRef.current = {
      storeSettings: { ...storeSettings },
      exchangeRates: { ...exchangeRates },
      currencyNames: { ...currencyNames },
      notificationSettings: { ...notificationSettings },
      printSettings: { ...printSettings },
      backupSettings: { ...backupSettings },
      hideMaintenanceSection,
      productFieldsConfig: productFieldsConfig || loadProductFieldsConfig(),
    };

    if (cloudSuccess) {
      toast({
        title: t('common.saved'),
        description: t('settings.settingsSaved'),
      });
    } else {
      toast({
        title: t('common.saved'),
        description: isRTL ? 'تم الحفظ محلياً. قد يكون هناك مشكلة في المزامنة السحابية.' : 'Saved locally. Cloud sync may have an issue.',
      });
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSettings(prev => ({ ...prev, lastSync: formatDateTime(new Date().toISOString()) }));
      toast({
        title: t('settings.syncComplete'),
        description: t('settings.dataSynced'),
      });
    }, 2000);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setUserForm({ name: '', email: '', password: '', phone: '', role: 'cashier', userType: 'cashier' });
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: UserData) => {
    setSelectedUser(user);
    // Convert boss/admin roles to 'cashier' for the form since we only allow cashier role for new users
    const formRole = user.role === 'boss' || user.role === 'admin' ? 'cashier' : user.role;
    // Populate phone from user data
    setUserForm({
      name: user.name,
      email: '',
      password: '',
      phone: user.phone || '',
      role: formRole as 'admin' | 'cashier',
      userType: user.userType || 'cashier'
    });
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
      // Update existing user - update profile with name, userType, and phone
      const nameChanged = userForm.name !== selectedUser.name;
      const userTypeChanged = userForm.userType !== selectedUser.userType;
      const phoneChanged = userForm.phone !== (selectedUser.phone || '');

      let success = true;

      // Update profile if anything changed
      if (nameChanged || userTypeChanged || phoneChanged) {
        success = await updateUserProfile(
          selectedUser.user_id,
          userForm.name,
          userForm.userType,
          userForm.phone
        );
      }

      if (success) {
        setUserDialogOpen(false);
        setSelectedUser(null);
        setUserForm({ name: '', email: '', password: '', phone: '', role: 'cashier', userType: 'cashier' });
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

      const success = await addUser(userForm.email, userForm.password, userForm.name, userForm.role, userForm.userType, userForm.phone);
      if (success) {
        setUserDialogOpen(false);
      }
    }

    setIsSavingUser(false);
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const { generateBackupData } = await import('@/lib/auto-backup');
      const backupData = await generateBackupData();

      const storeName = storeSettings.name.replace(/[^a-zA-Z0-9أ-ي\s_-]/g, '').trim() || 'hyperpos';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `backup_${storeName}_${dateStr}.json`;

      // Use cross-platform download utility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await downloadJSON(filename, backupData as any);

      const newBackup: BackupData = {
        id: Date.now().toString(),
        date: formatDateTime(new Date().toISOString()),
        size: (JSON.stringify(backupData).length / 1024 / 1024).toFixed(2) + ' MB',
        type: 'manual',
      };
      setBackups([newBackup, ...backups]);

      if (result.success) {
        setLastBackupResult({ ...result, filename });
        toast({
          title: t('settings.backupComplete'),
          description: isNativePlatform()
            ? `${t('settings.backupSavedDevice')} - ${result.path}/${filename}`
            : t('settings.backupDownloaded'),
        });
      } else {
        toast({
          title: t('common.error'),
          description: t('settings.backupFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast({
        title: t('common.error'),
        description: t('settings.backupFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsBackingUp(false);
    }
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
    try {
      const { generateBackupData } = await import('@/lib/auto-backup');
      const backupData = await generateBackupData();

      const filename = `hyperpos_export_${new Date().toISOString().split('T')[0]}.json`;

      // Use cross-platform download utility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await downloadJSON(filename, backupData as any);

      if (result.success) {
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
    } catch (error) {
      console.error('Export error:', error);
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
      case 'profile':
        return <ProfileManagement />;
      case 'productFields':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
            <ProductFieldsSection
              storeType={storeSettings.type}
              onConfigChange={(config) => {
                setProductFieldsConfig(config);
                setProductFieldsChanged(true);
              }}
              pendingConfig={productFieldsConfig}
            />
          </div>
        );
      case 'language':
        return <LanguageSection />;
      // تم نقل theme إلى صفحة /appearance
      case 'activity':
        return <ActivityLogSection />;
      case 'diagnostics':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
            <SystemDiagnostics />
          </div>
        );
      case 'store':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-3">{t('settings.storeInfo')}</h2>
              <div className="space-y-2">
                {/* اسم المتجر */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('settings.storeName')}</label>
                  <div className="relative flex-1">
                    <Store className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.name}
                      onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                      className="pr-10 bg-muted border-0 h-9"
                    />
                  </div>
                </div>
                {/* نوع المحل */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('settings.storeType')}</label>
                  <select
                    value={storeSettings.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setStoreSettings({ ...storeSettings, type: newType });
                      if (newType !== 'phones' && newType !== 'repair') {
                        setHideMaintenanceSection(true);
                      } else {
                        setHideMaintenanceSection(false);
                      }
                      const defaultFields = getDefaultFieldsByStoreType(newType as StoreType);
                      setProductFieldsConfig(defaultFields);
                      setProductFieldsChanged(true);
                      setPendingStoreType(newType);
                      setStoreTypeConfirmOpen(true);
                    }}
                    className="flex-1 h-9 px-3 rounded-md bg-muted border-0 text-foreground text-sm"
                  >
                    <option value="phones">{t('settings.storeTypes.phones')}</option>
                    <option value="grocery">{t('settings.storeTypes.grocery')}</option>
                    <option value="pharmacy">{t('settings.storeTypes.pharmacy')}</option>
                    <option value="clothing">{t('settings.storeTypes.clothing')}</option>
                    <option value="restaurant">{isRTL ? 'مطعم' : 'Restaurant'}</option>
                    <option value="repair">{isRTL ? 'ورشة صيانة' : 'Repair Shop'}</option>
                    <option value="bookstore">{isRTL ? 'مكتبة' : 'Bookstore'}</option>
                    <option value="general">{t('settings.storeTypes.general')}</option>
                  </select>
                </div>
                {/* الهاتف */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('common.phone')}</label>
                  <div className="relative flex-1">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d+\-\s]/g, '');
                        setStoreSettings({ ...storeSettings, phone: val });
                      }}
                      inputMode="tel"
                      className="pr-10 bg-muted border-0 h-9"
                    />
                  </div>
                </div>
                {/* البريد */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('common.email')}</label>
                  <div className="relative flex-1">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.email}
                      onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                      className="pr-10 bg-muted border-0 h-9"
                    />
                  </div>
                </div>
                {/* العنوان */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('settings.address')}</label>
                  <div className="relative flex-1">
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={storeSettings.address}
                      onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                      className="pr-10 bg-muted border-0 h-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              {storeSettings.logo ? (
                <div className="relative">
                  <img
                    src={storeSettings.logo}
                    alt={t('settings.storeLogo')}
                    className="w-14 h-14 rounded-lg object-cover border border-border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -left-2 h-5 w-5"
                    onClick={handleRemoveLogo}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
                  <Store className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4 ml-2" />
                      {t('settings.uploadLogo')}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('settings.logoRequirements')}</p>
              </div>
            </div>

            {/* POS Options - إخفاء الصيانة */}
            {(storeSettings.type === 'phones' || storeSettings.type === 'repair') && (
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">إخفاء قسم الصيانة</span>
                </div>
                <Switch
                  checked={hideMaintenanceSection}
                  onCheckedChange={setHideMaintenanceSection}
                />
              </div>
            )}

            {/* Language Section */}
            <div className="border-t border-border pt-2">
              <LanguageSection />
            </div>

            {/* Currencies Section */}
            <div className="pt-2 border-t border-border space-y-3">
              <h3 className="text-base font-semibold text-foreground">{t('settings.exchangeRates')}</h3>
              
              {/* العملة الأولى */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={currencyNames.TRY}
                    onChange={(e) => setCurrencyNames({ ...currencyNames, TRY: e.target.value })}
                    className="flex-1 bg-muted border-0 h-9 text-sm"
                    placeholder={t('settings.currencyTryPlaceholder')}
                  />
                  <div className="relative flex-1">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={exchangeRates.TRY}
                      onChange={(e) => setExchangeRates({ ...exchangeRates, TRY: sanitizeNumberText(e.target.value) })}
                      className="pr-10 bg-muted border-0 h-9 text-sm"
                      placeholder="32"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground px-1">1 {t('settings.dollar')} = {exchangeRates.TRY} {currencyNames.TRY}</p>
              </div>

              {/* العملة الثانية */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={currencyNames.SYP}
                    onChange={(e) => setCurrencyNames({ ...currencyNames, SYP: e.target.value })}
                    className="flex-1 bg-muted border-0 h-9 text-sm"
                    placeholder={t('settings.currencySypPlaceholder')}
                  />
                  <div className="relative flex-1">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={exchangeRates.SYP}
                      onChange={(e) => setExchangeRates({ ...exchangeRates, SYP: sanitizeNumberText(e.target.value) })}
                      className="pr-10 bg-muted border-0 h-9 text-sm"
                      placeholder="14500"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground px-1">1 {t('settings.dollar')} = {exchangeRates.SYP} {currencyNames.SYP}</p>
              </div>
            </div>
          </div>
        );

      // currencies tab removed - now inside store tab

      // sync tab merged into backup below

      case 'notifications':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-2">
            <h2 className="text-lg font-bold text-foreground mb-2">{t('settings.notifications')}</h2>
            {/* الصوت */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                {notificationSettings.sound ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm font-medium">{t('settings.sound')}</span>
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
              <div key={item.key} className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <Switch
                  checked={notificationSettings[item.key as keyof NotificationSettingsType] as boolean}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [item.key]: checked })}
                />
              </div>
            ))}
          </div>
        );

      case 'printing':
        return (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-3">
            <h2 className="text-lg font-bold text-foreground mb-2">{t('settings.printing')}</h2>
            {/* الطباعة التلقائية */}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium">{t('settings.autoPrint')}</span>
              <Switch
                checked={printSettings.autoPrint}
                onCheckedChange={(checked) => setPrintSettings({ ...printSettings, autoPrint: checked })}
              />
            </div>
            {/* حجم الورق + النسخ */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm font-medium text-foreground w-20 shrink-0">{t('settings.paperSize')}</label>
                <select
                  value={printSettings.paperSize}
                  onChange={(e) => setPrintSettings({ ...printSettings, paperSize: e.target.value })}
                  className="flex-1 h-9 px-3 rounded-md bg-muted border-0 text-foreground text-sm"
                >
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm</option>
                  <option value="A4">A4</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm font-medium text-foreground w-16 shrink-0">{t('settings.copies')}</label>
                <Input
                  type="number"
                  value={printSettings.copies}
                  onChange={(e) => setPrintSettings({ ...printSettings, copies: e.target.value })}
                  min="1"
                  max="5"
                  className="bg-muted border-0 h-9"
                />
              </div>
            </div>
            {/* تذييل الإيصال */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground w-20 shrink-0">{t('settings.receiptFooter')}</label>
              <Input
                value={printSettings.footer}
                onChange={(e) => setPrintSettings({ ...printSettings, footer: e.target.value })}
                className="bg-muted border-0 h-9 flex-1"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleTestPrint}>
              <Printer className="w-4 h-4 ml-2" />
              {t('settings.testPrint')}
            </Button>
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
                users
                  .filter((user) => user.role !== 'boss') // Hide boss accounts from this list
                  .map((user) => (
                    <div key={user.id} className="flex flex-col gap-2 p-4 bg-muted rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {user.role === 'admin' ? t('settings.userTypeOwner') :
                              user.userType === 'distributor' ? t('settings.userTypeDistributor') :
                                user.userType === 'pos' ? t('settings.userTypePOS') :
                                  t('settings.cashier')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border/50 pt-2">
                        {!user.isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => {
                              setPasswordChangeUserId(user.user_id);
                              setPasswordDialogOpen(true);
                            }}
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span className="text-xs">{isRTL ? 'كلمة المرور' : 'Password'}</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="flex-1 gap-1" onClick={() => handleEditUser(user)}>
                          <Edit className="w-3.5 h-3.5" />
                          <span className="text-xs">{t('common.edit')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 gap-1 text-destructive"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.user_id === currentUser?.id || user.isOwner}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-xs">{t('common.delete')}</span>
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
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">
              {isRTL ? 'النسخ الاحتياطي والمزامنة' : 'Backup & Sync'}
            </h2>

            {/* Backup & Import - compact row */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleBackupNow} disabled={isBackingUp} className="flex-1">
                {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span className="text-xs">{t('settings.downloadBackup')}</span>
              </Button>
              <div className="flex-1">
                <input type="file" accept=".json,application/json,text/plain" onChange={handleImportBackup} className="hidden" id="import-backup" ref={importInputRef} />
                <label htmlFor="import-backup" className="w-full">
                  <Button variant="outline" size="sm" className="w-full" asChild disabled={isImporting}>
                    <span className="cursor-pointer">
                      {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                      <span className="text-xs">{t('settings.importBackup')}</span>
                    </span>
                  </Button>
                </label>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportData}>
                <Download className="w-3.5 h-3.5" />
                <span className="text-xs">JSON</span>
              </Button>
            </div>

            {/* Last backup result */}
            {lastBackupResult?.success && (
              <div className="p-2 bg-muted/50 rounded-lg border border-border text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground truncate">
                  {lastBackupResult.path}/{lastBackupResult.filename}
                </span>
              </div>
            )}

            {/* Auto backup + Sync - compact grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{t('settings.autoBackup')}</p>
                </div>
                <Switch
                  checked={backupSettings.autoBackup}
                  onCheckedChange={(checked) => setBackupSettings({ ...backupSettings, autoBackup: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{t('settings.lastSync')}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{syncSettings.lastSync}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={handleSync} disabled={isSyncing} className="h-7 w-7 p-0 shrink-0">
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">{t('settings.backupInterval')}</label>
                <select
                  value={backupSettings.interval}
                  onChange={(e) => setBackupSettings({ ...backupSettings, interval: e.target.value })}
                  className="w-full h-8 px-2 text-xs rounded-md bg-muted border-0 text-foreground"
                >
                  <option value="daily">{t('settings.daily')}</option>
                  <option value="weekly">{t('settings.weekly')}</option>
                  <option value="monthly">{t('settings.monthly')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">{t('settings.keepDays')}</label>
                <Input
                  type="number"
                  value={backupSettings.keepDays}
                  onChange={(e) => setBackupSettings({ ...backupSettings, keepDays: e.target.value })}
                  min="7" max="365"
                  className="h-8 text-xs bg-muted border-0"
                />
              </div>
            </div>

            {/* Local Auto-Backup */}
            <LocalBackupSection />

            {/* Recent Backups - compact */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-foreground">{t('settings.recentBackups')}</h3>
              {backups.map((backup) => (
                <div key={backup.id} className="flex flex-col gap-1.5 p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{backup.date}</p>
                      <p className="text-[10px] text-muted-foreground">{backup.size} • {backup.type === 'auto' ? t('settings.auto') : t('settings.manual')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 border-t border-border/50 pt-1.5">
                    <Button variant="ghost" size="sm" className="flex-1 h-7 gap-1 text-xs" onClick={() => handleRestoreBackup(backup)}>
                      <RefreshCw className="w-3 h-3" />
                      {isRTL ? 'استعادة' : 'Restore'}
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7 gap-1 text-xs text-destructive" onClick={() => handleDeleteBackup(backup)}>
                      <Trash2 className="w-3 h-3" />
                      {isRTL ? 'حذف' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'license':
        return (
          <div className="space-y-6">
            <ActivationCodeInput />
            {/* Transfer License Button */}
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                {isRTL ? 'نقل الترخيص' : 'Transfer License'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? 'فك ارتباط الترخيص من هذا الجهاز لتتمكن من تفعيله على جهاز جديد. سيتم تسجيل خروجك تلقائياً.'
                  : 'Unbind the license from this device so you can activate it on a new one. You will be signed out automatically.'}
              </p>
              <Button
                variant="outline"
                className="w-full gap-2 border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                onClick={() => setTransferDialogOpen(true)}
              >
                <Smartphone className="w-4 h-4" />
                {isRTL ? 'نقل الترخيص لجهاز آخر' : 'Transfer License to Another Device'}
              </Button>
            </div>
          </div>
        );

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
                {t('common.open')}
              </Button>
            </div>
            <LicenseManagement />
          </div>
        );

      case 'archive':
        return <ArchiveSection />;

      case 'reset':
        return (
          <div className="space-y-6">
            <DataResetSection />
            {/* Contact Developer Section */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {isRTL ? 'التواصل مع المطور' : 'Contact Developer'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'تواصل مع فريق الدعم الفني' : 'Contact the support team'}
                  </p>
                </div>
              </div>
              <ContactLinksSection />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isAdmin = users.find(u => u.user_id === currentUser?.id)?.role === 'admin';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pr-14 md:pr-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Tabs Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {settingsTabs
          .filter(tab => {
            if (isBoss) return true;
            if (isOwnerAdmin && !(tab as any).bossOnly) return true;
            return !tab.adminOnly && !(tab as any).bossOnly;
          })
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200",
                activeTab === tab.id
                  ? "border-primary bg-primary/10 shadow-lg scale-[1.02]"
                  : "border-border bg-card hover:bg-muted hover:border-primary/50 hover:scale-[1.01]"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                <tab.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "font-medium text-xs text-center leading-tight",
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
            {!selectedUser && (
              <div className="space-y-2">
                <label className="text-sm font-medium">رقم الهاتف (اختياري)</label>
                <Input
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+963 912 345 678"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">نوع المستخدم</label>
              <select
                value={userForm.userType}
                onChange={(e) => setUserForm({ ...userForm, userType: e.target.value as 'cashier' | 'distributor' | 'pos' })}
                className="w-full h-10 px-3 rounded-md bg-muted border-0"
              >
                <option value="cashier">كاشير (يرى كل المنتجات)</option>
                <option value="pos">نقطة بيع (منتجات العهدة فقط)</option>
                <option value="distributor">موزع متجول (منتجات العهدة فقط)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {userForm.userType === 'cashier'
                  ? t('settings.userTypeCashierDesc')
                  : userForm.userType === 'pos'
                    ? 'نقطة بيع ثابتة - يرى فقط المنتجات في عهدته'
                    : 'موزع متجول - يرى فقط المنتجات في سيارته/عهدته'}
              </p>
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

      {/* Transfer License Dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={(open) => {
        setTransferDialogOpen(open);
        if (!open) { setTransferPassword(''); setShowTransferPassword(false); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'نقل الترخيص لجهاز آخر' : 'Transfer License'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'أدخل كلمة المرور لتأكيد هويتك. سيتم فك ارتباط الترخيص من هذا الجهاز وتسجيل خروجك تلقائياً.'
                : 'Enter your password to confirm. The license will be unbound from this device and you will be signed out.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="relative">
              <Input
                type={showTransferPassword ? 'text' : 'password'}
                value={transferPassword}
                onChange={(e) => setTransferPassword(e.target.value)}
                placeholder={isRTL ? 'كلمة المرور' : 'Password'}
                className="pe-10"
                onKeyDown={(e) => { if (e.key === 'Enter' && transferPassword) handleTransferLicense(); }}
              />
              <button
                type="button"
                onClick={() => setShowTransferPassword(!showTransferPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showTransferPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <Button
              onClick={handleTransferLicense}
              disabled={!transferPassword || isTransferring}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isTransferring ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Smartphone className="w-4 h-4 me-2" />}
              {isRTL ? 'تأكيد وفك الارتباط' : 'Confirm & Unbind'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Buttons (FAB) */}
      <div
        className={cn(
          "fixed bottom-6 z-50 flex items-center gap-3 transition-all duration-300 ease-in-out",
          isRTL ? "right-6" : "left-6",
          hasUnsavedChanges
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className="w-14 h-14 rounded-full shadow-lg p-0"
        >
          {isSavingSettings ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Save className="w-6 h-6" />
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={handleRevert}
          className="w-14 h-14 rounded-full shadow-lg p-0"
        >
          <Undo2 className="w-6 h-6" />
        </Button>
      </div>

      {/* تأكيد تغيير التصنيفات عند تغيير نوع المحل */}
      <Dialog open={storeTypeConfirmOpen} onOpenChange={setStoreTypeConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تغيير التصنيفات' : 'Update Categories'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? 'هل تريد استبدال التصنيفات الحالية بتصنيفات افتراضية تناسب نوع النشاط الجديد؟ سيتم حذف التصنيفات الحالية.'
              : 'Do you want to replace your current categories with default ones for the new business type? Your existing categories will be removed.'}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setStoreTypeConfirmOpen(false);
                setPendingStoreType(null);
                toast({
                  title: isRTL ? 'تم التحديث' : 'Updated',
                  description: isRTL ? 'تم تحديث الحقول فقط، التصنيفات لم تتغير' : 'Fields updated, categories unchanged',
                });
              }}
            >
              {isRTL ? 'الاحتفاظ بالتصنيفات الحالية' : 'Keep Current'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingStoreType) {
                  const defaultCats = getDefaultCategories(pendingStoreType);
                  const newCategories: Category[] = defaultCats.map((name, i) => ({
                    id: `auto_${Date.now()}_${i}`,
                    name,
                    createdAt: new Date().toISOString(),
                  }));
                  saveCategories(newCategories);
                }
                setStoreTypeConfirmOpen(false);
                setPendingStoreType(null);
                toast({
                  title: isRTL ? 'تم التحديث' : 'Updated',
                  description: isRTL ? 'تم تحديث الحقول والتصنيفات حسب نوع النشاط الجديد' : 'Fields and categories updated for the new business type',
                });
              }}
            >
              {isRTL ? 'استبدال التصنيفات' : 'Replace Categories'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
