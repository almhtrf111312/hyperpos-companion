import { useState, useEffect } from 'react';
import {
  Store,
  DollarSign,
  Percent,
  Users,
  Palette,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Sparkles,
  Check,
  Sun,
  Moon,
  Plus,
  Trash2,
  Barcode,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Wrench,
  Boxes,
  Layers,
  HelpCircle,
  TrendingUp,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  ChevronRight,
  Receipt,
  Printer,
  Camera,
  ScanLine,
  Keyboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { savePartners, Partner } from '@/lib/partners-store';
import { APP_FONTS, AppFontId, getStoredAppFont, setStoredAppFont } from '@/lib/app-font-config';
import { UI_SCALE_OPTIONS, UIScaleId, getStoredUIScale, setStoredUIScale } from '@/lib/ui-scale-config';
import { emitEvent, EVENTS } from '@/lib/events';
import { saveStoreSettings, getCurrentUserId, getCurrentUserName } from '@/lib/supabase-store';
import { getDefaultCategories } from '@/lib/store-type-config';
import { saveCategories, loadCategories, Category } from '@/lib/categories-store';
import { PREDEFINED_CURRENCIES } from '@/lib/currencies';
import { openShift, loadShifts, getActiveShift } from '@/lib/cashbox-store';

interface SetupWizardProps {
  onComplete: () => void;
  isPreview?: boolean;
}

interface PartnerItem {
  id: string;
  name: string;
  phone: string;
  capital: number;
  sharePercentage: number;
}

const SETTINGS_KEY = 'hyperpos_settings_v1';
const STORE_TYPE_KEY = 'hyperpos_store_type';
const TAX_KEY = 'hyperpos_tax_settings';

const getInitialStoredSettings = (): Record<string, any> | null => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const getInitialCurrencies = () => {
  const settings = getInitialStoredSettings();
  const enabledMap = (settings?.enabledCurrencies || {}) as Record<string, boolean>;
  const namesMap = (settings?.currencyNames || {}) as Record<string, string>;
  const symbolsMap = (settings?.currencySymbols || {}) as Record<string, string>;
  const ratesMap = (settings?.exchangeRates || {}) as Record<string, any>;

  // 1. Identify non-USD currencies that are explicitly enabled (true)
  const activeNonUsd = Object.keys(enabledMap).filter(code => code !== 'USD' && enabledMap[code] === true);

  // 2. Identify other non-USD currencies that exist in names, symbols, or rates
  const otherConfigured = Object.keys({ ...namesMap, ...symbolsMap, ...ratesMap })
    .filter(code => code !== 'USD' && !activeNonUsd.includes(code));

  // Prioritize actively enabled currencies first, then any other configured currencies
  const candidateCodes = [...activeNonUsd, ...otherConfigured];

  // Resolve Secondary Currency 1
  const c1Code = candidateCodes[0] || 'TRY';
  const c1Predefined = PREDEFINED_CURRENCIES.find(c => c.code === c1Code);
  const c1Enabled = enabledMap[c1Code] !== undefined ? !!enabledMap[c1Code] : true;
  const c1Name = namesMap[c1Code] || c1Predefined?.name || (c1Code === 'TRY' ? 'ليرة تركية' : c1Code);
  const c1Symbol = symbolsMap[c1Code] || c1Predefined?.symbol || (c1Code === 'TRY' ? '₺' : c1Code);
  const c1Rate = Number(ratesMap[c1Code]) || c1Predefined?.suggestedRate || (c1Code === 'TRY' ? 34 : 1);

  // Resolve Secondary Currency 2
  const c2Code = candidateCodes[1] || (c1Code === 'SYP' ? 'TRY' : 'SYP');
  const c2Predefined = PREDEFINED_CURRENCIES.find(c => c.code === c2Code);
  const c2Enabled = enabledMap[c2Code] !== undefined ? !!enabledMap[c2Code] : (candidateCodes.length > 1 ? false : true);
  const c2Name = namesMap[c2Code] || c2Predefined?.name || (c2Code === 'SYP' ? 'ليرة سورية' : c2Code);
  const c2Symbol = symbolsMap[c2Code] || c2Predefined?.symbol || (c2Code === 'SYP' ? 'ل.س' : c2Code);
  const c2Rate = Number(ratesMap[c2Code]) || c2Predefined?.suggestedRate || (c2Code === 'SYP' ? 14500 : 1);

  return {
    primaryCurrency: settings?.primaryCurrency || 'USD',
    c1: { code: c1Code, enabled: c1Enabled, name: c1Name, symbol: c1Symbol, rate: c1Rate },
    c2: { code: c2Code, enabled: c2Enabled, name: c2Name, symbol: c2Symbol, rate: c2Rate },
  };
};

export function SetupWizard({ onComplete, isPreview }: SetupWizardProps) {
  const { isRTL, direction } = useLanguage();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  // Check if we are in preview mode or if setup was already previously completed
  const isAlreadySetup = typeof isPreview === 'boolean'
    ? isPreview
    : (localStorage.getItem('hyperpos_setup_complete') === 'true' && sessionStorage.getItem('hyperpos_just_signed_up') !== 'true');

  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1]));

  // Step 1: Store info & Identity & Catalog Templates
  const [storeName, setStoreName] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.storeSettings?.name || '';
  });

  const [storeType, setStoreType] = useState<string>(() => {
    const s = getInitialStoredSettings();
    return localStorage.getItem(STORE_TYPE_KEY) || s?.storeSettings?.type || 'grocery';
  });

  const [storePhone, setStorePhone] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.storeSettings?.phone || '';
  });
  const [storeAddress, setStoreAddress] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.storeSettings?.address || '';
  });
  const [storeLogo, setStoreLogo] = useState<string>(() => {
    const s = getInitialStoredSettings();
    return s?.storeSettings?.logo || '';
  });
  const [seedCategories, setSeedCategories] = useState(true);

  // Step 2: Currencies & Pricing (Flexible Dynamic Multi-Currency)
  const initialCurrencies = getInitialCurrencies();
  const [primaryCurrency, setPrimaryCurrency] = useState(initialCurrencies.primaryCurrency);

  // Secondary Currency 1
  const [sec1Enabled, setSec1Enabled] = useState(initialCurrencies.c1.enabled);
  const [sec1Code, setSec1Code] = useState(initialCurrencies.c1.code);
  const [sec1Name, setSec1Name] = useState(initialCurrencies.c1.name);
  const [sec1Symbol, setSec1Symbol] = useState(initialCurrencies.c1.symbol);
  const [sec1Rate, setSec1Rate] = useState<number>(initialCurrencies.c1.rate);

  // Secondary Currency 2
  const [sec2Enabled, setSec2Enabled] = useState(initialCurrencies.c2.enabled);
  const [sec2Code, setSec2Code] = useState(initialCurrencies.c2.code);
  const [sec2Name, setSec2Name] = useState(initialCurrencies.c2.name);
  const [sec2Symbol, setSec2Symbol] = useState(initialCurrencies.c2.symbol);
  const [sec2Rate, setSec2Rate] = useState<number>(initialCurrencies.c2.rate);

  // Step 3: Sales, Tax, Thermal Printing & Barcode
  const [taxEnabled, setTaxEnabled] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.taxEnabled ?? false;
  });
  const [taxRate, setTaxRate] = useState<number>(() => {
    const s = getInitialStoredSettings();
    return Number(s?.taxRate) || 5;
  });
  const [discountPercentEnabled, setDiscountPercentEnabled] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.discountPercentEnabled ?? true;
  });
  const [discountFixedEnabled, setDiscountFixedEnabled] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.discountFixedEnabled ?? true;
  });
  const [barcodeScanMode, setBarcodeScanMode] = useState<'add' | 'search'>(() => {
    const s = getInitialStoredSettings();
    return s?.barcodeScanMode || 'add';
  });
  const [barcodeDevice, setBarcodeDevice] = useState<'camera' | 'scanner' | 'manual'>(() => {
    const s = getInitialStoredSettings();
    return s?.barcodeDeviceType || (localStorage.getItem('hyperpos_barcode_device') as any) || 'camera';
  });
  const [paperSize, setPaperSize] = useState<'80mm' | '57mm'>(() => {
    const s = getInitialStoredSettings();
    return s?.printSettings?.paperSize || '80mm';
  });
  const [receiptFooter, setReceiptFooter] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.printSettings?.footerText || 'شكراً لزيارتكم';
  });
  const [printAutoAfterSale, setPrintAutoAfterSale] = useState(() => {
    const s = getInitialStoredSettings();
    return s?.printSettings?.autoPrint ?? false;
  });

  // Step 4: Partners & Profits
  const [hasPartners, setHasPartners] = useState<'no' | 'yes'>('no');
  const [partners, setPartners] = useState<PartnerItem[]>([
    { id: '1', name: '', phone: '', capital: 0, sharePercentage: 50 },
  ]);

  // Step 5: Typography, Appearance & Opening Cash Float
  const [selectedFont, setSelectedFont] = useState<AppFontId>(() => getStoredAppFont());
  const [selectedScale, setSelectedScale] = useState<UIScaleId>(() => getStoredUIScale());
  const [openingCash, setOpeningCash] = useState<string>('0');
  const [openFirstShift, setOpenFirstShift] = useState(true);

  // Load existing settings on mount and sync missing fields from cloud if available
  useEffect(() => {
    let isMounted = true;

    // Background fetch from cloud to enrich any missing data if online
    import('@/lib/supabase-store').then(({ fetchStoreSettings }) => {
      fetchStoreSettings().then((cloud) => {
        if (!isMounted || !cloud) return;
        if (cloud.name) setStoreName((prev) => prev || cloud.name || '');
        if (cloud.phone) setStorePhone((prev) => prev || cloud.phone || '');
        if (cloud.address) setStoreAddress((prev) => prev || cloud.address || '');
        if (cloud.logo_url) setStoreLogo((prev) => prev || cloud.logo_url || '');
        if (cloud.store_type) setStoreType((prev) => prev || cloud.store_type || 'grocery');
        if (cloud.primary_currency) setPrimaryCurrency((prev) => prev || cloud.primary_currency || 'USD');
        if (cloud.tax_enabled !== undefined) setTaxEnabled((prev) => prev ?? !!cloud.tax_enabled);
        if (cloud.tax_rate !== undefined) setTaxRate((prev) => prev || Number(cloud.tax_rate) || 5);
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle predefined currency selection for secondary 1
  const handleSelectSec1 = (code: string) => {
    const found = PREDEFINED_CURRENCIES.find(c => c.code === code);
    if (found) {
      setSec1Code(found.code);
      setSec1Name(found.name);
      setSec1Symbol(found.symbol);
      if (found.suggestedRate) setSec1Rate(found.suggestedRate);
    }
  };

  // Handle predefined currency selection for secondary 2
  const handleSelectSec2 = (code: string) => {
    const found = PREDEFINED_CURRENCIES.find(c => c.code === code);
    if (found) {
      setSec2Code(found.code);
      setSec2Name(found.name);
      setSec2Symbol(found.symbol);
      if (found.suggestedRate) setSec2Rate(found.suggestedRate);
    }
  };

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الشعار كبير جداً (الحد الأقصى 2 ميغابايت)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setStoreLogo(base64);
      toast.success('تم رفع الشعار بنجاح');
    };
    reader.readAsDataURL(file);
  };

  // Partners helpers
  const handleAddPartner = () => {
    const totalShare = partners.reduce((s, p) => s + (p.sharePercentage || 0), 0);
    const rem = Math.max(0, 100 - totalShare);
    setPartners([
      ...partners,
      {
        id: Date.now().toString(),
        name: '',
        phone: '',
        capital: 0,
        sharePercentage: rem > 0 ? rem : 0,
      },
    ]);
  };

  const handleRemovePartner = (id: string) => {
    if (partners.length <= 1) {
      toast.error('يجب بقاء شريك واحد على الأقل عند تفعيل المشاركة');
      return;
    }
    setPartners(partners.filter(p => p.id !== id));
  };

  const handlePartnerChange = (id: string, field: keyof PartnerItem, value: any) => {
    setPartners(partners.map(p => {
      if (p.id !== id) return p;
      return { ...p, [field]: value };
    }));
  };

  // Finish Wizard & Save All Settings
  const handleFinish = async () => {
    const finalStoreName = storeName.trim() || 'متجري';

    // 1. Seed categories if enabled and store categories are empty
    if (seedCategories) {
      try {
        const existingCats = loadCategories();
        if (existingCats.length === 0) {
          const defaults = getDefaultCategories(storeType);
          if (defaults && defaults.length > 0) {
            const formattedCategories: Category[] = defaults.map((catName, idx) => ({
              id: `${Date.now()}-${idx}`,
              name: catName,
              createdAt: new Date().toISOString(),
            }));
            saveCategories(formattedCategories);
          }
        }
      } catch (e) {
        console.warn('[SetupWizard] Categories seed fallback:', e);
      }
    }

    // 2. Read previous settings to safely merge
    let prevSettings: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) prevSettings = JSON.parse(raw);
    } catch {}

    const newSettings = {
      ...prevSettings,
      storeSettings: {
        ...(prevSettings.storeSettings || {}),
        name: finalStoreName,
        type: storeType,
        phone: storePhone.trim(),
        address: storeAddress.trim(),
        logo: storeLogo,
      },
      primaryCurrency: primaryCurrency || prevSettings.primaryCurrency || 'USD',
      currencyNames: {
        ...(prevSettings.currencyNames || {}),
        USD: prevSettings.currencyNames?.USD || 'دولار',
        [sec1Code]: sec1Name.trim() || sec1Code,
        [sec2Code]: sec2Name.trim() || sec2Code,
      },
      currencySymbols: {
        ...(prevSettings.currencySymbols || {}),
        USD: prevSettings.currencySymbols?.USD || '$',
        [sec1Code]: sec1Symbol.trim() || sec1Code,
        [sec2Code]: sec2Symbol.trim() || sec2Code,
      },
      exchangeRates: {
        ...(prevSettings.exchangeRates || {}),
        USD: '1',
        [sec1Code]: String(sec1Rate || 1),
        [sec2Code]: String(sec2Rate || 1),
      },
      enabledCurrencies: {
        ...(prevSettings.enabledCurrencies || {}),
        USD: true,
        [sec1Code]: sec1Enabled,
        [sec2Code]: sec2Enabled,
      },
      taxEnabled,
      taxRate: taxEnabled ? Number(taxRate || 0) : 0,
      discountPercentEnabled,
      discountFixedEnabled,
      barcodeScanMode: barcodeDevice === 'manual' ? 'search' : barcodeScanMode,
      barcodeDeviceType: barcodeDevice,
      printSettings: {
        ...(prevSettings.printSettings || {}),
        paperSize,
        footerText: receiptFooter.trim(),
        autoPrint: printAutoAfterSale,
        showLogo: !!storeLogo,
        showTaxNumber: taxEnabled,
      },
    };

    // 3. Local Storage save
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      localStorage.setItem(STORE_TYPE_KEY, storeType);
      let prevTax: Record<string, any> = {};
      try {
        const rawTax = localStorage.getItem(TAX_KEY);
        if (rawTax) prevTax = JSON.parse(rawTax);
      } catch {}
      localStorage.setItem(TAX_KEY, JSON.stringify({
        ...prevTax,
        enabled: taxEnabled,
        rate: taxRate,
        inclusive: prevTax.inclusive ?? false,
        name: prevTax.name || 'ضريبة القيمة المضافة'
      }));
      localStorage.setItem('hyperpos_barcode_device', barcodeDevice);
      localStorage.setItem('hyperpos_setup_complete', 'true');
    } catch (e) {
      console.warn('[SetupWizard] Failed to save to localStorage:', e);
    }

    // 4. Opening Cash Float / Shift
    const amount = parseFloat(openingCash) || 0;
    const existingActiveShift = getActiveShift();
    if (!existingActiveShift && (openFirstShift || amount > 0)) {
      try {
        const uid = getCurrentUserId() || 'offline_admin';
        const uname = getCurrentUserName() || 'المدير';
        openShift(amount, uid, uname);
      } catch (e) {
        console.warn('[SetupWizard] Open shift fallback:', e);
      }
    }

    // 5. Partners save if enabled
    if (hasPartners === 'yes') {
      const valid = partners.filter(p => p.name.trim());
      if (valid.length > 0) {
        const now = new Date().toISOString();
        const partnersToSave: Partner[] = valid.map(p => ({
          id: `partner-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: p.name.trim(),
          phone: p.phone.trim(),
          sharePercentage: Number(p.sharePercentage) || 0,
          expenseSharePercentage: Number(p.sharePercentage) || 0,
          categoryShares: [],
          accessAll: true,
          sharesExpenses: true,
          initialCapital: Number(p.capital) || 0,
          currentCapital: Number(p.capital) || 0,
          capitalWithdrawals: [],
          capitalHistory: p.capital > 0 ? [{
            id: `cap-${Date.now()}`,
            amount: Number(p.capital),
            type: 'deposit' as const,
            date: now.split('T')[0],
            notes: 'رأس مال أولي',
          }] : [],
          confirmedProfit: 0,
          pendingProfit: 0,
          pendingProfitDetails: [],
          currentBalance: 0,
          totalWithdrawn: 0,
          totalExpensesPaid: 0,
          totalProfitEarned: 0,
          profitHistory: [],
          withdrawalHistory: [],
          expenseHistory: [],
          joinedDate: now,
        }));
        savePartners(partnersToSave);
      }
    }

    // 6. Cloud store settings sync
    try {
      const existingCloudRates = (prevSettings.exchangeRates && typeof prevSettings.exchangeRates === 'object')
        ? Object.fromEntries(Object.entries(prevSettings.exchangeRates).map(([k, v]) => [k, Number(v) || 1]))
        : {};

      await saveStoreSettings({
        name: finalStoreName,
        store_type: storeType,
        phone: storePhone.trim(),
        address: storeAddress.trim(),
        logo_url: storeLogo,
        primary_currency: primaryCurrency,
        exchange_rates: {
          ...existingCloudRates,
          USD: 1,
          [sec1Code]: sec1Rate || 1,
          [sec2Code]: sec2Rate || 1,
        },
        tax_enabled: taxEnabled,
        tax_rate: taxEnabled ? Number(taxRate || 0) : 0,
      });
    } catch (e) {
      console.warn('[SetupWizard] Cloud settings save fallback:', e);
    }

    // 7. Dispatch system events so POS, Sidebar, and Themes update immediately
    emitEvent(EVENTS.SETTINGS_UPDATED, newSettings);
    emitEvent(EVENTS.STORE_TYPE_CHANGED, storeType);
    window.dispatchEvent(new CustomEvent('setup:complete'));
    window.dispatchEvent(new CustomEvent('storeTypeChanged'));

    toast.success('تم إعداد المتجر بنجاح! مرحباً بك في Flow POS', {
      description: 'نظامك جاهز للعمل الآن بأعلى كفاءة',
    });

    onComplete();
  };

  const storeTypesList = [
    { id: 'grocery', name: 'بقالة وسوبرماركت', icon: ShoppingBag, desc: 'مواد غذائية واستهلاكية وتجزئة سريعة' },
    { id: 'phones', name: 'هواتف وإلكترونيات', icon: Smartphone, desc: 'أجهزة، إكسسوارات، بطاقات، وخدمات' },
    { id: 'clothing', name: 'ملابس وأزياء', icon: Layers, desc: 'مقاسات وألوان وأقمشة وتصنيفات' },
    { id: 'restaurant', name: 'مطعم أو كافيه', icon: UtensilsCrossed, desc: 'وجبات، مشروبات، وتناول محلي وسفري' },
    { id: 'maintenance', name: 'خدمات وصيانة', icon: Wrench, desc: 'أجور عمالة، قطع غيار، وأوامر عمل' },
    { id: 'general', name: 'تجزئة عامة ومتنوعة', icon: Boxes, desc: 'مخزون عام ومبيعات سريعة شاملة' },
  ];

  const stepsMeta = [
    { num: 1, label: 'المتجر', icon: Store },
    { num: 2, label: 'العملات', icon: Coins },
    { num: 3, label: 'المبيعات والطباعة', icon: Receipt },
    { num: 4, label: 'الشركاء', icon: Users },
    { num: 5, label: 'المظهر والصندوق', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir={direction}>
      <div className="w-full max-w-3xl bg-card border border-border shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/60 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-foreground">
                  معالج الترحيب والإعداد الأولي
                </h1>
                <p className="text-xs text-muted-foreground">
                  تهيئة متجرك خطوة بخطوة للعمل بأعلى احترافية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs font-bold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/20">
                خطوة {step} من {totalSteps}
              </div>

              {/* زر إغلاق / خروج بدون حفظ (Preview Mode) */}
              {isAlreadySetup && (
                <button
                  type="button"
                  onClick={() => onComplete()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                  title="إغلاق المعاينة دون حفظ أي تعديلات"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إغلاق</span>
                </button>
              )}
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {stepsMeta.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isPast = step > s.num;
              const isAccessible = visitedSteps.has(s.num);
              return (
                <button
                  key={s.num}
                  type="button"
                  disabled={!isAccessible}
                  onClick={() => {
                    if (isAccessible) setStep(s.num);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all border text-center",
                    !isAccessible && "opacity-40 cursor-not-allowed pointer-events-none",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/25 scale-[1.02] cursor-pointer"
                      : isPast
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer"
                      : isAccessible
                      ? "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 cursor-pointer"
                      : "border-border/40 bg-muted/20 text-muted-foreground/40"
                  )}
                  title={isAccessible ? s.label : 'يرجى إكمال الخطوات السابقة أولاً'}
                >
                  <div className="flex items-center gap-1">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] sm:text-xs truncate">{s.label}</span>
                  </div>
                  <div className={cn(
                    "h-1 w-full rounded-full mt-1.5 transition-all",
                    isActive ? "bg-primary-foreground" : isPast ? "bg-primary" : "bg-transparent"
                  )} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 space-y-6 flex-1 min-h-[380px] overflow-y-auto">
          
          {/* STEP 1: هوية المتجر وبيانات الفاتورة وقوالب التصنيفات */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" />
                  هوية المتجر وبيانات الفاتورة
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  حدد اسم محلك وطبيعة نشاطك وشعارك التجاري الذي سيظهر للزبائن
                </p>
              </div>

              {/* Store Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  اسم المتجر / النشاط التجاري
                </label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="مثال: سوبرماركت البركة، محلات النور، كافيه الياسمين..."
                  className="h-11 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Store Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">
                  نوع النشاط التجاري
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {storeTypesList.map((st) => {
                    const Icon = st.icon;
                    const isSelected = storeType === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStoreType(st.id)}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                            : "border-border/60 bg-card hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <span className="text-xs font-bold text-foreground block truncate w-full">
                          {st.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {st.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logo Upload + Phone + Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    رقم الهاتف للزبائن
                  </label>
                  <Input
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    placeholder="رقم الهاتف أو الواتساب"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    عنوان المحل / المدينة
                  </label>
                  <Input
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="المدينة، الشارع، السوق..."
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Logo upload widget */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                {storeLogo ? (
                  <div className="relative shrink-0">
                    <img
                      src={storeLogo}
                      alt="Logo preview"
                      className="w-12 h-12 rounded-xl object-contain border border-border bg-background p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setStoreLogo('')}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm"
                      title="حذف الشعار"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl border border-dashed border-border flex items-center justify-center bg-background/50 text-muted-foreground shrink-0">
                    <Upload className="w-5 h-5 opacity-60" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">شعار المتجر (Logo)</p>
                  <p className="text-[11px] text-muted-foreground">يظهر في رأس الفاتورة وإيصالات الطباعة</p>
                </div>

                <div>
                  <input
                    type="file"
                    accept="image/*"
                    id="setup-logo-upload"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg"
                    onClick={() => document.getElementById('setup-logo-upload')?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 me-1.5" />
                    {storeLogo ? 'تغيير' : 'رفع شعار'}
                  </Button>
                </div>
              </div>

              {/* بطاقة توليد التصنيفات النموذجية تلقائياً حسب نوع النشاط */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground">
                      توليد تصنيفات تلقائية لنشاطك
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    إنشاء تصنيفات نموذجية شائعة تناسب نشاطك المختار لتكون جاهزة في شاشة البيع فوراً
                  </p>
                </div>
                <Switch
                  checked={seedCategories}
                  onCheckedChange={setSeedCategories}
                  className="data-[state=checked]:bg-primary shrink-0"
                />
              </div>

              {/* Notice */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-2.5 text-xs text-primary">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>
                  هذه البيانات ستظهر في أعلى إيصال الطباعة للزبائن، ويمكنك تعديلها لاحقاً من شاشة الإعدادات.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: إعداد العملات المرن والديناميكي وأسعار الصرف */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  نظام العملات الديناميكي وأسعار الصرف
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  حدد العملة الافتراضية للبيع وخصص العملات الثانوية مع أسعار الصرف الحية
                </p>
              </div>

              {/* Primary Currency Radio Cards */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">
                  العملة الافتراضية للبيع والعرض أمام الزبائن
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { code: 'USD', symbol: '$', title: 'دولار أمريكي', badge: 'مرجع النظام' },
                    { code: sec1Code, symbol: sec1Symbol, title: sec1Name, badge: 'عملة ثانوية 1' },
                    { code: sec2Code, symbol: sec2Symbol, title: sec2Name, badge: 'عملة ثانوية 2' },
                  ].map((curr) => {
                    const isSelected = primaryCurrency === curr.code;
                    return (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => {
                          setPrimaryCurrency(curr.code);
                          if (curr.code === sec1Code) setSec1Enabled(true);
                          if (curr.code === sec2Code) setSec2Enabled(true);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all relative cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                            : "border-border/60 bg-card hover:bg-muted/40"
                        )}
                      >
                        <span className="text-2xl font-black text-primary mb-1">
                          {curr.symbol}
                        </span>
                        <span className="text-xs font-bold text-foreground truncate max-w-full">
                          {curr.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {curr.badge}
                        </span>
                        {isSelected && (
                          <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secondary Currency 1 Configuration Card */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">العملة الثانوية الأولى</p>
                      <p className="text-[10px] text-muted-foreground">خيار سداد وتبديل في سلة البيع والفواتير</p>
                    </div>
                  </div>
                  <Switch
                    checked={sec1Enabled || primaryCurrency === sec1Code}
                    disabled={primaryCurrency === sec1Code}
                    onCheckedChange={setSec1Enabled}
                  />
                </div>

                {sec1Enabled && (
                  <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in duration-150">
                    {/* Quick Pick Predefined Currency */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        اختيار سريع من العملات الجاهزة:
                      </label>
                      <Select value={sec1Code} onValueChange={handleSelectSec1}>
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                          <SelectValue placeholder="اختر عملة..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 z-[120]">
                          {PREDEFINED_CURRENCIES.map(curr => (
                            <SelectItem key={curr.code} value={curr.code} className="text-xs">
                              <span className="flex items-center gap-2">
                                <span className="font-bold font-mono">{curr.code}</span>
                                <span>{curr.name}</span>
                                <span className="text-muted-foreground">({curr.symbol})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Name, Symbol, and Exchange Rate */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">اسم العملة:</label>
                        <Input
                          value={sec1Name}
                          onChange={(e) => setSec1Name(e.target.value)}
                          placeholder="الاسم"
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">الرمز:</label>
                        <Input
                          value={sec1Symbol}
                          onChange={(e) => setSec1Symbol(e.target.value)}
                          placeholder="الرمز"
                          className="h-8 text-xs font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">1 $ = ({sec1Symbol})</label>
                        <Input
                          type="number"
                          step="any"
                          value={sec1Rate || ''}
                          onChange={(e) => setSec1Rate(Number(e.target.value))}
                          placeholder="سعر الصرف"
                          className="h-8 text-xs font-bold text-primary font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Secondary Currency 2 Configuration Card */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">العملة الثانوية الثانية</p>
                      <p className="text-[10px] text-muted-foreground">خيار سداد وتبديل إضافي بالعملة المحلية</p>
                    </div>
                  </div>
                  <Switch
                    checked={sec2Enabled || primaryCurrency === sec2Code}
                    disabled={primaryCurrency === sec2Code}
                    onCheckedChange={setSec2Enabled}
                  />
                </div>

                {sec2Enabled && (
                  <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in duration-150">
                    {/* Quick Pick Predefined Currency */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        اختيار سريع من العملات الجاهزة:
                      </label>
                      <Select value={sec2Code} onValueChange={handleSelectSec2}>
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                          <SelectValue placeholder="اختر عملة..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 z-[120]">
                          {PREDEFINED_CURRENCIES.map(curr => (
                            <SelectItem key={curr.code} value={curr.code} className="text-xs">
                              <span className="flex items-center gap-2">
                                <span className="font-bold font-mono">{curr.code}</span>
                                <span>{curr.name}</span>
                                <span className="text-muted-foreground">({curr.symbol})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Name, Symbol, and Exchange Rate */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">اسم العملة:</label>
                        <Input
                          value={sec2Name}
                          onChange={(e) => setSec2Name(e.target.value)}
                          placeholder="الاسم"
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">الرمز:</label>
                        <Input
                          value={sec2Symbol}
                          onChange={(e) => setSec2Symbol(e.target.value)}
                          placeholder="الرمز"
                          className="h-8 text-xs font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">1 $ = ({sec2Symbol})</label>
                        <Input
                          type="number"
                          step="any"
                          value={sec2Rate || ''}
                          onChange={(e) => setSec2Rate(Number(e.target.value))}
                          placeholder="سعر الصرف"
                          className="h-8 text-xs font-bold text-primary font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Friendly Note */}
              <div className="p-3 bg-muted/50 border border-border/60 rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground">
                <Sparkles className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  ملاحظة: يحافظ النظام على الدولار (USD) كمرجع محاسبي داخلي مستقر للأرباح والمخزون، مع مرونة تامة في تسعير وعرض وقبض الفواتير بأي عملة تحددها.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: إعدادات المبيعات والضريبة والطباعة الحرارية والباركود */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  المبيعات والضريبة وإعدادات الطباعة والباركود
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تحكم بخصائص الفوترة، مقاس ورق الطابعة، وسلوك ماسح الباركود
                </p>
              </div>

              {/* Tax Settings */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">ضريبة القيمة المضافة (VAT)</p>
                      <p className="text-[11px] text-muted-foreground">احتساب الضريبة بشكل تلقائي على الفاتورة</p>
                    </div>
                  </div>
                  <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                </div>

                {taxEnabled && (
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                    <label className="text-xs font-bold text-foreground shrink-0">
                      نسبة الضريبة المئوية:
                    </label>
                    <div className="flex items-center gap-1.5 w-32">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={taxRate || ''}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="h-8 text-xs font-bold text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Discounts Toggles */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                <p className="text-xs font-bold text-foreground">صلاحيات الخصومات في شاشة البيع</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                    <span className="text-xs font-medium">السماح بالخصم المئوي (%)</span>
                    <Switch
                      checked={discountPercentEnabled}
                      onCheckedChange={setDiscountPercentEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                    <span className="text-xs font-medium">السماح بالخصم المالي المباشر</span>
                    <Switch
                      checked={discountFixedEnabled}
                      onCheckedChange={setDiscountFixedEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Thermal Printer Settings (إعدادات الفاتورة والطباعة الحرارية) */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3.5">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-foreground">إعدادات إيصال الفاتورة والطباعة الحرارية</p>
                </div>

                {/* Paper Size Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground">مقاس ورق الطابعة الحرارية:</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaperSize('80mm')}
                      className={cn(
                        "flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer",
                        paperSize === '80mm'
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold text-foreground">طابعة فواتير قياسية (80mm)</span>
                        {paperSize === '80mm' && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        عرض 80 مم - ورق قياسي مناسب لكاشير المحلات ونقاط البيع
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaperSize('57mm')}
                      className={cn(
                        "flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer",
                        paperSize === '57mm'
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold text-foreground">طابعة بلوتوث صغيرة (57mm)</span>
                        {paperSize === '57mm' && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        عرض 57 مم - ورق صغير محمول مناسب للمناديب والعمل الميداني
                      </span>
                    </button>
                  </div>
                </div>

                {/* Receipt Footer Text */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">تذييل الفاتورة المطبوعة:</label>
                  <Input
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    placeholder="مثال: شكراً لزيارتكم، نسعد بخدمتكم دائماً"
                    className="h-9 text-xs bg-background"
                  />
                </div>

                {/* Auto Print Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                  <div>
                    <p className="text-xs font-bold text-foreground">الطباعة التلقائية بعد كل عملية بيع</p>
                    <p className="text-[10px] text-muted-foreground">إرسال الفاتورة للطابعة مباشرة فور الضغط على كاش أو آجل</p>
                  </div>
                  <Switch
                    checked={printAutoAfterSale}
                    onCheckedChange={setPrintAutoAfterSale}
                  />
                </div>
              </div>

              {/* Barcode Scanner Device & Behavior (3 Options) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-primary" />
                  طريقة قراءة ومسح الباركود المفضلة
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBarcodeDevice('camera')}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer",
                      barcodeDevice === 'camera'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        barcodeDevice === 'camera' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <Camera className="w-4 h-4" />
                      </div>
                      {barcodeDevice === 'camera' && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <span className="text-xs font-bold text-foreground block">كاميرا الهاتف / التابلت</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      مناسبة للعمل الميداني والمحلات الصغيرة دون أجهزة إضافية
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBarcodeDevice('scanner')}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer",
                      barcodeDevice === 'scanner'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        barcodeDevice === 'scanner' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <ScanLine className="w-4 h-4" />
                      </div>
                      {barcodeDevice === 'scanner' && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <span className="text-xs font-bold text-foreground block">قارئ خارجي (USB/BT)</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      مناسب لنقاط البيع المزدحمة والبيع السريع بتركيز مستمر
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBarcodeDevice('manual')}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer",
                      barcodeDevice === 'manual'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        barcodeDevice === 'manual' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <Keyboard className="w-4 h-4" />
                      </div>
                      {barcodeDevice === 'manual' && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <span className="text-xs font-bold text-foreground block">إدخال وبحث يدوي</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      للمحلات التي تبحث بالاسم والرمز أو لا تعتمد باركود للأصناف
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: الشركاء ورأس المال */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  إدارة الشركاء ورأس المال
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  حدد ما إذا كان لديك شركاء في رأس المال والأرباح ليقوم النظام بتوزيعها تلقائياً
                </p>
              </div>

              {/* Has Partners Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHasPartners('no')}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer",
                    hasPartners === 'no'
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border/60 bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <span className="text-xs font-bold text-foreground">متجر فردي (لا يوجد شركاء)</span>
                  {hasPartners === 'no' && <Check className="w-4 h-4 text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={() => setHasPartners('yes')}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer",
                    hasPartners === 'yes'
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border/60 bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <span className="text-xs font-bold text-foreground">يوجد شركاء في المحل</span>
                  {hasPartners === 'yes' && <Check className="w-4 h-4 text-primary" />}
                </button>
              </div>

              {/* Partners list if enabled */}
              {hasPartners === 'yes' && (
                <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">قائمة الشركاء والحصص</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 rounded-lg"
                      onClick={handleAddPartner}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة شريك
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {partners.map((partner, index) => (
                      <div
                        key={partner.id}
                        className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">شريك #{index + 1}</span>
                          {partners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePartner(partner.id)}
                              className="text-destructive hover:opacity-80 p-1"
                              title="حذف الشريك"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">اسم الشريك:</label>
                            <Input
                              value={partner.name}
                              onChange={(e) => handlePartnerChange(partner.id, 'name', e.target.value)}
                              placeholder="الاسم الكامل"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">رقم الهاتف:</label>
                            <Input
                              value={partner.phone}
                              onChange={(e) => handlePartnerChange(partner.id, 'phone', e.target.value)}
                              placeholder="09..."
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">رأس المال ($):</label>
                            <Input
                              type="number"
                              value={partner.capital || ''}
                              onChange={(e) => handlePartnerChange(partner.id, 'capital', Number(e.target.value))}
                              placeholder="0.00"
                              className="h-8 text-xs font-bold text-center"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">نسبة الأرباح (%):</label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={partner.sharePercentage || ''}
                              onChange={(e) => handlePartnerChange(partner.id, 'sharePercentage', Number(e.target.value))}
                              placeholder="50"
                              className="h-8 text-xs font-bold text-primary text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    يمكنك لاحقاً تخصيص نسب مختلفة لكل صنف وتعيين نسب المصاريف بالتفصيل من صفحة الشركاء.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: الخطوط وحجم الواجهة والمظهر ورصيد الصندوق الافتتاحي */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  المظهر العام ورصيد الصندوق الافتتاحي
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  اختر الخط المناسب، حجم العرض المريح، ورصيد الكاش الافتتاحي لبدء العمل فوراً
                </p>
              </div>

              {/* Font Family Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">
                  نوع الخط العربي المفضل
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {APP_FONTS.map((f) => {
                    const isSelected = selectedFont === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setSelectedFont(f.id);
                          setStoredAppFont(f.id);
                        }}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                            : "border-border/60 bg-card hover:bg-muted/40"
                        )}
                        style={{ fontFamily: f.cssFamily }}
                      >
                        <div className="truncate">
                          <span className="text-xs font-bold text-foreground block">{f.nameAr}</span>
                          <span className="text-[10px] text-muted-foreground block opacity-80">{f.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UI Scale Selector */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    حجم الخط والواجهة
                  </label>
                  <span className="text-xs font-bold text-primary font-mono">
                    {UI_SCALE_OPTIONS.find(o => o.id === selectedScale)?.percentage}%
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {UI_SCALE_OPTIONS.map((scale) => {
                    const isSelected = selectedScale === scale.id;
                    return (
                      <button
                        key={scale.id}
                        type="button"
                        onClick={() => {
                          setSelectedScale(scale.id);
                          setStoredUIScale(scale.id);
                        }}
                        className={cn(
                          "py-2 px-1 rounded-xl border text-center transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs scale-[1.02]"
                            : "border-border/60 bg-card text-foreground hover:bg-muted/40"
                        )}
                      >
                        <span className="text-xs font-bold block">{scale.percentage}%</span>
                        <span className="text-[9px] block opacity-80 truncate">{scale.labelAr.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Mode Selector (Dark / Light) */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <label className="text-xs font-bold text-foreground">
                  نمط المظهر
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={cn(
                      "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all cursor-pointer",
                      themeMode === 'light'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-muted/40 hover:bg-muted/70"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center",
                      themeMode === 'light' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                    )}>
                      <Sun className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-foreground">الوضع النهاري</span>
                    {themeMode === 'light' && <Check className="w-4 h-4 text-primary ms-auto" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={cn(
                      "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all cursor-pointer",
                      themeMode === 'dark'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-muted/40 hover:bg-muted/70"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center",
                      themeMode === 'dark' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                    )}>
                      <Moon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-foreground">الوضع الليلي</span>
                    {themeMode === 'dark' && <Check className="w-4 h-4 text-primary ms-auto" />}
                  </button>
                </div>
              </div>

              {/* بطاقة رصيد الصندوق الافتتاحي وبدء أول وردية */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">بدء أول وردية ورصيد الصندوق الافتتاحي</p>
                      <p className="text-[11px] text-muted-foreground">رصيد الفكة / الصرافة الافتتاحي في درج الكاشير</p>
                    </div>
                  </div>
                  <Switch
                    checked={openFirstShift}
                    onCheckedChange={setOpenFirstShift}
                    className="data-[state=checked]:bg-primary shrink-0"
                  />
                </div>

                {openFirstShift && (
                  <div className="pt-2 border-t border-primary/10 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                    <label className="text-xs font-bold text-foreground shrink-0">
                      المبلغ الافتتاحي في الصندوق:
                    </label>
                    <div className="flex items-center gap-1.5 w-36">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={openingCash}
                        onChange={(e) => setOpeningCash(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-xs font-bold text-center bg-background"
                      />
                      <span className="text-xs font-bold text-primary">$</span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  سيتم بدء أول وردية كاشير تلقائياً بهذا الرصيد لتكون شاشة البيع جاهزة فوراً.
                </p>
              </div>

              {/* Ready banner */}
              <div className="p-3.5 bg-success/10 border border-success/30 rounded-2xl flex items-center gap-3 text-success">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-xs font-bold">
                  أنت الآن جاهز بالكامل! اضغط على زر البدء لحفظ الإعدادات وبدء استخدام Flow POS مباشرة.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Bar */}
        <div className="p-4 sm:p-6 bg-muted/30 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          {/* Back button */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            {isAlreadySetup && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onComplete()}
                className="w-full sm:w-auto h-10 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                إغلاق المعاينة
              </Button>
            )}
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="w-full sm:w-auto h-10 px-5 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isRTL ? <ArrowRight className="w-4 h-4 me-1.5" /> : <ArrowLeft className="w-4 h-4 me-1.5" />}
                السابق
              </Button>
            )}
          </div>

          {/* Forward / Finish buttons */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            {step < totalSteps ? (
              <Button
                type="button"
                onClick={() => {
                  const nextStep = step + 1;
                  setVisitedSteps(prev => new Set([...prev, nextStep]));
                  setStep(nextStep);
                }}
                className="w-full sm:w-auto h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 cursor-pointer"
              >
                التالي
                {isRTL ? <ArrowLeft className="w-4 h-4 ms-1.5" /> : <ArrowRight className="w-4 h-4 ms-1.5" />}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={visitedSteps.size < totalSteps}
                onClick={handleFinish}
                className={cn(
                  "w-full sm:w-auto h-10 px-7 rounded-xl text-xs font-bold bg-success hover:bg-success/90 text-success-foreground shadow-md shadow-success/20 cursor-pointer",
                  visitedSteps.size < totalSteps
                    ? "opacity-50 cursor-not-allowed pointer-events-none"
                    : "animate-pulse"
                )}
                title={visitedSteps.size < totalSteps ? 'يرجى مراجعة كافة الخطوات أولاً' : ''}
              >
                <Sparkles className="w-4 h-4 me-1.5" />
                ابدأ العمل الآن (حفظ وبدء البيع)
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
