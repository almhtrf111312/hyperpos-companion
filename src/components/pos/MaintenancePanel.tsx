import { useState, useRef } from 'react';
import {
  Wrench,
  User,
  Phone,
  DollarSign,
  Calculator,
  Banknote,
  CreditCard,
  Share2,
  Send,
  Check,
  X,
  Smartphone,
  Watch,
  Laptop,
  Tablet,
  Headphones,
  Monitor,
  Package,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { addInvoiceCloud } from '@/lib/cloud/invoices-cloud';
import { distributeDetailedProfitCloud } from '@/lib/cloud/partners-cloud';
import { addDebtFromInvoiceCloud } from '@/lib/cloud/debts-cloud';
import { addExpenseCloud } from '@/lib/cloud/expenses-cloud';
import { loadCustomersCloud } from '@/lib/cloud/customers-cloud';
import { addActivityLog } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';
import { printHTML, getStoreSettings, getPrintSettings } from '@/lib/print-utils';
import { shareInvoice, InvoiceShareData } from '@/lib/native-share';
import { playSaleComplete, playDebtRecorded } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';

interface Currency {
  code: 'USD' | 'TRY' | 'SYP';
  symbol: string;
  name: string;
  rate: number;
}

interface MaintenancePanelProps {
  currencies: Currency[];
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  onClose?: () => void;
  isMobile?: boolean;
  fullWidth?: boolean;
}

export function MaintenancePanel({
  currencies,
  selectedCurrency,
  onCurrencyChange,
  onClose,
  isMobile = false,
  fullWidth = false,
}: MaintenancePanelProps) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [productType, setProductType] = useState('');
  const [description, setDescription] = useState('');
  const [servicePrice, setServicePrice] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);

  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  // ✅ Mutex lock to prevent duplicate saves
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const profit = servicePrice - partsCost;
  const servicePriceInCurrency = servicePrice * selectedCurrency.rate;

  const serviceTypes = [
    { value: 'repair', label: t('maintenance.serviceTypes.repair') },
    { value: 'setup', label: t('maintenance.serviceTypes.setup') },
    { value: 'account', label: t('maintenance.serviceTypes.account') },
    { value: 'unlock', label: t('maintenance.serviceTypes.unlock') },
    { value: 'software', label: t('maintenance.serviceTypes.software') },
    { value: 'data', label: t('maintenance.serviceTypes.data') },
    { value: 'cleaning', label: t('maintenance.serviceTypes.cleaning') },
    { value: 'other', label: t('maintenance.serviceTypes.other') },
  ];

  const productTypes = [
    { value: 'phone', label: t('maintenance.deviceTypes.phone'), icon: Smartphone },
    { value: 'tablet', label: t('maintenance.deviceTypes.tablet'), icon: Tablet },
    { value: 'laptop', label: t('maintenance.deviceTypes.laptop'), icon: Laptop },
    { value: 'watch', label: t('maintenance.deviceTypes.watch'), icon: Watch },
    { value: 'headphones', label: t('maintenance.deviceTypes.headphones'), icon: Headphones },
    { value: 'monitor', label: t('maintenance.deviceTypes.monitor'), icon: Monitor },
    { value: 'other', label: t('maintenance.deviceTypes.other'), icon: Package },
  ];

  const getServiceLabel = () => serviceTypes.find(s => s.value === serviceType)?.label || '';
  const getProductLabel = () => productTypes.find(p => p.value === productType)?.label || '';

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setServiceType('');
    setProductType('');
    setDescription('');
    setServicePrice(0);
    setPartsCost(0);
  };

  const validateForm = () => {
    if (servicePrice <= 0) {
      toast.error(t('maintenance.enterAmount'));
      return false;
    }
    return true;
  };

  // Get effective customer name - default to maintenance label if empty
  const getEffectiveCustomerName = () => {
    return customerName.trim() || 'فاتورة صيانة نقدي';
  };

  const handleCashSale = () => {
    if (!validateForm()) return;
    setShowCashDialog(true);
  };

  const handleDebtSale = async () => {
    if (!validateForm()) return;

    // التحقق إذا كان العميل موجوداً في قاعدة البيانات
    const existingCustomers = await loadCustomersCloud();
    const customerExists = existingCustomers.some(c =>
      c.name.toLowerCase() === customerName.toLowerCase().trim()
    );
    setIsNewCustomer(!customerExists);

    setShowDebtDialog(true);
  };

  const confirmSale = async (paymentType: 'cash' | 'debt') => {
    // ✅ Mutex lock to prevent duplicate saves
    if (isSaving || savingRef.current) {
      console.log('[MaintenancePanel] Already saving, ignoring click');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      const effectiveName = getEffectiveCustomerName();
      const fullDescription = [
        getServiceLabel(),
        getProductLabel(),
        description
      ].filter(Boolean).join(' - ');

      // ✅ Add to invoices using Cloud API
      const invoice = await addInvoiceCloud({
        type: 'maintenance',
        customerName: effectiveName,
        customerPhone,
        items: [],
        subtotal: servicePrice,
        discount: 0,
        total: servicePrice,
        totalInCurrency: servicePriceInCurrency,
        currency: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        paymentType,
        status: paymentType === 'cash' ? 'paid' : 'pending',
        serviceDescription: fullDescription,
        serviceType: getServiceLabel(),
        productType: getProductLabel(),
        partsCost,
        profit,
      });

      if (!invoice) {
        toast.error('فشل في حفظ الفاتورة');
        return;
      }

      // ✅ تسجيل تكلفة القطع كمصروف تلقائي (إذا كانت أكبر من 0) - Cloud API
      if (partsCost > 0) {
        await addExpenseCloud({
          type: 'equipment',
          customType: 'قطع غيار صيانة',
          amount: partsCost,
          notes: `قطع غيار لخدمة صيانة - العميل: ${effectiveName} - الفاتورة: ${invoice.id}`,
          date: new Date().toISOString().split('T')[0],
        });
      }

      // ✅ Distribute profit to partners (category: صيانة) - Cloud API
      if (profit > 0) {
        await distributeDetailedProfitCloud(
          [{ category: 'صيانة', profit }],
          invoice.id,
          customerName,
          paymentType === 'debt',
          profit  // ✅ Pass as authoritative since it's directly calculated from user input
        );
      }

      // ✅ Create debt record if payment is debt - Cloud API
      if (paymentType === 'debt') {
        await addDebtFromInvoiceCloud(invoice.id, effectiveName, customerPhone, servicePrice);
      }

      // Log activity with detailed information
      if (user) {
        addActivityLog(
          'maintenance',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `خدمة صيانة ${paymentType === 'cash' ? 'نقدي' : 'بالدين'} بقيمة $${formatNumber(servicePrice)} للعميل ${effectiveName} - نوع الخدمة: ${getServiceLabel() || 'غير محدد'} - نوع الجهاز: ${getProductLabel() || 'غير محدد'}`,
          {
            invoiceId: invoice.id,
            total: servicePrice,
            customerName: effectiveName,
            paymentType,
            serviceType: getServiceLabel(),
            productType: getProductLabel(),
            partsCost,
            profit,
            description: fullDescription
          }
        );

        if (paymentType === 'debt') {
          addActivityLog(
            'debt_created',
            user.id,
            profile?.full_name || user.email || 'مستخدم',
            `تم إنشاء دين صيانة للعميل ${effectiveName} بقيمة $${formatNumber(servicePrice)}`,
            { invoiceId: invoice.id, amount: servicePrice, customerName: effectiveName }
          );
        }
      }

      // Play appropriate sound
      if (paymentType === 'cash') {
        playSaleComplete();
      } else {
        playDebtRecorded();
      }

      toast.success(paymentType === 'cash'
        ? t('maintenance.cashRecorded')
        : t('maintenance.debtRecorded')
      );

      setShowCashDialog(false);
      setShowDebtDialog(false);
      resetForm();
    } catch (error) {
      console.error('[MaintenancePanel] Error saving:', error);
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleShareInvoiceImage = async () => {
    if (!validateForm()) return;

    const storeSettings = getStoreSettings();
    const currentDate = new Date().toLocaleDateString('ar-SA');
    const fullDescription = [getServiceLabel(), getProductLabel(), description].filter(Boolean).join(' - ');

    const shareData: InvoiceShareData = {
      id: `MNT-${Date.now().toString().slice(-6)}`,
      storeName: storeSettings.name,
      storePhone: storeSettings.phone,
      storeAddress: storeSettings.address,
      storeLogo: storeSettings.logo,
      customerName: getEffectiveCustomerName(),
      customerPhone: customerPhone || undefined,
      date: currentDate,
      items: [{
        name: fullDescription || 'خدمة صيانة',
        quantity: 1,
        unitPrice: servicePriceInCurrency,
        total: servicePriceInCurrency,
      }],
      subtotal: servicePriceInCurrency,
      total: servicePriceInCurrency,
      currencySymbol: selectedCurrency.symbol,
      paymentType: 'cash',
      type: 'maintenance',
      serviceDescription: fullDescription,
    };

    const success = await shareInvoice(shareData);
    if (success) {
      toast.success('تم فتح نافذة المشاركة');
    }
  };

  const handleWhatsApp = () => {
    if (!validateForm()) return;

    let storeName = 'HyperPOS Store';
    let storeAddress = '';
    let storePhone = '';
    let footer = 'شكراً لتعاملكم معنا!';

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storeAddress = settings.storeSettings?.address || '';
        storePhone = settings.storeSettings?.phone || '';
        footer = settings.printSettings?.footer || footer;
      }
    } catch {
      // Ignore parsing errors
    }

    const currentDate = new Date().toLocaleDateString('ar-SA');
    const fullDescription = [getServiceLabel(), getProductLabel(), description].filter(Boolean).join(' - ');

    const message = `╔══════════════════╗
    *${storeName}*
${storeAddress ? `📍 ${storeAddress}` : ''}
${storePhone ? `📞 ${storePhone}` : ''}
╚══════════════════╝

🔧 *فاتورة خدمة صيانة*
📅 ${currentDate}

━━━━━━━━━━━━━━━━━━
👤 *${t('maintenance.customer')}:* ${getEffectiveCustomerName()}
${customerPhone ? `📱 *${t('maintenance.phoneNumber')}:* ${customerPhone}` : ''}
${fullDescription ? `📝 *${t('maintenance.serviceType')}:* ${fullDescription}` : ''}
━━━━━━━━━━━━━━━━━━

💰 *${t('maintenance.total')}:* ${selectedCurrency.symbol}${formatNumber(servicePriceInCurrency)}

${footer}`;

    const phone = customerPhone?.replace(/[^\d]/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  return (
    <>
      <div className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl flex flex-col h-full shadow-2xl",
        isMobile ? "rounded-t-2xl" : fullWidth ? "" : "border-r border-border"
      )}>
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-border/40 bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h2 className="font-bold text-base md:text-lg">{t('maintenance.quickService')}</h2>
            </div>
            {isMobile && onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('maintenance.directBilling')}</p>
        </div>

        {/* Form */}
        <div className={cn(
          "flex-1 overflow-y-auto p-3 md:p-4",
          fullWidth ? "max-w-3xl mx-auto w-full" : ""
        )}>
          <div className={cn(
            "space-y-4",
            fullWidth ? "grid md:grid-cols-2 gap-6" : ""
          )}>
            {/* Left Column - Customer & Service Info */}
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">{t('maintenance.customerInfo')}</h3>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('maintenance.customerName')}</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('maintenance.customerName')}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="pr-10 h-11 bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('maintenance.phoneNumber')}</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="+963 xxx xxx xxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+]/g, ''))}
                      className="pr-10 h-11 bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm text-left"
                    />
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="font-medium text-sm text-muted-foreground">{t('maintenance.serviceDetails')}</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('maintenance.serviceType')}</label>
                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger className="h-11 bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm">
                        <SelectValue placeholder={t('maintenance.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('maintenance.deviceType')}</label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger className="h-11 bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm">
                        <SelectValue placeholder={t('maintenance.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {productTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="w-4 h-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('maintenance.description')}</label>
                  <Textarea
                    placeholder="تفاصيل إضافية عن الخدمة..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm min-h-[80px] resize-none p-3"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Pricing */}
            <div className="space-y-4">
              <div className="space-y-3 pt-3 border-t border-border md:border-t-0 md:pt-0">
                <h3 className="font-medium text-sm text-muted-foreground">تفاصيل السعر</h3>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">سعر الخدمة (دولار)</label>
                  <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0"
                      value={servicePrice || ''}
                      onChange={(e) => setServicePrice(Number(e.target.value))}
                      className="pr-10 h-12 bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm text-lg font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">تكلفة القطع (دولار)</label>
                  <div className="relative">
                    <Calculator className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0"
                      value={partsCost || ''}
                      onChange={(e) => setPartsCost(Number(e.target.value))}
                      className="pr-10 h-11 bg-background/90 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Profit Display */}
                <div className={cn(
                  "p-3 rounded-lg",
                  profit >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('maintenance.netProfit')}</span>
                    <span className={cn(
                      "text-lg font-bold",
                      profit >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      ${formatNumber(profit)}
                    </span>
                  </div>
                </div>

                {/* Currency Display */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">المجموع بالعملة</span>
                    <Select
                      value={selectedCurrency.code}
                      onValueChange={(code) => {
                        const currency = currencies.find(c => c.code === code);
                        if (currency) onCurrencyChange(currency);
                      }}
                    >
                      <SelectTrigger className="w-auto h-7 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.symbol} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xl font-bold">
                    {selectedCurrency.symbol}{formatNumber(servicePriceInCurrency)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 md:p-4 border-t border-border space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleCashSale}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Banknote className="w-4 h-4 ml-2" />}
              نقداً
            </Button>
            <Button
              onClick={handleDebtSale}
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CreditCard className="w-4 h-4 ml-2" />}
              بالدين
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleShareInvoiceImage} className="text-sm text-primary border-primary/30 hover:bg-primary/10">
              <Share2 className="w-4 h-4 ml-1" />
              مشاركة الفاتورة
            </Button>
            <Button variant="outline" onClick={handleWhatsApp} className="text-sm">
              <Send className="w-4 h-4 ml-1" />
              واتساب
            </Button>
          </div>
        </div>
      </div>

      {/* Cash Confirmation Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-500" />
              تأكيد الدفع النقدي
            </DialogTitle>
            <DialogDescription>
              {`سيتم تسجيل مبلغ ${selectedCurrency.symbol}${formatNumber(servicePriceInCurrency)} كدفع نقدي`}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('maintenance.customer')}</span>
              <span className="font-medium">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الخدمة</span>
              <span className="font-medium">{getServiceLabel() || 'غير محدد'}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground">{t('maintenance.netProfit')}</span>
              <span className={cn("font-bold", profit >= 0 ? "text-green-500" : "text-red-500")}>
                ${formatNumber(profit)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCashDialog(false)} className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95" disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => confirmSale('cash')}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Check className="w-4 h-4 ml-2" />}
              {t('common.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debt Confirmation Dialog */}
      <Dialog open={showDebtDialog} onOpenChange={setShowDebtDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              تأكيد تسجيل الدين
            </DialogTitle>
            <DialogDescription>
              {isNewCustomer
                ? `سيتم إنشاء عميل جديد باسم ${customerName} وتسجيل دين بمبلغ ${selectedCurrency.symbol}${formatNumber(servicePriceInCurrency)}`
                : `سيتم إضافة دين بمبلغ ${selectedCurrency.symbol}${formatNumber(servicePriceInCurrency)} للعميل ${customerName}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('maintenance.customer')}</span>
              <span className="font-medium">{customerName}</span>
            </div>
            {customerPhone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الهاتف</span>
                <span className="font-medium">{customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('maintenance.debtAmount')}</span>
              <span className="font-bold text-orange-500">${formatNumber(servicePrice)}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDebtDialog(false)} className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95" disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => confirmSale('debt')}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Check className="w-4 h-4 ml-2" />}
              تسجيل الدين
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
