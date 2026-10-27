import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wrench,
  AlertCircle,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  Percent,
  Banknote,
  CreditCard,
  X,
  UserPlus,
  Check,
  Search,
  Package,
  Repeat,
  Coins
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatNumber, formatCurrency, formatMoney, roundCurrency, addCurrency, clampNumber } from '@/lib/utils';
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
import { toast } from '@/lib/sonner-bridge';
import { showToast } from '@/lib/toast-config';
import { isNotificationEventAllowed } from '@/lib/notification-events-config';
import { showSmartToast } from '@/hooks/use-smart-toast';
import { loadCustomers, Customer } from '@/lib/customers-store';
import { getNextInvoiceNumber } from '@/lib/invoices-store';
import { addActivityLog } from '@/lib/activity-log';
import { addGrossProfit } from '@/lib/profits-store';
import { useAuth } from '@/hooks/use-auth';
import { printHTML, printInvoice, PrintableInvoice, getStoreSettings, getPrintSettings } from '@/lib/native-print';
import { isNativeAndroid } from '@/lib/printer/flowpos-printer';
import { getStoredPrinterConfig } from '@/lib/printer/printer-config';
import { shareInvoice, InvoiceShareData } from '@/lib/native-share';
import { playSaleComplete, playDebtRecorded } from '@/lib/sound-utils';
import { addSalesToShift, getActiveShift } from '@/lib/cashbox-store';
import { recordActivity } from '@/lib/auto-backup';
import { useLanguage } from '@/hooks/use-language';
import { getLocalizedUnit } from '@/lib/product-units';
import {
  loadCustomersCloud,
  addCustomerCloud,
} from '@/lib/cloud/customers-cloud';
import { useWarehouse } from '@/hooks/use-warehouse';
import { BackgroundSyncIndicator, useSyncState } from './BackgroundSyncIndicator';
import { addUniqueOperation } from '@/lib/sync-queue';
import { deductProductsLocalCache, validateCartProducts } from '@/lib/cloud/products-cloud';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import { recordOfflineInvoiceLocal, Invoice } from '@/lib/cloud/invoices-cloud';
import { canSellOffline, incrementOfflineInvoiceCounter } from '@/lib/offline-lease';
import { getCurrencySymbolByCode, resolveInvoiceCurrencySymbol } from '@/lib/currencies';
import { createCurrencySnapshot, getCurrencyDef, toUsd, fromUsd, round8, roundForCurrency as roundForCurr } from '@/lib/money-engine';

import { Calculator } from '@/components/ui/Calculator';
import { isNoInventoryMode, getCurrentStoreType, getVisibleSections } from '@/lib/store-type-config';
import { MaintenancePanel } from '@/components/pos/MaintenancePanel';

const isRepairStoreType = () => getCurrentStoreType() === 'repair';

// Helper to retrieve fallback cost price from local product cache if item.costPrice is missing or 0
const getFallbackCostPrice = (productId: string): number => {
  try {
    const cached = localStorage.getItem('hyperpos_products_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      const list = parsed.products || (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(list)) {
        const p = list.find((x: any) => x && (x.id === productId || String(x.id) === String(productId)));
        if (p && typeof p.costPrice === 'number' && p.costPrice > 0) {
          return p.costPrice;
        }
        if (p && typeof p.cost_price === 'number' && p.cost_price > 0) {
          return p.cost_price;
        }
      }
    }
  } catch {
    // ignore
  }
  return 0;
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
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
  /** عملة إدخال/عرض السعر لهذا السطر فقط */
  priceEntryCurrencyCode?: string;
  /** لقطة معدل صرف وقت اختيار عملة السطر */
  priceEntryRateSnapshot?: number;
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  rate: number;
}

export interface HeldCart {
  id: string;
  name: string;
  cart: CartItem[];
  customerName: string;
  discount: number;
  createdAt: number;
  invoiceCurrencyCode?: string;
  invoiceExchangeRateSnapshot?: number;
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
  heldCarts?: HeldCart[];
  activeCartId?: string;
  onSwitchCart?: (cartId: string) => void;
  onAddNewCart?: () => void;
  onRemoveCart?: (cartId: string, e?: React.MouseEvent) => void;
  lastAddedItemId?: string | null;
  isMaintenanceEnabled?: boolean;
}

function generateQuickCashOptions(totalAmount: number, currencyCode: string, exchangeRate: number = 1): number[] {
  if (totalAmount <= 0) return [];
  const options = new Set<number>();
  const isHighDenom = exchangeRate >= 100 || totalAmount >= 10000;
  const isMidDenom = exchangeRate >= 5 || totalAmount >= 50;

  const exact = isHighDenom ? Math.round(totalAmount) : Math.round(totalAmount * 100) / 100;
  options.add(exact);

  if (isHighDenom) {
    const steps = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
    for (const step of steps) {
      const rounded = Math.ceil(totalAmount / step) * step;
      if (rounded > totalAmount) options.add(rounded);
    }
  } else if (isMidDenom) {
    const steps = [5, 10, 20, 50, 100, 200, 500];
    for (const step of steps) {
      const rounded = Math.ceil(totalAmount / step) * step;
      if (rounded > totalAmount) options.add(rounded);
    }
  } else {
    const intCeil = Math.ceil(totalAmount);
    if (intCeil > totalAmount) options.add(intCeil);
    const steps = [5, 10, 20, 50, 100];
    for (const step of steps) {
      const rounded = Math.ceil(totalAmount / step) * step;
      if (rounded > totalAmount) options.add(rounded);
    }
  }

  return Array.from(options)
    .filter(val => val >= exact)
    .sort((a, b) => a - b)
    .slice(0, 5);
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
  heldCarts,
  activeCartId,
  onSwitchCart,
  onAddNewCart,
  onRemoveCart,
  lastAddedItemId,
  isMaintenanceEnabled: propIsMaintenanceEnabled,
}: CartPanelProps) {
  const { user, profile } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  // المستودع الرئيسي يخزن كمياته في المنتج نفسه وليس في جدول مخزون المستودعات
  const stockWarehouseId = activeWarehouse && activeWarehouse.type !== 'main' ? activeWarehouse.id : undefined;
  const { syncState, syncMessage, startSync, completeSync, failSync } = useSyncState();
  const { isOnline, syncImmediately } = useCloudSyncContext();
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showDeficitDialog, setShowDeficitDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false); // ✅ Mutex lock لمنع التكرارات
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const addCustomerRef = useRef(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Loaded customers for search
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // Fixed amount discount feature
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');

  // Wholesale mode
  const [wholesaleMode, setWholesaleMode] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [receivedCurrencyCode, setReceivedCurrencyCode] = useState<string>(() => selectedCurrency.code);

  // مزامنة عملة المبلغ المقبوض تلقائياً مع العملة المحددة للسلة وتصفير المقبوض
  useEffect(() => {
    setReceivedCurrencyCode(selectedCurrency.code);
    setReceivedAmount(0);
  }, [selectedCurrency.code]);

  // Fallback if the received currency was disabled in settings
  useEffect(() => {
    if (!currencies.some(c => c.code === receivedCurrencyCode)) {
      setReceivedCurrencyCode(currencies[0]?.code || 'USD');
    }
  }, [currencies, receivedCurrencyCode]);

  // تصفير المبلغ المقبوض عند تفريغ السلة
  useEffect(() => {
    if (cart.length === 0) {
      setReceivedAmount(0);
    }
  }, [cart.length]);

  const usdSymbol = currencies.find(c => c.code === 'USD')?.symbol || '$';
  

  // Smart customer search feature
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);  // ✅ آلة حاسبة
  const [showMaintenance, setShowMaintenance] = useState(false);

  const isMaintenanceEnabled = useMemo(() => {
    if (typeof propIsMaintenanceEnabled === 'boolean') {
      return propIsMaintenanceEnabled;
    }
    try {
      const raw = window.localStorage.getItem('hyperpos_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.hideMaintenanceSection) return false;
      }
      const storeType = getCurrentStoreType();
      const visible = getVisibleSections(storeType);
      return Boolean(visible?.maintenance);
    } catch {
      return false;
    }
  }, [propIsMaintenanceEnabled]);

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
    paymentType?: 'cash' | 'debt' | 'split';
    downPayment?: number;
    debtRemaining?: number;
    invoiceNumber?: string;
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

    return price;
  };

  const subtotal = round8(
    cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0)
  );

  // Discount is entered in the selected currency (fixed) or as a percent; discountAmount is always USD
  const activeRate = Number.isFinite(selectedCurrency.rate) && selectedCurrency.rate > 0 ? selectedCurrency.rate : 1;
  const safeDiscountValue = Number.isFinite(discount) ? Number(discount) : 0;
  const discountAmount = discountType === 'percent'
    ? round8((subtotal * clampNumber(safeDiscountValue, 0, 100)) / 100)
    : Math.min(
        subtotal,
        Math.max(0, toUsd(safeDiscountValue, selectedCurrency.code, activeRate))
      );

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // ✅ Tax Calculation - read from store settings
  const [taxMode, setTaxMode] = useState<'net' | 'gross'>('net');
  const storeSettingsRaw = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('hyperpos_settings_v1') || '{}');
    } catch { return {}; }
  }, []);
  const storeTaxEnabled = storeSettingsRaw.taxEnabled ?? false;
  const storeTaxValue = Number(storeSettingsRaw.taxRate ?? 0);
  const storeTaxRate = Number.isFinite(storeTaxValue) ? clampNumber(storeTaxValue, 0, 100) : 0;
  const safeTaxRate = storeTaxRate;
  const settingsDiscountPercentEnabled = storeSettingsRaw.discountPercentEnabled ?? true;
  const settingsDiscountFixedEnabled = storeSettingsRaw.discountFixedEnabled ?? true;

  const effectiveTaxRate = storeTaxEnabled ? safeTaxRate : 0;
  const taxAmount = round8(taxMode === 'gross'
    ? (taxableAmount * effectiveTaxRate) / (100 + effectiveTaxRate)
    : (taxableAmount * effectiveTaxRate) / 100);

  const total = round8(taxMode === 'gross'
    ? taxableAmount // price already includes tax
    : taxableAmount + taxAmount);
  const totalInCurrency = roundForCurr(fromUsd(total, selectedCurrency.code, selectedCurrency.rate), selectedCurrency.code);

  // Active currency object for received amount
  const activeReceivedCurrency = useMemo(() => {
    return currencies.find(c => c.code === receivedCurrencyCode) || selectedCurrency;
  }, [currencies, receivedCurrencyCode, selectedCurrency]);

  const receivedRate = Number.isFinite(activeReceivedCurrency.rate) && activeReceivedCurrency.rate > 0
    ? activeReceivedCurrency.rate
    : 1;

  // 💱 المبلغ المقبوض يُحوّل للدولار بناءً على عملة القبض المختارة
  const receivedUSD = toUsd(receivedAmount > 0 ? receivedAmount : 0, activeReceivedCurrency.code, receivedRate);

  // إجمالي الفاتورة بعملة المقبوض مقرباً بدقة منازل العملة
  const totalInReceivedCurrency = roundForCurr(fromUsd(total, activeReceivedCurrency.code, receivedRate), activeReceivedCurrency.code);

  // Quick cash denomination options
  const quickCashOptions = useMemo(() => {
    return generateQuickCashOptions(totalInReceivedCurrency, activeReceivedCurrency.code, activeReceivedCurrency.rate);
  }, [totalInReceivedCurrency, activeReceivedCurrency.code, activeReceivedCurrency.rate]);

  // الباقي للزبون (Change) مقرباً وفق منازل عملة القبض، وبالدولار بدقة 8 منازل
  const changeInReceivedCurrency = roundForCurr(Math.max(0, receivedAmount - totalInReceivedCurrency), activeReceivedCurrency.code);
  const changeUSD = round8(Math.max(0, receivedUSD - total));

  // المتبقي كدين أو عجز مقرباً وفق منازل عملة القبض، وبالدولار بدقة 8 منازل
  const remainingInReceivedCurrency = roundForCurr(Math.max(0, totalInReceivedCurrency - receivedAmount), activeReceivedCurrency.code);
  const remainingUSD = round8(Math.max(0, total - receivedUSD));

  // هل تنطبق شروط الدفع المركب (مقبوض جزئي أكبر من 0 وأقل من الإجمالي)
  

  // Wholesale profit = receivedAmount - COGS (الربح الفعلي = المبلغ المستلم - رأس المال)
  const wholesaleCOGS = round8(cart.reduce((sum, item) => {
    const costPrice = item.costPrice || 0;
    return sum + costPrice * item.quantity;
  }, 0));

  // ✅ الربح = المبلغ المستلم (بالدولار) - رأس المال
  const wholesaleProfit = wholesaleMode
    ? round8((receivedUSD > 0 ? receivedUSD : subtotal) - wholesaleCOGS)
    : undefined;

  // هل العميل محدد ومسجل وليس عاماً
  const isRealCustomerSelected = (name?: string) => {
    if (!name) return false;
    const clean = name.trim();
    return clean.length > 0 && clean !== 'عميل نقدي' && clean !== 'زبون عام';
  };

  // ✅ حفظ لقطة من البيع الحالي قبل تفريغ السلة
  const saveSaleSnapshot = (
    cartData: CartItem[],
    custName: string,
    paymentType: 'cash' | 'debt' | 'split' = 'cash',
    downPayment: number = 0,
    debtRemaining: number = 0,
    invoiceNum?: string,
    customCurrencySymbol?: string
  ) => {
    const snap = createCurrencySnapshot(selectedCurrency.code, selectedCurrency.rate || activeRate);
    const symbolToUse = customCurrencySymbol || snap.currency_symbol;
    setLastSale({
      cart: [...cartData],
      customerName: custName,
      totalInCurrency,
      subtotal,
      discount,
      discountAmount,
      discountType,
      selectedCurrency: {
        ...selectedCurrency,
        symbol: symbolToUse,
      },
      taxAmount,
      effectiveTaxRate,
      paymentType,
      downPayment,
      debtRemaining,
      invoiceNumber: invoiceNum,
    });
  };

  // اعتماد العجز في المبلغ المقبوض كخصم فوري للتسوية السريعة
  const handleApplyDeficitAsDiscount = () => {
    if (receivedUSD <= 0 || receivedUSD >= total - 0.0001) return;
    
    // حساب قيمة الخصم الإجمالية بالدولار المطلوبة لجعل الإجمالي النهائي مساوياً تماماً للمقبوض
    let requiredDiscountAmountUSD = 0;
    if (taxMode === 'gross' || effectiveTaxRate <= 0) {
      requiredDiscountAmountUSD = Math.max(0, round8(subtotal - receivedUSD));
    } else {
      const targetTaxable = receivedUSD / (1 + effectiveTaxRate / 100);
      requiredDiscountAmountUSD = Math.max(0, round8(subtotal - targetTaxable));
    }

    setDiscountType('fixed');
    const newDiscountInCurrency = roundForCurr(fromUsd(requiredDiscountAmountUSD, selectedCurrency.code, activeRate), selectedCurrency.code);
    onDiscountChange(newDiscountInCurrency);
    showToast.success(`${t('pos.deficitAppliedSuccess') || 'تم اعتماد العجز كخصم فوري'} (${activeReceivedCurrency.symbol}${formatNumber(remainingInReceivedCurrency)})`);
  };

  // اعتماد الزيادة في المبلغ المقبوض كربح إضافي عبر تعديل سعر البيع
  const handleApplySurplusAsProfit = () => {
    if (!onUpdateItemPrice || cart.length === 0) return;
    if (receivedUSD <= total + 0.0001) return;

    if (discount > 0) {
      onDiscountChange(0);
    }

    const targetSubtotalUSD = (taxMode === 'gross' || effectiveTaxRate <= 0)
      ? receivedUSD
      : receivedUSD / (1 + effectiveTaxRate / 100);

    const extraProfitUSD = round8(receivedUSD - total);

    if (cart.length === 1) {
      const item = cart[0];
      const newUnitPrice = round8(targetSubtotalUSD / item.quantity);
      onUpdateItemPrice(item.id, newUnitPrice, item.unit);
      showToast.success(`${t('pos.surplusAppliedSuccess') || 'تم تعديل السعر واعتماد الزيادة كربح إضافي'} (${formatNumber(extraProfitUSD)})`);
    } else {
      const currentSubtotal = subtotal > 0 ? subtotal : 1;
      const ratio = targetSubtotalUSD / currentSubtotal;
      cart.forEach((item) => {
        const newUnitPrice = round8(item.price * ratio);
        onUpdateItemPrice(item.id, newUnitPrice, item.unit);
      });
      showToast.success(`${t('pos.surplusAppliedSuccess') || 'تم تعديل السعر واعتماد الزيادة كربح إضافي'} (${formatNumber(extraProfitUSD)})`);
    }
  };

  const handleCashSale = async () => {
    if (cart.length === 0) return;

    const validation = await validateCartProducts(cart);
    if (!validation.isValid) {
      showToast.error(`${t('pos.itemUnavailable') || 'الصنف غير متاح'}: ${validation.invalidItems.join(', ')}`);
      return;
    }

    // إذا كان هناك عجز في المقبوض، نفتح حوار المعالجة (خصم فوري أو دين) بدلاً من window.confirm المانع لتجميد WebView
    if (!wholesaleMode && receivedUSD > 0 && receivedUSD < total - 0.001) {
      setShowDeficitDialog(true);
      return;
    }

    setShowCashDialog(true);
  };

  const handleDebtSale = async () => {
    if (cart.length === 0) return;

    // 🛡️ فحص استباقي: التحقق من أن كل صنف في السلة معتمد وموجود في الكتالوج السحابي
    const validation = await validateCartProducts(cart);
    if (!validation.isValid) {
      showToast.error(
        `${t('pos.itemUnapproved') || 'الصنف غير معتمد أو تم حذفه من السحابة. يرجى إزالته من السلة.'} (${validation.invalidItems.join(', ')})`,
        { persistent: false }
      );
      return;
    }

    if (!isRealCustomerSelected(customerName)) {
      showToast.error(t('pos.enterCustomerName') || 'يرجى تحديد عميل مسجل لتسجيل الدين');
      return;
    }

    // ✅ التحقق إذا كان العميل موجوداً في قاعدة البيانات واستخدام رقم هاتفه
    const existingCustomer = allCustomers.find(c =>
      c.name.toLowerCase().trim() === customerName.toLowerCase().trim()
    );

    if (existingCustomer) {
      setIsNewCustomer(false);
      setCustomerPhone(existingCustomer.phone || customerPhone || ''); // ✅ استخدام الهاتف المحفوظ
    } else if (customerPhone && customerPhone.trim()) {
      // ✅ العميل تمت إضافته للتو برقم هاتف في هذه الجلسة
      setIsNewCustomer(false);
    } else {
      setIsNewCustomer(true);
      setCustomerPhone('');
    }

    setShowDebtDialog(true);
  };

  const confirmCashSale = async () => {
    // ✅ حماية مزدوجة: state + ref لمنع التكرارات
    if (isSaving || savingRef.current) return;

    // 🎫 بوابة تذكرة الأوفلاين: منع البيع عند انتهاء التذكرة أو العبث بالساعة أو بلوغ حد الفواتير
    const leaseGate = canSellOffline();
    if (!leaseGate.allowed) {
      showToast.error(leaseGate.message, { persistent: false });
      return;
    }

    // 🛡️ فحص استباقي حاسم قبل تفريغ السلة وتوليد الفاتورة
    const validation = await validateCartProducts(cart);
    if (!validation.isValid) {
      showToast.error(
        `تعذر حفظ الفاتورة: الصنف "${validation.invalidItems.join('، ')}" تالف أو تم حذفه من السحابة. يرجى إزالته من السلة.`,
        { persistent: false }
      );
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    // Snapshot cart data before any changes
    const cartSnapshot = [...cart];
    // 🛡️ لا يُحوَّل نقص المقبوض إلى خصم صامت بعد اليوم.
    // البيع النقدي يُسجَّل بقيمته الكاملة؛ النقص يُعالج كخصم صريح أو كبيع مركب مع عميل.
    if (!wholesaleMode && receivedUSD > 0 && receivedUSD < total - 0.001) {
      savingRef.current = false;
      setIsSaving(false);
      setShowCashDialog(false);
      
      showToast.error(
        `المبلغ المقبوض (${activeReceivedCurrency.symbol}${formatNumber(receivedAmount)}) أقل من إجمالي الفاتورة (${activeReceivedCurrency.symbol}${formatNumber(totalInReceivedCurrency)}). حدد عميلاً مسجلاً لإتمام العملية كدفع مركب، أو أدخل المبلغ كاملاً.`
      );
      return;
    }
    const effectiveDiscountAmount = round8(discountAmount);
    const totalSnapshot = round8(total);

    const customerNameSnapshot = customerName;
    const operationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sale_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // دقة تحديد رمز العملة الفعلي لضمان عدم تسرب $ إذا كانت العملة غير الدولار
    const effectiveCurrencySymbol = resolveInvoiceCurrencySymbol(
      selectedCurrency.code,
      selectedCurrency.symbol
    );

    // 🚀 توليد رقم الفاتورة وإغلاق نافذة الدفع والسلة فوراً وتفريغ المحتويات
    const invoiceNumber = getNextInvoiceNumber();
    (window as any).__posSuppressExitUntil = Date.now() + 4000;
    setShowCashDialog(false);
    onClose?.();
    saveSaleSnapshot(cartSnapshot, customerNameSnapshot || 'عميل نقدي', 'cash', 0, 0, invoiceNumber, effectiveCurrencySymbol);
    onClearCart();
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
            const baseCost = (item.costPrice && item.costPrice > 0) ? item.costPrice : getFallbackCostPrice(item.id);
            itemCostPrice = baseCost * (item.conversionFactor || 1);
          }
        } else {
          itemCostPrice = (item.costPrice && item.costPrice > 0) ? item.costPrice : getFallbackCostPrice(item.id);
        }

        const itemPrice = wholesaleMode ? getItemPrice(item) : item.price;
        const itemNetPrice = taxMode === 'gross' && effectiveTaxRate > 0 ? itemPrice / (1 + effectiveTaxRate / 100) : itemPrice;
        const itemProfit = round8((itemNetPrice - itemCostPrice) * item.quantity);
        const itemCOGS = round8(itemCostPrice * item.quantity);

        const cat = item.category || 'عام';
        profitsByCategory[cat] = round8((profitsByCategory[cat] || 0) + itemProfit);
        totalProfit = round8(totalProfit + itemProfit);
        totalCOGS = round8(totalCOGS + itemCOGS);

        return {
          id: item.id,
          name: item.name,
          price: itemPrice,
          quantity: item.quantity,
          total: round8(itemPrice * item.quantity),
          costPrice: itemCostPrice,
          profit: itemProfit,
          category: cat,
        };
      });

      const discountRatio = subtotal > 0 ? Math.min(1, effectiveDiscountAmount / subtotal) : 0;
      // الربح = المجموع − الخصم − التكلفة بدقة 8 منازل
      const discountedProfit = round8(totalProfit - effectiveDiscountAmount);

      const stockItemsLocal = cartSnapshot.map(item => ({
        productId: item.id,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity,
      }));

      if (!noInventory) {
        const deductResult = await deductProductsLocalCache(stockItemsLocal, operationId, stockWarehouseId);
        if (!deductResult.success) {
          const msgs = deductResult.insufficientItems.map(i => `${i.productName} (المطلوب: ${i.requested}, المتاح: ${i.available})`);
          showToast.error('المخزون غير كافٍ: ' + msgs.join('، '));
          return;
        }
      }

      const selectedCustomer = allCustomers.find(c =>
        c.name.toLowerCase().trim() === (customerNameSnapshot || '').toLowerCase().trim()
      );
      const resolvedCustomerId = selectedCustomerId || selectedCustomer?.id;

      if (isRealCustomerSelected(customerNameSnapshot) && !resolvedCustomerId) {
        showToast.warning('اسم العميل المدخل غير مسجل كعميل في النظام، وسيتم حفظ الفاتورة النقدية بدون معرف عميل.');
      }

      // 1. ✅ تسجيل الفاتورة محلياً فوراً وبث التحديث للشاشة (0ms)
      const cashSnap = createCurrencySnapshot(selectedCurrency.code, activeRate);
      const exactCashTotalInCurr = roundForCurr(fromUsd(totalSnapshot, cashSnap.currency_code, cashSnap.exchange_rate), cashSnap.currency_code);

      const offlineCashInvoice: Invoice = {
        id: invoiceNumber,
        type: 'sale',
        customerId: resolvedCustomerId,
        customerName: customerNameSnapshot || 'عميل نقدي',
        items: localItems.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          total: i.total,
          costPrice: i.costPrice,
          profit: round8(i.profit - i.total * discountRatio),
          category: i.category,
        })),
        subtotal,
        subtotalInCurrency: exactCashTotalInCurr,
        discount: effectiveDiscountAmount,
        discountPercentage: discountType === 'percent' ? discount : 0,
        taxRate: effectiveTaxRate,
        taxAmount,
        total: totalSnapshot,
        totalInCurrency: exactCashTotalInCurr,
        currency: cashSnap.currency_code,
        currencySymbol: cashSnap.currency_symbol,
        currencyName: selectedCurrency.name,
        exchangeRate: cashSnap.exchange_rate,
        currencyCode: cashSnap.currency_code,
        profit: discountedProfit,
        partsCost: totalCOGS,
        paymentType: 'cash',
        status: 'paid',
        pending_sync: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cashierId: user?.id,
        cashierName: profile?.full_name || user?.email || undefined,
        warehouseId: stockWarehouseId,
      };
      recordOfflineInvoiceLocal(offlineCashInvoice);

      // ✅ تحديث إحصائيات العميل النشطة فوراً
      if (resolvedCustomerId) {
        import('@/lib/cloud/customers-cloud').then(({ updateCustomerStatsCloud }) => {
          updateCustomerStatsCloud(resolvedCustomerId).catch(() => {});
        });
      }

      // ✅ تسجيل الربح محلياً فوراً برقم الفاتورة ومعرف العملية (يمنع المضاعفة عند المزامنة)
      addGrossProfit(invoiceNumber, discountedProfit, totalCOGS, totalSnapshot, operationId);

      // 2. ✅ إضافة الفاتورة لطابور المزامنة sync-queue
      addUniqueOperation('invoice_create', {
        operationId,
        bundle: {
          invoiceNumber,
          customerId: resolvedCustomerId,
          customerName: customerNameSnapshot || 'عميل نقدي',
          items: localItems.map(i => ({ ...i, profit: round8(i.profit - i.total * discountRatio) })),
          subtotal,
          discount: effectiveDiscountAmount,
          discountPercentage: discountType === 'percent' ? discount : 0,
          taxRate: effectiveTaxRate,
          taxAmount,
          total: totalSnapshot,
          totalInCurrency: exactCashTotalInCurr,

          currency: cashSnap.currency_code,
          currencySymbol: cashSnap.currency_symbol,
          currencyName: selectedCurrency.name,
          exchangeRate: cashSnap.exchange_rate,
          currency_code: cashSnap.currency_code,
          currency_symbol: cashSnap.currency_symbol,
          exchange_rate: cashSnap.exchange_rate,
          decimals: cashSnap.decimals,
          profit: discountedProfit,
          cogs: totalCOGS,
          profitsByCategory: Object.fromEntries(
            Object.entries(profitsByCategory).map(([k, v]) => [k, round8(localItems.filter(i => i.category === k).reduce((s, i) => s + (i.profit - i.total * discountRatio), 0))])
          ),
          stockItems: stockItemsLocal,
          warehouseId: stockWarehouseId,
          wholesaleMode,
        },
      }, operationId);

      // 🎫 احتساب الفاتورة ضمن حصة الأوفلاين (لا تُصفَّر إلا بمزامنة ناجحة)
      if (!navigator.onLine) incrementOfflineInvoiceCounter();

      // ✅ تسجيل النشاط
      if (user) {
        const itemsDescription = cartSnapshot.map(item => `${item.name} × ${item.quantity}`).join('، ');
        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `عملية بيع نقدي بقيمة ${formatMoney(totalSnapshot)} - المنتجات: ${itemsDescription}`,
          { total: totalSnapshot, itemsCount: cartSnapshot.length, customerName: customerNameSnapshot || 'عميل نقدي' }
        );
      }

      addSalesToShift(
        totalSnapshot,
        discountedProfit,
        totalCOGS,
        (receivedCurrencyCode as any) || 'USD',
        receivedAmount || (totalSnapshot * (activeReceivedCurrency.rate || 1))
      );
      recordActivity();

      playSaleComplete();

      const totalPieces = cartSnapshot.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
      const isSingle = cartSnapshot.length === 1 && totalPieces === 1;
      const singleName = isSingle ? cartSnapshot[0].name : undefined;
      const formattedTotal = `${effectiveCurrencySymbol}${formatNumber(receivedAmount || (totalSnapshot * activeRate), 2)}`;

      // ✅ إشعار نهائي موحد وحيد لعملية البيع يوضح رقم الفاتورة والإجمالي بدقة
      const cashSaleSnapshot = {
        cart: [...cartSnapshot],
        customerName: customerNameSnapshot || 'عميل نقدي',
        totalInCurrency: receivedAmount || (totalSnapshot * activeRate),
        subtotal,
        discount,
        discountAmount: effectiveDiscountAmount,
        discountType,
        selectedCurrency: {
          ...selectedCurrency,
          symbol: effectiveCurrencySymbol,
        },
        taxAmount,
        effectiveTaxRate,
        paymentType: 'cash' as const,
        downPayment: 0,
        debtRemaining: 0,
        invoiceNumber,
      };

      showToast.success('فاتورة مكتملة', {
        operation: 'فاتورة مكتملة',
        invoiceNumber,
        itemName: singleName,
        isMultiple: !isSingle,
        itemCount: totalPieces,
        price: formattedTotal,
        currency: effectiveCurrencySymbol,
        primaryAction: {
          label: t('pos.print') || 'طباعة',
          onClick: () => handlePrint(cashSaleSnapshot),
        },
        secondaryAction: {
          label: t('pos.share') || 'مشاركة',
          onClick: () => handleWhatsApp(cashSaleSnapshot),
        },
        duration: 4000,
      });

      startSync('جاري رفع الفاتورة للسحابة...', false);

      // ✅ تشغيل المزامنة الفورية بالخلفية بهدوء لتحديث المؤشر دون إشعارات مكررة
      (async () => {
        try {
          const syncPromise = syncImmediately();
          const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
            setTimeout(() => resolve({ timeout: true }), 3500)
          );

          const outcome = await Promise.race([syncPromise, timeoutPromise]);

          if ('timeout' in outcome) {
            completeSync('محفوظة محلياً ✓ جاري المزامنة بالخلفية...', 2500);
          } else if (outcome.success) {
            completeSync('تمت المزامنة بنجاح ✓', 2000);
          } else if (outcome.failed > 0) {
            failSync('الفاتورة محفوظة محلياً - ستُعاد المحاولة');
          } else {
            completeSync('تم حفظ الفاتورة ✓', 2000);
          }
        } catch {
          completeSync('محفوظة محلياً ✓', 2000);
        }
      })();

    } catch (error) {
      console.error('Cash sale error:', error);
      failSync('حدث خطأ - الفاتورة محفوظة محلياً');
      showToast.warning('تم حفظ الفاتورة أوفلاين - سيتم رفعها تلقائياً');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const confirmDebtSale = async (isSplitSale: boolean = false) => {
    // ✅ حماية مزدوجة: state + ref لمنع التكرارات
    if (isSaving || savingRef.current) return;

    // 🎫 بوابة تذكرة الأوفلاين: منع البيع عند انتهاء التذكرة أو العبث بالساعة أو بلوغ حد الفواتير
    const leaseGate = canSellOffline();
    if (!leaseGate.allowed) {
      showToast.error(leaseGate.message, { persistent: false });
      return;
    }

    if (!isRealCustomerSelected(customerName)) {
      showToast.error('لا يمكن اعتماد الفاتورة كدين أو بيع مركب بدون تحديد عميل مسجل.');
      return;
    }

    const customerNameSnapshot = customerName;
    const selectedCustomer = allCustomers.find(c =>
      c.name.toLowerCase().trim() === (customerNameSnapshot || '').toLowerCase().trim()
    );
    const resolvedCustomerId = selectedCustomerId || selectedCustomer?.id;

    if (!resolvedCustomerId) {
      showToast.error('العميل المحدد غير مسجل في النظام. يرجى اختيار عميل من القائمة أو إضافة عميل جديد لحفظ الفاتورة مع معرف العميل.');
      return;
    }

    // 🛡️ فحص استباقي حاسم قبل تفريغ السلة وتوليد الفاتورة
    const validation = await validateCartProducts(cart);
    if (!validation.isValid) {
      showToast.error(
        `تعذر حفظ الفاتورة: الصنف "${validation.invalidItems.join('، ')}" تالف أو تم حذفه من السحابة. يرجى إزالته من السلة.`,
        { persistent: false }
      );
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    // Snapshot cart data before any changes
    const cartSnapshot = [...cart];
    const totalSnapshot = roundCurrency(total);
    // 💵 الدفعة الأولى المقبوضة عند البيع المؤجل أو المركب (محوّلة للدولار) — تُخصم من الدين وتدخل الصندوق
    const downPaymentSnapshot = roundCurrency(Math.max(0, Math.min(receivedUSD, totalSnapshot)));
    const debtRemainingSnapshot = roundCurrency(totalSnapshot - downPaymentSnapshot);
    const customerPhoneSnapshot = customerPhone;

    const operationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `debt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const effectiveCurrencySymbol = resolveInvoiceCurrencySymbol(
      selectedCurrency.code,
      selectedCurrency.symbol
    );

    // 🚀 توليد رقم الفاتورة وإغلاق نافذة الدفع والسلة فوراً وتفريغ المحتويات
    const invoiceNumber = getNextInvoiceNumber();
    (window as any).__posSuppressExitUntil = Date.now() + 4000;
    setShowDebtDialog(false);
    onClose?.();
    saveSaleSnapshot(
      cartSnapshot,
      customerNameSnapshot,
      downPaymentSnapshot > 0 ? 'split' : 'debt',
      downPaymentSnapshot,
      debtRemainingSnapshot,
      invoiceNumber,
      effectiveCurrencySymbol
    );
    onClearCart();
    startSync(
      downPaymentSnapshot > 0 
        ? 'جاري حفظ البيع المركب...' 
        : 'جاري إنشاء فاتورة البيع المؤجل...', 
      false
    );

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
            const baseCost = (item.costPrice && item.costPrice > 0) ? item.costPrice : getFallbackCostPrice(item.id);
            itemCostPrice = baseCost * (item.conversionFactor || 1);
          }
        } else {
          itemCostPrice = (item.costPrice && item.costPrice > 0) ? item.costPrice : getFallbackCostPrice(item.id);
        }

        const itemNetPrice = taxMode === 'gross' && effectiveTaxRate > 0 ? item.price / (1 + effectiveTaxRate / 100) : item.price;
        const itemProfit = round8((itemNetPrice - itemCostPrice) * item.quantity);
        const itemCOGS = round8(itemCostPrice * item.quantity);

        const cat = item.category || 'عام';
        profitsByCategory[cat] = round8((profitsByCategory[cat] || 0) + itemProfit);
        totalProfit = round8(totalProfit + itemProfit);
        totalCOGS = round8(totalCOGS + itemCOGS);

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          costPrice: itemCostPrice,
          conversionFactor: item.conversionFactor,
          category: cat,
          total: round8(item.price * item.quantity),
          profit: round8(itemProfit - (item.price * item.quantity) * (subtotal > 0 ? discountAmount / subtotal : 0)),
        };
      });

      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const discountedProfit = round8(totalProfit - discountAmount);

      const stockItemsLocal = cartSnapshot.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity,
      }));

      const debtSnap = createCurrencySnapshot(selectedCurrency.code, selectedCurrency.rate || activeRate || 1);
      const exactDebtTotalInCurr = roundForCurr(fromUsd(totalSnapshot, debtSnap.currency_code, debtSnap.exchange_rate), debtSnap.currency_code);

      // ✅ إضافة فاتورة الدين للطابور فوراً (محلياً - 0ms)
      const bundle = {
        invoiceNumber,
        customerId: resolvedCustomerId,
        customerName: customerNameSnapshot,
        customerPhone: customerPhoneSnapshot || '',
        items: localItems,
        subtotal,
        discount: discountAmount,
        discountAmount,
        discountPercentage: discountType === 'percent' ? discount : 0,
        taxRate: effectiveTaxRate,
        taxAmount,
        total: totalSnapshot,
        totalInCurrency: exactDebtTotalInCurr,
        currency: debtSnap.currency_code,
        currencySymbol: debtSnap.currency_symbol,
        currencyName: selectedCurrency.name,
        exchangeRate: debtSnap.exchange_rate,
        currencyCode: debtSnap.currency_code,
        profit: discountedProfit,
        cogs: totalCOGS,
        profitsByCategory: Object.fromEntries(
          Object.entries(profitsByCategory).map(([k, v]) => [k, round8(localItems.filter(i => i.category === k).reduce((s, i) => s + i.profit, 0))])
        ),
        stockItems: stockItemsLocal,
        warehouseId: stockWarehouseId,
        downPayment: downPaymentSnapshot,
      };




      // Validate local stock availability before queuing (unless no-inventory mode)
      if (!noInventory) {
        const deductResult = await deductProductsLocalCache(stockItemsLocal, operationId, stockWarehouseId);
        if (!deductResult.success) {
          const msgs = deductResult.insufficientItems.map(i => `${i.productName} (المطلوب: ${i.requested}, المتاح: ${i.available})`);
          showToast.error('فشل في خصم المخزون محلياً: ' + msgs.join('، '));
          savingRef.current = false;
          setIsSaving(false);
          return;
        }
      }

      // 1. ✅ تسجيل الفاتورة محلياً فوراً وبث التحديث للشاشة (0ms)
      const offlineDebtInvoice: Invoice = {
        id: invoiceNumber,
        type: 'sale',
        customerId: resolvedCustomerId,
        customerName: customerNameSnapshot || (downPaymentSnapshot > 0 ? 'عميل بيع مركب' : 'عميل دين'),
        customerPhone: customerPhoneSnapshot || undefined,
        items: localItems.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          total: i.total,
          costPrice: i.costPrice,
          profit: i.profit,
          category: i.category,
        })),
        subtotal,
        subtotalInCurrency: exactDebtTotalInCurr,
        discount: discountAmount,
        discountPercentage: discountType === 'percent' ? discount : 0,
        taxRate: effectiveTaxRate,
        taxAmount,
        total: totalSnapshot,
        totalInCurrency: exactDebtTotalInCurr,
        currency: debtSnap.currency_code,
        currencySymbol: debtSnap.currency_symbol,
        currencyName: selectedCurrency.name,
        exchangeRate: debtSnap.exchange_rate,
        currencyCode: debtSnap.currency_code,
        profit: discountedProfit,
        partsCost: totalCOGS,
        paymentType: 'debt',
        status: downPaymentSnapshot >= totalSnapshot ? 'paid' : 'pending',
        pending_sync: true,
        debtPaid: downPaymentSnapshot,
        debtRemaining: totalSnapshot - downPaymentSnapshot,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cashierId: user?.id,
        cashierName: profile?.full_name || user?.email || undefined,
        warehouseId: stockWarehouseId,
      };
      recordOfflineInvoiceLocal(offlineDebtInvoice);

      // ✅ تحديث إحصائيات العميل النشطة فوراً
      if (resolvedCustomerId) {
        import('@/lib/cloud/customers-cloud').then(({ updateCustomerStatsCloud }) => {
          updateCustomerStatsCloud(resolvedCustomerId).catch(() => {});
        });
      }

      // ✅ تسجيل الدفعة النقدية المقبوضة في الصندوق والوردية النشطة فوراً
      if (downPaymentSnapshot > 0) {
        const cashRatio = totalSnapshot > 0 ? downPaymentSnapshot / totalSnapshot : 1;
        const downPaymentProfit = round8(discountedProfit * cashRatio);
        const downPaymentCOGS = round8(totalCOGS * cashRatio);
        addSalesToShift(
          downPaymentSnapshot,
          downPaymentProfit,
          downPaymentCOGS,
          (receivedCurrencyCode as any) || 'USD',
          downPaymentSnapshot * (activeReceivedCurrency.rate || 1)
        );
      }

      // ✅ تسجيل الربح محلياً فوراً برقم الفاتورة ومعرف العملية (يمنع المضاعفة عند المزامنة)
      addGrossProfit(invoiceNumber, discountedProfit, totalCOGS, totalSnapshot, operationId);

      // 2. ✅ إضافة حزمة البيع الآجل لطابور المزامنة sync-queue
      addUniqueOperation('debt_sale_bundle', { localId: operationId, bundle }, operationId);

      // 🎫 احتساب الفاتورة ضمن حصة الأوفلاين (لا تُصفَّر إلا بمزامنة ناجحة)
      if (!navigator.onLine) incrementOfflineInvoiceCounter();

      // ✅ تسجيل النشاط
      if (user) {
        const itemsDescription = cartSnapshot.map(item => `${item.name} × ${item.quantity}`).join('، ');
        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          downPaymentSnapshot > 0
            ? `عملية بيع مركب بقيمة ${formatMoney(totalSnapshot)} للعميل ${customerNameSnapshot} (نقدي: ${formatMoney(downPaymentSnapshot)} + دين: ${formatMoney(debtRemainingSnapshot)}) - المنتجات: ${itemsDescription}`
            : `عملية بيع مؤجل بقيمة ${formatMoney(totalSnapshot)} للعميل ${customerNameSnapshot} - المنتجات: ${itemsDescription}`,
          { 
            total: totalSnapshot, 
            itemsCount: cartSnapshot.length, 
            customerName: customerNameSnapshot, 
            paymentType: downPaymentSnapshot > 0 ? 'split' : 'debt',
            downPayment: downPaymentSnapshot,
            debtRemaining: debtRemainingSnapshot
          }
        );
        addActivityLog(
          'debt_created',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          downPaymentSnapshot > 0
            ? `تم إنشاء دين للعميل ${customerNameSnapshot} بقيمة ${formatMoney(debtRemainingSnapshot)} بعد دفعة أولى ${formatMoney(downPaymentSnapshot)}`
            : `تم إنشاء دين جديد للعميل ${customerNameSnapshot} بقيمة ${formatMoney(totalSnapshot)}`,
          { amount: debtRemainingSnapshot, downPayment: downPaymentSnapshot, customerName: customerNameSnapshot }
        );

      }

      if (downPaymentSnapshot > 0) {
        playSaleComplete();
      } else {
        playDebtRecorded();
      }

      const totalPieces = cartSnapshot.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
      const isSingle = cartSnapshot.length === 1 && totalPieces === 1;
      const singleName = isSingle ? cartSnapshot[0].name : undefined;
      const totalDebtSale = downPaymentSnapshot + debtRemainingSnapshot;
      const debtDecimals = (selectedCurrency?.rate && selectedCurrency.rate >= 100) ? 0 : 2;
      const formattedDebtPrice = `${selectedCurrency.symbol}${formatNumber(totalDebtSale * (selectedCurrency.rate || 1), debtDecimals)}`;

      const debtSaleSnapshot = {
        cart: [...cartSnapshot],
        customerName: customerNameSnapshot,
        totalInCurrency: roundForCurr(fromUsd(totalDebtSale, selectedCurrency.code, selectedCurrency.rate), selectedCurrency.code),
        subtotal,
        discount,
        discountAmount,
        discountType,
        selectedCurrency,
        taxAmount,
        effectiveTaxRate,
        paymentType: (downPaymentSnapshot > 0 ? 'split' : 'debt') as 'split' | 'debt',
        downPayment: downPaymentSnapshot,
        debtRemaining: debtRemainingSnapshot,
        invoiceNumber,
      };

      // ✅ إشعار نهائي موحد وحيد لعملية البيع المؤجل أو المركب باستخدام بطاقة SmartToast الكبيرة
      const itemsLabel = t('pos.items') || 'الأصناف';
      const itemsDetail = isSingle
        ? singleName
        : (totalPieces > 1 ? `${singleName || (t('pos.multipleItems') || 'أصناف متعددة')} (${totalPieces})` : singleName);

      showSmartToast({
        type: 'debt_sale',
        title: t('deferredInvoiceCompleted'),
        subtitle: `#${invoiceNumber}`,
        statusBadge: t('nowApprovedDeferred'),
        primaryLabel: t('pos.customer') || 'العميل',
        primaryValue: customerNameSnapshot,
        secondaryLabel: itemsLabel,
        secondaryValue: itemsDetail,
        description: downPaymentSnapshot > 0
          ? `نقدي: ${selectedCurrency.symbol}${formatNumber(downPaymentSnapshot * (selectedCurrency.rate || 1), debtDecimals)} + دين: ${selectedCurrency.symbol}${formatNumber(debtRemainingSnapshot * (selectedCurrency.rate || 1), debtDecimals)}`
          : undefined,
        pillText: formattedDebtPrice,
        primaryAction: {
          label: t('pos.print') || 'طباعة',
          onClick: () => handlePrint(debtSaleSnapshot),
        },
        secondaryAction: {
          label: t('pos.share') || 'مشاركة',
          onClick: () => handleWhatsApp(debtSaleSnapshot),
        },
        duration: 4000,
      });

      // ✅ تشغيل المزامنة الفورية بالخلفية بهدوء لتحديث المؤشر دون إشعارات مكررة
      (async () => {
        try {
          const syncPromise = syncImmediately();
          const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
            setTimeout(() => resolve({ timeout: true }), 3500)
          );

          const outcome = await Promise.race([syncPromise, timeoutPromise]);

          if ('timeout' in outcome) {
            completeSync(t('pos.savedLocallySyncing') || 'محفوظة محلياً ✓ جاري المزامنة بالخلفية...', 2500);
          } else if (outcome.success) {
            completeSync(t('pos.syncedSuccess') || 'تمت المزامنة بنجاح ✓', 2000);
          } else if (outcome.failed > 0) {
            failSync(t('pos.savedLocallyRetry') || 'الفاتورة محفوظة محلياً - ستُعاد المحاولة');
          } else {
            completeSync(t('pos.invoiceSavedLocally') || 'تم حفظ الفاتورة ✓', 2000);
          }
        } catch {
          completeSync(t('pos.invoiceSavedLocally') || 'محفوظة محلياً ✓', 2000);
        }
      })();

    } catch (error) {
      console.error('Debt sale error:', error);
      failSync(t('pos.savedLocallyRetry') || 'حدث خطأ - الفاتورة محفوظة محلياً');
      if (isNotificationEventAllowed('sync_offline_queued_warning')) {
        showToast.warning(t('pos.offlineSaleWarning') || 'تم حفظ فاتورة البيع المؤجل أوفلاين - سيتم رفعها تلقائياً');
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Normalize Arabic letters and characters for flawless instant search
  const normalizeArabicSearch = (text: string): string => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ى]/g, 'ي')
      .replace(/[\u064B-\u065F\u0670ـ]/g, '') // remove Arabic tashkeel & tatweel
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '') // remove zero-width / bidi marks
      .trim();
  };

  // Smart instant customer search handler - uses fast memory & local cache with zero latency
  const handleCustomerSearch = (value: string) => {
    onCustomerNameChange(value);
    setSelectedCustomerId(null);
    const cleanSearch = normalizeArabicSearch(value);

    if (cleanSearch.length >= 1) {
      const sourceList = allCustomers.length > 0 ? allCustomers : loadCustomers();
      const matches = sourceList.filter(c => {
        const cleanName = normalizeArabicSearch(c.name);
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        const searchDigits = value.replace(/\D/g, '');
        return cleanName.includes(cleanSearch) || (searchDigits.length >= 2 && cleanPhone.includes(searchDigits));
      }).slice(0, 8);

      setCustomerSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
      setCustomerSuggestions([]);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    onCustomerNameChange(customer.name);
    setCustomerPhone(customer.phone || '');
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  const handleAddCustomer = async () => {
    // ✅ منع التكرار عند الضغط المتعدد
    if (isAddingCustomer || addCustomerRef.current) return;

    if (!newCustomer.name?.trim() || !newCustomer.phone?.trim()) {
      console.log('Validation Errors - New Customer:', { 
        name: newCustomer.name, 
        phone: newCustomer.phone,
        nameEmpty: !newCustomer.name?.trim(),
        phoneEmpty: !newCustomer.phone?.trim()
      });
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
        showToast.error(t('pos.customerNameExists') || 'هذا الاسم موجود مسبقاً، يرجى اختيار اسم مختلف');
        return;
      }

      // تحديث الحالة حتى لا يطلب الهاتف مرة أخرى
      setSelectedCustomerId(created.id);
      onCustomerNameChange(created.name);
      setCustomerPhone(created.phone || '');
      setIsNewCustomer(false);

      // تحديث قائمة العملاء للبحث التلقائي فوراً
      setAllCustomers(prev => [created, ...prev.filter(c => c.id !== created.id)]);

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

    const printerConfig = getStoredPrinterConfig();
    if (printerConfig.connectionType === 'bluetooth' && isNativeAndroid()) {
      const invoiceData: PrintableInvoice = {
        id: data?.invoiceNumber ? `#${data.invoiceNumber}` : 'POS',
        invoiceNumber: data?.invoiceNumber ? `#${data.invoiceNumber}` : undefined,
        date: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US'),
        time: new Date().toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US'),
        customerName: printCustomerName || (language === 'ar' ? 'زبون عام' : 'General Customer'),
        items: printCart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: roundForCurr(fromUsd(item.price, printCurrency.code, printCurrency.rate), printCurrency.code),
          total: roundForCurr(fromUsd(item.price * item.quantity, printCurrency.code, printCurrency.rate), printCurrency.code),
        })),
        subtotal: roundForCurr(fromUsd((data?.subtotal ?? (subtotal || 0)), printCurrency.code, printCurrency.rate), printCurrency.code),
        discount: printDiscountAmount,
        total: printTotalInCurrency,
        currencySymbol: printCurrency.symbol || '$',
        currencyName: printCurrency.name,
        currency: printCurrency.code,
        paymentType: data?.paymentType === 'split' ? 'split' : data?.paymentType === 'debt' ? 'debt' : 'cash',
      };
      printInvoice(invoiceData);
      if (data) setLastSale(null);
      return;
    }

    // Load store settings
    let storeName = 'FlowPOS Pro';
    let storeAddress = '';
    let storePhone = '';
    let storeLogo = '';
    let footer = t('pos.receiptThanks') || 'شكراً لتعاملكم معنا!';

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

    const currentDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
    const currentTime = new Date().toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US');

    const storeType = getCurrentStoreType();
    const isPharmacy = storeType === 'pharmacy';

    const itemsHtml = printCart.map(item => `
      <tr>
        <td style="padding: 5px; border-bottom: 1px solid #eee;">
          ${item.name}
          ${isPharmacy && item.expiryDate ? `<br/><small style="color: #888;">${t('pos.expiryDateLabel') || 'الصلاحية'}: ${item.expiryDate}</small>` : ''}
          ${isPharmacy && item.batchNumber ? `<br/><small style="color: #888;">${t('pos.batchNumberLabel') || 'الدفعة'}: ${item.batchNumber}</small>` : ''}
        </td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: ${isRTL ? 'left' : 'right'};">${printCurrency.symbol}${formatNumber(item.price * item.quantity * printCurrency.rate)}</td>
      </tr>
    `).join('');

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${language}">
        <head>
          <meta charset="UTF-8">
          <title>${t('pos.invoiceTitle') || 'فاتورة'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; font-size: 12px; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #333; padding-bottom: 12px; }
            .logo { max-width: 60px; max-height: 60px; margin: 0 auto 8px; display: block; }
            .store-name { font-size: 1.3em; font-weight: bold; margin: 5px 0; }
            .store-info { font-size: 0.85em; color: #555; }
            .invoice-info { margin: 12px 0; font-size: 0.9em; }
            .invoice-info > div { padding: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.9em; }
            th { background: #333; color: #fff; padding: 8px 5px; text-align: ${isRTL ? 'right' : 'left'}; font-size: 0.85em; }
            td { padding: 8px 5px; border-bottom: 1px solid #eee; }
            .total { font-size: 1.2em; font-weight: bold; margin-top: 12px; border-top: 2px solid #333; padding-top: 10px; text-align: center; }
            .footer { text-align: center; margin-top: 20px; font-size: 0.8em; color: #666; border-top: 1px dashed #ccc; padding-top: 12px; }
            @media print { @page { size: 80mm auto; margin: 5mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeLogo ? `<img src="${storeLogo}" alt="${t('pos.logo') || 'شعار'}" class="logo" />` : ''}
            <div class="store-name">${storeName}</div>
            ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="store-info">${storePhone}</div>` : ''}
          </div>
          <div class="invoice-info">
            ${data?.invoiceNumber ? `<div><strong>${t('pos.invoiceNumberLabel') || 'رقم الفاتورة'}:</strong> #${data.invoiceNumber}</div>` : ''}
            <div><strong>${t('pos.dateLabel') || 'التاريخ'}:</strong> ${currentDate} - ${currentTime}</div>
            <div><strong>${t('pos.customerLabel') || 'العميل'}:</strong> ${printCustomerName || t('pos.walkInCustomer') || 'عميل نقدي'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>${t('pos.productCol') || 'المنتج'}</th>
                <th>${t('pos.qtyCol') || 'الكمية'}</th>
                <th>${t('pos.amountCol') || 'المبلغ'}</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${printDiscount > 0 ? `<div style="text-align: ${isRTL ? 'left' : 'right'}; color: #c00;">${t('pos.discountCol') || 'خصم'}: -${printCurrency.symbol}${formatNumber(printDiscountAmount)}</div>` : ''}
          <div class="total">
            ${t('pos.totalLabel') || 'الإجمالي'}: ${printCurrency.symbol}${formatNumber(printTotalInCurrency)}
          </div>
          ${data?.paymentType === 'split' && data?.downPayment ? `
            <div style="margin-top: 8px; font-size: 0.9em; text-align: center; border-top: 1px dashed #333; padding-top: 6px;">
              <div>${t('pos.paymentMethodLabel') || 'طريقة الدفع'}: <strong>${t('pos.compositeSale') || 'بيع مركب'}</strong></div>
              <div>${t('pos.cashPaid') || 'المقبوض نقداً'}: <strong>${printCurrency.symbol}${formatNumber(roundForCurr(fromUsd(data.downPayment, printCurrency.code, printCurrency.rate), printCurrency.code))}</strong></div>
              <div style="color: #c00;">${t('pos.remainingAsDebt') || 'المتبقي كدين'}: <strong>${printCurrency.symbol}${formatNumber(roundForCurr(fromUsd(data.debtRemaining || 0, printCurrency.code, printCurrency.rate), printCurrency.code))}</strong></div>
            </div>
          ` : ''}
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;

    printHTML(printContent);
    showToast.success(t('pos.sendingToPrinter') || 'جاري إرسال الفاتورة للطابعة...');
    if (data) setLastSale(null); // مسح بعد الطباعة
  };

  // مشاركة الفاتورة عبر واتساب كصورة بعد اعتماد البيع حصراً
  const handleWhatsApp = async (saleData?: typeof lastSale) => {
    const completedSale = saleData ?? lastSale;
    // حماية صارمة: منع مشاركة السلة كمسودة قبل صدور رقم فاتورة معتمد
    if (!completedSale?.invoiceNumber || !completedSale?.cart || completedSale.cart.length === 0) {
      toast.warning('يرجى إتمام عملية البيع أولاً لمشاركة الفاتورة الرسمية');
      return;
    }

    const data = completedSale;
    const shareCart = data.cart;
    const shareCustName = data.customerName;
    const shareCurrency = data.selectedCurrency;
    const shareTotalInCurrency = data.totalInCurrency;
    const shareSubtotal = data.subtotal;
    const shareDiscountAmount = data.discountAmount;
    const sharePaymentType = data?.paymentType || 'cash';
    const shareDownPayment = data?.downPayment ? roundForCurr(fromUsd(data.downPayment, shareCurrency.code, shareCurrency.rate), shareCurrency.code) : undefined;
    const shareDebtRemaining = data?.debtRemaining ? roundForCurr(fromUsd(data.debtRemaining, shareCurrency.code, shareCurrency.rate), shareCurrency.code) : undefined;

    // تحميل إعدادات المتجر
    const store = getStoreSettings();
    const currentDate = new Date().toLocaleDateString('ar-SA');

    // تحضير بيانات الفاتورة للمشاركة
    const shareData: InvoiceShareData = {
      id: `#${data.invoiceNumber}`,
      storeName: store.name,
      storePhone: store.phone,
      customerName: shareCustName || 'عميل نقدي',
      date: currentDate,
      items: shareCart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: roundForCurr(fromUsd(item.price, shareCurrency.code, shareCurrency.rate), shareCurrency.code),
        total: roundForCurr(fromUsd(item.price * item.quantity, shareCurrency.code, shareCurrency.rate), shareCurrency.code),
      })),
      subtotal: roundForCurr(fromUsd(shareSubtotal, shareCurrency.code, shareCurrency.rate), shareCurrency.code),
      discount: roundForCurr(fromUsd(shareDiscountAmount, shareCurrency.code, shareCurrency.rate), shareCurrency.code),
      total: shareTotalInCurrency,
      currencySymbol: shareCurrency.symbol,
      currencyName: shareCurrency.name,
      currency: shareCurrency.code,
      exchangeRate: shareCurrency.rate,
      totalUSD: round8(data.subtotal - data.discountAmount + data.taxAmount),
      paymentType: sharePaymentType,
      downPayment: shareDownPayment,
      debtRemaining: shareDebtRemaining,
      type: 'sale',
    };

    await shareInvoice(shareData);
    if (data) setLastSale(null); // مسح بعد المشاركة
  };

  return (
    <>
      <div className={cn(
        "bg-card flex flex-col h-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]",
          isMobile ? "rounded-t-3xl" : "rounded-3xl border border-black/5 dark:border-white/10"
      )}>
        {/* Cart Header */}
        <div className="p-3 md:p-3.5 border-b border-black/5 dark:border-white/5 bg-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h2 className="font-bold text-base md:text-lg">{t('pos.shoppingCart')}</h2>
              {cart.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
              {isMaintenanceEnabled && (
                <button
                  type="button"
                  onClick={() => setShowMaintenance(v => !v)}
                  className={cn(
                    "text-xs font-bold px-2.5 py-1 rounded-full transition-all duration-200 inline-flex items-center gap-1 cursor-pointer select-none",
                    showMaintenance
                      ? "bg-primary text-primary-foreground shadow-xs scale-105"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{t('pos.maintenance') || 'صيانة'}</span>
                </button>
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
                type="button"
                onClick={() => {
                  setWholesaleMode(!wholesaleMode);
                  if (!wholesaleMode) setReceivedAmount(0);
                }}
                className={cn(
                  "text-xs font-bold px-2 py-1 rounded-lg transition-colors inline-flex items-center gap-1 shrink-0",
                  wholesaleMode
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-muted text-foreground hover:bg-muted/80"
                )}
              >
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span>{wholesaleMode ? (t('pos.wholesale') || 'جملة') : (t('pos.retail') || 'مفرق')}</span>
              </button>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-xs font-semibold text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg shrink-0 transition-colors"
                >
                  {t('pos.clear')}
                </button>
              )}
              {isMobile && onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full bg-muted/60 hover:bg-destructive/10 shrink-0">
                  <X className="w-4 h-4" />
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

          {/* Held Carts Tabs Bar */}
          {heldCarts && heldCarts.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-2 scrollbar-none">
              {heldCarts.map((hc) => (
                <button
                  key={hc.id}
                  type="button"
                  onClick={() => onSwitchCart?.(hc.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors shrink-0 border",
                    hc.id === activeCartId
                      ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                      : "bg-muted/50 text-muted-foreground border-border/50 hover:text-foreground"
                  )}
                >
                  <span>{hc.name}</span>
                  {hc.cart.length > 0 && (
                    <span className={cn(
                      "w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold",
                      hc.id === activeCartId ? "bg-primary-foreground text-primary" : "bg-primary/20 text-primary"
                    )}>
                      {hc.cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                  {heldCarts.length > 1 && onRemoveCart && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => onRemoveCart(hc.id, e)}
                      className="hover:text-destructive p-0.5 rounded text-muted-foreground"
                      title={t('pos.clearCart') || 'إلغاء السلة'}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))}
              {onAddNewCart && (
                <button
                  type="button"
                  onClick={onAddNewCart}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-dashed border-border/70 transition-colors shrink-0"
                  title={t('pos.newCart') || 'إضافة سلة جديدة'}
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('pos.cart') || 'سلة'} +</span>
                </button>
              )}
            </div>
          )}

          {/* شريط اختيار العملة المفعلة للقبض داخل السلة */}
          {currencies && currencies.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-1.5 scrollbar-none">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-primary" />
                <span>{t('pos.cartCurrency') || 'عملة السلة'}:</span>
              </span>
              {currencies.map((curr) => {
                const isSelected = selectedCurrency.code === curr.code;
                return (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => onCurrencyChange?.(curr)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 border cursor-pointer select-none",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                        : "bg-muted/50 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <span>{curr.symbol}</span>
                    <span className="mr-1 text-[10px] opacity-80">{curr.code}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Customer Name with Autocomplete */}
          <div className="mt-2 flex gap-1.5">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                type="text"
                placeholder={t('pos.customerName')}
                value={customerName}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                onFocus={() => {
                  if (customerName.trim().length >= 1 && customerSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 250);
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="pr-9 bg-slate-100 dark:bg-zinc-800 border-none h-9 md:h-10 rounded-xl text-xs md:text-sm shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              {/* Customer Suggestions Dropdown */}
              {showSuggestions && customerSuggestions.length > 0 && (
                <div 
                  className="absolute top-full right-0 left-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="p-1 space-y-0.5">
                    {customerSuggestions.map((customer) => (
                      <div
                        key={customer.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectCustomer(customer)}
                        className="cursor-pointer px-3 py-2.5 hover:bg-muted active:bg-muted/80 rounded-md flex items-center justify-between transition-colors text-foreground select-none"
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">{customer.name}</span>
                        </div>
                        {customer.phone && (
                          <span className="text-xs text-muted-foreground font-mono">{customer.phone}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 md:h-10 md:w-10 rounded-xl flex-shrink-0 border-none shadow-sm bg-white dark:bg-zinc-800 hover:bg-black/5"
              onClick={() => setShowCustomerDialog(true)}
              title={t('pos.addNewCustomer') || (isRTL ? 'إضافة عميل جديد' : 'Add Customer')}
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showMaintenance ? (
          <div className="flex-1 overflow-y-auto p-2 sm:p-3">
            <MaintenancePanel
              currencies={currencies as any}
              selectedCurrency={selectedCurrency as any}
              onCurrencyChange={onCurrencyChange as any}
              onClose={() => setShowMaintenance(false)}
              isMobile={isMobile}
              fullWidth={true}
            />
          </div>
        ) : (
          <>
          {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1 bg-slate-50/50 dark:bg-zinc-950/50">
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
                className="bg-card rounded-xl px-2.5 py-1.5 border border-border/40 cart-item-enter transition-[border-color,background-color] duration-150 hover:border-primary/40 hover:bg-card/95 flex items-center gap-2 group min-h-11"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                {/* زر حذف واضح ومريح */}
                {/* زر حذف مكبّر ومريح للمس السريع */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id, item.unit)}
                  className="size-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-[transform,colors] active:scale-90"
                  title={t('pos.removeFromCart') || 'حذف من السلة'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* اسم المنتج وشارة الوحدة */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-xs leading-tight truncate text-foreground" title={item.name}>
                      {item.name}
                    </span>
                    {!!item.bulkSalePrice && item.bulkSalePrice > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className={cn(
                          "text-[9px] px-1 py-0.2 rounded font-medium",
                          item.unit === 'bulk'
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {item.unit === 'bulk'
                            ? getLocalizedUnit(item.bulkUnit, true, language)
                            : getLocalizedUnit(item.smallUnit, false, language)}
                        </span>
                        {onToggleUnit && (
                          <button
                            type="button"
                            onClick={() => onToggleUnit(item.id, item.unit)}
                            className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                            title={t('pos.switchUnit') || 'تبديل الوحدة'}
                          >
                            <Repeat className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {(wholesaleMode || (isRepairStoreType() && item.costPrice != null)) && (
                    <div className="text-[9px] text-muted-foreground truncate leading-none mt-0.5">
                      {wholesaleMode && (() => {
                        const safeCartRate = Number.isFinite(selectedCurrency.rate) && selectedCurrency.rate > 0
                          ? selectedCurrency.rate
                          : 1;
                        const linePrice = roundForCurr(fromUsd(getItemPrice(item), selectedCurrency.code, safeCartRate), selectedCurrency.code);
                        return <span className="text-orange-400 font-medium">{formatNumber(linePrice)} {selectedCurrency.symbol} × {item.quantity}</span>;
                      })()}
                      {wholesaleMode && isRepairStoreType() && item.costPrice != null && ' · '}
                      {isRepairStoreType() && item.costPrice != null && `${t('pos.cost') || 'تكلفة'}: ${formatNumber(item.costPrice || 0)}`}
                    </div>
                  )}
                </div>

                {/* أزرار التحكم بالكمية الأنيقة */}
                <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/30 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, -1, item.unit)}
                    className="w-6 h-6 rounded-md bg-card hover:bg-muted text-foreground flex items-center justify-center active:scale-95 transition-[transform,colors] shadow-xs"
                    title={t('pos.decreaseQty') || 'تقليل الكمية'}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-xs text-foreground tabular-nums select-none">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, 1, item.unit)}
                    className="w-6 h-6 rounded-md bg-card hover:bg-muted text-foreground flex items-center justify-center active:scale-95 transition-[transform,colors] shadow-xs"
                    title={t('pos.increaseQty') || 'زيادة الكمية'}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* إجمالي السطر بعملة السلة العامة */}
                <div className="flex items-center shrink-0 text-left">
                  <span className={cn("font-bold text-xs md:text-sm tabular-nums min-w-[3.4rem] text-left", wholesaleMode ? "text-warning" : "text-primary")}>
                    {formatCurrency(roundForCurr(fromUsd(getItemPrice(item) * item.quantity, selectedCurrency.code, selectedCurrency.rate), selectedCurrency.code), selectedCurrency.symbol, undefined, selectedCurrency.code, selectedCurrency.name)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer - Modern & Compact */}
        <div className="border-t border-border/60 bg-card p-2.5 space-y-2">
          {/* Tax Toggle Switch - only show when tax is enabled */}
          {storeTaxEnabled && storeTaxRate > 0 && (
            <div className="flex items-center justify-between px-2 py-1 bg-muted/40 rounded-lg text-xs">
              <span className="text-[10px] text-muted-foreground">
                {t('pos.tax') || 'الضريبة'}: {storeTaxRate}%
                <span className="ms-1">{taxMode === 'gross' ? (t('pos.inclusive') || 'شامل') : (t('pos.exclusive') || 'غير شامل')}</span>
              </span>
              <Switch
                checked={taxMode === 'gross'}
                onCheckedChange={(checked) => setTaxMode(checked ? 'gross' : 'net')}
                className="scale-75"
              />
            </div>
          )}

          {/* Row 2: Discount (only if enabled) - unified pill design */}
          {(settingsDiscountPercentEnabled || settingsDiscountFixedEnabled) && (
            <div className="grid min-w-0 grid-cols-2 gap-1.5">
              {settingsDiscountPercentEnabled && (
                <label
                  className={cn(
                    "group box-border flex h-10 min-w-0 w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 transition-colors cursor-text focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary",
                    discountType === 'percent' && discount > 0
                      ? "bg-primary/5 border-primary/40"
                      : "bg-muted/40 border-border/40 hover:border-border/60"
                  )}
                >
                  <Input
                    type="number"
                    placeholder={t('pos.discount') || 'خصم'}
                    value={discountType === 'percent' ? (discount || '') : ''}
                    onChange={(e) => {
                      setDiscountType('percent');
                      onDiscountChange(Number(e.target.value));
                    }}
                    onFocus={() => setDiscountType('percent')}
                    className={cn(
                      "box-border h-full min-w-0 w-0 flex-1 border-0 bg-transparent p-0 text-xs text-foreground shadow-none outline-none placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                      discountType === 'percent' && discount > 0 && "font-semibold text-primary"
                    )}
                    min="0"
                    max="100"
                  />
                  <span className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold flex-shrink-0 transition-colors",
                    discountType === 'percent' && discount > 0
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground border border-border/60"
                  )}>%</span>
                </label>
              )}
              {settingsDiscountFixedEnabled && (
                <label
                  className={cn(
                    "group box-border flex h-10 min-w-0 w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 transition-colors cursor-text focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary",
                    discountType === 'fixed' && discount > 0
                      ? "bg-primary/5 border-primary/40"
                      : "bg-muted/40 border-border/40 hover:border-border/60"
                  )}
                >
                  <Input
                    type="number"
                    placeholder={t('pos.discount') || 'خصم'}
                    value={discountType === 'fixed' ? (discount || '') : ''}
                    onChange={(e) => {
                      setDiscountType('fixed');
                      onDiscountChange(Number(e.target.value));
                    }}
                    onFocus={() => setDiscountType('fixed')}
                    className={cn(
                      "box-border h-full min-w-0 w-0 flex-1 border-0 bg-transparent p-0 text-xs text-foreground shadow-none outline-none placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                      discountType === 'fixed' && discount > 0 && "font-semibold text-primary"
                    )}
                    min="0"
                  />
                  <span className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold flex-shrink-0 transition-colors",
                    discountType === 'fixed' && discount > 0
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground border border-border/60"
                  )}>{selectedCurrency.symbol}</span>
                </label>
              )}
            </div>
          )}

          {/* Row 3: Received Amount */}
          <div className="space-y-1">
            <div className={cn(
              "box-border flex h-10 min-w-0 w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 transition-colors cursor-text focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary",
              receivedAmount > 0
                ? "bg-primary/5 border-primary/40"
                : "bg-muted/40 border-border/40 hover:border-border/60"
            )}>
              <Banknote className={cn(
                "w-3.5 h-3.5 flex-shrink-0",
                wholesaleMode ? "text-warning" : receivedAmount > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              <Input
                type="number"
                placeholder={t('pos.receivedAmount') || 'المبلغ المقبوض'}
                value={receivedAmount === 0 ? '' : receivedAmount}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : Number(e.target.value);
                  setReceivedAmount(Number.isFinite(value) ? value : 0);
                }}
                className={cn(
                  "box-border h-full min-w-0 w-0 flex-1 border-0 bg-transparent p-0 text-xs text-foreground shadow-none outline-none placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                  wholesaleMode ? "font-semibold text-warning" : receivedAmount > 0 ? "font-semibold text-primary" : ""
                )}
                min="0"
              />
            </div>

            {/* بيان توضيحي لقيمة المقبوض بالدولار إذا أُدخل بعملة ثانوية */}
            {receivedAmount > 0 && activeReceivedCurrency.code !== 'USD' && (
              <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
                <span>{t('pos.usdEquivalent') || 'المعادل بالدولار'}:</span>
                <span className="font-semibold text-foreground">${formatNumber(receivedUSD)} (${t('pos.exchangeRate') || 'سعر الصرف'}: {formatNumber(receivedRate)})</span>
              </div>
            )}
          </div>

          {/* Row 4: Info summary + Total */}
          <div className="space-y-1">
            {/* Info chips */}
            {(subtotal !== total || discount > 0 || (storeTaxEnabled && taxAmount > 0) || receivedAmount > 0) && (
              <div className="flex flex-wrap gap-1 text-[9px]">
                {subtotal !== total && (
                  <span className="bg-muted/70 text-muted-foreground px-1.5 py-0.5 rounded">
                    {wholesaleMode ? (t('pos.wholesale') || 'جملة') : (t('pos.subtotal') || 'المجموع')}: {formatCurrency(subtotal * activeRate, selectedCurrency.symbol, undefined, selectedCurrency.code, selectedCurrency.name)}
                  </span>
                )}
                {discount > 0 && (
                  <span className="bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">
                    {t('pos.discount') || 'خصم'}: -{formatCurrency(discountType === 'fixed' ? discount : discountAmount * activeRate, selectedCurrency.symbol, undefined, selectedCurrency.code, selectedCurrency.name)}
                  </span>
                )}
                {storeTaxEnabled && effectiveTaxRate > 0 && taxAmount > 0 && (
                  <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                    {t('pos.tax') || 'ض.'} {effectiveTaxRate}%: {formatCurrency(taxAmount * activeRate, selectedCurrency.symbol, undefined, selectedCurrency.code, selectedCurrency.name)}
                  </span>
                )}
                {receivedAmount > 0 && !wholesaleMode && receivedUSD >= total - 0.001 && (
                  <div className="flex items-center justify-between gap-1 w-full flex-wrap">
                    <span className="bg-success/10 text-success px-1.5 py-0.5 rounded font-bold">
                      {t('pos.balance') || 'باقي للعميل'}: {formatCurrency(changeInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}
                      {activeReceivedCurrency.code !== 'USD' && ` (${formatMoney(changeUSD, 'USD')})`}
                    </span>
                    {receivedUSD > total + 0.001 && onUpdateItemPrice && (
                      <button
                        type="button"
                        onClick={handleApplySurplusAsProfit}
                        className="text-[9px] font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                        title={t('pos.setExtraProfit') || 'تعديل سعر الصنف واعتماد الزيادة كربح'}
                      >
                        <span>{t('pos.acceptExtraProfit') || 'اعتماد كربح إضافي'} (+{formatMoney(round8(receivedUSD - total), 'USD')})</span>
                      </button>
                    )}
                  </div>
                )}
                {receivedAmount > 0 && !wholesaleMode && receivedUSD < total - 0.01 && (
                  <div className="flex flex-col gap-1 w-full mt-1 animate-in fade-in zoom-in-95 duration-200">
                    <span className="bg-destructive/15 text-destructive px-2 py-1.5 rounded-md text-xs font-bold text-center border border-destructive/30 shadow-sm flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('pos.shortageAlert') || 'المبلغ المقبوض أقل من الإجمالي - هل ترغب بالمتابعة؟'}
                    </span>
                    <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold text-center text-xs">
                      {t('pos.received') || 'مقبوض'}: {formatCurrency(receivedAmount, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)} — {t('pos.remaining') || 'متبقٍ'}: {formatCurrency(remainingInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}
                    </span>
                  </div>
                )}

                {receivedAmount > 0 && wholesaleMode && (
                  <span className={cn("px-1.5 py-0.5 rounded font-bold", wholesaleProfit && wholesaleProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {t('pos.profit') || 'ربح'}: {formatMoney(wholesaleProfit || 0, 'USD')}
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
                  className="w-6 h-6 rounded-md bg-primary/20 text-primary hover:bg-primary/30 flex items-center justify-center transition-colors text-xs font-semibold"
                  title={t('pos.calculator') || 'آلة حاسبة'}
                >
                  ⊞
                </button>
              </div>
              <span className={cn("text-xl font-bold tabular-nums", wholesaleMode ? "text-warning" : "text-primary")}>
                {formatCurrency(totalInCurrency, selectedCurrency.symbol, undefined, selectedCurrency.code, selectedCurrency.name)}
              </span>
            </div>
          </div>

          {/* شريط معالجة عجز المبلغ المقبوض مع خيارات الاعتماد كخصم أو دين */}
          {!wholesaleMode && receivedAmount > 0 && receivedUSD < total - 0.001 && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-col gap-2 shadow-xs">
              <div className="flex items-center justify-between gap-1 font-bold">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{t('pos.receivedShortage')} {formatCurrency(remainingInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)} ({formatMoney(remainingUSD, 'USD')})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleApplyDeficitAsDiscount}
                  className="flex-1 h-7 text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-amber-500/40 rounded-lg"
                  title={t('pos.acceptAsDiscount') || 'اعتماد كخصم'}
                >
                  {t('pos.acceptAsDiscount') || 'اعتماد كخصم'} (-{formatMoney(remainingUSD, 'USD')})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDebtSale}
                  className="flex-1 h-7 text-[11px] font-bold bg-warning/15 hover:bg-warning/25 text-warning border-warning/40 rounded-lg"
                  title={t('pos.recordAsDebt') || 'تسجيل كدين'}
                >
                  {t('pos.recordAsDebt') || 'تسجيل كدين'}
                </Button>
              </div>
            </div>
          )}

          {/* Row 5: Pay Buttons + Action Icons */}
          <div className="flex items-center gap-1.5">
            <Button
              data-tour="cash-btn"
              className="flex-1 h-11 bg-success hover:bg-success/90 text-sm font-bold shadow-md shadow-success/25 transition-[transform,colors,box-shadow] active:scale-95 rounded-xl"
              disabled={cart.length === 0}
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4" />
              {t('pos.cash')}
            </Button>

            <Button
                data-tour="debt-btn"
                variant="outline"
                className="flex-1 h-11 border-2 border-warning/70 text-warning hover:bg-warning/10 text-sm font-bold transition-[transform,colors] active:scale-95 rounded-xl"
                disabled={cart.length === 0}
                onClick={handleDebtSale}
              >
                <CreditCard className="w-4 h-4" />
                {t('pos.debt')}
              </Button>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Cash Sale Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="w-[94vw] max-w-md p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-success" />
              {t('pos.confirmCashSale')}
            </DialogTitle>
            <DialogDescription>
              {t('pos.confirmCashSaleDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('pos.productCount') || 'عدد المنتجات'}:</span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('pos.customer') || 'العميل'}:</span>
                <span className="font-semibold">{customerName || t('pos.cashCustomer')}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t border-border pt-2 mt-2 gap-2">
                <span className="shrink-0">{t('pos.total') || 'الإجمالي'}:</span>
                <span className="text-primary font-mono tabular-nums text-base sm:text-lg shrink-0" dir="ltr">
                  {formatCurrency(totalInCurrency, selectedCurrency.symbol, undefined, selectedCurrency.code, selectedCurrency.name)}
                </span>
              </div>
              {receivedAmount > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('pos.receivedAmount') || 'المبلغ المقبوض'}:</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(receivedAmount, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}
                      {activeReceivedCurrency.code !== 'USD' && ` (${formatMoney(receivedUSD, 'USD')})`}
                    </span>
                  </div>
                  {changeInReceivedCurrency > 0 && (
                    <div className="flex flex-col gap-1.5 bg-success/10 p-2.5 rounded-lg border border-success/20">
                      <div className="flex justify-between text-success font-bold text-sm">
                        <span>{t('pos.balance') || 'الباقي للعميل'}:</span>
                        <span>
                          {formatCurrency(changeInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}
                          {activeReceivedCurrency.code !== 'USD' && ` (${formatMoney(changeUSD, 'USD')})`}
                        </span>
                      </div>
                      {onUpdateItemPrice && receivedUSD > total + 0.001 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleApplySurplusAsProfit();
                            setShowCashDialog(false);
                          }}
                          className="h-7 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 self-end mt-1 rounded-lg"
                        >
                          {t('pos.acceptExtraProfit') || 'اعتماد الزيادة كربح إضافي'} ({t('pos.withoutChange') || 'بدون باقٍ'})
                        </Button>
                      )}
                    </div>
                  )}
                  {remainingInReceivedCurrency > 0 && receivedUSD < total - 0.001 && (
                    <div className="flex flex-col gap-1.5 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30 text-amber-800 dark:text-amber-300">
                      <div className="flex justify-between font-bold text-sm">
                        <span>{t('pos.shortageInReceived')}</span>
                        <span>{formatCurrency(remainingInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          handleApplyDeficitAsDiscount();
                        }}
                        className="h-7 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 self-end mt-1 rounded-lg"
                      >
                        {t('pos.applyShortageAsDiscount')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-foreground" onClick={() => setShowCashDialog(false)} disabled={isSaving}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1 bg-success hover:bg-success/90" onClick={confirmCashSale} disabled={isSaving} aria-busy={isSaving}>
                <Check className={cn('w-4 h-4', isSaving && 'animate-spin')} />
                {isSaving ? (t('common.saving') || 'جاري الحفظ...') : (t('common.confirm') || 'تأكيد')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deficit Resolution Dialog (Safe for mobile & Android WebView) */}
      <Dialog open={showDeficitDialog} onOpenChange={setShowDeficitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {t('pos.shortageAlertTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pos.shortageAlertDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-sm text-foreground">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pos.invoiceTotalLabel')}</span>
                <span className="font-bold">{formatCurrency(totalInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pos.receivedAmount')}:</span>
                <span className="font-bold text-success">{formatCurrency(receivedAmount, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-500/20 pt-2 text-amber-700 dark:text-amber-300 font-bold text-base">
                <span>{t('pos.shortageAmountLabel')}</span>
                <span>{formatCurrency(remainingInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => {
                  handleApplyDeficitAsDiscount();
                  setShowDeficitDialog(false);
                  setShowCashDialog(true);
                }}
              >
                {t('pos.applyShortageAsDiscountBtn')}
              </Button>

              {isRealCustomerSelected(customerName) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-warning text-warning hover:bg-warning/10 font-bold"
                  onClick={() => {
                    setShowDeficitDialog(false);
                    handleDebtSale();
                  }}
                >
                  {t('pos.recordShortageAsDebtBtn')} ({customerName})
                </Button>
              ) : (
                <div className="text-xs text-center text-muted-foreground">
                  {t('pos.mustSelectCustomerForDebt')}
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground mt-1"
                onClick={() => setShowDeficitDialog(false)}
              >
                {t('pos.cancelAndModify')}
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
              {t('pos.confirmDebtSaleTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pos.confirmDebtSaleDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('pos.customer') || 'العميل'}:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {isNewCustomer && (
                <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <label htmlFor="cart-new-customer-phone" className="text-sm font-medium mb-1.5 block text-warning">
                    {t('pos.requiredForNewCustomer')}
                  </label>
                  <Input
                    id="cart-new-customer-phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="+963 xxx xxx xxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    className="bg-background border-warning text-left"
                  />
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>{t('pos.productCount') || 'عدد المنتجات'}:</span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              {receivedAmount > 0 && (
                <div className="flex justify-between text-sm text-success font-semibold bg-success/10 p-2 rounded-lg">
                  <span>{t('pos.downPaymentCash')}</span>
                  <span>
                    {formatCurrency(receivedAmount, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}
                    {activeReceivedCurrency.code !== 'USD' && ` (${formatMoney(receivedUSD, 'USD')})`}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2 text-warning">
                <span>{t('pos.debtAmount') || 'مبلغ الدين'}:</span>
                <span>
                  {formatCurrency(remainingInReceivedCurrency, activeReceivedCurrency.symbol, undefined, activeReceivedCurrency.code, activeReceivedCurrency.name)}
                  {activeReceivedCurrency.code !== 'USD' && ` (${formatMoney(remainingUSD, 'USD')})`}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-foreground" onClick={() => setShowDebtDialog(false)} disabled={isSaving}>
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"
                disabled={isSaving}
                aria-busy={isSaving}
                onClick={() => {
                  if (isNewCustomer && !customerPhone.trim()) {
                    showToast.error(t('pos.phoneRequired') || 'يرجى إدخال رقم الهاتف للعميل الجديد');
                    return;
                  }
                  confirmDebtSale(false);
                }}
              >
                <Check className={cn('w-4 h-4', isSaving && 'animate-spin')} />
                {isSaving ? (t('common.saving') || 'جاري الحفظ...') : (t('pos.confirmDebt') || 'تأكيد البيع المؤجل')}
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
              {t('pos.addNewCustomer')}
            </DialogTitle>
            <DialogDescription>
              {t('pos.enterNewCustomerData')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="cart-customer-name" className="text-sm font-medium mb-1.5 block">{t('pos.name') || 'الاسم'} *</label>
                <Input
                  id="cart-customer-name"
                  placeholder={t('pos.namePlaceholder') || 'اسم العميل'}
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="cart-customer-phone" className="text-sm font-medium mb-1.5 block">{t('pos.phone') || 'رقم الهاتف'} *</label>
                <Input
                  id="cart-customer-phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="+963 xxx xxx xxx"
                  value={newCustomer.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d+]/g, '');
                    setNewCustomer(prev => ({ ...prev, phone: val }));
                  }}
                  className="text-left"
                />
              </div>
              <div>
                <label htmlFor="cart-customer-email" className="text-sm font-medium mb-1.5 block">{t('pos.email') || 'البريد الإلكتروني'}</label>
                <Input
                  id="cart-customer-email"
                  placeholder="email@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-foreground" onClick={() => setShowCustomerDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddCustomer} disabled={isAddingCustomer}>
                <UserPlus className="w-4 h-4" />
                {isAddingCustomer ? (t('common.saving') || 'جاري الحفظ...') : (t('pos.addCustomerBtn') || 'إضافة العميل')}
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
