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
  X
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
import { toast } from 'sonner';
import { addMaintenanceService } from '@/lib/maintenance-store';

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
}

export function MaintenancePanel({
  currencies,
  selectedCurrency,
  onCurrencyChange,
  onClose,
  isMobile = false,
}: MaintenancePanelProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [servicePrice, setServicePrice] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);
  
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);

  const profit = servicePrice - partsCost;
  const servicePriceInCurrency = servicePrice * selectedCurrency.rate;

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDescription('');
    setServicePrice(0);
    setPartsCost(0);
  };

  const validateForm = () => {
    if (!customerName.trim()) {
      toast.error('يرجى إدخال اسم العميل');
      return false;
    }
    if (servicePrice <= 0) {
      toast.error('يرجى إدخال قيمة الخدمة');
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
    setShowDebtDialog(true);
  };

  const confirmSale = (paymentType: 'cash' | 'debt') => {
    addMaintenanceService({
      customerName,
      customerPhone,
      description,
      servicePrice,
      partsCost,
      paymentType,
      status: 'completed',
    });
    
    toast.success(paymentType === 'cash' 
      ? 'تم تسجيل خدمة الصيانة نقداً' 
      : 'تم تسجيل خدمة الصيانة كدين'
    );
    
    setShowCashDialog(false);
    setShowDebtDialog(false);
    resetForm();
  };

  const handlePrint = () => {
    if (!validateForm()) return;
    
    // Load store settings for invoice
    let storeName = 'HyperPOS Store';
    let storeAddress = '';
    let storePhone = '';
    let storeLogo = '';
    let showLogo = true;
    let showAddress = true;
    let showPhone = true;
    let footer = 'شكراً لتعاملكم معنا!';
    
    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storeAddress = settings.storeSettings?.address || '';
        storePhone = settings.storeSettings?.phone || '';
        storeLogo = settings.storeSettings?.logo || '';
        showLogo = settings.printSettings?.showLogo ?? true;
        showAddress = settings.printSettings?.showAddress ?? true;
        showPhone = settings.printSettings?.showPhone ?? true;
        footer = settings.printSettings?.footer || footer;
      }
    } catch {}

    const currentDate = new Date().toLocaleDateString('ar-SA');
    const currentTime = new Date().toLocaleTimeString('ar-SA');
    
    // Create print content with logo
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
            ${showLogo && storeLogo ? `<img src="${storeLogo}" alt="شعار المحل" class="logo" />` : ''}
            <div class="store-name">${storeName}</div>
            ${showAddress && storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
            ${showPhone && storePhone ? `<div class="store-info">${storePhone}</div>` : ''}
            <div class="date-time">${currentDate} - ${currentTime}</div>
          </div>
          <div class="info"><span class="info-label">العميل:</span> ${customerName}</div>
          ${customerPhone ? `<div class="info"><span class="info-label">الهاتف:</span> ${customerPhone}</div>` : ''}
          ${description ? `<div class="info"><span class="info-label">الوصف:</span> ${description}</div>` : ''}
          <div class="total">
            <strong>قيمة الخدمة:</strong> ${selectedCurrency.symbol}${servicePriceInCurrency.toLocaleString()}
          </div>
          <div class="footer">
            <p>${footer}</p>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleWhatsApp = () => {
    if (!validateForm()) return;
    
    // Message only shows service price (not parts cost)
    const message = `فاتورة خدمة صيانة\n\nالعميل: ${customerName}\n${description ? `الوصف: ${description}\n` : ''}\nقيمة الخدمة: ${selectedCurrency.symbol}${servicePriceInCurrency.toLocaleString()}\n\nشكراً لتعاملكم معنا!`;
    
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
        isMobile ? "rounded-t-2xl" : "border-r border-border"
      )}>
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h2 className="font-bold text-base md:text-lg">خدمات الصيانة</h2>
            </div>
            {isMobile && onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Customer Info */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم العميل *</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="اسم العميل"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pr-9 bg-muted border-0"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">رقم الهاتف</label>
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

            <div>
              <label className="text-sm font-medium mb-1.5 block">وصف الخدمة</label>
              <Textarea
                placeholder="وصف مختصر للخدمة..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-muted border-0 min-h-[80px]"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div>
              <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                قيمة الخدمة (للعميل) *
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
                تكلفة القطع (علينا)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={partsCost || ''}
                onChange={(e) => setPartsCost(Number(e.target.value))}
                className="bg-muted border-0"
              />
            </div>

            {/* Profit Display */}
            <div className="bg-success/10 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">الربح الصافي</span>
                <span className={cn(
                  "text-lg font-bold",
                  profit >= 0 ? "text-success" : "text-destructive"
                )}>
                  ${profit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Currency Selector */}
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
              <span>الإجمالي للعميل</span>
              <span className="text-primary">
                {selectedCurrency.symbol}{servicePriceInCurrency.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Button
              className="h-11 md:h-14 bg-success hover:bg-success/90 text-sm md:text-base"
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              نقدي
            </Button>
            <Button
              variant="outline"
              className="h-11 md:h-14 border-warning text-warning hover:bg-warning hover:text-warning-foreground text-sm md:text-base"
              onClick={handleDebtSale}
            >
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              دين
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
              طباعة
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm"
              onClick={handleWhatsApp}
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              واتساب
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
              تأكيد الدفع النقدي
            </DialogTitle>
            <DialogDescription>
              سيتم تسجيل خدمة الصيانة كدفع نقدي
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>العميل:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {description && (
                <div className="flex justify-between text-sm">
                  <span>الوصف:</span>
                  <span className="font-semibold text-muted-foreground">{description}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                <span>قيمة الخدمة:</span>
                <span className="text-primary">{selectedCurrency.symbol}{servicePriceInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCashDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => confirmSale('cash')}>
                <Check className="w-4 h-4 ml-2" />
                تأكيد
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
              تأكيد الدين
            </DialogTitle>
            <DialogDescription>
              سيتم تسجيل قيمة الخدمة كدين على العميل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>العميل:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {description && (
                <div className="flex justify-between text-sm">
                  <span>الوصف:</span>
                  <span className="font-semibold text-muted-foreground">{description}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2 text-warning">
                <span>مبلغ الدين:</span>
                <span>{selectedCurrency.symbol}{servicePriceInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDebtDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground" onClick={() => confirmSale('debt')}>
                <Check className="w-4 h-4 ml-2" />
                تأكيد الدين
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
