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
  Repeat,
  Calculator as CalculatorIcon,
} from 'lucide-react';
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
import { addInvoice } from '@/lib/invoices-store';
import { loadCustomers, Customer } from '@/lib/customers-store';
import { loadProductsCloud } from '@/lib/cloud/products-cloud';
import { distributeDetailedProfitCloud } from '@/lib/cloud/partners-cloud';
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
  findOrCreateCustomerCloud,
  updateCustomerStatsCloud
} from '@/lib/cloud/customers-cloud';
import { addInvoiceCloud } from '@/lib/cloud/invoices-cloud';
import { deductStockBatchCloud, checkStockAvailabilityCloud } from '@/lib/cloud/products-cloud';
import { deductWarehouseStockBatchCloud, checkWarehouseStockAvailability } from '@/lib/cloud/warehouses-cloud';
import { addDebtFromInvoiceCloud } from '@/lib/cloud/debts-cloud';
import { useWarehouse } from '@/hooks/use-warehouse';
import { BackgroundSyncIndicator, useSyncState } from './BackgroundSyncIndicator';
import { addToQueue } from '@/lib/sync-queue';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { Calculator } from '@/components/ui/Calculator';

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
  onUpdatePrice: (id: string, newPrice: number, unit?: 'piece' | 'bulk') => void;
  onRemoveItem: (id: string, unit?: 'piece' | 'bulk') => void;
  onClearCart: () => void;
  onCurrencyChange: (currency: Currency) => void;
  onDiscountChange: (discount: number) => void;
  onCustomerNameChange: (name: string) => void;
  onToggleUnit?: (id: string, currentUnit: 'piece' | 'bulk') => void;
  onToggleWholesale?: (enable: boolean) => void;
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
  onUpdatePrice,
  onRemoveItem,
  onClearCart,
  onCurrencyChange,
  onDiscountChange,
  onCustomerNameChange,
  onToggleUnit,
  onToggleWholesale,
  onClose,
  isMobile = false,
}: CartPanelProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  const { syncState, syncMessage, startSync, completeSync, failSync } = useSyncState();
  const { isOnline } = useNetworkStatus();
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


  // Load customers on mount
  useEffect(() => {
    loadCustomersCloud().then(setAllCustomers);
  }, []);

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
  const discountAmount = discountType === 'percent'
    ? (subtotal * discount) / 100
    : Math.min(discount, subtotal); // Fixed amount should not exceed subtotal

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // ✅ Tax Calculation (Placeholder for future settings)
  const taxRate = 0;
  const taxAmount = (taxableAmount * taxRate) / 100;

  const total = taxableAmount + taxAmount;
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

  // ✅ الإجمالي المعروض = المبلغ المقبوض في الجملة (when entered)
  const displayTotal = wholesaleMode && receivedAmount > 0
    ? receivedAmount
    : total;
  const displayTotalInCurrency = displayTotal * selectedCurrency.rate;

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
      // إذا كان الاتصال غير متاح، حفظ محلياً للمزامنة لاحقاً
      if (!isOnline) {
        addToQueue('invoice_create', {
          invoice: {
            customer_name: customerNameSnapshot || 'عميل نقدي',
            total: totalSnapshot,
            items: cartSnapshot,
          },
          timestamp: Date.now(),
        });
        completeSync('تم حفظ الفاتورة محلياً، سيتم الرفع عند عودة الاتصال', 1000);
        setIsSaving(false);
        return;
      }

      // حساب الكميات الفعلية بالقطع (مع مراعاة معامل التحويل للوحدات الكبرى)
      const stockItemsWithConversion = cartSnapshot.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity
      }));

      // التحقق من توفر الكميات
      // ✅ للمستودع الرئيسي (أو عدم وجود مستودع): استخدم products.quantity
      // ✅ للمستودعات الفرعية (vehicle): استخدم warehouse_stock
      let stockCheck;
      if (activeWarehouse && activeWarehouse.type === 'vehicle' && activeWarehouse.assigned_cashier_id) {
        // مستودع موزع - استخدم warehouse_stock
        stockCheck = await checkWarehouseStockAvailability(activeWarehouse.id, stockItemsWithConversion);
      } else {
        // المستودع الرئيسي أو لا يوجد مستودع - استخدم products.quantity
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
      const customer = customerNameSnapshot ? await findOrCreateCustomerCloud(customerNameSnapshot) : null;

      // Calculate profit by category for accurate partner distribution
      const products = await loadProductsCloud();
      const profitsByCategory: Record<string, number> = {};
      let totalProfit = 0;
      let totalCOGS = 0;

      const soldItems: Array<{ name: string; quantity: number; price: number }> = [];

      cartSnapshot.forEach((item) => {
        const product = products.find(p => p.id === item.id);
        if (product) {
          let costPrice: number;

          if (item.unit === 'bulk') {
            if (item.bulkCostPrice && item.bulkCostPrice > 0) {
              costPrice = item.bulkCostPrice;
            } else {
              costPrice = (item.costPrice || product.costPrice) * (item.conversionFactor || 1);
            }
          } else {
            costPrice = item.costPrice || product.costPrice;
          }

          const itemPrice = wholesaleMode ? getItemPrice(item) : item.price;
          const itemProfit = roundCurrency((itemPrice - costPrice) * item.quantity);
          const itemCOGS = costPrice * item.quantity;
          const category = product.category || 'عام';
          profitsByCategory[category] = (profitsByCategory[category] || 0) + itemProfit;
          totalProfit += roundCurrency(itemProfit);
          totalCOGS += itemCOGS;
        }
        soldItems.push({ name: item.name, quantity: item.quantity, price: wholesaleMode ? getItemPrice(item) : item.price });
      });

      // ✅ الربح = المبلغ المستلم - رأس المال (في الجملة)
      const actualSaleAmount = wholesaleMode && receivedAmount > 0 ? receivedAmount : subtotal;
      const finalProfit = wholesaleMode
        ? roundCurrency(actualSaleAmount - totalCOGS)  // ✅ receivedAmount - COGS
        : totalProfit;

      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const discountedProfit = finalProfit * (1 - discountRatio);
      const discountMultiplier = 1 - discountRatio;

      const itemsWithCost = cartSnapshot.map(item => {
        const product = products.find(p => p.id === item.id);
        let itemCostPrice: number;

        if (item.unit === 'bulk') {
          if (item.bulkCostPrice && item.bulkCostPrice > 0) {
            itemCostPrice = item.bulkCostPrice;
          } else {
            itemCostPrice = (item.costPrice || product?.costPrice || 0) * (item.conversionFactor || 1);
          }
        } else {
          itemCostPrice = item.costPrice || product?.costPrice || 0;
        }

        const itemPrice = wholesaleMode ? getItemPrice(item) : item.price;
        const itemProfit = roundCurrency((itemPrice - itemCostPrice) * item.quantity);  // ✅ Rounded!

        return {
          id: item.id,
          name: item.name,
          price: itemPrice,
          quantity: item.quantity,
          total: roundCurrency(itemPrice * item.quantity),
          costPrice: itemCostPrice,
          profit: roundCurrency(itemProfit * (1 - discountRatio)),  // ✅ Always apply discount
        };
      });

      // In wholesale mode, if receivedAmount is entered, that IS the total
      const effectiveTotal = wholesaleMode && receivedAmount > 0 ? receivedAmount : totalSnapshot;
      const effectiveTotalInCurrency = effectiveTotal * selectedCurrency.rate;

      // Create invoice in cloud
      const invoice = await addInvoiceCloud({
        type: 'sale',
        customerName: customerNameSnapshot || 'عميل نقدي',
        items: itemsWithCost,
        subtotal,
        discount,
        discountPercentage: discountType === 'percent' ? discount : 0,
        taxRate,
        taxAmount,
        total: effectiveTotal,  // ✅ Use effective total
        totalInCurrency: effectiveTotalInCurrency, // ✅ Use effective total currency
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

      // ✅ باقي العمليات تتم في الخلفية (parallel)
      const backgroundTasks = [];

      // تسجيل الربح
      addGrossProfit(invoice.id, discountedProfit, totalCOGS, effectiveTotal);

      // Distribute profit to partners
      const categoryProfits = Object.entries(profitsByCategory)
        .filter(([_, profit]) => profit * discountMultiplier > 0)
        .map(([category, profit]) => ({ category, profit: profit * discountMultiplier }));

      if (categoryProfits.length > 0) {
        // Run in the same background batch so it doesn't fail silently
        backgroundTasks.push(
          distributeDetailedProfitCloud(
            categoryProfits,
            invoice.id,
            customerNameSnapshot || 'عميل نقدي',
            false
          ).catch((err) => {
            console.error('[CartPanel] Partner profit distribution failed (cash sale):', err);
          })
        );
      }

      // Deduct stock (parallel)
      const stockItemsToDeduct = cartSnapshot.map(item => ({
        productId: item.id,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity
      }));

      // ✅ خصم المخزون: استخدم products للمستودع الرئيسي، warehouse_stock للموزعين
      if (activeWarehouse && activeWarehouse.type === 'vehicle' && activeWarehouse.assigned_cashier_id) {
        backgroundTasks.push(deductWarehouseStockBatchCloud(activeWarehouse.id, stockItemsToDeduct));
      } else {
        backgroundTasks.push(deductStockBatchCloud(stockItemsToDeduct));
      }

      // Update customer stats
      if (customer) {
        backgroundTasks.push(updateCustomerStatsCloud(customer.id, effectiveTotal, false));
      }

      // Run background tasks in parallel
      await Promise.all(backgroundTasks);

      // Log activity
      if (user) {
        const itemsDescription = soldItems.map(item => `${item.name} × ${item.quantity}`).join('، ');
        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `عملية بيع نقدي بقيمة $${formatNumber(effectiveTotal)} - المنتجات: ${itemsDescription}`,
          { invoiceId: invoice.id, total: effectiveTotal, itemsCount: cartSnapshot.length, customerName: customerNameSnapshot || 'عميل نقدي', items: soldItems }
        );
      }

      addSalesToShift(effectiveTotal);
      recordActivity();

      // ✅ Clear cart only after successful save
      onClearCart();
      playSaleComplete();
      completeSync('تمت المزامنة بنجاح');
      showToast.success(`تم إنشاء الفاتورة ${invoice.id} بنجاح ✓`);
    } catch (error) {
      console.error('Cash sale error:', error);

      // Recalculate effective total for local save
      const effectiveTotal = wholesaleMode && receivedAmount > 0 ? receivedAmount : totalSnapshot;

      // في حالة الفشل، حفظ محلياً
      addToQueue('invoice_create', {
        invoice: {
          customer_name: customerNameSnapshot || 'عميل نقدي',
          total: effectiveTotal,
          items: cartSnapshot,
        },
        timestamp: Date.now(),
      });

      failSync('تم حفظ الفاتورة محلياً، سيتم الرفع لاحقاً');
      showToast.error('حدث خطأ أثناء معالجة البيع');
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
      // إذا كان الاتصال غير متاح، حفظ محلياً للمزامنة لاحقاً
      if (!isOnline) {
        const bundle = {
          invoiceData: {
            customer_name: customerNameSnapshot || 'عميل',
            customer_phone: customerPhoneSnapshot || '',
            total: totalSnapshot,
            items: cartSnapshot,
          },
          timestamp: Date.now(),
        };
        addToQueue('debt_sale_bundle', { localId: `debt_${Date.now()}`, bundle });
        completeSync('تم حفظ الفاتورة محلياً، سيتم الرفع عند عودة الاتصال', 1000);
        setIsSaving(false);
        return;
      }

      // حساب الكميات الفعلية بالقطع (مع مراعاة معامل التحويل للوحدات الكبرى)
      const stockItemsWithConversion = cartSnapshot.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity
      }));

      // التحقق من المخزون
      // ✅ للمستودع الرئيسي: استخدم products.quantity
      // ✅ للمستودعات الفرعية (vehicle): استخدم warehouse_stock
      let stockCheck;
      if (activeWarehouse && activeWarehouse.type === 'vehicle' && activeWarehouse.assigned_cashier_id) {
        stockCheck = await checkWarehouseStockAvailability(activeWarehouse.id, stockItemsWithConversion);
      } else {
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
      const customer = await findOrCreateCustomerCloud(customerNameSnapshot);

      // Calculate profit by category
      const products = await loadProductsCloud();
      const profitsByCategory: Record<string, number> = {};
      let totalProfit = 0;
      let totalCOGS = 0;

      const soldItems: Array<{ name: string; quantity: number; price: number }> = [];

      cartSnapshot.forEach((item) => {
        const product = products.find(p => p.id === item.id);
        if (product) {
          let costPrice: number;

          if (item.unit === 'bulk') {
            if (item.bulkCostPrice && item.bulkCostPrice > 0) {
              costPrice = item.bulkCostPrice;
            } else {
              costPrice = (item.costPrice || product.costPrice) * (item.conversionFactor || 1);
            }
          } else {
            costPrice = item.costPrice || product.costPrice;
          }

          const itemProfit = roundCurrency((item.price - costPrice) * item.quantity);
          const itemCOGS = costPrice * item.quantity;
          const category = product.category || 'عام';
          profitsByCategory[category] = (profitsByCategory[category] || 0) + itemProfit;
          totalProfit += roundCurrency(itemProfit);
          totalCOGS += itemCOGS;
        }

        soldItems.push({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        });
      });

      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const discountedProfit = totalProfit * (1 - discountRatio);
      const discountMultiplier = 1 - discountRatio;

      const itemsWithCost = cartSnapshot.map(item => {
        const product = products.find(p => p.id === item.id);
        let itemCostPrice: number;

        if (item.unit === 'bulk') {
          if (item.bulkCostPrice && item.bulkCostPrice > 0) {
            itemCostPrice = item.bulkCostPrice;
          } else {
            itemCostPrice = (item.costPrice || product?.costPrice || 0) * (item.conversionFactor || 1);
          }
        } else {
          itemCostPrice = item.costPrice || product?.costPrice || 0;
        }

        const itemPrice = wholesaleMode ? getItemPrice(item) : item.price;  // ✅ Support wholesale
        const itemProfit = roundCurrency((itemPrice - itemCostPrice) * item.quantity);  // ✅ Rounded!

        return {
          id: item.id,
          name: item.name,
          price: itemPrice,
          quantity: item.quantity,
          total: roundCurrency(itemPrice * item.quantity),
          costPrice: itemCostPrice,
          profit: roundCurrency(itemProfit * discountMultiplier),  // ✅ Rounded!
        };
      });

      // In wholesale mode, if receivedAmount is entered, that IS the total
      const effectiveTotal = wholesaleMode && receivedAmount > 0 ? receivedAmount : totalSnapshot;
      const effectiveTotalInCurrency = effectiveTotal * selectedCurrency.rate;

      // Create invoice using Cloud API
      const invoice = await addInvoiceCloud({
        type: 'sale',
        customerName: customerNameSnapshot,
        items: itemsWithCost,
        subtotal,
        discount,
        discountPercentage: discountType === 'percent' ? discount : 0,
        taxRate,
        taxAmount,
        total: effectiveTotal,  // ✅ Use effective total
        totalInCurrency: effectiveTotalInCurrency, // ✅ Use effective total currency
        currency: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        paymentType: 'debt',
        status: 'pending',
        profit: discountedProfit,
      });

      if (!invoice) {
        showToast.error('فشل في إنشاء الفاتورة');
        return;
      }

      // ✅ باقي العمليات في الخلفية (parallel)
      const backgroundTasks = [];

      // تسجيل الربح
      addGrossProfit(invoice.id, discountedProfit, totalCOGS, effectiveTotal);

      // Create debt record
      backgroundTasks.push(addDebtFromInvoiceCloud(invoice.id, customerNameSnapshot, customerPhoneSnapshot || '', effectiveTotal));

      // Distribute profit to partners
      const categoryProfits = Object.entries(profitsByCategory)
        .filter(([_, profit]) => profit * discountMultiplier > 0)
        .map(([category, profit]) => ({
          category,
          profit: profit * discountMultiplier
        }));

      if (categoryProfits.length > 0) {
        backgroundTasks.push(
          distributeDetailedProfitCloud(
            categoryProfits,
            invoice.id,
            customerNameSnapshot,
            true
          ).catch((err) => {
            console.error('[CartPanel] Partner profit distribution failed (debt sale):', err);
          })
        );
      }

      // Deduct stock (parallel)
      const stockItemsToDeduct = cartSnapshot.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.unit === 'bulk' && item.conversionFactor
          ? item.quantity * item.conversionFactor
          : item.quantity
      }));

      // ✅ خصم المخزون: استخدم products للمستودع الرئيسي، warehouse_stock للموزعين
      if (activeWarehouse && activeWarehouse.type === 'vehicle' && activeWarehouse.assigned_cashier_id) {
        backgroundTasks.push(deductWarehouseStockBatchCloud(activeWarehouse.id, stockItemsToDeduct));
      } else {
        backgroundTasks.push(deductStockBatchCloud(stockItemsToDeduct));
      }

      // Update customer stats
      if (customer) {
        backgroundTasks.push(updateCustomerStatsCloud(customer.id, effectiveTotal, true));
      }

      // Run all background tasks in parallel
      await Promise.all(backgroundTasks);

      // Log activity
      if (user) {
        const itemsDescription = soldItems.map(item => `${item.name} × ${item.quantity}`).join('، ');

        addActivityLog(
          'sale',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `عملية بيع بالدين بقيمة $${formatNumber(effectiveTotal)} للعميل ${customerNameSnapshot} - المنتجات: ${itemsDescription}`,
          {
            invoiceId: invoice.id,
            total: effectiveTotal,
            itemsCount: cartSnapshot.length,
            customerName: customerNameSnapshot,
            paymentType: 'debt',
            items: soldItems
          }
        );

        addActivityLog(
          'debt_created',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `تم إنشاء دين جديد للعميل ${customerNameSnapshot} بقيمة $${formatNumber(effectiveTotal)}`,
          { invoiceId: invoice.id, amount: effectiveTotal, customerName: customerNameSnapshot }
        );
      }

      // ✅ Clear cart only after successful save
      onClearCart();
      playDebtRecorded();
      completeSync('تمت المزامنة بنجاح');
      showToast.success(`تم إنشاء فاتورة الدين ${invoice.id} بنجاح ✓`);
    } catch (error) {
      console.error('Debt sale error:', error);

      // Recalculate effective total for local save
      const effectiveTotal = wholesaleMode && receivedAmount > 0 ? receivedAmount : totalSnapshot;

      // في حالة الفشل، حفظ محلياً
      const bundle = {
        invoiceData: {
          customer_name: customerNameSnapshot || 'عميل',
          customer_phone: customerPhoneSnapshot || '',
          total: effectiveTotal,
          items: cartSnapshot,
        },
        timestamp: Date.now(),
      };
      addToQueue('debt_sale_bundle', { localId: `debt_${Date.now()}`, bundle });

      failSync('تم حفظ الفاتورة محلياً، سيتم الرفع لاحقاً');
      showToast.error('حدث خطأ أثناء معالجة البيع بالدين');
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
    } catch { }

    const currentDate = new Date().toLocaleDateString('ar-SA');
    const currentTime = new Date().toLocaleTimeString('ar-SA');

    // ✅ استخدام getItemPrice للسعر الصحيح (جملة أو مفرد)
    const itemsHtml = cart.map(item => {
      const itemPrice = getItemPrice(item);
      const itemTotal = roundCurrency(itemPrice * item.quantity * selectedCurrency.rate);
      return `
      <tr>
        <td style="padding: 5px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${selectedCurrency.symbol}${formatNumber(itemTotal)}</td>
      </tr>
    `;
    }).join('');

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
          ${discount > 0 ? `<div style="text-align: left; color: #c00;">خصم ${discountType === 'percent' ? discount + '%' : ''}: -${selectedCurrency.symbol}${formatNumber(discountAmount * selectedCurrency.rate)}</div>` : ''}
          <div class="total">
            الإجمالي: ${selectedCurrency.symbol}${formatNumber(displayTotalInCurrency)}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;

    printHTML(printContent);
    showToast.success('جاري إرسال الفاتورة للطابعة...');
  };

  const handleWhatsApp = async () => {
    if (cart.length === 0) return;

    // تحميل إعدادات المتجر
    const store = getStoreSettings();
    const currentDate = new Date().toLocaleDateString('ar-SA');

    // تحضير بيانات الفاتورة للمشاركة - ✅ استخدام getItemPrice و displayTotalInCurrency
    const shareData: InvoiceShareData = {
      id: `POS-${Date.now()}`,
      storeName: store.name,
      storePhone: store.phone,
      customerName: customerName || 'عميل نقدي',
      date: currentDate,
      items: cart.map(item => {
        const itemPrice = getItemPrice(item);  // ✅ استخدام السعر الصحيح (جملة أو مفرد)
        return {
          name: item.name,
          quantity: item.quantity,
          unitPrice: itemPrice,
          total: roundCurrency(itemPrice * item.quantity),
        };
      }),
      subtotal: subtotal,  // ✅ المجموع الفرعي المحسوب صحيحاً
      discount: discountAmount,
      total: displayTotalInCurrency,  // ✅ الإجمالي الصحيح (يأخذ بالاعتبار وضع الجملة والمبلغ المقبوض)
      currencySymbol: selectedCurrency.symbol,
      paymentType: 'cash',
      type: 'sale',
    };

    const success = await shareInvoice(shareData);
    if (success) {
      showToast.success('تم فتح المشاركة');
    }
  };

  return (
    <>
      <div className={cn(
        "bg-card flex flex-col h-full",
        isMobile ? "rounded-t-2xl" : "border-r border-border"
      )}>
        {/* Cart Header - Compact */}
        <div className="p-2 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-primary" />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center border border-background">
                    {cart.length}
                  </span>
                )}
              </div>
              <h2 className="font-bold text-sm hidden sm:block">{t('pos.shoppingCart')}</h2>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Wholesale Toggle - Compact Pill */}
              <button
                onClick={() => {
                  const newMode = !wholesaleMode;
                  setWholesaleMode(newMode);
                  if (onToggleWholesale) onToggleWholesale(newMode);
                  if (!newMode) setReceivedAmount(0);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-bold transition-all",
                  wholesaleMode
                    ? "bg-orange-100 border-orange-200 text-orange-700 hover:bg-orange-200"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
                title="تفعيل/إلغاء سعر الجملة"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  wholesaleMode ? "bg-orange-500 animate-pulse" : "bg-muted-foreground/30"
                )} />
                جملة
              </button>

              {/* Clear Cart - Icon Only */}
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClearCart}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title={t('pos.clear')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}

              {/* Sync Indicator - Mini */}
              <BackgroundSyncIndicator
                state={syncState}
                message={syncMessage}
                className="hidden sm:flex scale-75 origin-right"
              />

              {isMobile && onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
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

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40">
              <ShoppingCart className="w-12 h-12 mb-2" />
              <p className="text-sm">{t('pos.emptyCart')}</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={`${item.id}-${item.unit}`}
                className="bg-card hover:bg-muted/50 border border-border/50 rounded-lg p-2.5 transition-colors group"
              >
                {/* Row 1: Name & Delete */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-medium text-sm leading-tight line-clamp-2 text-foreground/90">
                    {item.name}
                  </h4>
                  <button
                    onClick={() => onRemoveItem(item.id, item.unit)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5 -mt-0.5 -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Row 2: Controls (Qty/Unit) & Price */}
                <div className="flex items-center justify-between gap-2">

                  {/* Left: Quantity & Unit */}
                  <div className="flex items-center bg-muted/50 rounded-md border border-border/50 h-8">
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1, item.unit)}
                      className="w-7 h-full flex items-center justify-center hover:bg-background rounded-r-md text-foreground/70 hover:text-primary transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-8 text-center font-bold text-sm tabular-nums">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => onUpdateQuantity(item.id, -1, item.unit)}
                      className="w-7 h-full flex items-center justify-center hover:bg-background rounded-l-md text-foreground/70 hover:text-destructive transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    {/* Unit Toggle Separator */}
                    {(item.bulkSalePrice && item.bulkSalePrice > 0) && (
                      <div className="w-[1px] h-4 bg-border mx-0.5" />
                    )}

                    {/* Unit Badge/Toggle */}
                    {(item.bulkSalePrice && item.bulkSalePrice > 0) && (
                      <button
                        onClick={() => onToggleUnit && onToggleUnit(item.id, item.unit)}
                        className={cn(
                          "px-2 h-full flex items-center justify-center text-[10px] font-medium transition-colors rounded-l-md",
                          item.unit === 'bulk'
                            ? "text-primary bg-primary/10 hover:bg-primary/20"
                            : "text-muted-foreground hover:bg-muted-foreground/10"
                        )}
                        title={item.unit === 'bulk' ? 'تحويل إلى قطعة' : 'تحويل إلى كرتونة'}
                      >
                        {item.unit === 'bulk' ? (item.bulkUnit || 'كرتونة') : (item.smallUnit || 'قطعة')}
                      </button>
                    )}
                  </div>

                  {/* Right: Price & Total */}
                  <div className="flex items-center gap-2">
                    {/* Price Input (Hidden in Wholesale Mode) */}
                    {!wholesaleMode && (
                      <div className="relative w-16 group/input">
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70 pointer-events-none">$</span>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => onUpdatePrice(item.id, Number(e.target.value), item.unit)}
                          onFocus={(e) => e.target.select()}
                          className="h-8 pr-3 pl-1 text-left font-bold text-sm bg-background border-transparent hover:border-border text-foreground/80 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all p-0 rounded-md"
                          min="0"
                        />
                      </div>
                    )}

                    {/* Total Price */}
                    <span className={cn(
                      "font-bold text-sm text-right min-w-[3.5rem]",
                      wholesaleMode ? "text-orange-600" : "text-primary"
                    )}>
                      ${formatNumber(getItemPrice(item) * item.quantity)}
                    </span>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="bg-muted/30 border-t border-border p-3 space-y-3">

          {/* Controls Row: Currency & Discount */}
          <div className="flex gap-2">
            {/* Currency - Compact */}
            <div className="flex items-center bg-background border border-border rounded-md px-1 h-9">
              {currencies.map(c => (
                <button
                  key={c.code}
                  onClick={() => onCurrencyChange(c)}
                  className={cn(
                    "px-2 py-0.5 text-xs font-bold rounded transition-colors",
                    selectedCurrency.code === c.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c.code}
                </button>
              ))}
            </div>

            {/* Discount - Compact */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="%"
                  className="h-9 pl-7 pr-1 text-sm bg-background"
                  value={discountType === 'percent' ? (discount || '') : ''}
                  onChange={(e) => {
                    setDiscountType('percent');
                    onDiscountChange(Number(e.target.value));
                  }}
                  onFocus={() => setDiscountType('percent')}
                />
              </div>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="$"
                  className="h-9 pl-7 pr-1 text-sm bg-background"
                  value={discountType === 'fixed' ? (discount || '') : ''}
                  onChange={(e) => {
                    setDiscountType('fixed');
                    onDiscountChange(Number(e.target.value));
                  }}
                  onFocus={() => setDiscountType('fixed')}
                />
              </div>
            </div>
          </div>

          {/* Wholesale Payment Input */}
          {wholesaleMode && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <span className="text-xs font-bold text-orange-600 whitespace-nowrap">المقبوض:</span>
              <div className="relative flex-1">
                <Input
                  className="h-9 border-orange-200 focus:border-orange-500 bg-background"
                  value={receivedAmount || ''}
                  onChange={(e) => setReceivedAmount(Number(e.target.value))}
                  placeholder="المبلغ المستلم"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary" onClick={() => setShowCalculator(true)}>
                  <CalculatorIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="bg-background rounded-lg border border-border/50 p-2.5 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span>${formatNumber(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-success font-medium">
                <span>خصم</span>
                <span>-${formatNumber(discountAmount)}</span>
              </div>
            )}

            {/* Final Total */}
            <div className="flex justify-between items-center pt-1 mt-1 border-t border-dashed border-border">
              <span className="font-bold text-base">{t('pos.total')}</span>
              <div className="flex flex-col items-end">
                <span className={cn(
                  "text-xl font-black leading-none",
                  wholesaleMode ? "text-orange-600" : "text-primary"
                )}>
                  {selectedCurrency.symbol}{formatNumber(displayTotalInCurrency)}
                </span>
                {selectedCurrency.code !== 'USD' && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    ${formatNumber(displayTotalInCurrency / selectedCurrency.rate)}
                  </span>
                )}
              </div>
            </div>

            {/* Wholesale Profit */}
            {wholesaleMode && receivedAmount > 0 && (
              <div className="flex justify-between text-xs pt-1 border-t border-border/30 mt-1">
                <span>الربح المتوقع</span>
                <span className={wholesaleProfit >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                  ${formatNumber(wholesaleProfit)}
                </span>
              </div>
            )}
          </div>

          {/* Action Grid (2x2) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Main Payment Buttons */}
            <Button
              className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95"
              disabled={cart.length === 0}
              onClick={handleCashSale}
            >
              <div className="flex flex-col items-center">
                <span className="text-base font-bold">{t('pos.cash')}</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-12 border-2 border-orange-500/20 text-orange-600 hover:bg-orange-50 hover:border-orange-500/50 hover:text-orange-700 transition-all active:scale-95"
              disabled={cart.length === 0}
              onClick={handleDebtSale}
            >
              <div className="flex flex-col items-center">
                <span className="text-base font-bold">{t('pos.debt')}</span>
              </div>
            </Button>

            {/* Secondary Actions */}
            <Button
              variant="secondary"
              className="h-9 text-xs"
              disabled={cart.length === 0}
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              {t('pos.print')}
            </Button>

            <Button
              variant="secondary"
              className="h-9 text-xs"
              disabled={cart.length === 0}
              onClick={handleWhatsApp}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              {t('pos.whatsapp')}
            </Button>
          </div>
        </div>
      </div >

      {/* Cash Sale Dialog */}
      < Dialog open={showCashDialog} onOpenChange={setShowCashDialog} >
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
                <span>المبلغ المطلوب:</span>
                <span className="text-primary">{selectedCurrency.symbol}{formatNumber(displayTotalInCurrency)}</span>
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
      </Dialog >

      {/* Debt Sale Dialog */}
      < Dialog open={showDebtDialog} onOpenChange={setShowDebtDialog} >
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
                <span>{selectedCurrency.symbol}{formatNumber(displayTotalInCurrency)}</span>
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
      </Dialog >

      {/* Add Customer Dialog */}
      < Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog} >
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
              <Button className="flex-1" onClick={handleAddCustomer} disabled={isAddingCustomer}>
                <UserPlus className="w-4 h-4 ml-2" />
                {isAddingCustomer ? 'جاري الحفظ...' : 'إضافة العميل'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* آلة حاسبة */}
      < Calculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)
        }
        onResult={(value) => setReceivedAmount(value)}
      />
    </>
  );
}
