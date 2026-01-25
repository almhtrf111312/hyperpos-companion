import { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  Percent,
  Banknote,
  CreditCard,
  Printer,
  Send,
  X,
  UserPlus,
  Check,
  Search,
  DollarSign,
  Package,
  Repeat
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { showToast } from '@/lib/toast-config';
import { addInvoice } from '@/lib/invoices-store';
import { findOrCreateCustomer, updateCustomerStats, loadCustomers, Customer } from '@/lib/customers-store';
import { addDebtFromInvoice } from '@/lib/debts-store';
import { loadProducts, deductStockBatch } from '@/lib/products-store';
import { distributeDetailedProfit } from '@/lib/partners-store';
import { addActivityLog } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';
import { printHTML, getStoreSettings, getPrintSettings } from '@/lib/print-utils';
import { playSaleComplete, playDebtRecorded } from '@/lib/sound-utils';
import { addSalesToShift, getActiveShift } from '@/lib/cashbox-store';
import { recordActivity } from '@/lib/auto-backup';
import { useLanguage } from '@/hooks/use-language';
import { 
  loadCustomersCloud, 
  findOrCreateCustomerCloud, 
  updateCustomerStatsCloud 
} from '@/lib/cloud/customers-cloud';
import { addInvoiceCloud } from '@/lib/cloud/invoices-cloud';
import { deductStockBatchCloud, checkStockAvailabilityCloud } from '@/lib/cloud/products-cloud';
import { deductWarehouseStockBatchCloud, checkWarehouseStockAvailability } from '@/lib/cloud/warehouses-cloud';
import { useWarehouse } from '@/hooks/use-warehouse';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  // Multi-unit support
  unit: 'piece' | 'bulk';
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
}

interface Currency {
  code: 'USD' | 'TRY' | 'SYP';
  symbol: string;
  name: string;
  rate: number;
}

interface CartPanelProps {
  cart: CartItem[];
  currencies: Currency[];
  selectedCurrency: Currency;
  discount: number;
  customerName: string;
  onUpdateQuantity: (id: string, change: number, unit?: 'piece' | 'bulk') => void;
  onRemoveItem: (id: string, unit?: 'piece' | 'bulk') => void;
  onClearCart: () => void;
  onCurrencyChange: (currency: Currency) => void;
  onDiscountChange: (discount: number) => void;
  onCustomerNameChange: (name: string) => void;
  onToggleUnit?: (id: string, currentUnit: 'piece' | 'bulk') => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function CartPanel({
  cart,
  currencies,
  selectedCurrency,
  discount,
  customerName,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCurrencyChange,
  onDiscountChange,
  onCustomerNameChange,
  onToggleUnit,
  onClose,
  isMobile = false,
}: CartPanelProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Loaded customers for search
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  
  // Fixed amount discount feature
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  
  // Smart customer search feature
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load customers on mount
  useEffect(() => {
    loadCustomersCloud().then(setAllCustomers);
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  // Calculate discount based on type
  const discountAmount = discountType === 'percent' 
    ? (subtotal * discount) / 100 
    : Math.min(discount, subtotal); // Fixed amount should not exceed subtotal
  
  const total = Math.max(0, subtotal - discountAmount);
  const totalInCurrency = total * selectedCurrency.rate;

  const handleCashSale = () => {
    if (cart.length === 0) return;
    setShowCashDialog(true);
  };

  const handleDebtSale = () => {
    if (cart.length === 0) return;
    if (!customerName) {
      showToast.error(t('pos.enterCustomerName'));
      return;
    }
    
    // التحقق إذا كان العميل موجوداً في قاعدة البيانات
    const customerExists = allCustomers.some(c => 
      c.name.toLowerCase() === customerName.toLowerCase().trim()
    );
    setIsNewCustomer(!customerExists);
    setCustomerPhone('');
    
    setShowDebtDialog(true);
  };

  const confirmCashSale = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      // حساب الكميات الفعلية بالقطع (مع مراعاة معامل التحويل للوحدات الكبرى)
      const stockItemsWithConversion = cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity
      }));
      
      // التحقق من توفر الكميات - استخدام المستودع المُسند إذا متاح
      let stockCheck;
      if (activeWarehouse) {
        // التحقق من مخزون المستودع المُسند (للموزعين)
        stockCheck = await checkWarehouseStockAvailability(activeWarehouse.id, stockItemsWithConversion);
      } else {
        // التحقق من المخزون العام
        stockCheck = await checkStockAvailabilityCloud(stockItemsWithConversion);
      }
      
      if (!stockCheck.success) {
        const insufficientNames = stockCheck.insufficientItems
          .map(item => `${item.productName} (متاح: ${item.available}, مطلوب: ${item.requested})`)
          .join('\n');
        showToast.error(`لا يوجد مخزون كافٍ:\n${insufficientNames}`, {
          persistent: true,
          description: 'اضغط × للإغلاق',
        });
        return;
      }
      
      // Find or create customer
      const customer = customerName ? await findOrCreateCustomerCloud(customerName) : null;
      
      // Calculate profit by category for accurate partner distribution
      const products = loadProducts();
      const profitsByCategory: Record<string, number> = {};
      let totalProfit = 0;
      
      const soldItems: Array<{ name: string; quantity: number; price: number }> = [];
      
      cart.forEach((item) => {
        const product = products.find(p => p.id === item.id);
        if (product) {
          // ✅ إصلاح: استخدام سعر التكلفة المناسب بناءً على الوحدة
          let costPrice: number;
          
          if (item.unit === 'bulk') {
            // إذا كان البيع بالكرتونة
            if (item.bulkCostPrice && item.bulkCostPrice > 0) {
              // استخدام سعر تكلفة الكرتونة إذا كان محدداً
              costPrice = item.bulkCostPrice;
            } else {
              // حساب تكلفة الكرتونة = سعر القطعة × معامل التحويل
              costPrice = (item.costPrice || product.costPrice) * (item.conversionFactor || 1);
            }
          } else {
            // البيع بالقطعة
            costPrice = item.costPrice || product.costPrice;
          }
          
          const itemProfit = (item.price - costPrice) * item.quantity;
          const category = product.category || 'عام';
          profitsByCategory[category] = (profitsByCategory[category] || 0) + itemProfit;
          totalProfit += itemProfit;
        }
        soldItems.push({ name: item.name, quantity: item.quantity, price: item.price });
      });
      
      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const discountedProfit = totalProfit * (1 - discountRatio);
      const discountMultiplier = 1 - discountRatio;
      
      // Create invoice in cloud
      const invoice = await addInvoiceCloud({
        type: 'sale',
        customerName: customerName || 'عميل نقدي',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        })),
        subtotal,
        discount,
        total,
        totalInCurrency,
        currency: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        paymentType: 'cash',
        status: 'paid',
        profit: discountedProfit,
      });
      
      if (!invoice) {
        showToast.error('فشل في إنشاء الفاتورة');
        return;
      }
      
      // Distribute profit to partners
      const categoryProfits = Object.entries(profitsByCategory)
        .filter(([_, profit]) => profit * discountMultiplier > 0)
        .map(([category, profit]) => ({ category, profit: profit * discountMultiplier }));
      
      if (categoryProfits.length > 0) {
        distributeDetailedProfit(categoryProfits, invoice.id, customerName || 'عميل نقدي', false);
      }
      
      // Deduct stock from inventory (warehouse-specific if available)
      // استخدام الكمية الفعلية بالقطع (مع معامل التحويل)
      const stockItemsToDeduct = cart.map(item => ({
        productId: item.id,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity
      }));
      if (activeWarehouse) {
        await deductWarehouseStockBatchCloud(activeWarehouse.id, stockItemsToDeduct);
      } else {
        await deductStockBatchCloud(stockItemsToDeduct);
      }
      
      // Update customer stats
      if (customer) {
        await updateCustomerStatsCloud(customer.id, total, false);
      }
      
      // Log activity
      if (user) {
        const itemsDescription = soldItems.map(item => `${item.name} × ${item.quantity}`).join('، ');
        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `عملية بيع نقدي بقيمة $${total.toLocaleString()} - المنتجات: ${itemsDescription}`,
          { invoiceId: invoice.id, total, itemsCount: cart.length, customerName: customerName || 'عميل نقدي', items: soldItems }
        );
      }
      
      playSaleComplete();
      addSalesToShift(total);
      recordActivity();
      
      showToast.success(`تم إنشاء الفاتورة ${invoice.id} بنجاح`);
      setShowCashDialog(false);
      onClearCart();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDebtSale = async () => {
    // حساب الكميات الفعلية بالقطع (مع مراعاة معامل التحويل للوحدات الكبرى)
    const stockItemsWithConversion = cart.map(item => ({
      productId: item.id,
      productName: item.name,
      quantity: item.unit === 'bulk' && item.conversionFactor
        ? item.quantity * item.conversionFactor
        : item.quantity
    }));
    
    // ✅ إصلاح: التحقق من المخزون الصحيح بناءً على المستودع المُسند
    let stockCheck;
    if (activeWarehouse) {
      // التحقق من مخزون المستودع المُسند (للموزعين)
      stockCheck = await checkWarehouseStockAvailability(activeWarehouse.id, stockItemsWithConversion);
    } else {
      // التحقق من المخزون العام
      stockCheck = await checkStockAvailabilityCloud(stockItemsWithConversion);
    }
    
    if (!stockCheck.success) {
      const insufficientNames = stockCheck.insufficientItems
        .map(item => `${item.productName} (متاح: ${item.available}, مطلوب: ${item.requested})`)
        .join('\n');
      // تنبيه هام يتطلب إغلاق يدوي
      showToast.error(`لا يوجد مخزون كافٍ:\n${insufficientNames}`, {
        persistent: true,
        description: 'اضغط × للإغلاق',
      });
      return;
    }
    
    // Find or create customer
    const customer = findOrCreateCustomer(customerName);
    
    // Calculate profit by category for accurate partner distribution
    const products = loadProducts();
    const profitsByCategory: Record<string, number> = {};
    let totalProfit = 0;
    
    // تفاصيل المنتجات لسجل النشاطات
    const soldItems: Array<{ name: string; quantity: number; price: number }> = [];
    
    cart.forEach((item) => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        // ✅ إصلاح: استخدام سعر التكلفة المناسب بناءً على الوحدة
        let costPrice: number;
        
        if (item.unit === 'bulk') {
          // إذا كان البيع بالكرتونة
          if (item.bulkCostPrice && item.bulkCostPrice > 0) {
            // استخدام سعر تكلفة الكرتونة إذا كان محدداً
            costPrice = item.bulkCostPrice;
          } else {
            // حساب تكلفة الكرتونة = سعر القطعة × معامل التحويل
            costPrice = (item.costPrice || product.costPrice) * (item.conversionFactor || 1);
          }
        } else {
          // البيع بالقطعة
          costPrice = item.costPrice || product.costPrice;
        }
        
        const itemProfit = (item.price - costPrice) * item.quantity;
        const category = product.category || 'عام';
        profitsByCategory[category] = (profitsByCategory[category] || 0) + itemProfit;
        totalProfit += itemProfit;
      }
      
      // تسجيل تفاصيل المنتجات المباعة
      soldItems.push({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      });
    });
    
    // Apply discount to profit - use actual discount ratio from amounts
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
    const discountedProfit = totalProfit * (1 - discountRatio);
    const discountMultiplier = 1 - discountRatio;
    
    // Create invoice
    const invoice = addInvoice({
      type: 'sale',
      customerName,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      subtotal,
      discount,
      total,
      totalInCurrency,
      currency: selectedCurrency.code,
      currencySymbol: selectedCurrency.symbol,
      paymentType: 'debt',
      status: 'pending',
      profit: discountedProfit,
    });
    
    // Create debt record
    addDebtFromInvoice(invoice.id, customerName, customerPhone || '', total);
    
    // Distribute profit to partners by category (as pending) - استدعاء واحد لتجنب Race Condition
    const categoryProfits = Object.entries(profitsByCategory)
      .filter(([_, profit]) => profit * discountMultiplier > 0)
      .map(([category, profit]) => ({
        category,
        profit: profit * discountMultiplier
      }));
    
    if (categoryProfits.length > 0) {
      distributeDetailedProfit(categoryProfits, invoice.id, customerName, true);
    }
    
    // ✅ إصلاح الخصم المزدوج: خصم من مصدر واحد فقط
    // إذا كان هناك مستودع مُسند، نخصم منه فقط
    // وإلا نخصم من المخزون العام
    const stockItemsToDeduct = cart.map(item => ({
      productId: item.id,
      productName: item.name,
      quantity: item.unit === 'bulk' && item.conversionFactor
        ? item.quantity * item.conversionFactor
        : item.quantity
    }));
    
    if (activeWarehouse) {
      // خصم من المستودع المُسند فقط
      await deductWarehouseStockBatchCloud(activeWarehouse.id, stockItemsToDeduct);
    } else {
      // خصم من المخزون العام فقط
      await deductStockBatchCloud(stockItemsToDeduct);
    }
    
    // Update customer stats
    updateCustomerStats(customer.id, total, true);
    
    // Log activity with product details
    if (user) {
      const itemsDescription = soldItems
        .map(item => `${item.name} × ${item.quantity}`)
        .join('، ');
      
      addActivityLog(
        'sale',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `عملية بيع بالدين بقيمة $${total.toLocaleString()} للعميل ${customerName} - المنتجات: ${itemsDescription}`,
        { 
          invoiceId: invoice.id, 
          total, 
          itemsCount: cart.length, 
          customerName, 
          paymentType: 'debt',
          items: soldItems // تفاصيل المنتجات للتدقيق
        }
      );
      
      addActivityLog(
        'debt_created',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `تم إنشاء دين جديد للعميل ${customerName} بقيمة $${total.toLocaleString()}`,
        { invoiceId: invoice.id, amount: total, customerName }
      );
    }
    
    // Play debt sound
    playDebtRecorded();
    
    showToast.success(`تم إنشاء فاتورة الدين ${invoice.id} بنجاح`);
    setShowDebtDialog(false);
    onClearCart();
  };

  // Smart customer search handler
  const handleCustomerSearch = (value: string) => {
    onCustomerNameChange(value);
    if (value.length >= 2) {
      const customers = loadCustomers();
      const matches = customers.filter(c => 
        c.name.toLowerCase().includes(value.toLowerCase()) ||
        (c.phone && c.phone.includes(value))
      ).slice(0, 5); // Max 5 results
      setCustomerSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
      setCustomerSuggestions([]);
    }
  };

  const selectCustomer = (customer: Customer) => {
    onCustomerNameChange(customer.name);
    setCustomerPhone(customer.phone || '');
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      showToast.error(t('pos.fillRequired'));
      return;
    }
    // Add customer to store
    findOrCreateCustomer(newCustomer.name, newCustomer.phone);
    onCustomerNameChange(newCustomer.name);
    showToast.success(t('pos.customerAdded'));
    setShowCustomerDialog(false);
    setNewCustomer({ name: '', phone: '', email: '' });
  };

  const handlePrint = () => {
    if (cart.length === 0) return;
    
    // Load store settings
    let storeName = 'FlowPOS Pro';
    let storeAddress = '';
    let storePhone = '';
    let storeLogo = '';
    let footer = 'شكراً لتعاملكم معنا!';
    
    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storeAddress = settings.storeSettings?.address || '';
        storePhone = settings.storeSettings?.phone || '';
        storeLogo = settings.storeSettings?.logo || '';
        footer = settings.printSettings?.footer || footer;
      }
    } catch {}

    const currentDate = new Date().toLocaleDateString('ar-SA');
    const currentTime = new Date().toLocaleTimeString('ar-SA');
    
    const itemsHtml = cart.map(item => `
      <tr>
        <td style="padding: 5px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${selectedCurrency.symbol}${(item.price * item.quantity * selectedCurrency.rate).toLocaleString()}</td>
      </tr>
    `).join('');
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; font-size: 12px; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #333; padding-bottom: 12px; }
            .logo { max-width: 60px; max-height: 60px; margin: 0 auto 8px; display: block; }
            .store-name { font-size: 1.3em; font-weight: bold; margin: 5px 0; }
            .store-info { font-size: 0.85em; color: #555; }
            .invoice-info { margin: 12px 0; font-size: 0.9em; }
            .invoice-info > div { padding: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.9em; }
            th { background: #333; color: #fff; padding: 8px 5px; text-align: right; font-size: 0.85em; }
            td { padding: 8px 5px; border-bottom: 1px solid #eee; }
            .total { font-size: 1.2em; font-weight: bold; margin-top: 12px; border-top: 2px solid #333; padding-top: 10px; text-align: center; }
            .footer { text-align: center; margin-top: 20px; font-size: 0.8em; color: #666; border-top: 1px dashed #ccc; padding-top: 12px; }
            @media print { @page { size: 80mm auto; margin: 5mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeLogo ? `<img src="${storeLogo}" alt="شعار" class="logo" />` : ''}
            <div class="store-name">${storeName}</div>
            ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="store-info">${storePhone}</div>` : ''}
          </div>
          <div class="invoice-info">
            <div><strong>التاريخ:</strong> ${currentDate} - ${currentTime}</div>
            <div><strong>العميل:</strong> ${customerName || 'عميل نقدي'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${discount > 0 ? `<div style="text-align: left; color: #c00;">خصم ${discount}%: -${selectedCurrency.symbol}${discountAmount.toLocaleString()}</div>` : ''}
          <div class="total">
            الإجمالي: ${selectedCurrency.symbol}${totalInCurrency.toLocaleString()}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;
    
    printHTML(printContent);
  };

  const handleWhatsApp = () => {
    if (cart.length === 0) return;
    showToast.info(t('pos.openingWhatsapp'));
    const message = `فاتورة من HyperPOS\n\n${t('pos.total')}: ${selectedCurrency.symbol}${totalInCurrency.toLocaleString()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <>
      <div className={cn(
        "bg-card flex flex-col h-full",
        isMobile ? "rounded-t-2xl" : "border-r border-border"
      )}>
        {/* Cart Header */}
        <div className="p-3 md:p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h2 className="font-bold text-base md:text-lg">{t('pos.shoppingCart')}</h2>
              {cart.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button 
                  onClick={onClearCart}
                  className="text-xs md:text-sm text-destructive hover:text-destructive/80"
                >
                  {t('pos.clear')}
                </button>
              )}
              {isMobile && onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Customer Name with Autocomplete */}
          <div className="mt-3 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                type="text"
                placeholder={t('pos.customerName')}
                value={customerName}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                onFocus={() => {
                  if (customerName.length >= 2 && customerSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on suggestions
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="pr-9 bg-muted border-0 h-9 md:h-10 text-sm"
              />
              {/* Customer Suggestions Dropdown */}
              {showSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <Command className="bg-transparent">
                    <CommandList>
                      <CommandGroup>
                        {customerSuggestions.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            onSelect={() => selectCustomer(customer)}
                            className="cursor-pointer px-3 py-2 hover:bg-muted flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm">{customer.name}</span>
                            </div>
                            {customer.phone && (
                              <span className="text-xs text-muted-foreground">{customer.phone}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
              onClick={() => setShowCustomerDialog(true)}
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <ShoppingCart className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 opacity-50" />
              <p className="text-sm md:text-base">{t('pos.emptyCart')}</p>
              <p className="text-xs md:text-sm">{t('pos.clickToAdd')}</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div 
                key={`${item.id}-${item.unit}`}
                className="bg-muted rounded-lg md:rounded-xl p-2.5 md:p-3 slide-in-right"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-xs md:text-sm line-clamp-2">{item.name}</h4>
                    {/* Unit Badge with Toggle */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.unit === 'bulk' 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        {item.unit === 'bulk' ? (item.bulkUnit || 'كرتونة') : (item.smallUnit || 'قطعة')}
                      </span>
                      {/* Toggle Unit Button - only show if bulk pricing exists */}
                      {item.bulkSalePrice && item.bulkSalePrice > 0 && onToggleUnit && (
                        <button
                          onClick={() => onToggleUnit(item.id, item.unit)}
                          className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                          title={item.unit === 'bulk' ? 'تحويل إلى قطعة' : 'تحويل إلى كرتونة'}
                        >
                          <Repeat className="w-3 h-3" />
                        </button>
                      )}
                      {/* Show conversion info */}
                      {item.unit === 'bulk' && item.conversionFactor && item.conversionFactor > 1 && (
                        <span className="text-[9px] text-muted-foreground">
                          ({item.conversionFactor} {item.smallUnit || 'قطعة'})
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id, item.unit)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1, item.unit)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-md md:rounded-lg bg-background flex items-center justify-center hover:bg-background/80"
                    >
                      <Minus className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                    <span className="w-6 md:w-8 text-center font-semibold text-sm">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1, item.unit)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-md md:rounded-lg bg-background flex items-center justify-center hover:bg-background/80"
                    >
                      <Plus className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
                  <p className="font-bold text-primary text-sm md:text-base">
                    ${(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
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

          {/* Discount with Type Toggle */}
          <div className="flex items-center gap-2">
            {/* Discount Type Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border flex-shrink-0">
              <button
                onClick={() => setDiscountType('percent')}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  discountType === 'percent' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Percent className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDiscountType('fixed')}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  discountType === 'fixed' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <DollarSign className="w-3.5 h-3.5" />
              </button>
            </div>
            <Input
              type="number"
              placeholder={discountType === 'percent' ? 'خصم %' : 'خصم $'}
              value={discount || ''}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
              className="bg-muted border-0 h-9 text-sm"
              min="0"
              max={discountType === 'percent' ? 100 : undefined}
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('pos.subtotal')}</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>{t('pos.discount')} {discountType === 'percent' ? `(${discount}%)` : ''}</span>
                <span>-${discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base md:text-lg font-bold pt-2 border-t border-border">
              <span>{t('pos.total')}</span>
              <span className="text-primary">
                {selectedCurrency.symbol}{totalInCurrency.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Button
              className="h-12 md:h-16 bg-success hover:bg-success/90 text-sm md:text-lg font-bold shadow-lg shadow-success/25 transition-all active:scale-95"
              disabled={cart.length === 0}
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              {t('pos.cash')}
            </Button>
            <Button
              variant="outline"
              className="h-12 md:h-16 border-2 border-warning text-warning hover:bg-warning hover:text-warning-foreground text-sm md:text-lg font-bold transition-all active:scale-95"
              disabled={cart.length === 0}
              onClick={handleDebtSale}
            >
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              {t('pos.debt')}
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm" 
              disabled={cart.length === 0}
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              {t('pos.print')}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm" 
              disabled={cart.length === 0}
              onClick={handleWhatsApp}
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              {t('pos.whatsapp')}
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
              تأكيد البيع النقدي
            </DialogTitle>
            <DialogDescription>
              هل تريد تأكيد الفاتورة النقدية؟
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>عدد المنتجات:</span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>العميل:</span>
                <span className="font-semibold">{customerName || 'بدون اسم'}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                <span>الإجمالي:</span>
                <span className="text-primary">{selectedCurrency.symbol}{totalInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCashDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1 bg-success hover:bg-success/90" onClick={confirmCashSale}>
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
              تأكيد البيع بالدين
            </DialogTitle>
            <DialogDescription>
              سيتم إضافة المبلغ كدين على العميل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>العميل:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {isNewCustomer && (
                <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <label className="text-sm font-medium mb-1.5 block text-warning">
                    رقم الهاتف * (مطلوب لعميل جديد)
                  </label>
                  <Input
                    placeholder="+963 xxx xxx xxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-background border-warning"
                  />
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>عدد المنتجات:</span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2 text-warning">
                <span>مبلغ الدين:</span>
                <span>{selectedCurrency.symbol}{totalInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDebtDialog(false)}>
                إلغاء
              </Button>
              <Button 
                className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground" 
                onClick={() => {
                  // التحقق من رقم الهاتف إذا كان عميل جديد
                  if (isNewCustomer && !customerPhone.trim()) {
                    showToast.error('يرجى إدخال رقم الهاتف للعميل الجديد');
                    return;
                  }
                  confirmDebtSale();
                }}
              >
                <Check className="w-4 h-4 ml-2" />
                تأكيد الدين
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              إضافة عميل جديد
            </DialogTitle>
            <DialogDescription>
              أدخل بيانات العميل الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">الاسم *</label>
                <Input
                  placeholder="اسم العميل"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
                <Input
                  placeholder="+963 xxx xxx xxx"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">البريد الإلكتروني</label>
                <Input
                  placeholder="email@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCustomerDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddCustomer}>
                <UserPlus className="w-4 h-4 ml-2" />
                إضافة العميل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
