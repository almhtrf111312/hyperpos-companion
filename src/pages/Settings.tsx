import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Coins, Undo2, Smartphone, UserCheck, Users, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import Partners from '@/pages/Partners';
import { ArchiveSection } from '@/components/settings/ArchiveSection';
import {
  Search,
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
  Archive,
  Percent,
  Wallet
} from 'lucide-react';
import { downloadJSON, isNativePlatform, listNativeBackups, NativeBackupFile, DownloadResult } from '@/lib/file-download';
import { LocalBackupSection } from '@/components/settings/LocalBackupSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { isValidAppFontId, setStoredAppFont, APP_FONT_STORAGE_KEY } from '@/lib/app-font-config';
// ThemeSection integrated as a tab
import { ActivityLogSection } from '@/components/settings/ActivityLogSection';
import { SystemDiagnostics } from '@/components/settings/SystemDiagnostics';
import { PasswordChangeDialog } from '@/components/settings/PasswordChangeDialog';
import { LicenseManagement } from '@/components/settings/LicenseManagement';
import { ActivationCodeInput } from '@/components/settings/ActivationCodeInput';
import { ProductFieldsSection } from '@/components/settings/ProductFieldsSection';
import { ProductFieldsConfig, loadProductFieldsConfig, saveProductFieldsConfig, getDefaultFieldsByStoreType, StoreType } from '@/lib/product-fields-config';
import { loadCustomFields } from '@/lib/custom-fields-config';
import { PREDEFINED_CURRENCIES, CURRENCY_CATEGORIES } from '@/lib/currencies';
import { getDefaultCategories } from '@/lib/store-type-config';
import { saveCategories, Category } from '@/lib/categories-store';
import DataResetSection from '@/components/settings/DataResetSection';
import { ContactLinksSection } from '@/components/settings/ContactLinksSection';
import { ProfileManagement } from '@/components/settings/ProfileManagement';
import { printHTML } from '@/lib/native-print';
import { checkNotificationPermissionNative, requestNotificationPermissionNative, sendLocalNotification } from '@/lib/native-notifications';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useUsersManagement, UserData } from '@/hooks/use-users-management';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { isGuestDemoMode } from '@/lib/demo-data';
import { emitEvent, EVENTS } from '@/lib/events';
import { saveStoreSettings, fetchStoreSettings } from '@/lib/supabase-store';
import {
  loadUnifiedStoreSettings,
  mergeStoreSettings,
  applySettingsToRuntime,
  saveUnifiedStoreSettings,
  StoreSettingsSaveStatus,
} from '@/lib/store-settings-sync';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';
import { PageHeader } from '@/components/layout/PageHeader';

export interface SettingsTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  bossOnly?: boolean;
  danger?: boolean;
  description?: string;
  category?: 'core' | 'operations' | 'support';
  badge?: string;
  color?: string;
  keywords?: string[];
}

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

// Type-safe settings interfaces
interface SyncSettingsType {
  interval: number;
  showSuccessNotification: boolean;
  showErrorNotification: boolean;
  showSyncStatus: boolean;
  lastSync: string;
  trackCapital?: boolean;
  initialCapital?: number;
}

interface NotificationSettingsType {
  masterEnabled: boolean; // مفتاح الإشعارات الرئيسي الشامل
  sound: boolean;
  newSale: boolean;
  lowStock: boolean;
  newDebt: boolean;
  paymentReceived: boolean;
  dailyReport: boolean;
  durationSeconds?: number; // وقت بقاء الإشعار بالثواني (0.5 إلى 3.0)
}

interface PrintSettingsType {
  autoPrint: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  paperSize: string;
  copies: string;
  footer: string;
  showStoreName?: boolean;
  showEmail?: boolean;
  showInvoiceNumber?: boolean;
  showDateTime?: boolean;
  showCashierName?: boolean;
  welcomeMessage?: string;
  showAlternativeCurrencies?: boolean;
}

interface BackupSettingsType {
  autoBackup: boolean;
  interval: string;
  keepDays: string;
}

export interface PersistedSettings {
  primaryCurrency?: 'USD' | 'TRY' | 'SYP';
  enabledCurrencies?: { USD: boolean; TRY: boolean; SYP: boolean };
  storeSettings?: Partial<{ name: string; type: string; phone: string; email: string; address: string; logo: string }>;
  exchangeRates?: Partial<{ USD?: number; TRY: string; SYP: string }>;
  currencyNames?: Partial<{ USD?: string; TRY?: string; SYP?: string }>;
  currencySymbols?: Partial<{ USD?: string; TRY?: string; SYP?: string }>;
  syncSettings?: Partial<SyncSettingsType>;
  notificationSettings?: Partial<NotificationSettingsType>;
  printSettings?: Partial<PrintSettingsType>;
  backupSettings?: Partial<BackupSettingsType>;
  currencySymbol?: string;
  hideMaintenanceSection?: boolean;
  taxEnabled?: boolean;
  taxRate?: number;
  discountPercentEnabled?: boolean;
  discountFixedEnabled?: boolean;
  barcodeScanMode?: 'search' | 'add';
  trackCapital?: boolean;
  initialCapital?: number;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');

  // Layout mode switcher state ('smart' | 'classic')
  const [layoutMode, setLayoutMode] = useState<'smart' | 'classic'>(() => {
    if (typeof window === 'undefined') return 'smart';
    try {
      return (localStorage.getItem('hyperpos_settings_layout_mode') as 'smart' | 'classic') || 'smart';
    } catch {
      return 'smart';
    }
  });

  const handleSwitchLayoutMode = (mode: 'smart' | 'classic') => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('hyperpos_settings_layout_mode', mode);
    } catch (e) {
      console.warn('Failed to persist layout mode:', e);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const setActiveTab = (tabId: string | null) => {
    if (tabId) {
      setSearchParams({ tab: tabId });
    } else {
      setSearchParams({});
    }
    window.scrollTo({ top: 0 });
  };
  const [isSavingUser, setIsSavingUser] = useState(false);
  const navigate = useNavigate();
  const { isBoss, isAdmin: isOwnerAdmin } = useUserRole();

  // Boss panel password verification
  const [bossPassword, setBossPassword] = useState('');
  const [showBossPassword, setShowBossPassword] = useState(false);
  const [bossPasswordError, setBossPasswordError] = useState('');
  const [isVerifyingBossPassword, setIsVerifyingBossPassword] = useState(false);

  const handleOpenBossPanel = async () => {
    if (!bossPassword || !currentUser?.email) return;
    setIsVerifyingBossPassword(true);
    setBossPasswordError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: bossPassword,
      });
      if (error) {
        setBossPasswordError(t('auth.invalidCredentials') || 'كلمة المرور غير صحيحة');
      } else {
        setBossPassword('');
        navigate('/boss');
      }
    } catch {
      setBossPasswordError('حدث خطأ أثناء التحقق');
    } finally {
      setIsVerifyingBossPassword(false);
    }
  };

  const persisted = loadPersistedSettings();
  const initialUnified = loadUnifiedStoreSettings();

  const [isSettingsReady, setIsSettingsReady] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<StoreSettingsSaveStatus | null>(null);

  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    name: initialUnified?.storeSettings?.name ?? (persisted?.storeSettings?.name ?? ''),
    type: initialUnified?.storeSettings?.type ?? (persisted?.storeSettings?.type ?? 'phones'),
    phone: initialUnified?.storeSettings?.phone ?? (persisted?.storeSettings?.phone ?? ''),
    email: initialUnified?.storeSettings?.email ?? (persisted?.storeSettings?.email ?? ''),
    address: initialUnified?.storeSettings?.address ?? (persisted?.storeSettings?.address ?? ''),
    logo: initialUnified?.storeSettings?.logo ?? (persisted?.storeSettings?.logo ?? ''),
  });

  // Tax settings
  const [taxEnabled, setTaxEnabled] = useState(initialUnified?.taxEnabled ?? (persisted?.taxEnabled ?? false));
  const [taxRate, setTaxRate] = useState(initialUnified?.taxRate ?? (persisted?.taxRate ?? 0));

  // Discount control settings
  const [discountPercentEnabled, setDiscountPercentEnabled] = useState(initialUnified?.discountPercentEnabled ?? (persisted?.discountPercentEnabled ?? true));
  const [discountFixedEnabled, setDiscountFixedEnabled] = useState(initialUnified?.discountFixedEnabled ?? (persisted?.discountFixedEnabled ?? true));
  const [barcodeScanMode, setBarcodeScanMode] = useState<'search' | 'add'>(initialUnified?.barcodeScanMode ?? (persisted?.barcodeScanMode ?? 'search'));

  // Capital tracking settings
  const [trackCapital, setTrackCapital] = useState<boolean>(
    initialUnified?.trackCapital ?? (persisted?.trackCapital ?? (persisted?.syncSettings?.trackCapital ?? false))
  );
  const [initialCapital, setInitialCapital] = useState<number>(
    initialUnified?.initialCapital ?? (persisted?.initialCapital ?? (persisted?.syncSettings?.initialCapital ?? 0))
  );

  const [notificationPerm, setNotificationPerm] = useState<string>('prompt');

  // التحقق الحقيقي من إذن الإشعارات الأصلي عند تحميل الإعدادات
  useEffect(() => {
    checkNotificationPermissionNative().then(status => {
      setNotificationPerm(status);
    }).catch(() => {});
  }, []);

  const handleRequestNotificationPermission = async () => {
    try {
      const status = await requestNotificationPermissionNative();
      setNotificationPerm(status);

      if (status === 'granted') {
        localStorage.setItem('hyperpos_notifications_enabled', 'true');
        toast({ title: '✓ تم تفعيل الإشعارات بنجاح', description: 'ستصلك تنبيهات المبيعات والديون ونفاذ المخزون' });
        // إرسال إشعار تجريبي فوري حقيقي في شريط الإشعارات
        await sendLocalNotification('FlowPOS Pro', '🎉 تنبيه تجريبي: نظام الإشعارات يعمل بنجاح!');
      } else {
        toast({
          title: 'تنبيه الأذونات',
          description: 'يرجى السماح بالإشعارات للتطبيق من إعدادات الهاتف (التطبيقات > FlowPOS Pro > الإشعارات)',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      toast({ title: 'تنبيه', description: 'يرجى مراجعة إعدادات الإشعارات في جهازك', variant: 'destructive' });
    }
  };

  const handleSendTestNotification = async () => {
    const success = await sendLocalNotification('FlowPOS Pro', '🎉 تنبيه تجريبي: نظام الإشعارات يعمل بنجاح!');
    if (success) {
      toast({
        title: '🎉 تم إرسال الإشعار التجريبي',
        description: 'تحقق من شريط إشعارات الهاتف في الأعلى',
      });
    } else {
      toast({
        title: '⚠️ لم يتم إرسال الإشعار',
        description: 'تأكد من تفعيل إذن الإشعارات للتطبيق في إعدادات الهاتف',
        variant: 'destructive',
      });
    }
  };

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

  // Enabled currencies state
  const [enabledCurrencies, setEnabledCurrencies] = useState({
    USD: initialUnified?.enabledCurrencies?.USD !== false && persisted?.enabledCurrencies?.USD !== false,
    TRY: initialUnified?.enabledCurrencies?.TRY !== false && (persisted?.enabledCurrencies?.TRY ?? true),
    SYP: initialUnified?.enabledCurrencies?.SYP !== false && (persisted?.enabledCurrencies?.SYP ?? true),
  });

  const toggleCurrency = (currency: 'USD' | 'TRY' | 'SYP', enabled: boolean) => {
    // 1. حساب العملات الجديدة
    const nextEnabled = {
      ...enabledCurrencies,
      [currency]: enabled,
    };

    // منع إيقاف جميع العملات معاً (يجب إبقاء عملة واحدة على الأقل نشطة في النظام)
    if (!nextEnabled.USD && !nextEnabled.TRY && !nextEnabled.SYP) {
      toast({
        title: 'تنبيه',
        description: 'يجب الإبقاء على عملة واحدة مفعلة على الأقل في النظام',
        variant: 'destructive',
      });
      return;
    }
    
    // 2. إذا تم إيقاف العملة الأساسية، يتم التحويل تلقائياً للعملة النشطة الأخرى
    let newPrimary = primaryCurrency;
    if (!enabled && primaryCurrency === currency) {
      if (currency === 'USD') {
        newPrimary = nextEnabled.TRY ? 'TRY' : nextEnabled.SYP ? 'SYP' : 'USD';
      } else if (currency === 'TRY') {
        newPrimary = nextEnabled.SYP ? 'SYP' : nextEnabled.USD ? 'USD' : 'TRY';
      } else if (currency === 'SYP') {
        newPrimary = nextEnabled.TRY ? 'TRY' : nextEnabled.USD ? 'USD' : 'SYP';
      }
      setPrimaryCurrency(newPrimary);
    }
    
    // 3. تحديث حالة الواجهة
    setEnabledCurrencies(nextEnabled);

    // 4. حفظ الإعدادات بالاسم الصحيح لدالة التحميل loadPersistedSettings
    const persistedSettings = loadPersistedSettings() || {};
    const updated = {
      ...persistedSettings,
      enabledCurrencies: nextEnabled,
      primaryCurrency: newPrimary,
    };

    savePersistedSettings(updated as PersistedSettings);

    // الحفظ المتزامن والموحد في الخلفية (Offline-First)
    saveUnifiedStoreSettings({
      enabledCurrencies: nextEnabled,
      primaryCurrency: newPrimary,
    }).catch(e => console.warn('[Settings] toggleCurrency unified save error:', e));

    // 5. إشعار جميع التبويبات والشاشات بالحدث الرسمي الموحد
    emitEvent(EVENTS.SETTINGS_UPDATED, updated);
  };

  // Exchange rates (string to avoid mobile keyboard/focus issues)
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'TRY' | 'SYP'>(
    (initialUnified?.primaryCurrency as 'USD' | 'TRY' | 'SYP') || persisted?.primaryCurrency || 'USD'
  );

  const [exchangeRates, setExchangeRates] = useState({
    TRY: initialUnified?.exchangeRates?.TRY ? String(initialUnified.exchangeRates.TRY) : (persisted?.exchangeRates?.TRY ?? ''),
    SYP: initialUnified?.exchangeRates?.SYP ? String(initialUnified.exchangeRates.SYP) : (persisted?.exchangeRates?.SYP ?? ''),
  });

  // Custom currency names (USD, TRY, SYP)
  const [currencyNames, setCurrencyNames] = useState({
    USD: (persisted?.currencyNames?.USD && persisted.currencyNames.USD.trim()) ? persisted.currencyNames.USD.trim() : (initialUnified?.currencyNames?.USD || 'دولار'),
    TRY: (persisted?.currencyNames?.TRY && persisted.currencyNames.TRY.trim()) ? persisted.currencyNames.TRY.trim() : (initialUnified?.currencyNames?.TRY || 'ليرة تركية'),
    SYP: (persisted?.currencyNames?.SYP && persisted.currencyNames.SYP.trim()) ? persisted.currencyNames.SYP.trim() : (initialUnified?.currencyNames?.SYP || 'ليرة سورية'),
  });

  // Custom currency symbols (USD, TRY, SYP)
  const [currencySymbols, setCurrencySymbols] = useState({
    USD: (persisted?.currencySymbols?.USD && persisted.currencySymbols.USD.trim()) ? persisted.currencySymbols.USD.trim() : (initialUnified?.currencySymbols?.USD || '$'),
    TRY: (persisted?.currencySymbols?.TRY && persisted.currencySymbols.TRY.trim()) ? persisted.currencySymbols.TRY.trim() : (initialUnified?.currencySymbols?.TRY || '₺'),
    SYP: (persisted?.currencySymbols?.SYP && persisted.currencySymbols.SYP.trim()) ? persisted.currencySymbols.SYP.trim() : (initialUnified?.currencySymbols?.SYP || 'ل.س'),
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
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsType>({
    masterEnabled: persisted?.notificationSettings?.masterEnabled ?? (initialUnified?.notificationSettings as any)?.masterEnabled ?? true,
    sound: persisted?.notificationSettings?.sound ?? (initialUnified?.notificationSettings as any)?.sound ?? true,
    newSale: persisted?.notificationSettings?.newSale ?? (initialUnified?.notificationSettings as any)?.newSale ?? true,
    lowStock: persisted?.notificationSettings?.lowStock ?? (initialUnified?.notificationSettings as any)?.lowStock ?? true,
    newDebt: persisted?.notificationSettings?.newDebt ?? (initialUnified?.notificationSettings as any)?.newDebt ?? true,
    paymentReceived: persisted?.notificationSettings?.paymentReceived ?? (initialUnified?.notificationSettings as any)?.paymentReceived ?? true,
    dailyReport: persisted?.notificationSettings?.dailyReport ?? (initialUnified?.notificationSettings as any)?.dailyReport ?? false,
    durationSeconds: persisted?.notificationSettings?.durationSeconds ?? (initialUnified?.notificationSettings as any)?.durationSeconds ?? 2,
  });

  // Printing settings
  const [printSettings, setPrintSettings] = useState({
    autoPrint: persisted?.printSettings?.autoPrint ?? (initialUnified?.printSettings as any)?.autoPrint ?? true,
    showStoreName: persisted?.printSettings?.showStoreName ?? (initialUnified?.printSettings as any)?.showStoreName ?? true,
    showLogo: persisted?.printSettings?.showLogo ?? (initialUnified?.printSettings as any)?.showLogo ?? true,
    showAddress: persisted?.printSettings?.showAddress ?? (initialUnified?.printSettings as any)?.showAddress ?? true,
    showPhone: persisted?.printSettings?.showPhone ?? (initialUnified?.printSettings as any)?.showPhone ?? true,
    showEmail: persisted?.printSettings?.showEmail ?? (initialUnified?.printSettings as any)?.showEmail ?? true,
    showInvoiceNumber: persisted?.printSettings?.showInvoiceNumber ?? (initialUnified?.printSettings as any)?.showInvoiceNumber ?? true,
    showDateTime: persisted?.printSettings?.showDateTime ?? (initialUnified?.printSettings as any)?.showDateTime ?? true,
    showCashierName: persisted?.printSettings?.showCashierName ?? (initialUnified?.printSettings as any)?.showCashierName ?? true,
    welcomeMessage: persisted?.printSettings?.welcomeMessage ?? (initialUnified?.printSettings as any)?.welcomeMessage ?? '',
    footer: persisted?.printSettings?.footer || (initialUnified?.printSettings as any)?.footer || t('settings.defaultFooter'),
    showAlternativeCurrencies: persisted?.printSettings?.showAlternativeCurrencies ?? (initialUnified?.printSettings as any)?.showAlternativeCurrencies ?? false,
    paperSize: persisted?.printSettings?.paperSize || (initialUnified?.printSettings as any)?.paperSize || '80mm',
    copies: String(persisted?.printSettings?.copies ?? (initialUnified?.printSettings as any)?.copies ?? 1),
  });

  // Users are now managed by useUsersManagement hook

  // Backups
  const [backups, setBackups] = useState<BackupData[]>([
    { id: '1', date: '2024-01-15 10:00', size: '2.5 MB', type: 'auto' },
    { id: '2', date: '2024-01-14 10:00', size: '2.4 MB', type: 'auto' },
    { id: '3', date: '2024-01-13 15:30', size: '2.3 MB', type: 'manual' },
  ]);

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: persisted?.backupSettings?.autoBackup ?? initialUnified?.backupSettings?.autoBackup ?? true,
    interval: persisted?.backupSettings?.interval ?? initialUnified?.backupSettings?.interval ?? 'daily',
    keepDays: String(persisted?.backupSettings?.keepDays ?? initialUnified?.backupSettings?.keepDays ?? 30),
  });

  // POS options
  const [hideMaintenanceSection, setHideMaintenanceSection] = useState(
    persisted?.hideMaintenanceSection ?? initialUnified?.hideMaintenanceSection ?? false
  );

  // Product fields config state (for unified save)
  const [productFieldsConfig, setProductFieldsConfig] = useState<ProductFieldsConfig | null>(() => loadProductFieldsConfig());
  const [productFieldsChanged, setProductFieldsChanged] = useState(false);

  // Floating action banner success state
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up success banner timeout on unmount
  useEffect(() => {
    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);

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
    allowedPages: [] as string[],
  });
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const userNameInputRef = useRef<HTMLInputElement>(null);
  const userEmailInputRef = useRef<HTMLInputElement>(null);
  const userPasswordInputRef = useRef<HTMLInputElement>(null);

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
          title: t('common.error'),
          description: data?.error || t('settings.transferFailed'),
          variant: 'destructive',
        });
        setIsTransferring(false);
        return;
      }

      toast({
        title: t('common.success'),
        description: t('settings.deviceUnlinked'),
      });

      // Clear all local data and force sign out
      setTransferDialogOpen(false);
      setTransferPassword('');
      localStorage.clear();
      await supabase.auth.signOut();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('settings.unexpectedError'),
        variant: 'destructive',
      });
    }
    setIsTransferring(false);
  };

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Snapshot of settings when page loads - for revert functionality
  const settingsSnapshotRef = useRef<{
    storeSettings: typeof storeSettings;
    primaryCurrency: 'USD' | 'TRY' | 'SYP';
    enabledCurrencies: typeof enabledCurrencies;
    exchangeRates: typeof exchangeRates;
    currencyNames: typeof currencyNames;
    currencySymbols: typeof currencySymbols;
    notificationSettings: typeof notificationSettings;
    printSettings: typeof printSettings;
    backupSettings: typeof backupSettings;
    hideMaintenanceSection: boolean;
    productFieldsConfig: ProductFieldsConfig | null;
    taxEnabled: boolean;
    taxRate: number;
    discountPercentEnabled: boolean;
    discountFixedEnabled: boolean;
    barcodeScanMode: 'search' | 'add';
    trackCapital?: boolean;
    initialCapital?: number;
  } | null>(null);


  // ✅ Load settings from cloud on mount to ensure persistence across reinstalls/updates
  useEffect(() => {
    let isMounted = true;
    const loadFromCloud = async () => {
      try {
        const cloudData = await fetchStoreSettings();
        if (!isMounted) return;

        const localSettings = loadUnifiedStoreSettings();
        if (cloudData) {
          const merged = mergeStoreSettings(localSettings, cloudData);

          setStoreSettings(merged.storeSettings);
          setTaxEnabled(merged.taxEnabled);
          setTaxRate(merged.taxRate);
          setNotificationSettings(merged.notificationSettings as typeof notificationSettings);
          setPrintSettings(merged.printSettings as typeof printSettings);
          setExchangeRates({
            TRY: String(merged.exchangeRates.TRY),
            SYP: String(merged.exchangeRates.SYP),
          });
          setPrimaryCurrency(merged.primaryCurrency as 'USD' | 'TRY' | 'SYP');
          setEnabledCurrencies({
            USD: merged.enabledCurrencies.USD !== false,
            TRY: merged.enabledCurrencies.TRY !== false,
            SYP: merged.enabledCurrencies.SYP !== false,
          });
          setDiscountPercentEnabled(merged.discountPercentEnabled);
          setDiscountFixedEnabled(merged.discountFixedEnabled);
          setBarcodeScanMode(merged.barcodeScanMode);
          setHideMaintenanceSection(merged.hideMaintenanceSection);
          setTrackCapital(merged.trackCapital);
          setInitialCapital(merged.initialCapital);
          setCurrencyNames({
            USD: merged.currencyNames.USD || 'دولار',
            TRY: merged.currencyNames.TRY || 'ليرة تركية',
            SYP: merged.currencyNames.SYP || 'ليرة سورية',
          });
          setCurrencySymbols({
            USD: merged.currencySymbols.USD || '$',
            TRY: merged.currencySymbols.TRY || '₺',
            SYP: merged.currencySymbols.SYP || 'ل.س',
          });
          setBackupSettings({
            autoBackup: Boolean(merged.backupSettings.autoBackup),
            interval: String(merged.backupSettings.interval || 'daily'),
            keepDays: String(merged.backupSettings.keepDays || '7'),
          });

          if (merged.productFieldsConfig) {
            setProductFieldsConfig(merged.productFieldsConfig);
          }

          applySettingsToRuntime(merged);

          // ✅ Update snapshot with the EXACT identical fresh values
          settingsSnapshotRef.current = {
            storeSettings: { ...merged.storeSettings },
            primaryCurrency: merged.primaryCurrency as 'USD' | 'TRY' | 'SYP',
            enabledCurrencies: {
              USD: merged.enabledCurrencies.USD !== false,
              TRY: merged.enabledCurrencies.TRY !== false,
              SYP: merged.enabledCurrencies.SYP !== false,
            },
            exchangeRates: {
              TRY: String(merged.exchangeRates.TRY),
              SYP: String(merged.exchangeRates.SYP),
            },
            currencyNames: {
              USD: merged.currencyNames.USD || 'دولار',
              TRY: merged.currencyNames.TRY || 'ليرة تركية',
              SYP: merged.currencyNames.SYP || 'ليرة سورية',
            },
            currencySymbols: {
              USD: merged.currencySymbols.USD || '$',
              TRY: merged.currencySymbols.TRY || '₺',
              SYP: merged.currencySymbols.SYP || 'ل.س',
            },
            notificationSettings: { ...(merged.notificationSettings as typeof notificationSettings) },
            printSettings: { ...(merged.printSettings as typeof printSettings) },
            backupSettings: {
              autoBackup: Boolean(merged.backupSettings.autoBackup),
              interval: String(merged.backupSettings.interval || 'daily'),
              keepDays: String(merged.backupSettings.keepDays || '7'),
            },
            hideMaintenanceSection: merged.hideMaintenanceSection,
            productFieldsConfig: merged.productFieldsConfig || loadProductFieldsConfig(),
            taxEnabled: merged.taxEnabled,
            taxRate: merged.taxRate,
            discountPercentEnabled: merged.discountPercentEnabled,
            discountFixedEnabled: merged.discountFixedEnabled,
            barcodeScanMode: merged.barcodeScanMode,
            trackCapital: merged.trackCapital,
            initialCapital: merged.initialCapital,
          };

          console.log('[Settings] Loaded and synced from cloud successfully');
        } else {
          // In offline mode or cloud not reachable, apply local unified settings
          applySettingsToRuntime(localSettings);
        }
      } catch (err) {
        console.warn('[Settings] Could not load from cloud, using local cache:', err);
      } finally {
        if (isMounted) {
          setIsSettingsReady(true);
        }
      }
    };

    loadFromCloud();
    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture snapshot on first render only
  useEffect(() => {
    if (!settingsSnapshotRef.current) {
      settingsSnapshotRef.current = {
        storeSettings: { ...storeSettings },
        primaryCurrency,
        enabledCurrencies: { ...enabledCurrencies },
        exchangeRates: { ...exchangeRates },
        currencyNames: { ...currencyNames },
        currencySymbols: { ...currencySymbols },
        notificationSettings: { ...notificationSettings },
        printSettings: { ...printSettings },
        backupSettings: { ...backupSettings },
        hideMaintenanceSection,
        productFieldsConfig: loadProductFieldsConfig(),
        taxEnabled,
        taxRate,
        discountPercentEnabled,
        discountFixedEnabled,
        barcodeScanMode,
        trackCapital,
        initialCapital,
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const settingsTabs: SettingsTabItem[] = useMemo(() => [
    {
      id: 'profile',
      label: t('settings.profile') || 'الملف الشخصي',
      description: isRTL ? 'إدارة الحساب وكلمة المرور' : 'Account & password',
      icon: User,
      category: 'core',
      color: 'rose',
      badge: isBoss ? 'Boss 👑' : isOwnerAdmin ? 'Owner' : 'Cashier',
      keywords: ['ملف', 'حساب', 'مستخدم', 'كلمة مرور', 'profile', 'user', 'account', 'password'],
    },
    {
      id: 'store',
      label: t('settings.store') || 'إعدادات المتجر والعملات',
      description: isRTL ? 'الهوية، الضرائب وأسعار الصرف' : 'Identity, taxes & exchange rates',
      icon: Store,
      category: 'core',
      color: 'amber',
      badge: `${primaryCurrency || 'USD'}`,
      keywords: ['متجر', 'محل', 'شعار', 'عملات', 'صرف', 'ضرائب', 'store', 'currencies', 'taxes', 'rates'],
    },
    {
      id: 'backup',
      label: t('settings.backupSync') || 'النسخ والمزامنة',
      description: isRTL ? 'نسخ احتياطي محلي وسحابي' : 'Cloud sync & local backups',
      icon: Database,
      adminOnly: true,
      category: 'core',
      color: 'blue',
      badge: syncSettings?.lastSync ? (syncSettings.lastSync.includes(' ') ? syncSettings.lastSync.split(' ')[1] : syncSettings.lastSync) : (isRTL ? 'سحابي' : 'Cloud'),
      keywords: ['نسخ', 'احتياطي', 'مزامنة', 'سحابي', 'تصدير', 'استيراد', 'backup', 'sync', 'cloud', 'import', 'export'],
    },
    {
      id: 'notifications',
      label: t('settings.notifications') || 'التنبيهات والإشعارات',
      description: isRTL ? 'صوت، مبيعات ونفاد المخزون' : 'Sounds, sales & low stock alerts',
      icon: Bell,
      category: 'core',
      color: 'purple',
      badge: notificationPerm === 'granted' ? (isRTL ? 'مفعل 🔔' : 'Active 🔔') : (isRTL ? 'تنبيه' : 'Alert'),
      keywords: ['إشعار', 'إشعارات', 'تنبيه', 'صوت', 'notifications', 'alerts', 'sound'],
    },
    {
      id: 'productFields',
      label: t('settings.productFields') || 'حقول المنتجات',
      description: isRTL ? 'تخصيص بطاقة الأصناف ومواصفاتها' : 'Custom fields for product cards',
      icon: Package,
      category: 'core',
      color: 'amber',
      badge: isRTL ? 'تخصيص' : 'Custom',
      keywords: ['حقول', 'منتجات', 'أصناف', 'بطاقة', 'fields', 'products'],
    },
    {
      id: 'printing',
      label: t('settings.printing') || 'الطباعة والمشاركة',
      description: isRTL ? 'تخصيص الفواتير والبلوتوث' : 'Receipt design & thermal printers',
      icon: Printer,
      category: 'operations',
      color: 'teal',
      badge: printSettings?.paperSize || '80mm',
      keywords: ['طباعة', 'فاتورة', 'طابعة', 'بلوتوث', 'حرارية', 'printer', 'receipt', 'print'],
    },
    {
      id: 'users',
      label: t('settings.users') || 'المستخدمين والصلاحيات',
      description: isRTL ? 'إدارة الكاشيرات وضبط الوصول' : 'Staff, cashiers & permissions',
      icon: Users,
      adminOnly: true,
      category: 'operations',
      color: 'indigo',
      badge: `${users?.length || 0} ${isRTL ? 'مستخدم' : 'users'}`,
      keywords: ['مستخدمين', 'كاشير', 'صلاحيات', 'وصول', 'users', 'roles', 'cashier'],
    },
    {
      id: 'activity',
      label: t('settings.activityLog') || 'سجل النشاط والعمليات',
      description: isRTL ? 'تدقيق الحركات والمصروفات' : 'Audit operations & activity logs',
      icon: Activity,
      bossOnly: true,
      category: 'operations',
      color: 'emerald',
      badge: isRTL ? 'تدقيق آمن' : 'Audit',
      keywords: ['نشاط', 'سجل', 'تدقيق', 'عمليات', 'حركات', 'activity', 'log', 'audit'],
    },
    {
      id: 'license',
      label: t('settings.license') || 'الترخيص وتفعيل الجهاز',
      description: isRTL ? 'كود الترخيص ونقل الرخصة' : 'Device license & activation',
      icon: Key,
      category: 'operations',
      color: 'orange',
      badge: isRTL ? 'نشط' : 'Active',
      keywords: ['ترخيص', 'تفعيل', 'كود', 'رخصة', 'license', 'activation', 'key'],
    },
    {
      id: 'licenses',
      label: t('settings.licenseManagement') || 'إدارة التراخيص',
      description: isRTL ? 'توليد الأكواد وإدارة الأجهزة' : 'Generate keys & manage devices',
      icon: Shield,
      bossOnly: true,
      danger: true,
      category: 'operations',
      color: 'rose',
      badge: 'Super Admin',
      keywords: ['تراخيص', 'توليد', 'أجهزة', 'أكواد', 'licenses', 'management'],
    },
    {
      id: 'partners',
      label: t('nav.partners') || 'الشركاء ورأس المال',
      description: isRTL ? 'حصص الأرباح والمسحوبات' : 'Partners & profit sharing',
      icon: UserCheck,
      adminOnly: true,
      category: 'operations',
      color: 'cyan',
      badge: isRTL ? 'أرباح' : 'Profits',
      keywords: ['شركاء', 'أرباح', 'رأس مال', 'مسحوبات', 'partners', 'capital'],
    },
    {
      id: 'archive',
      label: t('archive.title') || 'الأرشيف والمحذوفات',
      description: isRTL ? 'استرجاع الفواتير والديون' : 'Restore deleted invoices & debts',
      icon: Archive,
      category: 'operations',
      color: 'stone',
      badge: isRTL ? 'محفوظ' : 'Saved',
      keywords: ['أرشيف', 'محذوفات', 'استرجاع', 'فواتير', 'archive', 'deleted'],
    },
    {
      id: 'reset',
      label: t('settings.resetData') || 'تصفير البيانات',
      description: isRTL ? 'تهيئة قاعدة البيانات من الصفر' : 'Reset & clear all system data',
      icon: AlertTriangle,
      adminOnly: true,
      danger: true,
      category: 'operations',
      color: 'destructive',
      badge: '⚠️',
      keywords: ['تصفير', 'حذف', 'إعادة ضبط', 'بيانات', 'reset', 'clear', 'wipe'],
    },
    {
      id: 'contact',
      label: t('license.contactDeveloper') || 'التواصل مع المطور',
      description: isRTL ? 'واتساب، تلكرام والدعم المباشر' : 'WhatsApp, Telegram & support',
      icon: Phone,
      category: 'support',
      color: 'emerald',
      badge: isRTL ? 'مباشر' : 'Live',
      keywords: ['تواصل', 'مطور', 'دعم', 'واتساب', 'تلكرام', 'contact', 'support', 'developer'],
    },
    {
      id: 'about',
      label: isRTL ? 'حول البرنامج' : 'About',
      description: isRTL ? 'الإصدار v1.0.68 وسجل التحديثات' : 'v1.0.68 release & updates',
      icon: FileText,
      category: 'support',
      color: 'primary',
      badge: 'v1.0.68',
      keywords: ['حول', 'برنامج', 'إصدار', 'تحديث', 'نسخة', 'about', 'version'],
    },
  ], [t, isRTL, isBoss, isOwnerAdmin, primaryCurrency, syncSettings?.lastSync, notificationPerm, printSettings?.paperSize, users?.length]);

  // Independent tabs that have no saveable settings form state
  const INDEPENDENT_TABS = ['licenses', 'activity', 'backup', 'archive', 'license', 'contact', 'reset', 'about', 'users', 'partners', 'profile'];

  // Check if there are unsaved changes
  const hasUnsavedChanges = (() => {
    // Hide save bar on main screen (activeTab === null) or independent tabs
    if (!activeTab || INDEPENDENT_TABS.includes(activeTab)) return false;
    const snap = settingsSnapshotRef.current;
    if (!snap) return false;

    // Check changes ONLY for the active tab to prevent false triggers
    if (activeTab === 'store') {
      return (
        primaryCurrency !== snap.primaryCurrency ||
        JSON.stringify(enabledCurrencies) !== JSON.stringify(snap.enabledCurrencies) ||
        JSON.stringify(storeSettings) !== JSON.stringify(snap.storeSettings) ||
        JSON.stringify(exchangeRates) !== JSON.stringify(snap.exchangeRates) ||
        JSON.stringify(currencyNames) !== JSON.stringify(snap.currencyNames) ||
        JSON.stringify(currencySymbols) !== JSON.stringify(snap.currencySymbols) ||
        hideMaintenanceSection !== snap.hideMaintenanceSection ||
        taxEnabled !== snap.taxEnabled ||
        taxRate !== snap.taxRate ||
        discountPercentEnabled !== snap.discountPercentEnabled ||
        discountFixedEnabled !== snap.discountFixedEnabled ||
        barcodeScanMode !== snap.barcodeScanMode ||
        trackCapital !== snap.trackCapital ||
        initialCapital !== snap.initialCapital
      );
    }

    if (activeTab === 'productFields') {
      const isProductFieldsDirty = Boolean(
        (productFieldsConfig && !snap.productFieldsConfig) ||
        (!productFieldsConfig && snap.productFieldsConfig) ||
        (productFieldsConfig && snap.productFieldsConfig && JSON.stringify(productFieldsConfig) !== JSON.stringify(snap.productFieldsConfig))
      );
      return isProductFieldsDirty || productFieldsChanged;
    }

    if (activeTab === 'notifications') {
      return JSON.stringify(notificationSettings) !== JSON.stringify(snap.notificationSettings);
    }

    if (activeTab === 'printing') {
      return JSON.stringify(printSettings) !== JSON.stringify(snap.printSettings);
    }

    return false;
  })();

  // Revert all settings to snapshot
  const handleRevert = () => {
    const snap = settingsSnapshotRef.current;
    if (!snap) return;
    setStoreSettings({ ...snap.storeSettings });
    setPrimaryCurrency(snap.primaryCurrency ?? 'USD');
    if (snap.enabledCurrencies) {
      setEnabledCurrencies({ ...snap.enabledCurrencies });
    }
    setExchangeRates({ ...snap.exchangeRates });
    setCurrencyNames({ ...snap.currencyNames });
    setCurrencySymbols({ ...snap.currencySymbols });
    setNotificationSettings({ ...snap.notificationSettings });
    setPrintSettings({ ...snap.printSettings });
    setBackupSettings({ ...snap.backupSettings });
    setHideMaintenanceSection(snap.hideMaintenanceSection);
    setTrackCapital(snap.trackCapital ?? false);
    setInitialCapital(snap.initialCapital ?? 0);
    if (snap.productFieldsConfig) {
      setProductFieldsConfig({ ...snap.productFieldsConfig });
      localStorage.setItem('hyperpos_product_fields_v1', JSON.stringify(snap.productFieldsConfig));
      emitEvent(EVENTS.PRODUCT_FIELDS_UPDATED, snap.productFieldsConfig);
    } else {
      setProductFieldsConfig(null);
    }
    setProductFieldsChanged(false);
    setTaxEnabled(snap.taxEnabled);
    setTaxRate(snap.taxRate);
    setDiscountPercentEnabled(snap.discountPercentEnabled);
    setDiscountFixedEnabled(snap.discountFixedEnabled);
    setBarcodeScanMode(snap.barcodeScanMode);
    setIsSaveSuccess(false);
    setLastSaveStatus(null);
    if (saveSuccessTimeoutRef.current) {
      clearTimeout(saveSuccessTimeoutRef.current);
    }
    toast({
      title: t('common.success'),
      description: t('settings.changesReverted'),
    });
  };

  // Handlers
  const handleSaveSettings = async () => {
    const tryRate = Number(exchangeRates.TRY);
    const sypRate = Number(exchangeRates.SYP);
    const copies = Number(printSettings.copies);
    const keepDays = Number(backupSettings.keepDays);

    // Allow 0 or empty exchange rates (new accounts), but reject negative
    if (exchangeRates.TRY !== '' && (!Number.isFinite(tryRate) || tryRate < 0)) {
      toast({
        title: t('common.error'),
        description: t('settings.invalidExchangeRates'),
        variant: 'destructive',
      });
      return;
    }
    if (exchangeRates.SYP !== '' && (!Number.isFinite(sypRate) || sypRate < 0)) {
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

    try {
      setIsSavingSettings(true);

      const existingCustomFields = loadCustomFields();
      const existingProductFields = productFieldsConfig || loadProductFieldsConfig();

      const saveResult = await saveUnifiedStoreSettings({
        storeSettings,
        primaryCurrency,
        enabledCurrencies,
        exchangeRates: { USD: 1, TRY: tryRate, SYP: sypRate },
        currencyNames,
        currencySymbols,
        taxEnabled,
        taxRate,
        discountPercentEnabled,
        discountFixedEnabled,
        barcodeScanMode,
        hideMaintenanceSection,
        trackCapital,
        initialCapital,
        notificationSettings,
        printSettings,
        backupSettings,
        productFieldsConfig: existingProductFields,
        customFields: existingCustomFields,
      });

      localStorage.setItem('hyperpos_toast_duration', String((notificationSettings.durationSeconds || 2) * 1000));

      if (productFieldsConfig) {
        localStorage.setItem('hyperpos_product_fields_v1', JSON.stringify(productFieldsConfig));
        emitEvent(EVENTS.PRODUCT_FIELDS_UPDATED, productFieldsConfig);
      }
      setProductFieldsChanged(false);

      // Update snapshot after successful save
      settingsSnapshotRef.current = {
        storeSettings: { ...storeSettings },
        primaryCurrency,
        enabledCurrencies: { ...enabledCurrencies },
        exchangeRates: { ...exchangeRates },
        currencyNames: { ...currencyNames },
        currencySymbols: { ...currencySymbols },
        notificationSettings: { ...notificationSettings },
        printSettings: { ...printSettings },
        backupSettings: { ...backupSettings },
        hideMaintenanceSection,
        productFieldsConfig: existingProductFields ? { ...existingProductFields } : null,
        taxEnabled,
        taxRate,
        discountPercentEnabled,
        discountFixedEnabled,
        barcodeScanMode,
        trackCapital,
        initialCapital,
      };

      // Activate interactive save success state in floating action banner
      setLastSaveStatus(saveResult.status);
      setIsSaveSuccess(true);
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
      saveSuccessTimeoutRef.current = setTimeout(() => {
        setIsSaveSuccess(false);
      }, 2500);

      if (saveResult.status === 'synced') {
        toast({
          title: t('common.saved'),
          description: isRTL ? 'تم حفظ الإعدادات ومزامنتها سحابياً بنجاح ☁️' : 'Settings saved & synced to cloud successfully ☁️',
        });
      } else if (saveResult.status === 'queued') {
        toast({
          title: t('common.saved'),
          description: isRTL ? 'تم حفظ الإعدادات محلياً — بانتظار المزامنة عند توفر الاتصال ⏳' : 'Settings saved locally — queued for cloud sync ⏳',
        });
      } else {
        toast({
          title: t('common.saved'),
          description: isRTL ? 'تم حفظ الإعدادات محلياً بنجاح 💾' : 'Settings saved locally on this device 💾',
        });
      }
    } catch (err) {
      console.error('[Settings] Save error:', err);
      toast({
        title: t('common.error'),
        description: isRTL ? 'تعذر حفظ الإعدادات، يرجى المحاولة مرة أخرى' : 'Failed to save settings, please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
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
    if (isGuestDemoMode()) {
      toast({
        title: isRTL ? 'تنبيه' : 'Notice',
        description: 'إدارة الحسابات تتطلب حساباً رسمياً وغير متاحة في النسخة التجريبية',
      });
      return;
    }
    setSelectedUser(null);
    setUserForm({ name: '', email: '', password: '', phone: '', role: 'cashier', userType: 'cashier', allowedPages: [] });
    setEmailError('');
    setPasswordError('');
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: UserData) => {
    if (isGuestDemoMode()) {
      toast({
        title: isRTL ? 'تنبيه' : 'Notice',
        description: 'إدارة الحسابات تتطلب حساباً رسمياً وغير متاحة في النسخة التجريبية',
      });
      return;
    }
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
      userType: user.userType || 'cashier',
      allowedPages: user.allowedPages || [],
    });
    setEmailError('');
    setPasswordError('');
    setUserDialogOpen(true);
  };

  const handleDeleteUser = (user: UserData) => {
    if (isGuestDemoMode()) {
      toast({
        title: isRTL ? 'تنبيه' : 'Notice',
        description: 'إدارة الحسابات تتطلب حساباً رسمياً وغير متاحة في النسخة التجريبية',
      });
      return;
    }
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
    if (isGuestDemoMode()) {
      toast({
        title: isRTL ? 'تنبيه' : 'Notice',
        description: 'إدارة الحسابات تتطلب حساباً رسمياً وغير متاحة في النسخة التجريبية',
      });
      return;
    }
    setEmailError('');
    setPasswordError('');

    const trimmedName = userForm.name.trim();
    if (!trimmedName) {
      toast({
        title: t('common.error'),
        description: t('settings.enterUsername'),
        variant: "destructive",
      });
      userNameInputRef.current?.focus();
      return;
    }

    if (selectedUser) {
      setIsSavingUser(true);
      // Update existing user - update profile with name, userType, phone, and allowedPages
      const nameChanged = trimmedName !== selectedUser.name;
      const userTypeChanged = userForm.userType !== selectedUser.userType;
      const phoneChanged = userForm.phone !== (selectedUser.phone || '');
      const pagesChanged = JSON.stringify(userForm.allowedPages) !== JSON.stringify(selectedUser.allowedPages || []);

      let success = true;

      // Update profile if anything changed
      if (nameChanged || userTypeChanged || phoneChanged || pagesChanged) {
        success = await updateUserProfile(
          selectedUser.user_id,
          trimmedName,
          userForm.userType,
          userForm.phone,
          userForm.allowedPages.length > 0 ? userForm.allowedPages : null
        );
      }

      if (success) {
        setUserDialogOpen(false);
        setSelectedUser(null);
        setUserForm({ name: '', email: '', password: '', phone: '', role: 'cashier', userType: 'cashier', allowedPages: [] });
      }
      setIsSavingUser(false);
    } else {
      // Add new user - Clean inputs
      const trimmedEmail = userForm.email.trim().toLowerCase();
      const rawPassword = userForm.password;

      // Email validation: check empty and strict regex
      if (!trimmedEmail) {
        setEmailError('يرجى إدخال البريد الإلكتروني');
        toast({
          title: t('common.error'),
          description: 'يرجى إدخال البريد الإلكتروني',
          variant: "destructive",
        });
        userEmailInputRef.current?.focus();
        return;
      }

      // Regex ensures valid standard format [local]@[domain].[tld] preventing reversed formats
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(trimmedEmail)) {
        setEmailError('صيغة البريد الإلكتروني غير صالحة (مثال: user@example.com)');
        toast({
          title: t('common.error'),
          description: 'صيغة البريد الإلكتروني غير صالحة، تأكد من كتابة البريد بشكل صحيح',
          variant: "destructive",
        });
        userEmailInputRef.current?.focus();
        return;
      }

      // Password validation: check empty and minimum length
      if (!rawPassword) {
        setPasswordError('يرجى إدخال كلمة المرور');
        toast({
          title: t('common.error'),
          description: 'يرجى إدخال كلمة المرور',
          variant: "destructive",
        });
        userPasswordInputRef.current?.focus();
        return;
      }

      if (rawPassword.length < 6) {
        setPasswordError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل');
        toast({
          title: t('common.error'),
          description: t('settings.passwordTooShort') || 'كلمة المرور يجب أن لا تقل عن 6 أحرف',
          variant: "destructive",
        });
        userPasswordInputRef.current?.focus();
        return;
      }

      setIsSavingUser(true);

      const success = await addUser(
        trimmedEmail,
        rawPassword,
        trimmedName,
        userForm.role,
        userForm.userType,
        userForm.phone?.trim() || undefined,
        userForm.allowedPages.length > 0 ? userForm.allowedPages : undefined
      );

      if (success) {
        setUserDialogOpen(false);
        setUserForm({ name: '', email: '', password: '', phone: '', role: 'cashier', userType: 'cashier', allowedPages: [] });
      }

      setIsSavingUser(false);
    }
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
        type BackupPayload = {
          version?: string;
          exportedAt?: string;
          localStorageData?: Record<string, unknown>;
          settings?: {
            storeSettings?: typeof storeSettings;
            exchangeRates?: typeof exchangeRates;
            syncSettings?: typeof syncSettings;
            notificationSettings?: typeof notificationSettings;
            printSettings?: typeof printSettings;
            backupSettings?: typeof backupSettings;
          };
          backups?: BackupData[];
        };
        let data: BackupPayload;
        try {
          data = JSON.parse(fileContent) as BackupPayload;
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

        // Apply settings directly to runtime
        const updatedUnified = loadUnifiedStoreSettings();
        applySettingsToRuntime(updatedUnified);

        // Dispatch standardized events to update all components
        emitEvent(EVENTS.CUSTOMERS_UPDATED);
        emitEvent(EVENTS.DEBTS_UPDATED);
        emitEvent(EVENTS.INVOICES_UPDATED);
        emitEvent(EVENTS.PRODUCTS_UPDATED);
        emitEvent(EVENTS.PARTNERS_UPDATED);
        emitEvent(EVENTS.EXPENSES_UPDATED);

        toast({
          title: t('settings.restoreComplete'),
          description: t('localBackup.restoreSuccess') || t('settings.restoreComplete'),
        });
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

  const handleTestPrint = async () => {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('ar-SA');
      const timeStr = now.toLocaleTimeString('ar-SA');
      const storeName = storeSettings.name || 'FlowPOS Pro';
      const storePhone = storeSettings.phone || '';
      const storeAddress = storeSettings.address || '';
      const paperSize = printSettings.paperSize || '80mm';
      const copies = printSettings.copies || '1';
      const footer = printSettings.footer || 'شكراً لتسوقكم معنا!';

      const testContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فحص الطابعة - ${storeName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', system-ui, sans-serif; }
            body { width: ${paperSize === '58mm' ? '54mm' : paperSize === 'A4' ? '210mm' : '76mm'}; margin: 0 auto; padding: 8px; font-size: 12px; color: #000; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
            .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .badge { display: inline-block; background: #000; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin: 4px 0; }
            .info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { padding: 4px; text-align: right; border-bottom: 1px dotted #ccc; font-size: 11px; }
            th { border-bottom: 1px solid #000; font-weight: bold; }
            .total-box { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin: 8px 0; text-align: center; font-weight: bold; font-size: 14px; }
            .footer { text-align: center; font-size: 11px; margin-top: 8px; color: #444; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${storeName}</div>
            ${storeAddress ? '<div>' + storeAddress + '</div>' : ''}
            ${storePhone ? '<div>هاتف: ' + storePhone + '</div>' : ''}
            <div class="badge">تجربة فحص الطابعة / TEST PRINT</div>
          </div>
          <div class="info-row"><span>التاريخ:</span><span>${dateStr}</span></div>
          <div class="info-row"><span>الوقت:</span><span>${timeStr}</span></div>
          <div class="info-row"><span>مقاس الورق:</span><span>${paperSize}</span></div>
          <div class="info-row"><span>عدد النسخ:</span><span>${copies}</span></div>
          <table>
            <thead>
              <tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr>
            </thead>
            <tbody>
              <tr><td>صنف فحص تجريبي أ</td><td>1</td><td>$10.00</td></tr>
              <tr><td>صنف فحص تجريبي ب</td><td>2</td><td>$20.00</td></tr>
            </tbody>
          </table>
          <div class="total-box">
            الإجمالي التجريبي: $30.00
          </div>
          <div class="footer">
            <p>${footer}</p>
            <p style="margin-top: 4px; font-size: 9px; color: #888;">FlowPOS Pro • فحص استجابة الطابعة ناجح</p>
          </div>
        </body>
        </html>
      `;

      await printHTML(testContent);
      toast({
        title: '✓ تم إرسال الطباعة التجريبية',
        description: 'جاري تمرير الفاتورة التجريبية إلى الطابعة المحددة',
      });
    } catch (err) {
      console.error('Test print failed:', err);
      toast({
        title: 'خطأ في الطباعة',
        description: 'تعذر إرسال أمر الطباعة، يرجى التأكد من اتصال الطابعة',
        variant: 'destructive'
      });
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileManagement />;
      case 'productFields':
        return (
          <ProductFieldsSection
            storeType={storeSettings.type}
            onConfigChange={(config) => {
              setProductFieldsConfig(config);
              setProductFieldsChanged(true);
            }}
            pendingConfig={productFieldsConfig}
          />
        );
      case 'language':
        return <LanguageSection />;
      // تم نقل theme إلى صفحة /appearance
      case 'activity':
        return <ActivityLogSection />;
      case 'store':
        return (
          <div className="space-y-4">
            <Tabs defaultValue="info">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="info" className="flex-1">{t('settings.storeInfoTab') || 'معلومات المتجر'}</TabsTrigger>
                <TabsTrigger value="finance" className="flex-1">{t('settings.financeTab') || 'العملات والضرائب'}</TabsTrigger>
              </TabsList>

              {/* التبويب الفرعي 1: معلومات المتجر */}
              <TabsContent value="info" className="space-y-4 mt-0">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-foreground mb-3">{t('settings.storeInfo')}</h2>

                  {/* Setup Wizard Quick Launcher */}
                  <div className="p-3 mb-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">معالج الترحيب والإعداد الأولي</p>
                        <p className="text-[11px] text-muted-foreground">تهيئة هوية المتجر والعملات والضرائب والشركاء والمظهر خطوة بخطوة</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/10 shrink-0 font-bold"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('hyperpos:open-setup-wizard'));
                      }}
                    >
                      تشغيل المعالج
                    </Button>
                  </div>

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
                        <option value="restaurant">{t('settings.storeTypes.restaurant')}</option>
                        <option value="bakery">{t('settings.storeTypes.bakery')}</option>
                        <option value="repair">{t('settings.storeTypes.repair')}</option>
                        <option value="bookstore">{t('settings.storeTypes.bookstore')}</option>
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
                          <Upload className="w-4 h-4" />
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
                      <span className="text-sm font-medium">{t('settings.hideMaintenanceSection')}</span>
                    </div>
                    <Switch
                      checked={hideMaintenanceSection}
                      onCheckedChange={(checked) => {
                        setHideMaintenanceSection(checked);
                      }}
                    />
                  </div>
                )}

                {/* Language Section */}
                <div className="border-t border-border pt-2">
                  <LanguageSection />
                </div>

                {/* Barcode behavior */}
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-base font-semibold text-foreground">{isRTL ? 'سلوك قراءة الباركود' : 'Barcode scan behavior'}</h3>
                  </div>
                  <Tabs value={barcodeScanMode} onValueChange={(value) => {
                    const mode = value === 'add' ? 'add' : 'search';
                    setBarcodeScanMode(mode);
                  }}>
                    <TabsList className="grid h-auto w-full grid-cols-2">
                      <TabsTrigger value="search" className="min-h-10 whitespace-normal text-xs">
                        {isRTL ? 'عرض المنتج' : 'Show product'}
                      </TabsTrigger>
                      <TabsTrigger value="add" className="min-h-10 whitespace-normal text-xs">
                        {isRTL ? 'إضافة مباشرة للسلة' : 'Add directly to cart'}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'في وضع الإضافة المباشرة، كل تمرير جديد يزيد الكمية قطعة واحدة.' : 'In direct-add mode, every new scan adds one item.'}
                  </p>
                </div>

                {/* نص توضيحي لمعلومات المتجر */}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground text-start">
                    {isRTL ? 'تظهر هذه البيانات على رأس الفواتير والتقارير' : 'This info appears on invoices & receipts'}
                  </p>
                </div>
              </TabsContent>

              {/* التبويب الفرعي 2: العملات والضرائب */}
              <TabsContent value="finance" className="space-y-4 mt-0">
                {/* قسم العملة وأسعار الصرف */}
                <div className="space-y-4 rounded-xl border border-border/80 bg-card/60 p-4 md:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Coins className="w-5 h-5 text-primary" />
                        {t('settings.exchangeRates')} والعملة الافتراضية
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        اختر العملة الرئيسية التي ستظهر بها أسعار البيع والشراء وسلة الكاشير افتراضياً
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit text-xs px-2.5 py-1 font-semibold border-primary/30 text-primary bg-primary/10">
                      العملة النشطة حالياً: {primaryCurrency}
                    </Badge>
                  </div>

                  {/* بطاقات العملات الثلاث باختيار راديو ومفاتيح التفعيل */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                    
                    {/* 1. الدولار الأمريكي USD */}
                    <div
                      onClick={() => {
                        if (enabledCurrencies.USD !== false) {
                          setPrimaryCurrency('USD');
                        } else {
                          toast({ title: 'العملة معطلة', description: 'يجب تفعيل عرض الدولار الأمريكي أولاً لاختياره كعملة افتراضية' });
                        }
                      }}
                      className={cn(
                        "relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer",
                        enabledCurrencies.USD === false && "opacity-60 border-dashed border-border/60 bg-muted/10",
                        primaryCurrency === 'USD'
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 hover:border-primary/40 bg-card hover:bg-muted/20"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center font-black text-base",
                            primaryCurrency === 'USD' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            $
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground">الدولار الأمريكي</h4>
                            <span className="text-[11px] text-muted-foreground font-mono">USD</span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          primaryCurrency === 'USD' ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        )}>
                          {primaryCurrency === 'USD' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px] font-medium bg-muted/60 text-muted-foreground">
                            مرجع محاسبي (1.00 $)
                          </Badge>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-medium text-foreground">عرض في الواجهة:</span>
                            <Switch
                              checked={enabledCurrencies.USD !== false}
                              onCheckedChange={(val) => toggleCurrency('USD', val)}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                          يبقى الدولار المرجع المحاسبي في قاعدة البيانات حتى عند إخفائه من نقاط البيع والفواتير.
                        </p>
                      </div>
                    </div>

                    {/* 2. العملة الإضافية 1 (Slot 1) */}
                    <div
                      onClick={() => {
                        if (enabledCurrencies.TRY) {
                          setPrimaryCurrency('TRY');
                        } else {
                          toast({ title: isRTL ? 'العملة معطلة' : 'Currency Disabled', description: isRTL ? 'يجب تفعيل هذه العملة أولاً لاختيارها كعملة افتراضية' : 'Must enable this currency first' });
                        }
                      }}
                      className={cn(
                        "relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer",
                        !enabledCurrencies.TRY && "opacity-60 border-dashed border-border/60 bg-muted/10",
                        primaryCurrency === 'TRY'
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 hover:border-primary/40 bg-card hover:bg-muted/20"
                      )}
                    >
                      <div>
                        {/* Header: Icon + Predefined Dropdown + Radio */}
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs",
                            primaryCurrency === 'TRY' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {currencySymbols.TRY || '₺'}
                          </div>

                          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                              {isRTL ? 'قائمة العملات الجاهزة (27 عملة):' : 'Predefined currencies (27):'}
                            </label>
                            <select
                              value={PREDEFINED_CURRENCIES.find(c => c.symbol === currencySymbols.TRY && c.name === currencyNames.TRY)?.code || ''}
                              onChange={(e) => {
                                const selected = PREDEFINED_CURRENCIES.find(c => c.code === e.target.value);
                                if (selected) {
                                  setCurrencySymbols(prev => ({ ...prev, TRY: selected.symbol }));
                                  setCurrencyNames(prev => ({ ...prev, TRY: isRTL ? selected.name : selected.nameEn }));
                                  if (selected.suggestedRate) {
                                    setExchangeRates(prev => ({ ...prev, TRY: String(selected.suggestedRate) }));
                                  }
                                }
                              }}
                              className="w-full h-8 px-2 rounded-lg bg-background border border-border/80 text-foreground text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-hidden"
                            >
                              <option value="" disabled>{isRTL ? 'اختر عملة لتعبئة البيانات تلقائياً...' : 'Choose predefined...'}</option>
                              {CURRENCY_CATEGORIES.map(category => (
                                <optgroup key={category.id} label={isRTL ? category.label : category.labelEn}>
                                  {PREDEFINED_CURRENCIES.filter(c => c.category === category.id).map(c => (
                                    <option key={c.code} value={c.code}>
                                      {c.code} - {isRTL ? c.name : c.nameEn} ({c.symbol})
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-1",
                            primaryCurrency === 'TRY' ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                          )}>
                            {primaryCurrency === 'TRY' && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Custom Name & Symbol Inputs */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold block mb-1">
                              {isRTL ? 'اسم العملة:' : 'Name:'}
                            </span>
                            <Input
                              value={currencyNames.TRY}
                              onChange={(e) => setCurrencyNames({ ...currencyNames, TRY: e.target.value })}
                              className="h-7 text-xs font-bold px-2 bg-background/80"
                              placeholder={isRTL ? "مثال: ليرة تركية" : "e.g. Turkish Lira"}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold block mb-1">
                              {isRTL ? 'رمز العملة:' : 'Symbol:'}
                            </span>
                            <Input
                              value={currencySymbols.TRY}
                              onChange={(e) => setCurrencySymbols({ ...currencySymbols, TRY: e.target.value })}
                              className="h-7 text-xs font-bold px-2 bg-background/80 font-mono"
                              placeholder={isRTL ? "مثال: ₺ أو ر.س" : "e.g. ₺ or SAR"}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Exchange Rate & Toggle Switch */}
                      <div className="mt-3 pt-3 border-t border-border/40 space-y-2.5">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{isRTL ? 'سعر الصرف ($1 =):' : 'Exchange Rate ($1 =):'}</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={exchangeRates.TRY}
                            onChange={(e) => setExchangeRates({ ...exchangeRates, TRY: sanitizeNumberText(e.target.value) })}
                            className="h-7 text-xs font-mono font-bold px-2 bg-background/80"
                            placeholder="34"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs font-medium text-foreground">{isRTL ? 'تفعيل العملة:' : 'Enable Currency:'}</span>
                          <Switch
                            checked={enabledCurrencies.TRY}
                            onCheckedChange={(val) => toggleCurrency('TRY', val)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. العملة الإضافية 2 (Slot 2) */}
                    <div
                      onClick={() => {
                        if (enabledCurrencies.SYP) {
                          setPrimaryCurrency('SYP');
                        } else {
                          toast({ title: isRTL ? 'العملة معطلة' : 'Currency Disabled', description: isRTL ? 'يجب تفعيل هذه العملة أولاً لاختيارها كعملة افتراضية' : 'Must enable this currency first' });
                        }
                      }}
                      className={cn(
                        "relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer",
                        !enabledCurrencies.SYP && "opacity-60 border-dashed border-border/60 bg-muted/10",
                        primaryCurrency === 'SYP'
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 hover:border-primary/40 bg-card hover:bg-muted/20"
                      )}
                    >
                      <div>
                        {/* Header: Icon + Predefined Dropdown + Radio */}
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs",
                            primaryCurrency === 'SYP' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {currencySymbols.SYP || 'ل.س'}
                          </div>

                          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                              {isRTL ? 'قائمة العملات الجاهزة (27 عملة):' : 'Predefined currencies (27):'}
                            </label>
                            <select
                              value={PREDEFINED_CURRENCIES.find(c => c.symbol === currencySymbols.SYP && c.name === currencyNames.SYP)?.code || ''}
                              onChange={(e) => {
                                const selected = PREDEFINED_CURRENCIES.find(c => c.code === e.target.value);
                                if (selected) {
                                  setCurrencySymbols(prev => ({ ...prev, SYP: selected.symbol }));
                                  setCurrencyNames(prev => ({ ...prev, SYP: isRTL ? selected.name : selected.nameEn }));
                                  if (selected.suggestedRate) {
                                    setExchangeRates(prev => ({ ...prev, SYP: String(selected.suggestedRate) }));
                                  }
                                }
                              }}
                              className="w-full h-8 px-2 rounded-lg bg-background border border-border/80 text-foreground text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-hidden"
                            >
                              <option value="" disabled>{isRTL ? 'اختر عملة لتعبئة البيانات تلقائياً...' : 'Choose predefined...'}</option>
                              {CURRENCY_CATEGORIES.map(category => (
                                <optgroup key={category.id} label={isRTL ? category.label : category.labelEn}>
                                  {PREDEFINED_CURRENCIES.filter(c => c.category === category.id).map(c => (
                                    <option key={c.code} value={c.code}>
                                      {c.code} - {isRTL ? c.name : c.nameEn} ({c.symbol})
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-1",
                            primaryCurrency === 'SYP' ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                          )}>
                            {primaryCurrency === 'SYP' && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Custom Name & Symbol Inputs */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold block mb-1">
                              {isRTL ? 'اسم العملة:' : 'Name:'}
                            </span>
                            <Input
                              value={currencyNames.SYP}
                              onChange={(e) => setCurrencyNames({ ...currencyNames, SYP: e.target.value })}
                              className="h-7 text-xs font-bold px-2 bg-background/80"
                              placeholder={isRTL ? "مثال: ليرة سورية" : "e.g. Syrian Pound"}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold block mb-1">
                              {isRTL ? 'رمز العملة:' : 'Symbol:'}
                            </span>
                            <Input
                              value={currencySymbols.SYP}
                              onChange={(e) => setCurrencySymbols({ ...currencySymbols, SYP: e.target.value })}
                              className="h-7 text-xs font-bold px-2 bg-background/80 font-mono"
                              placeholder={isRTL ? "مثال: ل.س أو د.ع" : "e.g. SYP or IQD"}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Exchange Rate & Toggle Switch */}
                      <div className="mt-3 pt-3 border-t border-border/40 space-y-2.5">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{isRTL ? 'سعر الصرف ($1 =):' : 'Exchange Rate ($1 =):'}</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={exchangeRates.SYP}
                            onChange={(e) => setExchangeRates({ ...exchangeRates, SYP: sanitizeNumberText(e.target.value) })}
                            className="h-7 text-xs font-mono font-bold px-2 bg-background/80"
                            placeholder="14500"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs font-medium text-foreground">{isRTL ? 'تفعيل العملة:' : 'Enable Currency:'}</span>
                          <Switch
                            checked={enabledCurrencies.SYP}
                            onCheckedChange={(val) => toggleCurrency('SYP', val)}
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Tax Settings */}
                <div className="pt-2 border-t border-border space-y-3">
                  <h3 className="text-base font-semibold text-foreground">{t('settings.tax') || 'الضريبة'}</h3>
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('settings.enableTax') || 'تفعيل الضريبة'}</span>
                    </div>
                    <Switch
                      checked={taxEnabled}
                      onCheckedChange={(checked) => {
                        setTaxEnabled(checked);
                      }}
                    />
                  </div>
                  {taxEnabled && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('settings.taxRate') || 'نسبة الضريبة'}</label>
                      <div className="relative flex-1">
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={taxRate || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTaxRate(val);
                          }}
                          className="pr-10 bg-muted border-0 h-9 text-sm"
                          placeholder="15"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Discount Control Settings */}
                <div className="pt-2 border-t border-border space-y-3">
                  <h3 className="text-base font-semibold text-foreground">{t('settings.discountControl') || 'التحكم بالخصومات'}</h3>
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('settings.enablePercentDiscount') || 'خصم النسبة المئوية'}</span>
                    </div>
                    <Switch
                      checked={discountPercentEnabled}
                      onCheckedChange={(checked) => {
                        setDiscountPercentEnabled(checked);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('settings.enableFixedDiscount') || 'خصم المبلغ الثابت'}</span>
                    </div>
                    <Switch
                      checked={discountFixedEnabled}
                      onCheckedChange={(checked) => {
                        setDiscountFixedEnabled(checked);
                      }}
                    />
                  </div>
                </div>

                {/* Capital & Liquidity Tracking Section */}
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <div>
                        <span className="text-sm font-medium block">
                          {isRTL ? 'تتبع رأس المال والسيولة' : 'Track Capital & Liquidity'}
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          {isRTL 
                            ? (trackCapital ? 'وضع تتبع رأس المال التأسيسي وحركة السيولة النقدية' : 'وضع بدون رأس مال (تدفق نقدي بسيط)') 
                            : (trackCapital ? 'Track initial capital and liquid cash movement' : 'Simple cash flow mode')}
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={trackCapital}
                      onCheckedChange={(checked) => {
                        setTrackCapital(checked);
                      }}
                    />
                  </div>
                  {trackCapital && (
                    <div className="space-y-1 bg-muted/40 p-3 rounded-xl border border-border/60">
                      <label className="text-sm font-medium text-foreground block">
                        {isRTL ? 'رأس المال التأسيسي للمحل ($)' : 'Initial Store Capital ($)'}
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={initialCapital || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                            setInitialCapital(val);
                          }}
                          className="pr-10 bg-background border-border/80 h-9 text-sm"
                          placeholder="0.00"
                          min="0"
                          step="any"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL 
                          ? 'يُضاف هذا المبلغ تلقائياً إلى رؤوس أموال الشركاء إن وجدوا لاحتساب إجمالي رأس المال والسيولة المتاحة.'
                          : 'This amount is combined with partners capital (if any) to calculate total capital and available liquidity.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* نص توضيحي للعملات والضرائب */}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground text-start">
                    {isRTL ? 'تُطبق أسعار الصرف ونسب الضريبة والخصومات فوراً في الكاشير' : 'Rates and discounts apply immediately to POS'}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        );

      // currencies tab removed - now inside store tab

      // sync tab merged into backup below

      case 'notifications':
        return (
          <div className="space-y-3">
            {/* بطاقة حالة إذن النظام */}
            {notificationPerm === 'granted' ? (
              <div className="flex items-center justify-between gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">الإشعارات مفعلة وتعمل بنجاح</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">التطبيق جاهز لإرسال تنبيهات المبيعات والديون ونفاذ المخزون</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleSendTestNotification} className="shrink-0 h-8 px-2.5 text-xs font-semibold">
                  إشعار تجريبي
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3.5 bg-primary/10 border border-primary/25 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 animate-bounce" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-foreground">تفعيل إذن الإشعارات</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">اضغط لمنح إذن وصول تنبيهات البيع والمخزون</p>
                  </div>
                </div>
                <Button size="sm" onClick={handleRequestNotificationPermission} className="shrink-0 h-8 px-3 text-xs font-semibold">
                  تفعيل الآن
                </Button>
              </div>
            )}

            {/* المفتاح الرئيسي الشامل للإشعارات */}
            <div className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 transition-colors ${
              notificationSettings.masterEnabled
                ? 'bg-primary/5 border-primary/30'
                : 'bg-muted/50 border-border'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  notificationSettings.masterEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {notificationSettings.masterEnabled ? 'الإشعارات مفعلة' : 'الإشعارات معطلة'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {notificationSettings.masterEnabled
                      ? 'سيتم إرسال جميع التنبيهات المحددة'
                      : 'لن تصلك أي تنبيهات حتى تعيد التفعيل'}
                  </p>
                </div>
              </div>
              <Switch
                checked={notificationSettings.masterEnabled}
                onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, masterEnabled: checked })}
              />
            </div>

            {/* خيارات التحكم التفصيلية */}
            <div className={`bg-card/80 dark:bg-card/40 rounded-2xl border border-border/50 divide-y divide-border/40 overflow-hidden transition-opacity ${
              notificationSettings.masterEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}>
              <div className="px-4 py-3 bg-muted/20">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('settings.notifications')}</h2>
              </div>
              {/* الصوت */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {notificationSettings.sound ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground block">{t('settings.sound')}</span>
                    <span className="text-xs text-muted-foreground block">
                      {notificationSettings.sound ? 'تشغيل نغمة عند وصول التنبيه' : 'كتم الصوت'}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.sound}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, sound: checked })}
                />
              </div>
              {[
                { key: 'newSale', label: t('settings.newSale'), desc: 'إشعار فوري عند تسجيل فاتورة جديدة', icon: CheckCircle2 },
                { key: 'lowStock', label: t('settings.lowStock'), desc: 'تنبيه عند اقتراب نفاذ كميات الأصناف', icon: AlertCircle },
                { key: 'newDebt', label: t('settings.newDebt'), desc: 'إشعار عند إضافة دين أو ذمة مالية', icon: FileText },
                { key: 'paymentReceived', label: t('settings.paymentReceived'), desc: 'إشعار عند تسجيل دفعة أو سداد نقدي', icon: DollarSign },
                { key: 'dailyReport', label: t('settings.dailyReport'), desc: 'ملخص بالأداء والمبيعات نهاية اليوم', icon: Clock },
              ].map((item) => {
                const isChecked = notificationSettings[item.key as keyof NotificationSettingsType] as boolean;
                return (
                  <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-foreground block">{item.label}</span>
                        <span className="text-xs text-muted-foreground block">{isChecked ? 'مفعل' : 'معطل'} • {item.desc}</span>
                      </div>
                    </div>
                    <Switch
                      checked={isChecked}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [item.key]: checked })}
                    />
                  </div>
                );
              })}

              {/* وقت بقاء الإشعار على الشاشة (من نصف ثانية إلى 3 ثواني) */}
              <div className="px-4 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground block">وقت بقاء الإشعار</span>
                      <span className="text-xs text-muted-foreground block">
                        المدة الزمنية لظهور الإشعار على الشاشة قبل الانكماش التلقائي (من 0.5 إلى 3 ثواني)
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                    {notificationSettings.durationSeconds ?? 2} ثانية
                  </span>
                </div>
                <div dir="ltr" className="space-y-1.5 pt-1 px-1">
                  <Slider
                    value={[notificationSettings.durationSeconds ?? 2]}
                    onValueChange={([val]) => {
                      setNotificationSettings({ ...notificationSettings, durationSeconds: val });
                      localStorage.setItem('hyperpos_toast_duration', String(val * 1000));
                    }}
                    min={0.5}
                    max={3}
                    step={0.5}
                    className="w-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                    <span>0.5s (خاطف)</span>
                    <span>1.5s (متوسط)</span>
                    <span>3.0s (أطول)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'printing':
        return (
          <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-5">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">{t('settings.printing')}</h2>
              <p className="text-xs text-muted-foreground">تخصيص بنود وقالب الفاتورة، مفاتيح الإظهار، والعملات البديلة للطباعة والمشاركة</p>
            </div>

            {/* إعدادات الطابعة العامة */}
            <div className="space-y-3 pt-1 border-t border-border/40">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">إعدادات الطابعة</h3>
              
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-sm font-medium block">{t('settings.autoPrint')}</span>
                  <span className="text-xs text-muted-foreground">طباعة الإيصال تلقائياً فور تأكيد البيع</span>
                </div>
                <Switch
                  checked={printSettings.autoPrint}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, autoPrint: checked })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 shrink-0">{t('settings.paperSize')}</label>
                  <select
                    value={printSettings.paperSize}
                    onChange={(e) => setPrintSettings({ ...printSettings, paperSize: e.target.value })}
                    className="flex-1 h-9 px-3 rounded-lg bg-card border border-border/60 text-foreground text-sm"
                  >
                    <option value="58mm">58mm (طابعة صغيرة)</option>
                    <option value="80mm">80mm (طابعة قياسية)</option>
                    <option value="A4">A4 (ورق قياسي)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground w-24 sm:w-20 shrink-0">{t('settings.copies')}</label>
                  <Input
                    type="number"
                    value={printSettings.copies}
                    onChange={(e) => setPrintSettings({ ...printSettings, copies: e.target.value })}
                    min="1"
                    max="5"
                    className="bg-card border border-border/60 h-9 flex-1"
                  />
                </div>
              </div>
            </div>

            {/* تخصيص بنود الفاتورة */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">تخصيص بنود وبيانات الفاتورة</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار اسم المتجر</span>
                  <Switch
                    checked={printSettings.showStoreName}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showStoreName: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار الشعار (Logo)</span>
                  <Switch
                    checked={printSettings.showLogo}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showLogo: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار العنوان</span>
                  <Switch
                    checked={printSettings.showAddress}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showAddress: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار رقم الهاتف</span>
                  <Switch
                    checked={printSettings.showPhone}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showPhone: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار البريد الإلكتروني</span>
                  <Switch
                    checked={printSettings.showEmail}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showEmail: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار رقم الفاتورة</span>
                  <Switch
                    checked={printSettings.showInvoiceNumber}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showInvoiceNumber: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار التاريخ والوقت</span>
                  <Switch
                    checked={printSettings.showDateTime}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showDateTime: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-sm font-medium">إظهار اسم الكاشير / البائع</span>
                  <Switch
                    checked={printSettings.showCashierName}
                    onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showCashierName: checked })}
                  />
                </div>
              </div>
            </div>

            {/* معادلات العملات البديلة في الفاتورة */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between p-3 rounded-lg bg-card/70 border border-primary/20">
                <div>
                  <span className="text-sm font-bold block text-foreground">إظهار المجموع بالعملات البديلة</span>
                  <span className="text-xs text-muted-foreground">
                    احتساب وعرض المعادل تلقائياً (مثل SYP و TRY) تحت إجمالي الفاتورة لأغراض الطباعة والمشاركة فقط
                  </span>
                </div>
                <Switch
                  checked={printSettings.showAlternativeCurrencies}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showAlternativeCurrencies: checked })}
                />
              </div>
            </div>

            {/* نصوص الفاتورة */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">رسائل ونصوص الفاتورة</h3>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">الكلمة الترحيبية (أعلى الفاتورة)</label>
                <Input
                  value={printSettings.welcomeMessage}
                  onChange={(e) => setPrintSettings({ ...printSettings, welcomeMessage: e.target.value })}
                  placeholder="مثال: أهلاً وسهلاً بكم في متجرنا"
                  className="bg-card border border-border/60 h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">{t('settings.receiptFooter')} (خاتمة الفاتورة)</label>
                <Input
                  value={printSettings.footer}
                  onChange={(e) => setPrintSettings({ ...printSettings, footer: e.target.value })}
                  placeholder="مثال: شكراً لتسوقكم معنا! بضاعتكم أمانة لدينا"
                  className="bg-card border border-border/60 h-9"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={handleTestPrint} className="w-full sm:w-auto">
                <Printer className="w-4 h-4" />
                {t('settings.testPrint')}
              </Button>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-4">
            {isGuestDemoMode() && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>إدارة الحسابات وتعيين كلمات المرور تتطلب حساباً رسمياً وغير متاحة في النسخة التجريبية.</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">{t('settings.userManagement')}</h2>
              <Button onClick={handleAddUser} className="w-full sm:w-auto h-9">
                <Plus className="w-4 h-4" />
                {t('settings.addUser')}
              </Button>
            </div>
            <div className="space-y-2.5">
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                  {t('common.loading')}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl p-4">
                  {t('settings.noUsers')}
                </div>
              ) : (
                users
                  .filter((user) => user.role !== 'boss') // Hide boss accounts from this list
                  .map((user) => (
                    <div key={user.id} className="flex flex-col gap-2 p-3.5 bg-muted/40 rounded-xl border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-sm truncate">{user.name}</p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground truncate font-mono">{user.email}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user.role === 'admin' ? t('settings.userTypeOwner') :
                              user.userType === 'distributor' ? t('settings.userTypeDistributor') :
                                user.userType === 'pos' ? t('settings.userTypePOS') :
                                  t('settings.cashier')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 border-t border-border/40 pt-2">
                        {(!user.isOwner || isBoss || user.role === 'cashier') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-colors font-medium shadow-none"
                            onClick={() => {
                              if (isGuestDemoMode()) {
                                toast({
                                  title: isRTL ? 'تنبيه' : 'Notice',
                                  description: 'إدارة الحسابات تتطلب حساباً رسمياً وغير متاحة في النسخة التجريبية',
                                });
                                return;
                              }
                              setPasswordChangeUserId(user.user_id || user.id);
                              setSelectedUser(user);
                              setPasswordDialogOpen(true);
                            }}
                            title={isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
                          >
                            <Key className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{isRTL ? 'كلمة المرور' : t('settings.password')}</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="flex-1 h-8 gap-1 text-xs" onClick={() => handleEditUser(user)}>
                          <Edit className="w-3 h-3" />
                          <span>{t('common.edit')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-8 gap-1 text-xs text-destructive"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.user_id === currentUser?.id || user.isOwner}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t('common.delete')}</span>
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
          <div className="space-y-4 overflow-hidden">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {t('settings.backupSync')}
            </h2>

            {/* Backup & Import */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button size="sm" onClick={handleBackupNow} disabled={isBackingUp} className="w-full h-9">
                {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
                <span className="text-xs">{t('settings.downloadBackup')}</span>
              </Button>
              <div className="w-full">
                <input type="file" accept=".json,application/json,text/plain" onChange={handleImportBackup} className="hidden" id="import-backup" ref={importInputRef} />
                <label htmlFor="import-backup" className="w-full block">
                  <Button variant="outline" size="sm" className="w-full h-9" asChild disabled={isImporting}>
                    <span className="cursor-pointer">
                      {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <FileUp className="w-3.5 h-3.5 shrink-0" />}
                      <span className="text-xs">{t('settings.importBackup')}</span>
                    </span>
                  </Button>
                </label>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} className="w-full h-9">
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">تصدير بيانات JSON</span>
            </Button>

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
                      {t('settings.restoreBtn')}
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7 gap-1 text-xs text-destructive" onClick={() => handleDeleteBackup(backup)}>
                      <Trash2 className="w-3 h-3" />
                      {t('common.delete')}
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
                {t('settings.transferLicense')}
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
                {t('settings.transferLicenseDesc')}
              </Button>
            </div>
          </div>
        );

      case 'licenses':
        return (
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 md:p-8 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">{t('settings.bossPanel')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.goToBossPanel')}</p>
              </div>
              {bossPasswordError && (
                <p className="text-sm text-destructive">{bossPasswordError}</p>
              )}
              <div className="w-full max-w-xs space-y-3">
                <div className="relative">
                  <Input
                    type={showBossPassword ? 'text' : 'password'}
                    value={bossPassword}
                    onChange={(e) => { setBossPassword(e.target.value); setBossPasswordError(''); }}
                    placeholder={t('auth.password')}
                    className="pe-10"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleOpenBossPanel(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowBossPassword(!showBossPassword)}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground"
                  >
                    {showBossPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleOpenBossPanel}
                  disabled={isVerifyingBossPassword || !bossPassword}
                  className="w-full gap-2"
                >
                  {isVerifyingBossPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  {t('common.open')}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  {t('license.contactDeveloper')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تواصل مع فريق الدعم الفني' : 'Contact the support team'}
                </p>
              </div>
            </div>
            <ContactLinksSection />
          </div>
        );

      case 'partners':
        return <Partners />;

      case 'archive':
        return <ArchiveSection />;

      case 'reset':
        return <DataResetSection />;

      case 'about': {
        // Read version injected at build time by vite.config.ts from version.json
        const versionInfo = typeof __APP_VERSION__ !== 'undefined'
          ? __APP_VERSION__
          : { versionName: '1.0.59', versionCode: 289, lastUpdated: '2026-10-02T04:00:00.000Z' };

        const releaseDate = new Date(versionInfo.lastUpdated);
        const releaseDateStr = releaseDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });

        // Build timestamp injected at build time
        const rawBuildTimestamp = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : versionInfo.lastUpdated;
        const buildDate = new Date(rawBuildTimestamp);
        const buildTimeStr = buildDate.toLocaleString(isRTL ? 'ar-SA' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        const commitHash = typeof __BUILD_COMMIT__ !== 'undefined' && __BUILD_COMMIT__ !== 'local'
          ? __BUILD_COMMIT__.slice(0, 7)
          : null;

        // Load changelog from build-time injection (limited to latest update fixes only)
        const rawChangelog = (globalThis as unknown as { __APP_CHANGELOG__?: unknown }).__APP_CHANGELOG__ ?? (typeof __APP_CHANGELOG__ !== 'undefined' ? __APP_CHANGELOG__ : null);
        const changelog: { type: 'new' | 'improved' | 'fixed'; ar: string; en: string }[] = Array.isArray(rawChangelog) && rawChangelog.length > 0
          ? rawChangelog.slice(0, 8)
          : [
            { type: 'improved', ar: 'تسريع فتح شاشة نقطة البيع واستبعاد المؤرشف ومزامنة المخزون اللحظية مع استرداد الفواتير', en: 'POS loading acceleration, archived exclusion, and real-time stock sync upon refunds' },
            { type: 'improved', ar: 'تفصيل رسائل أخطاء تسجيل الدخول وإنشاء الحساب وتوضيح أسباب الفشل بدقة', en: 'Detailed auth error messages for login and signup' },
            { type: 'improved', ar: 'تدقيق رسائل المزامنة والإنترنت وإظهار أسباب الرفض الصادرة من الخادم بدقة', en: 'Accurate sync error messages with server feedback' },
            { type: 'new', ar: 'إظهار تاريخ ووقت البناء الفعلي ورقم الإصدار في شاشة الإعدادات', en: 'Display build timestamp and version details in Settings' },
          ];

        return (
          <div className="space-y-5">
            {/* App Identity */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-2xl font-black text-primary-foreground">F</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">FlowPOS Pro</h2>
                <p className="text-sm text-muted-foreground">{isRTL ? 'نظام نقطة البيع المتكامل' : 'Integrated Point of Sale System'}</p>
              </div>
            </div>

            {/* Version Info */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isRTL ? 'معلومات الإصدار والبناء' : 'Version & Build Info'}
                </p>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: isRTL ? 'الإصدار الحالي' : 'Current Version', value: `v${versionInfo.versionName}`, icon: '🏷️' },
                  { label: isRTL ? 'رقم البناء' : 'Build Number', value: String(versionInfo.versionCode), icon: '🔢' },
                  { label: isRTL ? 'تاريخ ووقت البناء الفعلي' : 'Build Timestamp', value: buildTimeStr, icon: '⏱️' },
                  { label: isRTL ? 'تاريخ الإصدار' : 'Release Date', value: releaseDateStr, icon: '📅' },
                  ...(commitHash ? [{ label: isRTL ? 'معرّف التحديث (Commit)' : 'Commit', value: commitHash, icon: '🔖' }] : []),
                  { label: isRTL ? 'المنصة' : 'Platform', value: 'Android / Web / Windows', icon: '📱' },
                  { label: isRTL ? 'المطور' : 'Developer', value: 'FlowPOS Team', icon: '👨‍💻' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Changelog */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isRTL
                    ? `آخر التحديثات — الإصدار ${versionInfo.versionName} (بناء ${versionInfo.versionCode})`
                    : `Latest Updates — v${versionInfo.versionName} (Build ${versionInfo.versionCode})`}
                </p>
              </div>
              <div className="divide-y divide-border">
                {changelog.map((item, idx) => {
                  const colors = {
                    new: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    improved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                    fixed: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                  };
                  const labels = {
                    new: isRTL ? 'جديد' : 'NEW',
                    improved: isRTL ? 'تحسين' : 'IMPROVED',
                    fixed: isRTL ? 'إصلاح' : 'FIXED',
                  };
                  return (
                    <div key={idx} className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${colors[item.type]}`}>
                        {labels[item.type]}
                      </span>
                      <p className="text-sm text-foreground leading-relaxed">{isRTL ? item.ar : item.en}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground pb-2">
              {isRTL ? 'جميع الحقوق محفوظة © ٢٠٢٦ FlowPOS Pro' : '© 2026 FlowPOS Pro. All rights reserved.'}
            </p>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const isAdmin = users.find(u => u.user_id === currentUser?.id)?.role === 'admin';

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-full">
      {activeTab === null ? (
        <>
          {/* Header with Dual Layout Switcher */}
          <PageHeader
            title={t('settings.title')}
            subtitle={t('settings.subtitle')}
            actions={
              <div className="flex items-center bg-muted/80 p-1 rounded-xl border border-border/70 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSwitchLayoutMode('smart')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer",
                    layoutMode === 'smart'
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isRTL ? "النمط الذكي (Bento Hub)" : "Smart Bento Hub"}
                >
                  <span>✨</span>
                  <span>{isRTL ? 'الذكي' : 'Smart'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLayoutMode('classic')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer",
                    layoutMode === 'classic'
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isRTL ? "النمط الشبكي الكلاسيكي" : "Classic Grid"}
                >
                  <span>🔲</span>
                  <span>{isRTL ? 'الكلاسيكي' : 'Classic'}</span>
                </button>
              </div>
            }
          />

          {/* Instant Search Bar */}
          <div className="relative mb-3.5">
            <Search className="w-4 h-4 text-muted-foreground absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              id="settingsSearchInput"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? "بحث سريع في الإعدادات، التراخيص، العملات..." : "Search settings, licenses, currencies..."}
              className="bg-card border border-border/80 rounded-2xl h-10 ps-10 pe-9 text-xs font-semibold placeholder:text-muted-foreground/60 shadow-2xs focus-visible:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                title={isRTL ? "مسح البحث" : "Clear search"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {(() => {
            const visibleTabs = settingsTabs.filter(tab => {
              if (isGuestDemoMode()) {
                if (tab.id === 'licenses' || tab.id === 'activity' || tab.id === 'license') {
                  return false;
                }
              }
              if (isBoss) return true;
              if (isOwnerAdmin && !tab.bossOnly) return true;
              return !tab.adminOnly && !tab.bossOnly;
            });

            const filteredTabs = visibleTabs.filter(tab => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase().trim();
              const matchLabel = tab.label.toLowerCase().includes(q);
              const matchDesc = (tab.description || '').toLowerCase().includes(q);
              const matchKeywords = (tab.keywords || []).some(k => k.toLowerCase().includes(q));
              return matchLabel || matchDesc || matchKeywords;
            });

            const getStoreTypeLabel = (type: string) => {
              const map: Record<string, string> = {
                phones: isRTL ? 'هواتف وإلكترونيات' : 'Phones & Electronics',
                electronics: isRTL ? 'إلكترونيات' : 'Electronics',
                clothing: isRTL ? 'ملابس وأزياء' : 'Clothing & Fashion',
                grocery: isRTL ? 'بقالة ومواد غذائية' : 'Grocery & Food',
                supermarket: isRTL ? 'سوبرماركت' : 'Supermarket',
                perfumes: isRTL ? 'عطور ومستحضرات' : 'Perfumes & Cosmetics',
                pharmacy: isRTL ? 'صيدلية' : 'Pharmacy',
                bakery: isRTL ? 'مخبز وحلويات' : 'Bakery & Sweets',
                bookstore: isRTL ? 'مكتبة وقرطاسية' : 'Bookstore & Stationery',
                services: isRTL ? 'خدمات وصيانة' : 'Services & Maintenance',
                restaurant: isRTL ? 'مطعم ومقهى' : 'Restaurant & Cafe',
                general: isRTL ? 'نشاط تجاري عام' : 'General Store',
              };
              return map[type] || type;
            };

            const getTabColorClasses = (color?: string, danger?: boolean) => {
              if (danger) {
                return {
                  bg: 'bg-destructive/10 text-destructive border-destructive/20',
                  badge: 'bg-destructive/10 text-destructive border-destructive/25',
                };
              }
              switch (color) {
                case 'rose':
                  return {
                    bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
                  };
                case 'amber':
                  return {
                    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
                  };
                case 'blue':
                  return {
                    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
                  };
                case 'purple':
                  return {
                    bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
                  };
                case 'teal':
                  return {
                    bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
                    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
                  };
                case 'indigo':
                  return {
                    bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
                  };
                case 'emerald':
                  return {
                    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
                  };
                case 'orange':
                  return {
                    bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
                    badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
                  };
                case 'cyan':
                  return {
                    bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
                  };
                default:
                  return {
                    bg: 'bg-primary/10 text-primary border-primary/20',
                    badge: 'bg-muted text-muted-foreground border-border/50',
                  };
              }
            };

            // Empty search state
            if (filteredTabs.length === 0) {
              return (
                <div className="py-12 text-center text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border/70 p-6 space-y-3">
                  <Search className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-bold text-foreground">
                    {isRTL ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching settings found'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? `لم نجد أي إعداد يطابق "${searchQuery}"` : `No setting matching "${searchQuery}"`}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="rounded-xl text-xs h-8">
                    {isRTL ? 'مسح البحث' : 'Clear search'}
                  </Button>
                </div>
              );
            }

            // Mode 1: Smart Bento Hub
            if (layoutMode === 'smart') {
              const coreTabs = filteredTabs.filter(t => t.category === 'core' && t.id !== 'store');
              const opTabs = filteredTabs.filter(t => t.category === 'operations');
              const supportTabs = filteredTabs.filter(t => t.category === 'support');
              const isSearching = searchQuery.trim().length > 0;

              return (
                <div className="space-y-4">
                  {/* Hero Store & Currencies Card (Always visible when not searching or when store matches) */}
                  {(!isSearching || filteredTabs.some(t => t.id === 'store')) && (
                    <div
                      onClick={() => setActiveTab('store')}
                      className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/95 via-primary to-primary/90 text-primary-foreground p-3.5 md:p-5 shadow-sm hover:shadow-md transition-[transform,box-shadow] duration-200 cursor-pointer active:scale-[0.99] group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 md:gap-4 min-w-0">
                          <div className="w-11 h-11 md:w-13 md:h-13 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
                            {storeSettings.logo ? (
                              <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                              <span>🏬</span>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm md:text-base tracking-tight truncate">
                                {storeSettings.name || (isRTL ? 'متجري' : 'My Store')}
                              </span>
                              <span className="bg-white/25 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md">
                                {getStoreTypeLabel(storeSettings.type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-primary-foreground/90 font-medium flex-wrap">
                              <span className="bg-white/15 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold">
                                {isRTL ? `العملة الأساسية: ${primaryCurrency} $` : `Base: ${primaryCurrency} $`}
                              </span>
                              <span className="text-[10px] md:text-[11px] text-primary-foreground/85 font-mono">
                                1$ = {exchangeRates.TRY} {currencySymbols.TRY || '₺'} · 1$ = {exchangeRates.SYP} {currencySymbols.SYP || 'ل.س'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <span className="text-[11px] font-bold text-white/90 hidden sm:inline-block">
                            {isRTL ? 'إدارة الهوية والعملات' : 'Manage Store & Rates'}
                          </span>
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-white/20 text-white flex items-center justify-center text-xs font-bold group-hover:translate-x-[-2px] rtl:group-hover:translate-x-[2px] transition-transform">
                            {isRTL ? '←' : '→'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If searching, render all matches directly */}
                  {isSearching ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filteredTabs.map(tab => {
                        const colors = getTabColorClasses(tab.color, tab.danger);
                        return (
                          <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                              "bg-card border border-border/80 rounded-2xl md:rounded-3xl p-3 md:p-3.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-150 cursor-pointer relative group flex flex-col justify-between min-h-[96px]",
                              tab.danger && "hover:border-destructive/60"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border", colors.bg)}>
                                <tab.icon className="w-4 h-4" />
                              </div>
                              {tab.badge && (
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border", colors.badge)}>
                                  {tab.badge}
                                </span>
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-xs md:text-sm text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                                {tab.label}
                              </h3>
                              {tab.description && (
                                <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium mt-0.5 line-clamp-1">
                                  {tab.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      {/* Section 1: Core Data & Account */}
                      {coreTabs.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-extrabold text-muted-foreground px-1">
                            <span>{isRTL ? 'البيانات الأساسية والحساب' : 'Core Data & Profile'}</span>
                            <span className="text-primary text-[10px] font-bold">{coreTabs.length} {isRTL ? 'أقسام' : 'sections'}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {coreTabs.map(tab => {
                              const colors = getTabColorClasses(tab.color, tab.danger);
                              return (
                                <div
                                  key={tab.id}
                                  onClick={() => setActiveTab(tab.id)}
                                  className="bg-card border border-border/80 rounded-2xl md:rounded-3xl p-3 md:p-3.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-150 cursor-pointer relative group flex flex-col justify-between min-h-[96px]"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border", colors.bg)}>
                                      <tab.icon className="w-4 h-4" />
                                    </div>
                                    {tab.badge && (
                                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border", colors.badge)}>
                                        {tab.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-xs md:text-sm text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                                      {tab.label}
                                    </h3>
                                    {tab.description && (
                                      <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium mt-0.5 line-clamp-1">
                                        {tab.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Operations, Security & Licenses */}
                      {opTabs.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-extrabold text-muted-foreground px-1">
                            <span>{isRTL ? 'العمليات، الرخص وسجلات الأمان' : 'Operations, Licenses & Logs'}</span>
                            <span className="text-primary text-[10px] font-bold">{opTabs.length} {isRTL ? 'أقسام' : 'sections'}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {opTabs.map(tab => {
                              const colors = getTabColorClasses(tab.color, tab.danger);
                              return (
                                <div
                                  key={tab.id}
                                  onClick={() => setActiveTab(tab.id)}
                                  className={cn(
                                    "bg-card border border-border/80 rounded-2xl md:rounded-3xl p-3 md:p-3.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-150 cursor-pointer relative group flex flex-col justify-between min-h-[96px]",
                                    tab.danger && "hover:border-destructive/60"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border", colors.bg)}>
                                      <tab.icon className="w-4 h-4" />
                                    </div>
                                    {tab.badge && (
                                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border", colors.badge)}>
                                        {tab.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-xs md:text-sm text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                                      {tab.label}
                                    </h3>
                                    {tab.description && (
                                      <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium mt-0.5 line-clamp-1">
                                        {tab.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Support & About */}
                      {supportTabs.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {supportTabs.map(tab => {
                              const colors = getTabColorClasses(tab.color, tab.danger);
                              return (
                                <div
                                  key={tab.id}
                                  onClick={() => setActiveTab(tab.id)}
                                  className="bg-card border border-border/80 rounded-2xl md:rounded-3xl p-3 md:p-3.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-150 cursor-pointer relative group flex items-center gap-3 min-h-[72px]"
                                >
                                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", colors.bg)}>
                                    <tab.icon className="w-4.5 h-4.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <h3 className="font-bold text-xs md:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                        {tab.label}
                                      </h3>
                                      {tab.badge && (
                                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0", colors.badge)}>
                                          {tab.badge}
                                        </span>
                                      )}
                                    </div>
                                    {tab.description && (
                                      <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                                        {tab.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            }

            // Mode 2: Classic Grid
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
                {filteredTabs.map(tab => {
                  const colors = getTabColorClasses(tab.color, tab.danger);
                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "bg-card border border-border/80 rounded-2xl md:rounded-3xl p-3 md:p-3.5 text-center flex flex-col items-center justify-between hover:border-primary/50 hover:shadow-md active:scale-95 transition-[transform,box-shadow,border-color] duration-150 cursor-pointer min-h-[110px] md:min-h-[120px] group",
                        tab.danger && "hover:border-destructive/60"
                      )}
                    >
                      <div className={cn("w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 border group-hover:scale-105 transition-transform mb-1.5", colors.bg)}>
                        <tab.icon className="w-4.5 h-4.5 md:w-5 md:h-5" />
                      </div>
                      <div className="w-full">
                        <span className="font-bold text-xs md:text-sm text-foreground leading-tight text-center line-clamp-1 block group-hover:text-primary transition-colors">
                          {tab.label}
                        </span>
                        {tab.description && (
                          <span className="text-[10px] text-muted-foreground font-medium text-center line-clamp-1 block mt-0.5">
                            {tab.description}
                          </span>
                        )}
                      </div>
                      {tab.badge && (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded-full border mt-1 shrink-0", colors.badge)}>
                          {tab.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {/* Sub-page header with back button */}
          <div className="flex items-center gap-2.5 rtl:pr-12 ltr:pl-12 md:rtl:pr-0 md:ltr:pl-0">
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              aria-label={t('common.back') || 'رجوع'}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/70 bg-card hover:bg-muted transition-colors flex-shrink-0 shadow-sm"
            >
              {isRTL ? <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" /> : <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            {(() => {
              const current = settingsTabs.find(tab => tab.id === activeTab);
              if (!current) return null;
              return (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <current.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h1 className="text-base sm:text-xl md:text-2xl font-bold text-foreground truncate">{current.label}</h1>
                </div>
              );
            })()}
          </div>

          {/* Content */}
          <div className="bg-card/70 sm:bg-card rounded-2xl border border-border/70 sm:border-border p-3.5 sm:p-6 overflow-hidden max-w-full pb-28">
            {!isSettingsReady ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-semibold">
                  {isRTL ? 'جاري مطابقة وتحديث إعدادات المتجر...' : 'Synchronizing store settings...'}
                </p>
              </div>
            ) : (
              renderTabContent()
            )}
          </div>
        </>
      )}

      {/* User Dialog */}
      <Dialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open);
          if (!open) {
            setEmailError('');
            setPasswordError('');
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{selectedUser ? t('settings.editUser') : t('settings.addNewUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.name')}</label>
              <Input
                ref={userNameInputRef}
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder={t('settings.usernamePlaceholder')}
              />
            </div>
            {selectedUser && (
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-primary shrink-0" />
                    <span>{isRTL ? 'كلمة مرور المستخدم' : 'User Password'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL ? 'تعيين أو تغيير كلمة المرور لهذا المستخدم مباشرة' : 'Directly set or change this user\'s password'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 font-medium"
                  onClick={() => {
                    setPasswordChangeUserId(selectedUser.user_id || selectedUser.id);
                    setPasswordDialogOpen(true);
                  }}
                >
                  <Key className="w-3.5 h-3.5 text-primary" />
                  <span>{isRTL ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}</span>
                </Button>
              </div>
            )}
            {!selectedUser && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('common.email')}</label>
                  <Input
                    ref={userEmailInputRef}
                    type="email"
                    dir="ltr"
                    value={userForm.email}
                    onChange={(e) => {
                      setUserForm({ ...userForm, email: e.target.value });
                      if (emailError) setEmailError('');
                    }}
                    placeholder="email@example.com"
                    className={`text-left placeholder:text-right ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive font-medium">{emailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('auth.password')}</label>
                  <div className="relative">
                    <Input
                      ref={userPasswordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={userForm.password}
                      onChange={(e) => {
                        setUserForm({ ...userForm, password: e.target.value });
                        if (passwordError) setPasswordError('');
                      }}
                      placeholder={t('auth.password')}
                      className={`text-left placeholder:text-right pr-10 ${passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-destructive font-medium">{passwordError}</p>
                  )}
                </div>
              </>
            )}
            {!selectedUser && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.phoneOptional')}</label>
                <Input
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+963 912 345 678"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.userTypeLabel')}</label>
              <select
                value={userForm.userType}
                onChange={(e) => setUserForm({ ...userForm, userType: e.target.value as 'cashier' | 'distributor' | 'pos' })}
                className="w-full h-10 px-3 rounded-md bg-muted border-0"
              >
                <option value="cashier">{t('settings.userTypeCashierOption')}</option>
                <option value="pos">{t('settings.userTypePOSOption')}</option>
                <option value="distributor">{t('settings.userTypeDistributorOption')}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {userForm.userType === 'cashier'
                  ? t('settings.userTypeCashierDesc')
                  : userForm.userType === 'pos'
                    ? t('settings.userTypePOSDesc')
                    : t('settings.userTypeDistributorDesc')}
              </p>
            </div>
            {/* Allowed Pages - checkboxes for page permissions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{isRTL ? 'القوائم المسموح بها' : 'Allowed Pages'}</label>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'حدد القوائم الإضافية التي يستطيع هذا المستخدم الوصول إليها' : 'Select additional pages this user can access'}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { key: 'dashboard', label: t('nav.dashboard') },
                  { key: 'products', label: isRTL ? 'المنتجات (عرض فقط)' : 'Products (view only)' },
                  { key: 'partners', label: t('nav.partners') },
                  { key: 'reports', label: t('nav.reports') },
                  { key: 'settings', label: t('nav.settings') },
                ].map(page => (
                  <label key={page.key} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded-lg hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={userForm.allowedPages.includes(page.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUserForm(prev => ({ ...prev, allowedPages: [...prev.allowedPages, page.key] }));
                        } else {
                          setUserForm(prev => ({ ...prev, allowedPages: prev.allowedPages.filter(p => p !== page.key) }));
                        }
                      }}
                      className="w-4 h-4 rounded border-primary text-primary accent-primary"
                    />
                    {page.label}
                  </label>
                ))}
              </div>
              {/* Special permission: can add products */}
              {(userForm.allowedPages.includes('products') || userForm.role === 'cashier') && (
                <div className="mt-2 p-2.5 bg-muted/60 rounded-lg border border-border/50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userForm.allowedPages.includes('products:add')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Make sure 'products' is also enabled
                          setUserForm(prev => ({
                            ...prev,
                            allowedPages: [...prev.allowedPages.filter(p => p !== 'products:add'), 'products:add',
                              ...(!prev.allowedPages.includes('products') ? ['products'] : [])
                            ]
                          }));
                        } else {
                          setUserForm(prev => ({ ...prev, allowedPages: prev.allowedPages.filter(p => p !== 'products:add') }));
                        }
                      }}
                      className="w-4 h-4 rounded border-primary text-primary accent-primary"
                    />
                    <div>
                      <span className="font-medium">{isRTL ? 'إمكانية إضافة المنتجات' : 'Can Add Products'}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRTL ? 'يسمح للكاشير بإضافة منتجات جديدة وتعديلها' : 'Allows cashier to add and edit products'}
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent className="max-w-sm w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="py-4">{t('settings.confirmDeleteUser')} "{selectedUser?.name}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDeleteUser} disabled={isSavingUser}>
              {isSavingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
          if (!open) {
            setPasswordChangeUserId(null);
          }
        }}
        userId={passwordChangeUserId || selectedUser?.user_id || selectedUser?.id || undefined}
        userName={users.find(u => (u.user_id === passwordChangeUserId || u.id === passwordChangeUserId))?.name || selectedUser?.name}
        isOwnPassword={passwordChangeUserId ? passwordChangeUserId === currentUser?.id : false}
      />

      {/* Transfer License Dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={(open) => {
        setTransferDialogOpen(open);
        if (!open) { setTransferPassword(''); setShowTransferPassword(false); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.transferLicenseDesc')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.transferLicenseConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="relative">
              <Input
                type={showTransferPassword ? 'text' : 'password'}
                value={transferPassword}
                onChange={(e) => setTransferPassword(e.target.value)}
                placeholder={t('settings.password')}
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
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <Button
              onClick={handleTransferLicense}
              disabled={!transferPassword || isTransferring}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              {t('settings.confirmUnbind')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Buttons (FAB) موحد ومطابق للمظهر */}
      <div
        className={cn(
          "fixed bottom-6 z-50 flex items-center gap-3 transition-all duration-300 ease-in-out",
          isRTL ? "left-6" : "right-6",
          (hasUnsavedChanges || isSaveSuccess)
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className={cn(
            "w-14 h-14 rounded-full shadow-2xl p-0 transition-all duration-200",
            isSaveSuccess
              ? (lastSaveStatus === 'synced' ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-amber-600 text-white hover:bg-amber-700")
              : "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
          )}
          title={t('common.save') || (isRTL ? 'حفظ' : 'Save')}
        >
          {isSavingSettings ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isSaveSuccess ? (
            lastSaveStatus === 'synced' ? <Check className="w-6 h-6 stroke-[3]" /> : <Clock className="w-6 h-6" />
          ) : (
            <Save className="w-6 h-6" />
          )}
        </Button>
        {hasUnsavedChanges && !isSaveSuccess && (
          <Button
            variant="secondary"
            onClick={handleRevert}
            className="w-14 h-14 rounded-full shadow-2xl p-0 hover:scale-105 active:scale-95 transition-transform"
            title={t('common.cancel') || (isRTL ? 'تراجع' : 'Cancel')}
          >
            <Undo2 className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* تأكيد تغيير التصنيفات عند تغيير نوع المحل */}
      <Dialog open={storeTypeConfirmOpen} onOpenChange={setStoreTypeConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.updateCategories')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('settings.updateCategoriesDesc')}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await saveUnifiedStoreSettings({
                    storeSettings: { ...storeSettings, type: storeSettings.type },
                  });
                } catch (e) { console.warn('[Settings] Unified store_type save failed:', e); }
                setStoreTypeConfirmOpen(false);
                setPendingStoreType(null);
                emitEvent(EVENTS.STORE_TYPE_CHANGED);
                toast({
                  title: t('settings.updated'),
                  description: t('settings.fieldsOnlyUpdated'),
                });
              }}
            >
              {t('settings.keepCurrentCategories')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingStoreType) {
                  const defaultCats = getDefaultCategories(pendingStoreType);
                  const newCategories: Category[] = defaultCats.map((name, i) => ({
                    id: `auto_${Date.now()}_${i}`,
                    name,
                    createdAt: new Date().toISOString(),
                  }));
                  saveCategories(newCategories);
                  // Sync categories to cloud
                  (async () => {
                    try {
                      const { loadCategoriesCloud, deleteCategoryCloud, addCategoryCloud, invalidateCategoriesCache } = await import('@/lib/cloud/categories-cloud');
                      const existing = await loadCategoriesCloud();
                      await Promise.allSettled(existing.map(c => deleteCategoryCloud(c.id)));
                      invalidateCategoriesCache();
                      await Promise.allSettled(defaultCats.map(name => addCategoryCloud(name)));
                    } catch (e) {
                      console.warn('[Settings] Cloud category sync failed:', e);
                    }
                  })();
                }
                try {
                  await saveUnifiedStoreSettings({
                    storeSettings: { ...storeSettings, type: storeSettings.type },
                  });
                } catch (e) { console.warn('[Settings] Unified store_type save failed:', e); }
                setStoreTypeConfirmOpen(false);
                setPendingStoreType(null);
                emitEvent(EVENTS.STORE_TYPE_CHANGED);
                toast({
                  title: t('settings.updated'),
                  description: t('settings.fieldsAndCategoriesUpdated'),
                });
              }}
            >
              {t('settings.replaceCategories')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
