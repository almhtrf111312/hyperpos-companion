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
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { savePartners, Partner } from '@/lib/partners-store';
import { APP_FONTS, AppFontId, getStoredAppFont, setStoredAppFont } from '@/lib/app-font-config';
import { UI_SCALE_OPTIONS, UIScaleId, getStoredUIScale, setStoredUIScale } from '@/lib/ui-scale-config';
import { emitEvent, EVENTS } from '@/lib/events';
import { saveStoreSettings } from '@/lib/supabase-store';

interface SetupWizardProps {
  onComplete: () => void;
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

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { isRTL, direction } = useLanguage();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Step 1: Store info & Identity
  const [storeName, setStoreName] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved)?.storeSettings?.name || '';
    } catch {}
    return '';
  });

  const [storeType, setStoreType] = useState<string>(() => {
    try {
      return localStorage.getItem(STORE_TYPE_KEY) || 'grocery';
    } catch {
      return 'grocery';
    }
  });

  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLogo, setStoreLogo] = useState<string>('');

  // Step 2: Currencies & Pricing
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'TRY' | 'SYP'>('USD');
  const [enableTRY, setEnableTRY] = useState(true);
  const [enableSYP, setEnableSYP] = useState(true);
  const [tryRate, setTryRate] = useState<number>(32);
  const [sypRate, setSypRate] = useState<number>(14500);

  // Step 3: Sales, Tax & Barcode
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(5);
  const [discountPercentEnabled, setDiscountPercentEnabled] = useState(true);
  const [discountFixedEnabled, setDiscountFixedEnabled] = useState(true);
  const [barcodeScanMode, setBarcodeScanMode] = useState<'add' | 'search'>('add');

  // Step 4: Partners & Profits
  const [hasPartners, setHasPartners] = useState<'no' | 'yes'>('no');
  const [partners, setPartners] = useState<PartnerItem[]>([
    { id: '1', name: '', phone: '', capital: 0, sharePercentage: 50 },
  ]);

  // Step 5: Typography & Appearance
  const [selectedFont, setSelectedFont] = useState<AppFontId>(() => getStoredAppFont());
  const [selectedScale, setSelectedScale] = useState<UIScaleId>(() => getStoredUIScale());

  // Load any existing settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.storeSettings?.name) setStoreName(parsed.storeSettings.name);
        if (parsed.storeSettings?.phone) setStorePhone(parsed.storeSettings.phone);
        if (parsed.storeSettings?.address) setStoreAddress(parsed.storeSettings.address);
        if (parsed.storeSettings?.logo) setStoreLogo(parsed.storeSettings.logo);
        if (parsed.primaryCurrency) setPrimaryCurrency(parsed.primaryCurrency);
        if (parsed.exchangeRates?.TRY) setTryRate(Number(parsed.exchangeRates.TRY) || 32);
        if (parsed.exchangeRates?.SYP) setSypRate(Number(parsed.exchangeRates.SYP) || 14500);
        if (parsed.taxEnabled !== undefined) setTaxEnabled(!!parsed.taxEnabled);
        if (parsed.taxRate !== undefined) setTaxRate(Number(parsed.taxRate) || 5);
        if (parsed.discountPercentEnabled !== undefined) setDiscountPercentEnabled(!!parsed.discountPercentEnabled);
        if (parsed.discountFixedEnabled !== undefined) setDiscountFixedEnabled(!!parsed.discountFixedEnabled);
        if (parsed.barcodeScanMode) setBarcodeScanMode(parsed.barcodeScanMode);
        if (parsed.enabledCurrencies?.TRY !== undefined) setEnableTRY(!!parsed.enabledCurrencies.TRY);
        if (parsed.enabledCurrencies?.SYP !== undefined) setEnableSYP(!!parsed.enabledCurrencies.SYP);
      }
    } catch {}
  }, []);

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
      { id: Date.now().toString(), name: '', phone: '', capital: 0, sharePercentage: rem }
    ]);
  };

  const handleRemovePartner = (id: string) => {
    if (partners.length > 1) {
      setPartners(partners.filter(p => p.id !== id));
    }
  };

  const handleUpdatePartner = (id: string, field: keyof PartnerItem, value: any) => {
    setPartners(partners.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Save all settings and finish wizard
  const handleFinish = async () => {
    const finalStoreName = storeName.trim() || 'متجري التجاري';

    const newSettings = {
      storeSettings: {
        name: finalStoreName,
        type: storeType,
        phone: storePhone.trim(),
        address: storeAddress.trim(),
        logo: storeLogo,
      },
      primaryCurrency,
      enabledCurrencies: {
        USD: true,
        TRY: primaryCurrency === 'TRY' ? true : enableTRY,
        SYP: primaryCurrency === 'SYP' ? true : enableSYP,
      },
      exchangeRates: {
        USD: '1',
        TRY: String(tryRate || 32),
        SYP: String(sypRate || 14500),
      },
      currencyNames: {
        USD: 'دولار',
        TRY: 'ليرة تركية',
        SYP: 'ليرة سورية',
      },
      taxEnabled,
      taxRate: taxEnabled ? Number(taxRate || 0) : 0,
      discountPercentEnabled,
      discountFixedEnabled,
      barcodeScanMode,
    };

    // 1. Local Storage save
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      localStorage.setItem(STORE_TYPE_KEY, storeType);
      localStorage.setItem(TAX_KEY, JSON.stringify({
        enabled: taxEnabled,
        rate: taxRate,
        inclusive: false,
        name: 'ضريبة القيمة المضافة'
      }));
      localStorage.setItem('hyperpos_setup_complete', 'true');
    } catch (e) {
      console.warn('[SetupWizard] Failed to save to localStorage:', e);
    }

    // 2. Partners save if enabled
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

    // 3. Cloud store settings sync
    try {
      await saveStoreSettings({
        name: finalStoreName,
        store_type: storeType,
        phone: storePhone.trim(),
        address: storeAddress.trim(),
        logo_url: storeLogo,
        primary_currency: primaryCurrency,
        exchange_rates: { USD: 1, TRY: tryRate || 32, SYP: sypRate || 14500 },
        tax_enabled: taxEnabled,
        tax_rate: taxEnabled ? Number(taxRate || 0) : 0,
      });
    } catch (e) {
      console.warn('[SetupWizard] Cloud settings save fallback:', e);
    }

    // 4. Dispatch system events so POS, Sidebar, and Themes update immediately
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
    { id: 'repair', name: 'خدمات وصيانة', icon: Wrench, desc: 'أجور عمالة، قطع غيار، وأوامر عمل' },
    { id: 'general', name: 'تجزئة عامة ومتنوعة', icon: Store, desc: 'مخزون عام ومبيعات سريعة شاملة' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto flex items-center justify-center p-3 sm:p-6"
      dir={direction}
    >
      <div className="w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-3xl overflow-hidden flex flex-col my-auto transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Title & Progress Stepper */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/60 p-5 sm:p-6 pb-4">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  معالج الترحيب والإعداد الأولي
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تهيئة متجرك خطوة بخطوة للعمل بأعلى احترافية
                </p>
              </div>
            </div>

            <div className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full shrink-0">
              خطوة {step} من {totalSteps}
            </div>
          </div>

          {/* Stepper Tabs Bar */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[
              { num: 1, label: 'المتجر', icon: Store },
              { num: 2, label: 'العملات', icon: Coins },
              { num: 3, label: 'المبيعات', icon: Receipt },
              { num: 4, label: 'الشركاء', icon: Users },
              { num: 5, label: 'المظهر', icon: Palette },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isPast = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all border text-center",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold scale-[1.02]"
                      : isPast
                      ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 font-medium"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70"
                  )}
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
        <div className="p-5 sm:p-7 space-y-6 flex-1 min-h-[380px]">
          
          {/* STEP 1: هوية المتجر وبيانات الفاتورة */}
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
                          "flex flex-col items-start p-3 rounded-xl border text-right transition-all",
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

              {/* Notice */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-2.5 text-xs text-primary">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>
                  هذه البيانات ستظهر في أعلى إيصال الطباعة للزبائن، ويمكنك تعديلها لاحقاً من شاشة الإعدادات.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: العملات والأسعار */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  العملات والأسعار وطريقة العرض
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  اختر العملة اليومية للتداول وحدد أسعار الصرف لحساب الأرباح تلقائياً
                </p>
              </div>

              {/* Primary Currency Radio Cards */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">
                  العملة الافتراضية للبيع والعرض أمام الزبائن
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { code: 'USD' as const, symbol: '$', title: 'دولار أمريكي', badge: 'مرجع النظام' },
                    { code: 'TRY' as const, symbol: '₺', title: 'ليرة تركية', badge: 'عملة يومية' },
                    { code: 'SYP' as const, symbol: 'ل.س', title: 'ليرة سورية', badge: 'عملة محلية' },
                  ].map((curr) => {
                    const isSelected = primaryCurrency === curr.code;
                    return (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => {
                          setPrimaryCurrency(curr.code);
                          if (curr.code === 'TRY') setEnableTRY(true);
                          if (curr.code === 'SYP') setEnableSYP(true);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all relative",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/60 bg-card hover:bg-muted/40"
                        )}
                      >
                        <span className="text-2xl font-black text-primary mb-1">
                          {curr.symbol}
                        </span>
                        <span className="text-xs font-bold text-foreground">
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

              {/* Toggles to enable/disable specific currencies */}
              <div className="space-y-2.5 pt-2 border-t border-border/50">
                <label className="text-xs font-bold text-foreground">
                  تفعيل أو إلغاء ظهور العملات في شاشات البيع
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div>
                      <p className="text-xs font-bold text-foreground">الليرة التركية (₺ - TRY)</p>
                      <p className="text-[10px] text-muted-foreground">إظهار كخيار سداد وتبديل في السلة</p>
                    </div>
                    <Switch
                      checked={enableTRY || primaryCurrency === 'TRY'}
                      disabled={primaryCurrency === 'TRY'}
                      onCheckedChange={setEnableTRY}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div>
                      <p className="text-xs font-bold text-foreground">الليرة السورية (ل.س - SYP)</p>
                      <p className="text-[10px] text-muted-foreground">إظهار كخيار سداد وتبديل في السلة</p>
                    </div>
                    <Switch
                      checked={enableSYP || primaryCurrency === 'SYP'}
                      disabled={primaryCurrency === 'SYP'}
                      onCheckedChange={setEnableSYP}
                    />
                  </div>
                </div>
              </div>

              {/* Exchange Rates Inputs */}
              {(enableTRY || enableSYP || primaryCurrency !== 'USD') && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <label className="text-xs font-bold text-foreground">
                    تحديد أسعار الصرف المعتمدة مقابل 1 دولار ($)
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(enableTRY || primaryCurrency === 'TRY') && (
                      <div className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold">سعر الليرة التركية:</span>
                          <span className="text-primary font-mono font-bold">1 $ = {tryRate} ₺</span>
                        </div>
                        <Input
                          type="number"
                          step="0.1"
                          value={tryRate || ''}
                          onChange={(e) => setTryRate(Number(e.target.value))}
                          placeholder="مثال: 32"
                          className="h-9 text-xs font-bold bg-background"
                        />
                      </div>
                    )}

                    {(enableSYP || primaryCurrency === 'SYP') && (
                      <div className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold">سعر الليرة السورية:</span>
                          <span className="text-primary font-mono font-bold">1 $ = {formatNumber(sypRate)} ل.س</span>
                        </div>
                        <Input
                          type="number"
                          step="100"
                          value={sypRate || ''}
                          onChange={(e) => setSypRate(Number(e.target.value))}
                          placeholder="مثال: 14500"
                          className="h-9 text-xs font-bold bg-background"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Friendly Note */}
              <div className="p-3 bg-muted/50 border border-border/60 rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground">
                <Sparkles className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  ملاحظة: يمكنك تسعير بضاعتك بالعملة التي تناسبك، والنظام يقوم بحساب الفواتير والأرباح تلقائياً دون أي خربطة.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: إعدادات المبيعات والضريبة والباركود */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  إعدادات المبيعات والضريبة والباركود
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تحكم بخصائص الفوترة والضرائب وسلوك ماسح الباركود
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

                <p className="text-[11px] text-muted-foreground">
                  عند التفعيل، سيتم احتساب الضريبة بشكل منفصل وتوضيحها في الفاتورة للعميل.
                </p>
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

              {/* Barcode Scanner Behavior */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-primary" />
                  سلوك قارئ الباركود عند المسح
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBarcodeScanMode('add')}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-right transition-all",
                      barcodeScanMode === 'add'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-foreground">إضافة مباشرة للسلة</span>
                      {barcodeScanMode === 'add' && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      إدراج المنتج فور قراءته (الأسرع للسوبرماركت والتجزئة)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBarcodeScanMode('search')}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-right transition-all",
                      barcodeScanMode === 'search'
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-foreground">طلب الكمية والسعر أولاً</span>
                      {barcodeScanMode === 'search' && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      فتح نافذة لتأكيد الكمية والتعديل قبل الإضافة للسلة
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: قسم الشركاء والأرباح */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  قسم الشركاء والأرباح
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  توزيع أرباح المتجر آلياً وشفافية رأس المال دون دفاتر يدوية
                </p>
              </div>

              {/* Commercial Explanation Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted/40 border border-primary/20 space-y-2.5">
                <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  ما هو قسم الشركاء وكيف يفيدك؟
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  إذا كان معك شريك في رأس المال أو بنسبة من أرباح المتجر:
                </p>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span><strong>تسجيل الحصص:</strong> يمكنك تسجيل اسم الشريك ونسبته المئوية (مثل 30% أو 50%) بدقة.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span><strong>توزيع آلي فوري:</strong> يقوم البرنامج تلقائياً عند كل عملية بيع بحساب صافي الربح وتوزيع حصة الشريك بدقة دون دفاتر يدوية.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span><strong>تقارير مالية شفافة:</strong> يمكنك سحب تقرير مفصل لأرباح ومسحوبات كل شريك في أي وقت بضغطة زر.</span>
                  </div>
                </div>
              </div>

              {/* Partner Choice Radios */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">
                  هل لديك شركاء في رأس المال أو أرباح المحل؟
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setHasPartners('no')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all font-bold text-xs",
                      hasPartners === 'no'
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    لا، أعمل بمفردي (أو لاحقاً)
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasPartners('yes')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all font-bold text-xs",
                      hasPartners === 'yes'
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    نعم، لدي شركاء في المحل
                  </button>
                </div>
              </div>

              {/* Partner Input Rows */}
              {hasPartners === 'yes' && (
                <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">قائمة الشركاء والحصص</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPartner}
                      className="h-7 text-xs rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5 me-1" />
                      إضافة شريك
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                    {partners.map((p, idx) => (
                      <div key={p.id} className="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">الشريك {idx + 1}</span>
                          {partners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePartner(p.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Input
                            placeholder="اسم الشريك"
                            value={p.name}
                            onChange={(e) => handleUpdatePartner(p.id, 'name', e.target.value)}
                            className="h-8 text-xs font-medium"
                          />
                          <Input
                            type="number"
                            placeholder="رأس المال ($)"
                            value={p.capital || ''}
                            onChange={(e) => handleUpdatePartner(p.id, 'capital', Number(e.target.value))}
                            className="h-8 text-xs"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="النسبة %"
                              value={p.sharePercentage || ''}
                              onChange={(e) => handleUpdatePartner(p.id, 'sharePercentage', Number(e.target.value))}
                              className="h-8 text-xs font-bold text-center"
                            />
                            <span className="text-xs font-bold text-muted-foreground">%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-muted/60 rounded-xl text-xs font-bold">
                    <span>مجموع نسب الأرباح الموزعة:</span>
                    <span className={cn(
                      "font-mono",
                      partners.reduce((s, p) => s + (p.sharePercentage || 0), 0) === 100
                        ? "text-success"
                        : "text-warning"
                    )}>
                      {partners.reduce((s, p) => s + (p.sharePercentage || 0), 0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: الخطوط وحجم الواجهة والمظهر */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  الخطوط وحجم الواجهة والمظهر
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  اختر الخط المناسب وحجم العرض المريح لعينيك أمام الشاشة
                </p>
              </div>

              {/* Font Family Selector in a clean row */}
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
                          "py-2.5 px-3 rounded-xl border text-right transition-all flex items-center justify-between",
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
                          "py-2 px-1 rounded-xl border text-center transition-all",
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
                      "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all",
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
                      "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all",
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
        <div className="p-4 sm:p-6 bg-muted/30 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Back button */}
          <div className="w-full sm:w-auto">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="w-full sm:w-auto h-10 px-5 rounded-xl text-xs font-bold"
              >
                {isRTL ? <ArrowRight className="w-4 h-4 me-1.5" /> : <ArrowLeft className="w-4 h-4 me-1.5" />}
                السابق
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={handleFinish}
                className="w-full sm:w-auto h-10 px-4 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              >
                تخطي والبدء بالافتراضيات
              </Button>
            )}
          </div>

          {/* Forward / Finish buttons */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            {step < totalSteps && (
              <button
                type="button"
                onClick={handleFinish}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 transition-colors hidden sm:block"
              >
                تخطي الباقي
              </button>
            )}

            {step < totalSteps ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                className="w-full sm:w-auto h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
              >
                التالي
                {isRTL ? <ArrowLeft className="w-4 h-4 ms-1.5" /> : <ArrowRight className="w-4 h-4 ms-1.5" />}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinish}
                className="w-full sm:w-auto h-10 px-7 rounded-xl text-xs font-bold bg-success hover:bg-success/90 text-success-foreground shadow-md shadow-success/20 animate-pulse"
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
