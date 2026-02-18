import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatNumber, formatCurrency, roundCurrency } from '@/lib/utils';
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
import { loadCustomers, Customer } from '@/lib/customers-store';
import { addActivityLog } from '@/lib/activity-log';
import { addGrossProfit } from '@/lib/profits-store';
import { useAuth } from '@/hooks/use-auth';
import { printHTML, getStoreSettings, getPrintSettings } from '@/lib/native-print';
import { shareInvoice, InvoiceShareData } from '@/lib/native-share';
import { playSaleComplete, playDebtRecorded } from '@/lib/sound-utils';
import { addSalesToShift, getActiveShift } from '@/lib/cashbox-store';
import { recordActivity } from '@/lib/auto-backup';
import { useLanguage } from '@/hooks/use-language';
import {
  loadCustomersCloud,
  addCustomerCloud,
} from '@/lib/cloud/customers-cloud';
import { useWarehouse } from '@/hooks/use-warehouse';
import { BackgroundSyncIndicator, useSyncState } from './BackgroundSyncIndicator';
import { addToQueue } from '@/lib/sync-queue';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';

import { Calculator } from '@/components/ui/Calculator';
import { isNoInventoryMode, getCurrentStoreType } from '@/lib/store-type-config';

const isRepairStoreType = () => getCurrentStoreType() === 'repair';

// EditablePrice: local string state during editing, commits on blur/Enter
function EditablePrice({ value, onChange, className }: { value: number; className?: string; onChange: (v: number) => void }) {
  const [localValue, setLocalValue] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(value));
    }
  }, [value, isEditing]);

  const commit = () => {
    setIsEditing(false);
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    } else {
      setLocalValue(String(value)); // revert
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={isEditing ? localValue : String(value)}
      onFocus={(e) => {
        setIsEditing(true);
        setLocalValue(String(value));
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      className={cn(
        "flex rounded-xl border border-border bg-muted/30 text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all duration-200",
        className
      )}
      dir="ltr"
    />
  );
}

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
  wholesalePrice?: number;
  laborCost?: number;
  // Pharmacy fields
  expiryDate?: string;
  batchNumber?: string;
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
  onUpdateItemPrice?: (id: string, newPrice: number, unit: 'piece' | 'bulk') => void;
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
  onUpdateItemPrice,
  onClose,
  isMobile = false,
}: CartPanelProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  const { syncState, syncMessage, startSync, completeSync, failSync } = useSyncState();
  const { isOnline } = useNetworkStatus();
  const { syncImmediately } = useCloudSyncContext();
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false); // ✅ Mutex lock لمنع التكرارات
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const addCustomerRef = useRef(false);

  // Loaded customers for search
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // Fixed amount discount feature
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');

  // Wholesale mode
  const [wholesaleMode, setWholesaleMode] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  // Smart customer search feature
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);  // ✅ آلة حاسبة

  // ✅ حفظ بيانات آخر عملية بيع لعرض أزرار الطباعة والمشاركة فوراً
  const [lastSale, setLastSale] = useState<{
    cart: CartItem[];
    customerName: string;
    totalInCurrency: number;
    subtotal: number;
    discount: number;
    discountAmount: number;
    discountType: 'percent' | 'fixed';
    selectedCurrency: Currency;
    taxAmount: number;
    effectiveTaxRate: number;
  } | null>(null);


  // Load customers on mount
  useEffect(() => {
    loadCustomersCloud().then(setAllCustomers);
  }, []);

  // ✅ مسح بيانات آخر عملية بيع عند إضافة منتج جديد
  useEffect(() => {
    if (cart.length > 0 && lastSale) {
      setLastSale(null);
    }
  }, [cart.length]);

  const getItemPrice = (item: CartItem) => {
    let price = item.price;

    if (wholesaleMode) {
      // ✅ استخدم سعر الجملة فقط إذا موجود، وإلا السعر العادي
      if (item.wholesalePrice && item.wholesalePrice > 0) {
        price = item.wholesalePrice;
      }
      // ❌ تم إزالة الربح التلقائي - لا إضافة نسبة مئوية
    }

    return roundCurrency(price);
  };

  const subtotal = roundCurrency(
    cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0)
  );

  // Calculate discount based on type
  // For fixed discounts in foreign currencies, convert to USD first
  const fixedDiscountInUSD = discountType === 'fixed' && selectedCurrency.rate > 1
    ? discount / selectedCurrency.rate
    : discount;
  const discountAmount = discountType === 'percent'
    ? (subtotal * discount) / 100
    : Math.min(fixedDiscountInUSD, subtotal); // Fixed amount converted to USD, must not exceed subtotal

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // ✅ Tax Calculation - read from store settings
  const [taxMode, setTaxMode] = useState<'net' | 'gross'>('net');
  const storeSettingsRaw = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('hyperpos_settings_v1') || '{}');
    } catch { return {}; }
  }, []);
  const storeTaxEnabled = storeSettingsRaw.taxEnabled ?? false;
  const storeTaxRate = storeSettingsRaw.taxRate ?? 0;
  const settingsDiscountPercentEnabled = storeSettingsRaw.discountPercentEnabled ?? true;
  const settingsDiscountFixedEnabled = storeSettingsRaw.discountFixedEnabled ?? true;

  const effectiveTaxRate = storeTaxEnabled ? storeTaxRate : 0;
  const taxAmount = taxMode === 'gross'
    ? (taxableAmount * effectiveTaxRate) / (100 + effectiveTaxRate)
    : (taxableAmount * effectiveTaxRate) / 100;

  const total = taxMode === 'gross'
    ? taxableAmount // price already includes tax
    : taxableAmount + taxAmount;
  const totalInCurrency = total * selectedCurrency.rate;

  // Wholesale profit = receivedAmount - COGS (الربح الفعلي = المبلغ المستلم - رأس المال)
  const wholesaleCOGS = roundCurrency(cart.reduce((sum, item) => {
    const costPrice = item.costPrice || 0;
    return sum + costPrice * item.quantity;
  }, 0));

  // ✅ الربح = المبلغ المستلم - رأس المال
  const wholesaleProfit = wholesaleMode
    ? roundCurrency((receivedAmount > 0 ? receivedAmount : subtotal) - wholesaleCOGS)
    : undefined;

  // ✅ حفظ لقطة من البيع الحالي قبل تفريغ السلة
  const saveSaleSnapshot = (cartData: CartItem[], custName: string) => {
    setLastSale({
      cart: [...cartData],
      customerName: custName,
      totalInCurrency,
      subtotal,
      discount,
      discountAmount,
      discountType,
      selectedCurrency,
      taxAmount,
      effectiveTaxRate,
    });
  };

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

    // ✅ التحقق إذا كان العميل موجوداً في قاعدة البيانات واستخدام رقم هاتفه
    const existingCustomer = allCustomers.find(c =>
      c.name.toLowerCase() === customerName.toLowerCase().trim()
    );

    if (existingCustomer) {
      setIsNewCustomer(false);
      setCustomerPhone(existingCustomer.phone || ''); // ✅ استخدام الهاتف المحفوظ
    } else {
      setIsNewCustomer(true);
      setCustomerPhone('');
    }

    setShowDebtDialog(true);
  };

  const confirmCashSale = async () => {
    // ✅ حماية مزدوجة: state + ref لمنع التكرارات
    if (isSaving || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    // Snapshot cart data before any changes
    const cartSnapshot = [...cart];
    const totalSnapshot = total;
    const customerNameSnapshot = customerName;

    setShowCashDialog(false);
    startSync('جاري حفظ الفاتورة...', false);

    try {
      // ============================================================
      // نموذج "محلي أولاً": حساب الأرباح من بيانات السلة المحلية
      // بدون انتظار السيرفر - الفاتورة تُحفظ فوراً في الطابور
      // ============================================================

      const noInventory = isNoInventoryMode();
      
      // ✅ فحص المخزون محلياً من بيانات السلة (سريع - 0ms)
      // السيرفر هو المرجع النهائي عند المزامنة
      if (!noInventory) {
        const insufficientLocal: string[] = [];
        for (const item of cartSnapshot) {
          // item.costPrice موجود = لدينا بيانات المنتج
          // نتحقق فقط من أن الكمية > 0 (الكاش المحلي يحتوي كمية افتراضية)
          const requestedQty = item.unit === 'bulk' && item.conversionFactor
            ? item.quantity * item.conversionFactor
            : item.quantity;
          if (requestedQty <= 0) {
            insufficientLocal.push(item.name);
          }
        }
        if (insufficientLocal.length > 0) {
          showToast.error(`كمية غير صالحة للمنتجات: ${insufficientLocal.join('، ')}`);
          savingRef.current = false;
          setIsSaving(false);
          return;
        }
      }

      // ✅ حساب الأرباح والتكلفة محلياً من بيانات السلة (0ms)
      const profitsByCategory: Record<string, number> = {};
      let totalProfit = 0;
      let totalCOGS = 0;

      const localItems = cartSnapshot.map(item => {
        let itemCostPrice: number;

        if (item.unit === 'bulk') {
          if (item.bulkCostPrice && item.bulkCostPrice > 0) {
            itemCostPrice = item.bulkCostPrice;
          } else {
            itemCostPrice = (item.costPrice || 0) * (item.conversionFactor || 1);
          }
        } else {
          itemCostPrice = item.costPrice || 0;
        }

        const itemPrice = wholesaleMode ? getItemPrice(item) : item.price;
        const itemProfit = roundCurrency((itemPrice - itemCostPrice) * item.quantity);
        const itemCOGS = itemCostPrice * item.quantity;

        // تصنيف الأرباح (نستخدم 'عام' افتراضياً - سيُصحح عند المزامنة)
        profitsByCategory['عام'] = (profitsByCategory['عام'] || 0) + itemProfit;
        totalProfit += itemProfit;
        totalCOGS += itemCOGS;

        return {
          id: item.id,
          name: item.name,
          price: itemPrice,
          quantity: item.quantity,
          total: roundCurrency(itemPrice * item.quantity),
          costPrice: itemCostPrice,
          profit: itemProfit,
        };
      });

      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const discountedProfit = totalProfit * (1 - discountRatio);

      const stockItemsLocal = cartSnapshot.map(item => ({
        productId: item.id,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity,
      }));

      // ✅ إضافة الفاتورة للطابور فوراً (محلياً - 0ms)
      addToQueue('invoice_create', {
        bundle: {
          customerName: customerNameSnapshot || 'عميل نقدي',
          items: localItems.map(i => ({ ...i, profit: roundCurrency(i.profit * (1 - discountRatio)) })),
          subtotal,
          discount,
          discountPercentage: discountType === 'percent' ? discount : 0,
          taxRate: effectiveTaxRate,
          taxAmount,
          total: totalSnapshot,
          totalInCurrency,
          currency: selectedCurrency.code,
          currencySymbol: selectedCurrency.symbol,
          profit: discountedProfit,
          cogs: totalCOGS,
          profitsByCategory: Object.fromEntries(
            Object.entries(profitsByCategory).map(([k, v]) => [k, v * (1 - discountRatio)])
          ),
          stockItems: stockItemsLocal,
          warehouseId: activeWarehouse?.id,
          wholesaleMode,
        },
      });

      // ✅ تسجيل الربح محلياً فوراً (تقريبي - سيُحدَّث بدقة عند المزامنة)
      const tempInvoiceId = `local_${Date.now()}`;
      addGrossProfit(tempInvoiceId, discountedProfit, totalCOGS, totalSnapshot);

      // ✅ تسجيل النشاط
      if (user) {
        const itemsDescription = cartSnapshot.map(item => `${item.name} × ${item.quantity}`).join('، ');
        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `عملية بيع نقدي بقيمة $${formatNumber(totalSnapshot)} - المنتجات: ${itemsDescription}`,
          { total: totalSnapshot, itemsCount: cartSnapshot.length, customerName: customerNameSnapshot || 'عميل نقدي' }
        );
      }

      addSalesToShift(totalSnapshot);
      recordActivity();

      // ✅ إغلاق الواجهة فوراً (< 100ms من الضغط على "بيع")
      saveSaleSnapshot(cartSnapshot, customerNameSnapshot || 'عميل نقدي');
      onClearCart();
      playSaleComplete();
      completeSync('تم الحفظ ✓ جاري الرفع...', 2000);
      showToast.success('تم حفظ الفاتورة ✓');

      // ✅ مزامنة فورية في الخلفية (بدون انتظار المستخدم)
      if (isOnline) {
        syncImmediately();
      }

    } catch (error) {
      console.error('Cash sale error:', error);
      failSync('حدث خطأ - الفاتورة محفوظة محلياً');
      showToast.warning('تم حفظ الفاتورة أوفلاين - سيتم رفعها تلقائياً');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const confirmDebtSale = async () => {
    // ✅ حماية مزدوجة: state + ref لمنع التكرارات
    if (isSaving || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    // Snapshot cart data before any changes
    const cartSnapshot = [...cart];
    const totalSnapshot = total;
    const customerNameSnapshot = customerName;
    const customerPhoneSnapshot = customerPhone;

    setShowDebtDialog(false);
    startSync('جاري إنشاء فاتورة الدين...', false);

    try {
      // ============================================================
      // نموذج "محلي أولاً": حساب الأرباح من بيانات السلة المحلية
      // بدون انتظار السيرفر - الفاتورة تُحفظ فوراً في الطابور
      // ============================================================

      const noInventory = isNoInventoryMode();

      // ✅ فحص المخزون محلياً (سريع - 0ms)
      if (!noInventory) {
        const insufficientLocal: string[] = [];
        for (const item of cartSnapshot) {
          const requestedQty = item.unit === 'bulk' && item.conversionFactor
            ? item.quantity * item.conversionFactor
            : item.quantity;
          if (requestedQty <= 0) {
            insufficientLocal.push(item.name);
          }
        }
        if (insufficientLocal.length > 0) {
          showToast.error(`كمية غير صالحة للمنتجات: ${insufficientLocal.join('، ')}`);
          savingRef.current = false;
          setIsSaving(false);
          return;
        }
      }

      // ✅ حساب الأرباح والتكلفة محلياً (0ms)
      let totalProfit = 0;
      let totalCOGS = 0;
      const profitsByCategory: Record<string, number> = {};

      const localItems = cartSnapshot.map(item => {
        let itemCostPrice: number;

        if (item.unit === 'bulk') {
          if (item.bulkCostPrice && item.bulkCostPrice > 0) {
            itemCostPrice = item.bulkCostPrice;
          } else {
            itemCostPrice = (item.costPrice || 0) * (item.conversionFactor || 1);
          }
        } else {
          itemCostPrice = item.costPrice || 0;
        }

        const itemProfit = roundCurrency((item.price - itemCostPrice) * item.quantity);
        const itemCOGS = itemCostPrice * item.quantity;

        profitsByCategory['عام'] = (profitsByCategory['عام'] || 0) + itemProfit;
        totalProfit += itemProfit;
        totalCOGS += itemCOGS;

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          costPrice: itemCostPrice,
          conversionFactor: item.conversionFactor,
          category: 'عام',
        };
      });

      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const discountedProfit = totalProfit * (1 - discountRatio);

      const stockItemsLocal = cartSnapshot.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity,
      }));

      // ✅ إضافة فاتورة الدين للطابور فوراً (محلياً - 0ms)
      const bundle = {
        customerName: customerNameSnapshot,
        customerPhone: customerPhoneSnapshot || '',
        items: localItems,
        subtotal,
        discount,
        discountAmount,
        total: totalSnapshot,
        totalInCurrency,
        currency: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        profit: discountedProfit,
        cogs: totalCOGS,
        profitsByCategory: Object.fromEntries(
          Object.entries(profitsByCategory).map(([k, v]) => [k, v * (1 - discountRatio)])
        ),
        stockItems: stockItemsLocal,
        warehouseId: activeWarehouse?.id,
      };

      addToQueue('debt_sale_bundle', { localId: `debt_${Date.now()}`, bundle });

      // ✅ تسجيل الربح محلياً فوراً
      const tempInvoiceId = `local_debt_${Date.now()}`;
      addGrossProfit(tempInvoiceId, discountedProfit, totalCOGS, totalSnapshot);

      // ✅ تسجيل النشاط
      if (user) {
        const itemsDescription = cartSnapshot.map(item => `${item.name} × ${item.quantity}`).join('، ');
        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `عملية بيع بالدين بقيمة $${formatNumber(totalSnapshot)} للعميل ${customerNameSnapshot} - المنتجات: ${itemsDescription}`,
          { total: totalSnapshot, itemsCount: cartSnapshot.length, customerName: customerNameSnapshot, paymentType: 'debt' }
        );
        addActivityLog(
          'debt_created',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `تم إنشاء دين جديد للعميل ${customerNameSnapshot} بقيمة $${formatNumber(totalSnapshot)}`,
          { amount: totalSnapshot, customerName: customerNameSnapshot }
        );
      }

      // ✅ إغلاق الواجهة فوراً
      saveSaleSnapshot(cartSnapshot, customerNameSnapshot);
      onClearCart();
      playDebtRecorded();
      completeSync('تم الحفظ ✓ جاري الرفع...', 2000);
      showToast.success('تم حفظ فاتورة الدين ✓');

      // ✅ مزامنة فورية في الخلفية
      if (isOnline) {
        syncImmediately();
      }

    } catch (error) {
      console.error('Debt sale error:', error);
      failSync('حدث خطأ - الفاتورة محفوظة محلياً');
      showToast.warning('تم حفظ فاتورة الدين أوفلاين - سيتم رفعها تلقائياً');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Smart customer search handler - using Cloud API
  const handleCustomerSearch = async (value: string) => {
    onCustomerNameChange(value);
    if (value.length >= 2) {
      try {
        // Use cloud API instead of local storage
        const customers = await loadCustomersCloud();
        const matches = customers.filter(c =>
          c.name.toLowerCase().includes(value.toLowerCase()) ||
          (c.phone && c.phone.includes(value))
        ).slice(0, 5); // Max 5 results
        setCustomerSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } catch (error) {
        console.error('Failed to load customers:', error);
        // Fallback to local storage
        const localCustomers = loadCustomers();
        const matches = localCustomers.filter(c =>
          c.name.toLowerCase().includes(value.toLowerCase()) ||
          (c.phone && c.phone.includes(value))
        ).slice(0, 5);
        setCustomerSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      }
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

  const handleAddCustomer = async () => {
    // ✅ منع التكرار عند الضغط المتعدد
    if (isAddingCustomer || addCustomerRef.current) return;

    if (!newCustomer.name || !newCustomer.phone) {
      showToast.error(t('pos.fillRequired'));
      return;
    }

    addCustomerRef.current = true;
    setIsAddingCustomer(true);

    try {
      // هذا الحوار مخصص لإضافة عميل جديد: إذا كان الاسم موجوداً نُظهر تحذيراً
      const created = await addCustomerCloud({
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || undefined,
      });

      if (!created) {
        showToast.error('هذا الاسم موجود مسبقاً، يرجى اختيار اسم مختلف');
        return;
      }

      // تحديث الحالة حتى لا يطلب الهاتف مرة أخرى
      onCustomerNameChange(created.name);
      setCustomerPhone(created.phone || '');
      setIsNewCustomer(false);

      // تحديث قائمة العملاء للبحث التلقائي
      const refreshed = await loadCustomersCloud();
      setAllCustomers(refreshed);

      showToast.success(t('pos.customerAdded'));
      setShowCustomerDialog(false);
      setNewCustomer({ name: '', phone: '', email: '' });
    } finally {
      addCustomerRef.current = false;
      setIsAddingCustomer(false);
    }
  };

  const handlePrint = (saleData?: typeof lastSale) => {
    const data = saleData || lastSale;
    const printCart = data ? data.cart : cart;
    const printCustomerName = data ? data.customerName : customerName;
    const printCurrency = data ? data.selectedCurrency : selectedCurrency;
    const printTotalInCurrency = data ? data.totalInCurrency : totalInCurrency;
    const printDiscount = data ? data.discount : discount;
    const printDiscountAmount = data ? data.discountAmount : discountAmount;

    if (printCart.length === 0) return;

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
    } catch { }

    const currentDate = new Date().toLocaleDateString('ar-SA');
    const currentTime = new Date().toLocaleTimeString('ar-SA');

    const storeType = getCurrentStoreType();
    const isPharmacy = storeType === 'pharmacy';

    const itemsHtml = printCart.map(item => `
      <tr>
        <td style="padding: 5px; border-bottom: 1px solid #eee;">
          ${item.name}
          ${isPharmacy && item.expiryDate ? `<br/><small style="color: #888;">الصلاحية: ${item.expiryDate}</small>` : ''}
          ${isPharmacy && item.batchNumber ? `<br/><small style="color: #888;">الدفعة: ${item.batchNumber}</small>` : ''}
        </td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${printCurrency.symbol}${formatNumber(item.price * item.quantity * printCurrency.rate)}</td>
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
            <div><strong>العميل:</strong> ${printCustomerName || 'عميل نقدي'}</div>
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
          ${printDiscount > 0 ? `<div style="text-align: left; color: #c00;">خصم ${printDiscount}%: -${printCurrency.symbol}${formatNumber(printDiscountAmount)}</div>` : ''}
          <div class="total">
            الإجمالي: ${printCurrency.symbol}${formatNumber(printTotalInCurrency)}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;

    printHTML(printContent);
    showToast.success('جاري إرسال الفاتورة للطابعة...');
    if (data) setLastSale(null); // مسح بعد الطباعة
  };

  const handleWhatsApp = async (saleData?: typeof lastSale) => {
    const data = saleData || lastSale;
    const shareCart = data ? data.cart : cart;
    const shareCustName = data ? data.customerName : customerName;
    const shareCurrency = data ? data.selectedCurrency : selectedCurrency;
    const shareTotalInCurrency = data ? data.totalInCurrency : totalInCurrency;
    const shareSubtotal = data ? data.subtotal : subtotal;
    const shareDiscountAmount = data ? data.discountAmount : discountAmount;

    if (shareCart.length === 0) return;

    // تحميل إعدادات المتجر
    const store = getStoreSettings();
    const currentDate = new Date().toLocaleDateString('ar-SA');

    // تحضير بيانات الفاتورة للمشاركة
    const shareData: InvoiceShareData = {
      id: `POS-${Date.now()}`,
      storeName: store.name,
      storePhone: store.phone,
      customerName: shareCustName || 'عميل نقدي',
      date: currentDate,
      items: shareCart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity,
      })),
      subtotal: shareSubtotal,
      discount: shareDiscountAmount,
      total: shareTotalInCurrency,
      currencySymbol: shareCurrency.symbol,
      paymentType: 'cash',
      type: 'sale',
    };

    const success = await shareInvoice(shareData);
    if (success) {
      showToast.success('تم فتح المشاركة');
    }
    if (data) setLastSale(null); // مسح بعد المشاركة
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
              {/* مؤشر المزامنة في الخلفية */}
              <BackgroundSyncIndicator
                state={syncState}
                message={syncMessage}
                className="hidden sm:flex"
              />
              {/* Wholesale Toggle */}
              <button
                onClick={() => {
                  setWholesaleMode(!wholesaleMode);
                  if (!wholesaleMode) setReceivedAmount(0);
                }}
                className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded-lg transition-all",
                  wholesaleMode
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-muted text-foreground hover:bg-muted/80"
                )}
              >
                <Package className="w-3.5 h-3.5 inline-block ml-1" />
                جملة
              </button>
              {cart.length > 0 && (
                <button
                  onClick={onClearCart}
                  className="text-xs md:text-sm text-destructive hover:text-destructive/80"
                >
                  {t('pos.clear')}
                </button>
              )}
              {isMobile && onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full bg-muted/60 hover:bg-destructive/10">
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          {/* مؤشر المزامنة على الموبايل */}
          {(syncState !== 'idle' || isSaving) && (
            <div className="mt-2 sm:hidden">
              <BackgroundSyncIndicator
                state={syncState}
                message={syncMessage}
              />
            </div>
          )}

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
        <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1.5 bg-muted/10">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('pos.emptyCart')}</p>
              <p className="text-xs opacity-70 mt-1">{t('pos.clickToAdd')}</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={`${item.id}-${item.unit}`}
                className="bg-card rounded-lg px-2.5 py-2 border border-border/30 cart-item-enter transition-all duration-150 hover:border-primary/30 hover:bg-card/90"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Product name row */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <h4 className="font-semibold text-xs leading-tight line-clamp-1 text-foreground">{item.name}</h4>
                    {item.bulkSalePrice && item.bulkSalePrice > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${item.unit === 'bulk'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                          }`}>
                          {item.unit === 'bulk' ? (item.bulkUnit || 'كرتونة') : (item.smallUnit || 'قطعة')}
                        </span>
                        {onToggleUnit && (
                          <button
                            onClick={() => onToggleUnit(item.id, item.unit)}
                            className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Repeat className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id, item.unit)}
                    className="p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {/* Price + qty row */}
                <div className="flex items-center justify-between gap-2">
                  {/* Qty controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1, item.unit)}
                      className="w-6 h-6 rounded-md bg-muted/80 border border-border/40 text-foreground flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="w-5 text-center font-bold text-xs text-foreground">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1, item.unit)}
                      className="w-6 h-6 rounded-md bg-muted/80 border border-border/40 text-foreground flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  {/* Price */}
                  <div className="flex items-center gap-1.5">
                    {onUpdateItemPrice && (
                      <EditablePrice
                        value={getItemPrice(item)}
                        onChange={(newPrice) => onUpdateItemPrice(item.id, newPrice, item.unit)}
                        className="w-14 h-6 text-[10px] text-center bg-muted/30 border border-border p-1"
                      />
                    )}
                    <span className={cn("font-bold text-sm tabular-nums", wholesaleMode ? "text-orange-500" : "text-primary")}>
                      ${formatNumber(getItemPrice(item) * item.quantity)}
                    </span>
                  </div>
                </div>
                {/* Wholesale / Repair extra info */}
                {wholesaleMode && (
                  <div className="text-[9px] text-orange-400 mt-1 opacity-80">
                    {formatNumber(getItemPrice(item))} × {item.quantity}
                  </div>
                )}
                {isRepairStoreType() && item.costPrice != null && (
                  <div className="text-[9px] text-muted-foreground mt-1">
                    تكلفة: ${formatNumber(item.costPrice || 0)} · مرجع: ${formatNumber((item.costPrice || 0) + (item.laborCost || 0))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Cart Footer - Modern & Compact */}
        <div className="border-t border-border/60 bg-card/95 backdrop-blur-sm p-2.5 space-y-2">
          {/* Row 1: Currency Pills (compact) + Tax Toggle */}
          <div className="flex items-center gap-1.5">
            {/* Currency pills - compact */}
            <div className="flex gap-1 bg-muted/60 rounded-lg p-0.5 flex-1">
              {currencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => onCurrencyChange(currency)}
                  className={cn(
                    "flex-1 py-1 rounded-md text-[10px] font-semibold transition-all leading-none",
                    selectedCurrency.code === currency.code
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {currency.code === 'USD' ? '$USD' : currency.code === 'TRY' ? '₺TRY' : 'SYP'}
                </button>
              ))}
            </div>
            {/* Tax Toggle Switch - only show when tax is enabled */}
            {storeTaxEnabled && storeTaxRate > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0 bg-muted/60 rounded-lg px-1.5 py-0.5">
                <Switch
                  checked={taxMode === 'gross'}
                  onCheckedChange={(checked) => setTaxMode(checked ? 'gross' : 'net')}
                  className="scale-75"
                />
                <span className="text-[9px] text-muted-foreground leading-tight font-medium">
                  {storeTaxRate}%
                </span>
              </div>
            )}
          </div>

          {/* Row 2: Discount (only if enabled) */}
          {(settingsDiscountPercentEnabled || settingsDiscountFixedEnabled) && (
            <div className="flex gap-1">
              {settingsDiscountPercentEnabled && (
                <div className="flex items-center gap-0.5 flex-1 bg-muted/50 rounded-lg px-2 h-7 border border-border/30">
                  <Percent className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="number"
                    placeholder="خصم %"
                    value={discountType === 'percent' ? (discount || '') : ''}
                    onChange={(e) => {
                      setDiscountType('percent');
                      onDiscountChange(Number(e.target.value));
                    }}
                    onFocus={() => setDiscountType('percent')}
                    className={cn(
                      "border-0 h-6 text-[10px] bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground",
                      discountType === 'percent' && discount > 0 && "font-semibold text-primary"
                    )}
                    min="0"
                    max="100"
                  />
                </div>
              )}
              {settingsDiscountFixedEnabled && (
                <div className="flex items-center gap-0.5 flex-1 bg-muted/50 rounded-lg px-2 h-7 border border-border/30">
                  <DollarSign className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="number"
                    placeholder={`خصم ${selectedCurrency.symbol}`}
                    value={discountType === 'fixed' ? (discount || '') : ''}
                    onChange={(e) => {
                      setDiscountType('fixed');
                      onDiscountChange(Number(e.target.value));
                    }}
                    onFocus={() => setDiscountType('fixed')}
                    className={cn(
                      "border-0 h-6 text-[10px] bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground",
                      discountType === 'fixed' && discount > 0 && "font-semibold text-primary"
                    )}
                    min="0"
                  />
                </div>
              )}
            </div>
          )}

          {/* Row 3: Received Amount */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 h-7 border border-border/30">
            <Banknote className={cn(
              "w-3 h-3 flex-shrink-0",
              wholesaleMode ? "text-warning" : "text-muted-foreground"
            )} />
            <Input
              type="number"
              placeholder={t('pos.receivedAmount') || 'المبلغ المقبوض'}
              value={receivedAmount || ''}
              onChange={(e) => setReceivedAmount(Number(e.target.value))}
              className={cn(
                "border-0 h-6 text-[10px] bg-transparent p-0 focus-visible:ring-0 shadow-none flex-1 text-foreground placeholder:text-muted-foreground",
                wholesaleMode ? "font-semibold text-warning" : receivedAmount > 0 ? "font-semibold text-primary" : ""
              )}
              min="0"
              dir="ltr"
            />
          </div>

          {/* Row 4: Info summary + Total */}
          <div className="space-y-1">
            {/* Info chips */}
            {(subtotal !== total || discount > 0 || (storeTaxEnabled && taxAmount > 0) || receivedAmount > 0) && (
              <div className="flex flex-wrap gap-1 text-[9px]">
                {subtotal !== total && (
                  <span className="bg-muted/70 text-muted-foreground px-1.5 py-0.5 rounded">
                    {wholesaleMode ? 'جملة' : 'المجموع'}: ${formatNumber(subtotal)}
                  </span>
                )}
                {discount > 0 && (
                  <span className="bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">
                    خصم: -{discountType === 'fixed' ? `${selectedCurrency.symbol}${formatNumber(discount)}` : `$${formatNumber(discountAmount)}`}
                  </span>
                )}
                {storeTaxEnabled && effectiveTaxRate > 0 && taxAmount > 0 && (
                  <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                    ض. {effectiveTaxRate}%: ${formatNumber(taxAmount)}
                  </span>
                )}
                {receivedAmount > 0 && !wholesaleMode && receivedAmount >= total && (
                  <span className="bg-success/10 text-success px-1.5 py-0.5 rounded font-bold">
                    باقي: ${formatNumber(receivedAmount - total)}
                  </span>
                )}
                {receivedAmount > 0 && wholesaleMode && (
                  <span className={cn("px-1.5 py-0.5 rounded font-bold", wholesaleProfit && wholesaleProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    ربح: ${formatNumber(wholesaleProfit || 0)}
                  </span>
                )}
              </div>
            )}
            {/* Total row */}
            <div className="flex justify-between items-center bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/10">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">{t('pos.total')}</span>
                <button
                  onClick={() => setShowCalculator(true)}
                  className="w-5 h-5 rounded bg-primary/20 text-primary hover:bg-primary/30 flex items-center justify-center transition-colors text-[10px]"
                  title="آلة حاسبة"
                >
                  ⊞
                </button>
              </div>
              <span className={cn("text-xl font-bold tabular-nums", wholesaleMode ? "text-warning" : "text-primary")}>
                {selectedCurrency.symbol}{formatNumber(totalInCurrency)}
              </span>
            </div>
          </div>

          {/* Row 5: Pay Buttons + Action Icons */}
          <div className="flex items-center gap-1.5">
            <Button
              data-tour="cash-btn"
              className="flex-1 h-11 bg-success hover:bg-success/90 text-sm font-bold shadow-md shadow-success/25 transition-all active:scale-95 rounded-xl"
              disabled={cart.length === 0}
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4 ml-1.5" />
              {t('pos.cash')}
            </Button>
            <Button
              data-tour="debt-btn"
              variant="outline"
              className="flex-1 h-11 border-2 border-warning/70 text-warning hover:bg-warning/10 text-sm font-bold transition-all active:scale-95 rounded-xl"
              disabled={cart.length === 0}
              onClick={handleDebtSale}
            >
              <CreditCard className="w-4 h-4 ml-1.5" />
              {t('pos.debt')}
            </Button>
            {/* Print & Share Icon Buttons */}
            <Button
              data-tour="action-btns"
              variant="ghost"
              size="icon"
              className="h-11 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl"
              disabled={cart.length === 0 && !lastSale}
              onClick={() => handlePrint()}
              title={t('pos.print')}
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl"
              disabled={cart.length === 0 && !lastSale}
              onClick={() => handleWhatsApp()}
              title={t('pos.whatsapp')}
            >
              <Send className="w-4 h-4" />
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
                <span className="text-primary">{selectedCurrency.symbol}{formatNumber(totalInCurrency)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-foreground" onClick={() => setShowCashDialog(false)}>
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
                <span>{selectedCurrency.symbol}{formatNumber(totalInCurrency)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-foreground" onClick={() => setShowDebtDialog(false)}>
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
              <Button variant="outline" className="flex-1 text-foreground" onClick={() => setShowCustomerDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddCustomer} disabled={isAddingCustomer}>
                <UserPlus className="w-4 h-4 ml-2" />
                {isAddingCustomer ? 'جاري الحفظ...' : 'إضافة العميل'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* آلة حاسبة */}
      <Calculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onResult={(value) => setReceivedAmount(value)}
      />
    </>
  );
}
