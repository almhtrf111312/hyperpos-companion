import { useState } from 'react';
import {
  Store,
  Users,
  DollarSign,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { savePartners, Partner } from '@/lib/partners-store';

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

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Step 1: Store Info
  const [storeInfo, setStoreInfo] = useState({
    name: '',
    type: 'retail',
    phone: '',
    address: '',
  });

  // Step 2: Initial Capital
  const [capital, setCapital] = useState({
    total: 0,
  });

  // Step 3: Partners
  const [partners, setPartners] = useState<PartnerInput[]>([
    { id: '1', name: '', phone: '', capital: 0, sharePercentage: 100, expenseSharePercentage: 100 }
  ]);

  // Step 4: Currencies
  const [currencies, setCurrencies] = useState({
    TRY: 32,
    SYP: 14500,
  });

  const addPartner = () => {
    const totalShare = partners.reduce((sum, p) => sum + p.sharePercentage, 0);
    const remainingShare = Math.max(0, 100 - totalShare);
    setPartners([...partners, {
      id: Date.now().toString(),
      name: '',
      phone: '',
      capital: 0,
      sharePercentage: remainingShare,
      expenseSharePercentage: remainingShare
    }]);
  };

  const removePartner = (id: string) => {
    if (partners.length > 1) {
      setPartners(partners.filter(p => p.id !== id));
    }
  };

  const updatePartner = (id: string, field: keyof PartnerInput, value: string | number) => {
    setPartners(partners.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleComplete = () => {
    // Validate
    if (!storeInfo.name) {
      toast.error('يرجى إدخال اسم المحل');
      setStep(1);
      return;
    }

    const validPartners = partners.filter(p => p.name);
    if (validPartners.length === 0) {
      toast.error('يرجى إضافة شريك واحد على الأقل');
      setStep(3);
      return;
    }

    // Save store settings
    const settings = {
      storeSettings: {
        name: storeInfo.name,
        type: storeInfo.type,
        phone: storeInfo.phone,
        address: storeInfo.address,
      },
      exchangeRates: {
        TRY: currencies.TRY.toString(),
        SYP: currencies.SYP.toString(),
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    // Save partners
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
        notes: 'رأس مال أولي'
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

    // Mark setup as complete
    localStorage.setItem('hyperpos_setup_complete', 'true');

    toast.success('تم إعداد المحل بنجاح!');
    onComplete();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">معلومات المحل</h2>
              <p className="text-muted-foreground mt-2">أدخل المعلومات الأساسية لمحلك</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">اسم المحل *</label>
                <Input
                  placeholder="مثال: محل الإلكترونيات"
                  value={storeInfo.name}
                  onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">نوع النشاط</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  value={storeInfo.type}
                  onChange={(e) => setStoreInfo({ ...storeInfo, type: e.target.value })}
                >
                  <option value="retail">بيع تجزئة</option>
                  <option value="wholesale">بيع جملة</option>
                  <option value="phones">هواتف وإلكترونيات</option>
                  <option value="grocery">بقالة</option>
                  <option value="pharmacy">صيدلية</option>
                   <option value="restaurant">مطعم</option>
                  <option value="bakery">فرن / مخبز</option>
                  <option value="services">خدمات</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">رقم الهاتف</label>
                <Input
                  placeholder="+963 912 345 678"
                  value={storeInfo.phone}
                  onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">العنوان</label>
                <Input
                  placeholder="دمشق، شارع النيل"
                  value={storeInfo.address}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold">رأس المال</h2>
              <p className="text-muted-foreground mt-2">حدد رأس المال الأولي للمحل</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">رأس المال الإجمالي ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={capital.total || ''}
                  onChange={(e) => setCapital({ ...capital, total: Number(e.target.value) })}
                  className="text-2xl h-14 text-center"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                سيتم توزيع رأس المال على الشركاء في الخطوة التالية
              </p>
            </div>
          </div>
        );

      case 3:
        const totalShare = partners.reduce((sum, p) => sum + p.sharePercentage, 0);
        const totalCapital = partners.reduce((sum, p) => sum + p.capital, 0);

        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-info/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-info" />
              </div>
              <h2 className="text-2xl font-bold">الشركاء</h2>
              <p className="text-muted-foreground mt-2">أضف الشركاء وحدد نسبهم</p>
            </div>

            <div className="space-y-4">
              {partners.map((partner, index) => (
                <div key={partner.id} className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">الشريك {index + 1}</span>
                    {partners.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removePartner(partner.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="الاسم *"
                      value={partner.name}
                      onChange={(e) => updatePartner(partner.id, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="الهاتف"
                      value={partner.phone}
                      onChange={(e) => updatePartner(partner.id, 'phone', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="رأس المال"
                      value={partner.capital || ''}
                      onChange={(e) => updatePartner(partner.id, 'capital', Number(e.target.value))}
                    />
                    <Input
                      type="number"
                      placeholder="نسبة الأرباح %"
                      value={partner.sharePercentage || ''}
                      onChange={(e) => updatePartner(partner.id, 'sharePercentage', Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full"
                onClick={addPartner}
              >
                <Plus className="w-4 h-4 ml-2" />
                إضافة شريك
              </Button>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">مجموع النسب:</span>
                  <span className={cn("font-bold", totalShare === 100 ? "text-success" : "text-destructive")}>
                    {totalShare}%
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">مجموع رأس المال:</span>
                  <span className="font-bold">${formatNumber(totalCapital)}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-warning" />
              </div>
              <h2 className="text-2xl font-bold">العملات</h2>
              <p className="text-muted-foreground mt-2">حدد أسعار الصرف</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">الليرة التركية (1 دولار = ؟ TRY)</label>
                <Input
                  type="number"
                  value={currencies.TRY || ''}
                  onChange={(e) => setCurrencies({ ...currencies, TRY: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">الليرة السورية (1 دولار = ؟ SYP)</label>
                <Input
                  type="number"
                  value={currencies.SYP || ''}
                  onChange={(e) => setCurrencies({ ...currencies, SYP: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all",
                i + 1 <= step ? "bg-primary w-8" : "bg-muted w-4"
              )}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
          {renderStep()}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(step - 1)}
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                السابق
              </Button>
            )}

            {step < totalSteps ? (
              <Button
                className="flex-1"
                onClick={() => setStep(step + 1)}
              >
                التالي
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            ) : (
              <Button
                className="flex-1 bg-success hover:bg-success/90"
                onClick={handleComplete}
              >
                <CheckCircle className="w-4 h-4 ml-2" />
                إنهاء الإعداد
              </Button>
            )}
          </div>
        </div>

        {/* Skip */}
        <div className="text-center mt-4">
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              localStorage.setItem('hyperpos_setup_complete', 'true');
              onComplete();
            }}
          >
            تخطي الإعداد
          </button>
        </div>
      </div>
    </div>
  );
}