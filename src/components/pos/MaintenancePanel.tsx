import { useState } from 'react';
import { 
  Wrench, 
  User, 
  Phone,
  DollarSign,
  Calculator,
  Banknote,
  CreditCard,
  Printer,
  Send,
  Check,
  X,
  Smartphone,
  Watch,
  Laptop,
  Tablet,
  Headphones,
  Monitor,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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
import { addMaintenanceService } from '@/lib/maintenance-store';
import { addInvoice } from '@/lib/invoices-store';
import { distributeDetailedProfitCloud } from '@/lib/cloud/partners-cloud';
import { addDebtFromInvoice } from '@/lib/debts-store';
import { addActivityLog } from '@/lib/activity-log';
import { addExpense } from '@/lib/expenses-store';
import { useAuth } from '@/hooks/use-auth';
import { loadCustomers } from '@/lib/customers-store';
import { printHTML, getStoreSettings, getPrintSettings } from '@/lib/print-utils';
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
    if (!customerName.trim()) {
      toast.error(t('maintenance.enterCustomerName'));
      return false;
    }
    if (servicePrice <= 0) {
      toast.error(t('maintenance.enterAmount'));
      return false;
    }
    return true;
  };

  const handleCashSale = () => {
    if (!validateForm()) return;
    setShowCashDialog(true);
  };

  const handleDebtSale = () => {
    if (!validateForm()) return;
    
    // التحقق إذا كان العميل موجوداً في قاعدة البيانات
    const existingCustomers = loadCustomers();
    const customerExists = existingCustomers.some(c => 
      c.name.toLowerCase() === customerName.toLowerCase().trim()
    );
    setIsNewCustomer(!customerExists);
    
    setShowDebtDialog(true);
  };

  const confirmSale = (paymentType: 'cash' | 'debt') => {
    const fullDescription = [
      getServiceLabel(),
      getProductLabel(),
      description
    ].filter(Boolean).join(' - ');

    // Add to maintenance store
    addMaintenanceService({
      customerName,
      customerPhone,
      description: fullDescription,
      servicePrice,
      partsCost,
      paymentType,
      status: 'completed',
    });

    // Add to invoices store
    const invoice = addInvoice({
      type: 'maintenance',
      customerName,
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
    
    // تسجيل تكلفة القطع كمصروف تلقائي (إذا كانت أكبر من 0)
    if (partsCost > 0) {
      addExpense({
        type: 'equipment',
        customType: 'قطع غيار صيانة',
        amount: partsCost,
        notes: `قطع غيار لخدمة صيانة - العميل: ${customerName} - الفاتورة: ${invoice.id}`,
        date: new Date().toISOString().split('T')[0],
      });
    }
    
    // Distribute profit to partners (category: صيانة) - ✅ استخدام Cloud API
    if (profit > 0) {
      distributeDetailedProfitCloud(
        [{ category: 'صيانة', profit }],
        invoice.id,
        customerName,
        paymentType === 'debt'
      );
    }
    
    // Create debt record if payment is debt
    if (paymentType === 'debt') {
      addDebtFromInvoice(invoice.id, customerName, customerPhone, servicePrice);
    }
    
    // Log activity with detailed information
    if (user) {
      addActivityLog(
        'maintenance',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `خدمة صيانة ${paymentType === 'cash' ? 'نقدي' : 'بالدين'} بقيمة $${servicePrice.toLocaleString()} للعميل ${customerName} - نوع الخدمة: ${getServiceLabel() || 'غير محدد'} - نوع الجهاز: ${getProductLabel() || 'غير محدد'}`,
        { 
          invoiceId: invoice.id, 
          total: servicePrice, 
          customerName, 
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
          `تم إنشاء دين صيانة للعميل ${customerName} بقيمة $${servicePrice.toLocaleString()}`,
          { invoiceId: invoice.id, amount: servicePrice, customerName }
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
  };

  const handlePrint = () => {
    if (!validateForm()) return;
    
    const storeSettings = getStoreSettings();
    const printSettings = getPrintSettings();

    const currentDate = new Date().toLocaleDateString('ar-SA');
    const currentTime = new Date().toLocaleTimeString('ar-SA');
    
    const fullDescription = [getServiceLabel(), getProductLabel(), description].filter(Boolean).join(' - ');
    
    const printContent = `
      <html dir="rtl">
        <head>
          <title>فاتورة صيانة</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .logo { max-width: 80px; max-height: 80px; margin: 0 auto 10px; display: block; }
            .store-name { font-size: 1.4em; font-weight: bold; margin: 5px 0; }
            .store-info { font-size: 0.85em; color: #555; }
            .date-time { font-size: 0.8em; color: #777; margin-top: 10px; }
            .info { margin-bottom: 8px; font-size: 0.9em; }
            .info-label { color: #555; }
            .total { font-size: 1.3em; font-weight: bold; margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; text-align: center; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.85em; color: #555; border-top: 1px dashed #ccc; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings.showLogo && storeSettings.logo ? `<img src="${storeSettings.logo}" alt="شعار المحل" class="logo" />` : ''}
            <div class="store-name">${storeSettings.name}</div>
            ${printSettings.showAddress && storeSettings.address ? `<div class="store-info">${storeSettings.address}</div>` : ''}
            ${printSettings.showPhone && storeSettings.phone ? `<div class="store-info">${storeSettings.phone}</div>` : ''}
            <div class="date-time">${currentDate} - ${currentTime}</div>
          </div>
          <div class="info"><span class="info-label">${t('maintenance.customer')}:</span> ${customerName}</div>
          ${customerPhone ? `<div class="info"><span class="info-label">${t('maintenance.phoneNumber')}:</span> ${customerPhone}</div>` : ''}
          ${fullDescription ? `<div class="info"><span class="info-label">${t('maintenance.serviceType')}:</span> ${fullDescription}</div>` : ''}
          <div class="total">
            <strong>${t('maintenance.total')}:</strong> ${selectedCurrency.symbol}${servicePriceInCurrency.toLocaleString()}
          </div>
          <div class="footer">
            <p>${printSettings.footer}</p>
          </div>
        </body>
      </html>
    `;
    
    printHTML(printContent);
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
    } catch {}

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
👤 *${t('maintenance.customer')}:* ${customerName}
${customerPhone ? `📱 *${t('maintenance.phoneNumber')}:* ${customerPhone}` : ''}
${fullDescription ? `📝 *${t('maintenance.serviceType')}:* ${fullDescription}` : ''}
━━━━━━━━━━━━━━━━━━

💰 *${t('maintenance.total')}:* ${selectedCurrency.symbol}${servicePriceInCurrency.toLocaleString()}

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
        "bg-card flex flex-col h-full",
        isMobile ? "rounded-t-2xl" : fullWidth ? "" : "border-r border-border"
      )}>
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-border">
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
                  <label className="text-sm font-medium mb-1.5 block">{t('maintenance.customerNameRequired')}</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('maintenance.customerName')}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="pr-9 bg-muted border-0"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('maintenance.phoneNumber')}</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="+963 xxx xxx xxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="pr-9 bg-muted border-0"
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
                      <SelectTrigger className="bg-muted border-0">
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
                      <SelectTrigger className="bg-muted border-0">
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
                  <label className="text-sm font-medium mb-1.5 block">{t('maintenance.additionalDetails')}</label>
                  <Textarea
                    placeholder={t('maintenance.serviceDescription')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-muted border-0 min-h-[80px]"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Pricing */}
            <div className="space-y-4">
              <div className="space-y-3 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                <h3 className="font-medium text-sm text-muted-foreground">{t('maintenance.pricing')}</h3>
                
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    {t('maintenance.amountCollected')}
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={servicePrice || ''}
                    onChange={(e) => setServicePrice(Number(e.target.value))}
                    className="bg-muted border-0 text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-warning" />
                    {t('maintenance.costPrice')}
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={partsCost || ''}
                    onChange={(e) => setPartsCost(Number(e.target.value))}
                    className="bg-muted border-0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('maintenance.notShownToCustomer')}</p>
                </div>

                {/* Profit Display */}
                <div className="bg-success/10 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{t('maintenance.netProfit')}</span>
                    <span className={cn(
                      "text-lg font-bold",
                      profit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      ${profit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Currency Selector */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="font-medium text-sm text-muted-foreground">{t('maintenance.currency')}</h3>
                <div className="flex gap-1.5 md:gap-2">
                  {currencies.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => onCurrencyChange(currency)}
                      className={cn(
                        "flex-1 py-1.5 md:py-2 rounded-md md:rounded-lg text-xs md:text-sm font-medium transition-all",
                        selectedCurrency.code === currency.code
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {currency.symbol} {currency.code}
                    </button>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>{t('maintenance.total')}</span>
                    <span className="text-primary">
                      {selectedCurrency.symbol}{servicePriceInCurrency.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "border-t border-border p-3 md:p-4 space-y-3",
          fullWidth ? "max-w-3xl mx-auto w-full" : ""
        )}>
          {/* Payment Buttons */}
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Button
              className="h-11 md:h-14 bg-success hover:bg-success/90 text-sm md:text-base"
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              {t('maintenance.cash')}
            </Button>
            <Button
              variant="outline"
              className="h-11 md:h-14 border-warning text-warning hover:bg-warning hover:text-warning-foreground text-sm md:text-base"
              onClick={handleDebtSale}
            >
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              {t('maintenance.debt')}
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm"
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              {t('maintenance.print')}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm"
              onClick={handleWhatsApp}
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              {t('maintenance.whatsapp')}
            </Button>
          </div>
        </div>
      </div>

      {/* Cash Sale Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-success" />
              {t('maintenance.confirmCashPayment')}
            </DialogTitle>
            <DialogDescription>
              {t('maintenance.cashPaymentDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('maintenance.customer')}:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {description && (
                <div className="flex justify-between text-sm">
                  <span>{t('maintenance.description')}:</span>
                  <span className="font-semibold text-muted-foreground">{description}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                <span>{t('maintenance.serviceValue')}:</span>
                <span className="text-primary">{selectedCurrency.symbol}{servicePriceInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCashDialog(false)}>
                {t('maintenance.cancel')}
              </Button>
              <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => confirmSale('cash')}>
                <Check className="w-4 h-4 ml-2" />
                {t('maintenance.confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debt Sale Dialog */}
      <Dialog open={showDebtDialog} onOpenChange={setShowDebtDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-warning" />
              {t('maintenance.confirmDebt')}
            </DialogTitle>
            <DialogDescription>
              {t('maintenance.debtDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('maintenance.customer')}:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {isNewCustomer && !customerPhone.trim() && (
                <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <label className="text-sm font-medium mb-1.5 block text-warning">
                    {t('maintenance.phoneRequiredNewCustomer')}
                  </label>
                  <Input
                    placeholder="+963 xxx xxx xxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-background border-warning"
                  />
                </div>
              )}
              {description && (
                <div className="flex justify-between text-sm">
                  <span>{t('maintenance.description')}:</span>
                  <span className="font-semibold text-muted-foreground">{description}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2 text-warning">
                <span>{t('maintenance.debtAmount')}:</span>
                <span>{selectedCurrency.symbol}{servicePriceInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDebtDialog(false)}>
                {t('maintenance.cancel')}
              </Button>
              <Button 
                className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground" 
                onClick={() => {
                  if (isNewCustomer && !customerPhone.trim()) {
                    toast.error(t('maintenance.enterPhoneNewCustomer'));
                    return;
                  }
                  confirmSale('debt');
                }}
              >
                <Check className="w-4 h-4 ml-2" />
                {t('maintenance.confirmDebtBtn')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
