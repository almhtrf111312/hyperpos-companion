import { useState } from 'react';
import {
  Store, Users, DollarSign, CheckCircle, ArrowLeft, ArrowRight, Plus, Trash2,
  Percent, Printer, Boxes, CreditCard, BookOpen, Wrench, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { savePartners, Partner } from '@/lib/partners-store';
import { useLanguage } from '@/hooks/use-language';

interface SetupWizardProps {
  onComplete: () => void;
}

interface PartnerInput {
  id: string;
  name: string;
  phone: string;
  capital: number;
  sharePercentage: number;
  expenseSharePercentage: number;
}

const SETTINGS_KEY = 'hyperpos_settings_v1';
const TAX_KEY = 'hyperpos_tax_settings';
const PRINT_KEY = 'hyperpos_print_settings';
const FEATURES_KEY = 'hyperpos_enabled_features';
const STORE_TYPE_KEY = 'hyperpos_store_type';
const LANG_KEY = 'hyperpos_language';

type Lang = 'ar' | 'en';
const tt = (lang: Lang, ar: string, en: string) => (lang === 'ar' ? ar : en);

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { language, isRTL, direction } = useLanguage();
  const lang: Lang = language === 'en' ? 'en' : 'ar';
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 1: Store Info
  const [storeInfo, setStoreInfo] = useState({
    name: '',
    type: 'retail',
    phone: '',
    address: '',
  });

  // Step 2: Currencies
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'TRY' | 'SYP' | 'EUR'>('USD');
  const [currencies, setCurrencies] = useState({ TRY: 32, SYP: 14500, EUR: 0.92 });

  // Step 3: Tax
  const [tax, setTax] = useState({
    enabled: false,
    rate: 0,
    inclusive: false,
    name: lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT',
  });

  // Step 4: Invoice / Print
  const [invoiceSettings, setInvoiceSettings] = useState({
    startingNumber: 1,
    printerWidth: '80mm' as '58mm' | '80mm' | 'A4',
    footer: lang === 'ar' ? 'شكراً لزيارتكم' : 'Thank you for your visit',
    soundEnabled: true,
  });

  // Step 5: Capital + Partners
  const [partners, setPartners] = useState<PartnerInput[]>([
    { id: '1', name: '', phone: '', capital: 0, sharePercentage: 100, expenseSharePercentage: 100 }
  ]);

  // Step 6: Optional features
  const [features, setFeatures] = useState({
    warehouses: false,
    debts: true,
    maintenance: false,
    library: false,
    multiCashier: false,
  });

  const addPartner = () => {
    const totalShare = partners.reduce((sum, p) => sum + p.sharePercentage, 0);
    const remaining = Math.max(0, 100 - totalShare);
    setPartners([...partners, {
      id: Date.now().toString(),
      name: '', phone: '', capital: 0,
      sharePercentage: remaining, expenseSharePercentage: remaining,
    }]);
  };
  const removePartner = (id: string) => {
    if (partners.length > 1) setPartners(partners.filter(p => p.id !== id));
  };
  const updatePartner = (id: string, field: keyof PartnerInput, value: string | number) => {
    setPartners(partners.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleComplete = () => {
    if (!storeInfo.name) {
      toast.error(tt(lang, 'يرجى إدخال اسم المتجر', 'Please enter the store name'));
      setStep(1);
      return;
    }
    const validPartners = partners.filter(p => p.name);

    // 1) Store settings
    const settings = {
      storeSettings: {
        name: storeInfo.name,
        type: storeInfo.type,
        phone: storeInfo.phone,
        address: storeInfo.address,
      },
      primaryCurrency,
      exchangeRates: {
        TRY: String(currencies.TRY),
        SYP: String(currencies.SYP),
        EUR: String(currencies.EUR),
      },
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(STORE_TYPE_KEY, storeInfo.type);

    // 2) Tax
    localStorage.setItem(TAX_KEY, JSON.stringify(tax));

    // 3) Print/invoice
    localStorage.setItem(PRINT_KEY, JSON.stringify(invoiceSettings));

    // 4) Features
    localStorage.setItem(FEATURES_KEY, JSON.stringify(features));

    // 5) Partners
    if (validPartners.length > 0) {
      const now = new Date().toISOString();
      const partnersToSave: Partner[] = validPartners.map(p => ({
        id: `partner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: p.name,
        phone: p.phone,
        sharePercentage: p.sharePercentage,
        expenseSharePercentage: p.expenseSharePercentage,
        categoryShares: [],
        accessAll: true,
        sharesExpenses: true,
        initialCapital: p.capital,
        currentCapital: p.capital,
        capitalWithdrawals: [],
        capitalHistory: p.capital > 0 ? [{
          id: `cap-${Date.now()}`,
          amount: p.capital,
          type: 'deposit' as const,
          date: now.split('T')[0],
          notes: tt(lang, 'رأس مال أولي', 'Initial capital'),
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

    localStorage.setItem('hyperpos_setup_complete', 'true');
    // Broadcast that setup is done so the onboarding tour can start
    window.dispatchEvent(new CustomEvent('setup:complete'));
    // Trigger store type change so sidebar/POS refresh
    window.dispatchEvent(new CustomEvent('storeTypeChanged'));

    toast.success(tt(lang, 'تم إعداد المتجر بنجاح!', 'Store setup complete!'));
    onComplete();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Store className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{tt(lang, 'معلومات المتجر', 'Store Info')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{tt(lang, 'أدخل المعلومات الأساسية لمتجرك', 'Basic info about your store')}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'اسم المتجر *', 'Store name *')}</label>
                <Input value={storeInfo.name} onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'نوع النشاط', 'Store type')}</label>
                <select className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground" value={storeInfo.type} onChange={(e) => setStoreInfo({ ...storeInfo, type: e.target.value })}>
                  <option value="retail">{tt(lang, 'تجزئة عام', 'General Retail')}</option>
                  <option value="phones">{tt(lang, 'هواتف', 'Phones')}</option>
                  <option value="grocery">{tt(lang, 'بقالة', 'Grocery')}</option>
                  <option value="pharmacy">{tt(lang, 'صيدلية', 'Pharmacy')}</option>
                  <option value="clothing">{tt(lang, 'ملابس', 'Clothing')}</option>
                  <option value="restaurant">{tt(lang, 'مطعم', 'Restaurant')}</option>
                  <option value="bakery">{tt(lang, 'مخبز', 'Bakery')}</option>
                  <option value="bookstore">{tt(lang, 'مكتبة', 'Bookstore')}</option>
                  <option value="repair">{tt(lang, 'صيانة', 'Repair')}</option>
                  <option value="wholesale">{tt(lang, 'جملة', 'Wholesale')}</option>
                  <option value="services">{tt(lang, 'خدمات', 'Services')}</option>
                  <option value="custom">{tt(lang, 'أخرى', 'Other')}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder={tt(lang, 'هاتف', 'Phone')} value={storeInfo.phone} onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })} />
                <Input placeholder={tt(lang, 'العنوان', 'Address')} value={storeInfo.address} onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })} />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-7 h-7 text-warning" />
              </div>
              <h2 className="text-xl font-bold">{tt(lang, 'العملات', 'Currencies')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{tt(lang, 'حدد العملة الأساسية وأسعار الصرف', 'Primary currency and exchange rates')}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'العملة الأساسية', 'Primary currency')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['USD', 'TRY', 'SYP', 'EUR'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrimaryCurrency(c)}
                      className={cn(
                        "h-10 rounded-md border text-sm font-medium transition-colors",
                        primaryCurrency === c ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
                      )}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'سعر الليرة التركية مقابل 1$', 'TRY per 1 USD')}</label>
                <Input type="number" value={currencies.TRY || ''} onChange={(e) => setCurrencies({ ...currencies, TRY: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'سعر الليرة السورية مقابل 1$', 'SYP per 1 USD')}</label>
                <Input type="number" value={currencies.SYP || ''} onChange={(e) => setCurrencies({ ...currencies, SYP: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'سعر اليورو مقابل 1$', 'EUR per 1 USD')}</label>
                <Input type="number" step="0.01" value={currencies.EUR || ''} onChange={(e) => setCurrencies({ ...currencies, EUR: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-info/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Percent className="w-7 h-7 text-info" />
              </div>
              <h2 className="text-xl font-bold">{tt(lang, 'الضرائب', 'Taxes')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{tt(lang, 'فعّل الضريبة إذا كانت مطلوبة', 'Enable tax if required')}</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div>
                  <p className="font-medium text-sm">{tt(lang, 'تفعيل الضريبة', 'Enable tax')}</p>
                  <p className="text-xs text-muted-foreground">{tt(lang, 'إضافة ضريبة لكل فاتورة', 'Add tax to every invoice')}</p>
                </div>
                <Switch checked={tax.enabled} onCheckedChange={(v) => setTax({ ...tax, enabled: v })} />
              </div>
              {tax.enabled && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'اسم الضريبة', 'Tax name')}</label>
                    <Input value={tax.name} onChange={(e) => setTax({ ...tax, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'نسبة الضريبة (%)', 'Tax rate (%)')}</label>
                    <Input type="number" value={tax.rate || ''} onChange={(e) => setTax({ ...tax, rate: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div>
                      <p className="font-medium text-sm">{tt(lang, 'الضريبة شاملة في السعر', 'Tax-inclusive pricing')}</p>
                      <p className="text-xs text-muted-foreground">{tt(lang, 'إذا كان السعر يتضمن الضريبة', 'Price already includes tax')}</p>
                    </div>
                    <Switch checked={tax.inclusive} onCheckedChange={(v) => setTax({ ...tax, inclusive: v })} />
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Printer className="w-7 h-7 text-success" />
              </div>
              <h2 className="text-xl font-bold">{tt(lang, 'الفاتورة والطباعة', 'Invoice & Printing')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{tt(lang, 'إعدادات الفواتير والطباعة', 'Invoice & printing setup')}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'رقم بداية الفواتير', 'Starting invoice number')}</label>
                <Input type="number" value={invoiceSettings.startingNumber || ''} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, startingNumber: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'عرض الطابعة', 'Printer width')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['58mm', '80mm', 'A4'] as const).map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setInvoiceSettings({ ...invoiceSettings, printerWidth: w })}
                      className={cn(
                        "h-10 rounded-md border text-sm font-medium transition-colors",
                        invoiceSettings.printerWidth === w ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
                      )}
                    >{w}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{tt(lang, 'تذييل الفاتورة', 'Invoice footer')}</label>
                <Input value={invoiceSettings.footer} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footer: e.target.value })} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div>
                  <p className="font-medium text-sm">{tt(lang, 'تفعيل صوت تأكيد البيع', 'Sale confirmation sound')}</p>
                </div>
                <Switch checked={invoiceSettings.soundEnabled} onCheckedChange={(v) => setInvoiceSettings({ ...invoiceSettings, soundEnabled: v })} />
              </div>
            </div>
          </div>
        );

      case 5: {
        const totalShare = partners.reduce((sum, p) => sum + p.sharePercentage, 0);
        const totalCapital = partners.reduce((sum, p) => sum + p.capital, 0);
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{tt(lang, 'رأس المال والشركاء', 'Capital & Partners')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{tt(lang, 'أضف الشركاء وحدد حصصهم (اختياري)', 'Add partners and their shares (optional)')}</p>
            </div>
            <div className="space-y-3">
              {partners.map((partner, index) => (
                <div key={partner.id} className="bg-muted/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{tt(lang, `الشريك ${index + 1}`, `Partner ${index + 1}`)}</span>
                    {partners.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePartner(partner.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={tt(lang, 'الاسم', 'Name')} value={partner.name} onChange={(e) => updatePartner(partner.id, 'name', e.target.value)} />
                    <Input placeholder={tt(lang, 'الهاتف', 'Phone')} value={partner.phone} onChange={(e) => updatePartner(partner.id, 'phone', e.target.value)} />
                    <Input type="number" placeholder={tt(lang, 'رأس المال', 'Capital')} value={partner.capital || ''} onChange={(e) => updatePartner(partner.id, 'capital', Number(e.target.value))} />
                    <Input type="number" placeholder={tt(lang, 'نسبة الربح %', 'Share %')} value={partner.sharePercentage || ''} onChange={(e) => updatePartner(partner.id, 'sharePercentage', Number(e.target.value))} />
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={addPartner}>
                <Plus className="w-4 h-4 me-2" />{tt(lang, 'إضافة شريك', 'Add partner')}
              </Button>
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{tt(lang, 'مجموع الحصص', 'Total shares')}</span>
                  <span className={cn("font-bold", totalShare === 100 ? "text-success" : "text-warning")}>{totalShare}%</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">{tt(lang, 'إجمالي رأس المال', 'Total capital')}</span>
                  <span className="font-bold">${formatNumber(totalCapital)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 6:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-info/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-info" />
              </div>
              <h2 className="text-xl font-bold">{tt(lang, 'الميزات المتقدمة', 'Advanced Features')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{tt(lang, 'فعّل ما تحتاجه فقط (يمكن تغييره لاحقاً)', 'Enable only what you need (changeable later)')}</p>
            </div>
            <div className="space-y-2">
              {[
                { key: 'warehouses' as const, icon: Boxes, ar: 'مستودعات متعددة', en: 'Multiple warehouses', descAr: 'إدارة مخازن متعددة وتحويل البضاعة', descEn: 'Manage multiple stores and transfer stock' },
                { key: 'debts' as const, icon: CreditCard, ar: 'الديون', en: 'Debts', descAr: 'البيع بالدين وتتبع المستحقات', descEn: 'Sell on credit and track receivables' },
                { key: 'maintenance' as const, icon: Wrench, ar: 'الصيانة', en: 'Maintenance', descAr: 'أوامر صيانة وإصلاح', descEn: 'Repair and maintenance orders' },
                { key: 'library' as const, icon: BookOpen, ar: 'المكتبة', en: 'Library', descAr: 'أعضاء وإعارة الكتب', descEn: 'Members and book loans' },
                { key: 'multiCashier' as const, icon: Users, ar: 'كاشيرات متعددة', en: 'Multiple cashiers', descAr: 'إنشاء حسابات لموظفي الكاشير', descEn: 'Create accounts for cashier staff' },
              ].map(feat => {
                const Icon = feat.icon;
                return (
                  <div key={feat.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{tt(lang, feat.ar, feat.en)}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{tt(lang, feat.descAr, feat.descEn)}</p>
                      </div>
                    </div>
                    <Switch checked={features[feat.key]} onCheckedChange={(v) => setFeatures({ ...features, [feat.key]: v })} />
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const skipAll = () => {
    // Save minimum: store name + defaults
    if (!storeInfo.name) {
      toast.error(tt(lang, 'يرجى إدخال اسم المتجر أولاً', 'Please enter the store name first'));
      setStep(1);
      return;
    }
    handleComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={direction}>
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all",
                i + 1 <= step ? "bg-primary w-6" : "bg-muted w-3"
              )}
            />
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 md:p-7">
          {renderStep()}

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
                {isRTL ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />}
                {tt(lang, 'السابق', 'Previous')}
              </Button>
            )}
            {step < totalSteps ? (
              <Button className="flex-1" onClick={() => setStep(step + 1)}>
                {tt(lang, 'التالي', 'Next')}
                {isRTL ? <ArrowLeft className="w-4 h-4 ms-2" /> : <ArrowRight className="w-4 h-4 ms-2" />}
              </Button>
            ) : (
              <Button className="flex-1 bg-success hover:bg-success/90" onClick={handleComplete}>
                <CheckCircle className="w-4 h-4 me-2" />
                {tt(lang, 'إنهاء الإعداد', 'Finish setup')}
              </Button>
            )}
          </div>

          {step > 1 && step < totalSteps && (
            <button
              type="button"
              onClick={skipAll}
              className="w-full text-center mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {tt(lang, 'تخطي باقي الخطوات واستخدام الافتراضات', 'Skip remaining steps and use defaults')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
