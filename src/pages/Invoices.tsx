import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Undo2,
  Printer,
  Send,
  Filter,
  Calendar,
  DollarSign,
  Banknote,
  CreditCard,
  Wrench,
  ShoppingCart,
  Truck,
  X,
  Check,
  MoreVertical,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Layers,
  Share2,
  Loader2,
  Save,
  Coins,
  Copy,
  User,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { cn, formatNumber, formatCurrency, formatDateTime, roundCurrency } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useCurrency, loadDefaultCurrencyCode } from '@/hooks/use-currency';
import { emitEvent, EVENTS } from '@/lib/events';
import {
  loadInvoicesCloud,
  invalidateInvoicesCache,
  deleteInvoiceCloud,
  refundInvoiceCloud,
  refundInvoicePartialCloud,
  PartialRefundItem,
  updateInvoiceCloud,
  getInvoiceStatsCloud,
  Invoice,
  InvoiceType,
  RefundResult
} from '@/lib/cloud/invoices-cloud';
import { invalidateProductsCache, refreshProductsFromCloud } from '@/lib/cloud/products-cloud';
import {
  settleDebtsByInvoiceIdCloud,
  loadDebtsCloud,
  recordPaymentWithInvoiceSyncCloud,
  invalidateDebtsCache,
  addDebtFromInvoiceCloud,
  Debt,
} from '@/lib/cloud/debts-cloud';
import { useAuth } from '@/hooks/use-auth';
import { addActivityLog } from '@/lib/activity-log';
import { confirmPendingProfit } from '@/lib/partners-store';
import { confirmPendingProfitCloud } from '@/lib/cloud/partners-cloud';
import { processDebtPayment } from '@/lib/unified-transactions';
import { logActivity } from '@/lib/activity-log';
import { printHTML } from '@/lib/native-print';
import { shareInvoice, InvoiceShareData, generateInvoiceShareText, nativeShare } from '@/lib/native-share';
import { useActionGuard } from '@/hooks/use-action-guard';
import { addToQueueIfNotExists } from '@/lib/sync-queue';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import { getCurrentUserRole } from '@/lib/supabase-store';
import { PurchaseInvoicesListTab } from '@/components/purchases/PurchaseInvoicesListTab';
import { PageHeader } from '@/components/layout/PageHeader';

// مفتاح موحّد لبنود الاسترداد (يُستخدم في الاختيار والإرسال معًا)
const refundKey = (item: { productId?: string; name: string }): string =>
  item.productId || (item as unknown as { id?: string }).id || item.name;

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export type DateQuickFilter = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

/**
 * فحص مطابقة تاريخ الفاتورة مع تاريخ اليوم بمعالجة فروق التوقيت المحلي وUTC ومنتصف الليل
 */
export function isInvoiceToday(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  try {
    const invDate = new Date(createdAt);
    if (isNaN(invDate.getTime())) return false;
    const now = new Date();

    // 1. مطابقة التاريخ المحلي (نفس اليوم والشهر والسنة في توقيت جهاز المستخدم)
    if (
      invDate.getFullYear() === now.getFullYear() &&
      invDate.getMonth() === now.getMonth() &&
      invDate.getDate() === now.getDate()
    ) {
      return true;
    }

    // 2. مطابقة نص التاريخ المحلي toDateString
    if (invDate.toDateString() === now.toDateString()) {
      return true;
    }

    // 3. مطابقة تاريخ UTC (لتغطية أي فارق توقيت بين خادم Supabase وجهاز المستخدم حول منتصف الليل)
    if (
      invDate.getUTCFullYear() === now.getUTCFullYear() &&
      invDate.getUTCMonth() === now.getUTCMonth() &&
      invDate.getUTCDate() === now.getUTCDate()
    ) {
      return true;
    }

    // 4. مطابقة البادئة النصية (YYYY-MM-DD)
    const localToday = getLocalDateString(now);
    const utcToday = now.toISOString().slice(0, 10);
    if (createdAt.startsWith(localToday) || createdAt.startsWith(utcToday)) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * فحص مطابقة تاريخ الفاتورة خلال آخر 7 أيام
 */
export function isInvoiceThisWeek(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  try {
    const invDate = new Date(createdAt);
    if (isNaN(invDate.getTime())) return false;
    const now = new Date();
    const diffMs = now.getTime() - invDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (diffMs >= -86400000 && diffMs <= sevenDaysMs) {
      return true;
    }
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    if (invDate >= weekAgo) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * فحص مطابقة تاريخ الفاتورة للشهر الحالي
 */
export function isInvoiceThisMonth(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  try {
    const invDate = new Date(createdAt);
    if (isNaN(invDate.getTime())) return false;
    const now = new Date();
    if (invDate.getFullYear() === now.getFullYear() && invDate.getMonth() === now.getMonth()) {
      return true;
    }
    if (invDate.getUTCFullYear() === now.getUTCFullYear() && invDate.getUTCMonth() === now.getUTCMonth()) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * فحص مطابقة تاريخ الفاتورة للسنة الحالية
 */
export function isInvoiceThisYear(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  try {
    const invDate = new Date(createdAt);
    if (isNaN(invDate.getTime())) return false;
    const now = new Date();
    if (invDate.getFullYear() === now.getFullYear()) {
      return true;
    }
    if (invDate.getUTCFullYear() === now.getUTCFullYear()) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * فحص مطابقة تاريخ الفاتورة مع تاريخ مخصص محدد
 */
export function isInvoiceCustomDate(createdAt?: string | null, targetDate?: string): boolean {
  if (!createdAt || !targetDate) return true;
  try {
    if (createdAt.startsWith(targetDate)) return true;
    const invDate = new Date(createdAt);
    if (isNaN(invDate.getTime())) return false;
    if (getLocalDateString(invDate) === targetDate) return true;
    if (invDate.toISOString().slice(0, 10) === targetDate) return true;
  } catch {}
  return false;
}

export default function Invoices() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'sales' | 'purchases'>('sales');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | InvoiceType>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'debt'>('all');

  const todayStr = useMemo(() => getLocalDateString(), []);
  const [dateQuickFilter, setDateQuickFilter] = useState<DateQuickFilter>('today');
  const [dateFilter, setDateFilter] = useState<string>(() => getLocalDateString());
  const [activeKpi, setActiveKpi] = useState<'total' | 'debt' | 'today' | 'profit' | null>('today');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [invoiceToRefund, setInvoiceToRefund] = useState<Invoice | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [invoiceToShare, setInvoiceToShare] = useState<Invoice | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [partialRefundQuantities, setPartialRefundQuantities] = useState<Record<string, number>>({});
  const [showRefunded, setShowRefunded] = useState(false);
  const [refundCondition, setRefundCondition] = useState<'good' | 'damaged'>('good');
  const [refundMeta, setRefundMeta] = useState<Record<string, { condition: 'good' | 'damaged'; at: string; mode: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('hyperpos_refund_meta_v1') || '{}'); } catch { return {}; }
  });
  const saveRefundMeta = (invoiceId: string) => {
    setRefundMeta(prev => {
      const next = { ...prev, [invoiceId]: { condition: refundCondition, at: new Date().toISOString(), mode: refundMode } };
      try { localStorage.setItem('hyperpos_refund_meta_v1', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [stats, setStats] = useState({ total: 0, todayCount: 0, todaySales: 0, totalSales: 0, pendingDebts: 0, totalProfit: 0 });
  const refundGuard = useActionGuard();
  const markPaidGuard = useActionGuard();
  const deleteGuard = useActionGuard();
  const { isOnline } = useCloudSyncContext();
  const { user, profile } = useAuth();

  const {
    currencyCode,
    currencySymbol,
    currencySymbols,
    currencyNames,
    exchangeRate,
    exchangeRates,
    enabledCurrencies
  } = useCurrency();

  const [displayCurrencyFilter, setDisplayCurrencyFilter] = useState<'stored' | 'TRY' | 'SYP' | 'USD'>('stored');

  // Debt Payment Dialog State
  const [showDebtPaymentDialog, setShowDebtPaymentDialog] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<Debt | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'TRY' | 'SYP'>(() => {
    const defaultCurr = loadDefaultCurrencyCode();
    return (defaultCurr as 'USD' | 'TRY' | 'SYP') || 'USD';
  });
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const paymentBusyRef = useRef(false);
  const paymentOpIdRef = useRef(`debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const currentRate = paymentCurrency === 'USD' ? 1 : (exchangeRates[paymentCurrency] || 1);

  const amountUSD = useMemo(() => {
    const val = parseFloat(paymentAmountInput) || 0;
    if (val <= 0) return 0;
    if (paymentCurrency === 'USD') return Math.round(val * 100) / 100;
    return Math.round((val / currentRate) * 100) / 100;
  }, [paymentAmountInput, paymentCurrency, currentRate]);

  const maxInCurrency = useMemo(() => {
    if (!selectedDebtForPayment) return 0;
    if (paymentCurrency === 'USD') return selectedDebtForPayment.remainingDebt;
    return Math.round(selectedDebtForPayment.remainingDebt * currentRate * 100) / 100;
  }, [selectedDebtForPayment, paymentCurrency, currentRate]);

  // Helper for computing display financial values for an invoice
  const getInvoiceFinancials = (inv: Invoice, forceStored: boolean = false) => {
    let code: string;
    let rate: number;
    let symbol: string;

    const target = forceStored ? 'stored' : displayCurrencyFilter;

    if (target !== 'stored') {
      code = target;
      if (code === 'USD') {
        rate = 1;
        symbol = currencySymbols?.USD || '$';
      } else {
        rate = (exchangeRates[code] && exchangeRates[code] > 0) ? exchangeRates[code] : (code === 'TRY' ? 34 : (code === 'SYP' ? 14500 : 1));
        symbol = currencySymbols?.[code] || (code === 'TRY' ? '₺' : (code === 'SYP' ? 'ل.س' : code));
        if ((!symbol || symbol === '$') && currencyCode === code && currencySymbol && currencySymbol !== '$') {
          symbol = currencySymbol;
        }
        if (!symbol || symbol === '$') {
          symbol = code;
        }
      }
    } else {
      // 'stored': use the invoice's stored currency if present and valid
      const rawStoredSymbol = (inv.currencySymbol || '').trim();
      const invCurr = (inv.currency || '').toUpperCase();
      const hasStoredRate = typeof inv.exchangeRate === 'number' && inv.exchangeRate > 0;
      const storedRate = hasStoredRate ? inv.exchangeRate! : 1;

      // تعتبر الفاتورة بعملة أجنبية/محلية إذا كانت العملة ليست USD أو معدل صرفها > 1
      const isForeign = (invCurr !== 'USD' && invCurr !== '') || storedRate > 1;

      if (isForeign) {
        code = (invCurr && invCurr !== 'USD') ? invCurr : (currencyCode !== 'USD' ? currencyCode : 'TRY');
        rate = hasStoredRate
          ? storedRate
          : ((exchangeRates[code] && exchangeRates[code] > 0) ? exchangeRates[code] : (code === 'TRY' ? 34 : (code === 'SYP' ? 14500 : 1)));

        // إذا كان الرمز المخزن تاريخياً بالخطأ "$" أو فارغاً، نتجاهل "$" ونجلب الرمز الفعلي المخصص للعملة
        const hasValidNonDollarStored = rawStoredSymbol !== '' && rawStoredSymbol !== '$';
        if (hasValidNonDollarStored) {
          symbol = rawStoredSymbol;
        } else {
          symbol = currencySymbols?.[code] || (code === 'TRY' ? '₺' : (code === 'SYP' ? 'ل.س' : code));
          if ((!symbol || symbol === '$') && currencyCode === code && currencySymbol && currencySymbol !== '$') {
            symbol = currencySymbol;
          }
          if (!symbol || symbol === '$') {
            symbol = code;
          }
        }
      } else {
        // الفاتورة المباعة بالدولار تُعرض دائماً بالدولار ($) بسعر صرف 1
        code = 'USD';
        rate = 1;
        symbol = (rawStoredSymbol && rawStoredSymbol !== '') ? rawStoredSymbol : (currencySymbols?.USD || '$');
      }
    }

    const decimals = rate >= 100 ? 0 : 2;

    // الإجمالي المعروض: إجمالي الفاتورة الأساسي (inv.total) مضروباً في سعر الصرف المعتمد
    const displayTotal = roundCurrency((inv.total || 0) * rate);

    // صافي الربح المعروض: ربح الفاتورة الأساسي (inv.profit) مضروباً في سعر الصرف المعتمد
    let baseProfit = typeof inv.profit === 'number' && !isNaN(inv.profit) ? inv.profit : 0;
    if (baseProfit === 0 && Array.isArray(inv.items) && inv.items.length > 0) {
      const itemsComputedProfit = inv.items.reduce((sum, item) => {
        const itemProfit = typeof item.profit === 'number'
          ? item.profit
          : ((Number(item.price) || 0) - (Number(item.costPrice) || 0)) * (Number(item.quantity) || 1);
        return sum + itemProfit;
      }, 0) - (Number(inv.discount) || 0);
      if (itemsComputedProfit !== 0) {
        baseProfit = roundCurrency(itemsComputedProfit);
      }
    }
    const displayProfit = roundCurrency(baseProfit * rate);

    const invUpper = (inv.currency || 'USD').toUpperCase();
    const tryRate = (invUpper === 'TRY' && typeof inv.exchangeRate === 'number' && inv.exchangeRate > 0)
      ? inv.exchangeRate
      : ((exchangeRates.TRY && exchangeRates.TRY > 0) ? exchangeRates.TRY : 34);

    const sypRate = (invUpper === 'SYP' && typeof inv.exchangeRate === 'number' && inv.exchangeRate > 0)
      ? inv.exchangeRate
      : ((exchangeRates.SYP && exchangeRates.SYP > 0) ? exchangeRates.SYP : 14500);

    return {
      code,
      rate,
      symbol,
      decimals,
      displayTotal,
      displayProfit,
      baseProfit,
      tryRate,
      sypRate,
    };
  };

  const statCurrencyCode = displayCurrencyFilter !== 'stored'
    ? displayCurrencyFilter
    : currencyCode;
  const statExchangeRate = statCurrencyCode === 'USD'
    ? 1
    : ((exchangeRates[statCurrencyCode] && exchangeRates[statCurrencyCode] > 1)
        ? exchangeRates[statCurrencyCode]
        : (statCurrencyCode === 'TRY' ? 34 : 14500));
  const statCurrencySymbol = statCurrencyCode === 'USD' ? (currencySymbols?.USD || '$') : (currencySymbols?.[statCurrencyCode] || (statCurrencyCode === 'TRY' ? '₺' : (statCurrencyCode === 'SYP' ? 'ل.س' : statCurrencyCode)));
  const statDecimals = statExchangeRate >= 100 ? 0 : 2;

  // مواءمة مبيعات اليوم مع فواتير اليوم الفعلية المعروضة لمنع أي تفاوت عند منتصف الليل
  const computedTodaySales = useMemo(() => {
    const todayInvs = invoices.filter(inv => inv.status !== 'refunded' && isInvoiceToday(inv.createdAt));
    return todayInvs.reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [invoices]);

  const effectiveTodaySales = computedTodaySales > 0 ? computedTodaySales : stats.todaySales;
  const todaySalesDisplay = roundCurrency(effectiveTodaySales * statExchangeRate);
  const totalProfitDisplay = roundCurrency(stats.totalProfit * statExchangeRate);

  const refundFinancials = invoiceToRefund ? getInvoiceFinancials(invoiceToRefund, true) : null;

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load invoices with proper cleanup & silent background updates
  const isAnyModalOpenRef = useRef(false);
  isAnyModalOpenRef.current = Boolean(showViewDialog || showShareSheet || showRefundDialog || showDebtPaymentDialog);

  const selectedInvoiceRef = useRef<Invoice | null>(null);
  selectedInvoiceRef.current = selectedInvoice;

  const pendingUpdateRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const [invoicesData, statsData] = await Promise.all([
        loadInvoicesCloud(),
        getInvoiceStatsCloud()
      ]);
      setInvoices(invoicesData);
      setStats(statsData);

      // تحديث بيانات الفاتورة المحددة بصمت إذا كانت معروضة دون إغلاق النافذة
      if (selectedInvoiceRef.current) {
        const currentId = selectedInvoiceRef.current.id;
        const freshSelected = invoicesData.find(i => i.id === currentId);
        if (freshSelected) {
          setSelectedInvoice(freshSelected);
        }
      }
    } catch (err) {
      console.warn('[Invoices] Error loading invoices:', err);
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData(false);

    const handleUpdate = () => {
      // 🛡️ إذا كانت هناك نافذة تفاعلية مفتوحة (عرض، مشاركة، استرداد، سداد)، نؤجل التحديث حتى تغلق
      if (isAnyModalOpenRef.current) {
        pendingUpdateRef.current = true;
        return;
      }
      // 🚀 تحديث صامت في الخلفية دائماً عند وصول أحداث التحديث لمنع وميض الشاشة أو {t('invoices.reset') || 'تصفير'} التمرير
      loadData(true);
    };

    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    };
  }, [loadData]);

  // تنفيذ أي تحديث مؤجل بمجرد إغلاق كافة النوافذ المنبثقة
  useEffect(() => {
    const isAnyOpen = showViewDialog || showShareSheet || showRefundDialog || showDebtPaymentDialog;
    if (!isAnyOpen && pendingUpdateRef.current) {
      pendingUpdateRef.current = false;
      loadData(true);
    }
  }, [showViewDialog, showShareSheet, showRefundDialog, showDebtPaymentDialog, loadData]);

  // Memoized filtered invoices for performance
  // Refunded invoices appear only in the "فواتير مستردة" view (full or partial refunds)
  const filteredInvoices = useMemo(() => {
    let result = showRefunded
      ? invoices.filter(inv => inv.status === 'refunded' || !!refundMeta[inv.id])
      : invoices.filter(inv => inv.status !== 'refunded');

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(inv =>
        inv.customerName.toLowerCase().includes(query) ||
        inv.id.toLowerCase().includes(query) ||
        inv.serviceDescription?.toLowerCase().includes(query) ||
        inv.items?.some(item => item.name.toLowerCase().includes(query))
      );
    }

    if (filterType !== 'all') {
      result = result.filter(inv => inv.type === filterType);
    }

    if (filterPayment !== 'all') {
      result = result.filter(inv => inv.paymentType === filterPayment);
    }

    // Date filtering (Quick filters + Custom date picker)
    if (dateQuickFilter === 'today') {
      result = result.filter(inv => isInvoiceToday(inv.createdAt));
    } else if (dateQuickFilter === 'week') {
      result = result.filter(inv => isInvoiceThisWeek(inv.createdAt));
    } else if (dateQuickFilter === 'month') {
      result = result.filter(inv => isInvoiceThisMonth(inv.createdAt));
    } else if (dateQuickFilter === 'year') {
      result = result.filter(inv => isInvoiceThisYear(inv.createdAt));
    } else if (dateQuickFilter === 'custom' && dateFilter) {
      result = result.filter(inv => isInvoiceCustomDate(inv.createdAt, dateFilter));
    }

    return result;
  }, [invoices, debouncedSearch, filterType, filterPayment, dateQuickFilter, dateFilter, showRefunded, refundMeta]);

  // KPI Card Filter Handlers
  const handleKpiTotal = () => {
    setActiveKpi('total');
    setFilterType('all');
    setFilterPayment('all');
    setDateQuickFilter('all');
    setDateFilter('');
    setShowRefunded(false);
  };

  const handleKpiDebt = () => {
    setActiveKpi('debt');
    setFilterPayment('debt');
    setFilterType('all');
    setDateQuickFilter('all');
    setDateFilter('');
    setShowRefunded(false);
  };

  const handleKpiToday = () => {
    setActiveKpi('today');
    setDateQuickFilter('today');
    setDateFilter(todayStr);
    setFilterType('all');
    setFilterPayment('all');
    setShowRefunded(false);
  };

  const handleKpiProfit = () => {
    setActiveKpi('profit');
    setDateQuickFilter('today');
    setDateFilter(todayStr);
    setFilterType('sale');
    setFilterPayment('all');
    setShowRefunded(false);
  };

  // استخراج تواريخ الأيام التي تحتوي على فواتير فعلية لتمييزها في التقويم
  const salesInvoiceDates = useMemo(() => {
    const dates = new Set<string>();
    for (const inv of invoices) {
      if (inv.status !== 'refunded' && inv.createdAt) {
        dates.add(inv.createdAt.slice(0, 10));
        try {
          dates.add(getLocalDateString(new Date(inv.createdAt)));
        } catch {}
      }
    }
    return Array.from(dates);
  }, [invoices]);

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
  };

  const handleRefund = (invoice: Invoice) => {
    // ✅ منع الاسترداد المزدوج من الواجهة
    if (invoice.status === 'refunded') {
      toast.warning(
        language === 'en'
          ? 'This invoice is already refunded'
          : language === 'tr'
          ? 'Bu fatura zaten iade edildi'
          : language === 'ku'
          ? 'ئەم فاکتۆڕە پێشتر گەڕێندراوەتەوە'
          : language === 'fa'
          ? 'این فاکتور قبلاً مرجوع شده است'
          : 'هذه الفاتورة مستردة بالفعل'
      );
      return;
    }
    // ✅ فحص دور المستخدم — الكاشير لا يملك صلاحية الاسترداد (يحتاج إذن مشرف)
    getCurrentUserRole().then(role => {
      if (role === 'cashier') {
        toast.error(
          language === 'en'
            ? 'You do not have permission to refund'
            : language === 'tr'
            ? 'İade işlemi için yetkiniz bulunmamaktadır'
            : language === 'ku'
            ? 'دەسەڵاتی ئەنجامدانی گەڕاندنەوەت نییە'
            : language === 'fa'
            ? 'شما مجوز انجام مرجوعی را ندارید'
            : 'ليس لديك صلاحية تنفيذ الاسترداد',
          {
            description:
              language === 'en'
                ? 'This action requires supervisor or manager permissions. Contact the store owner.'
                : language === 'tr'
                ? 'Bu işlem yönetici veya müdür yetkisi gerektirir. Mağaza sahibiyle iletişime geçin.'
                : language === 'ku'
                ? 'ئەم کردارە پێویستی بە دەسەڵاتی سەرپەرشتیار یان بەڕێوەبەر هەیە. پەیوەندی بە خاوەنی فرۆشگاوە بکە.'
                : language === 'fa'
                ? 'این عملیات نیاز به مجوز سرپرست یا مدیر دارد. با مالک فروشگاه تماس بگیرید.'
                : 'هذه العملية تتطلب صلاحيات المشرف أو المدير. تواصل مع مالك المتجر.',
            duration: 5000,
          }
        );
        return;
      }
      // لديه صلاحية — نفتح نافذة الاسترداد
      setInvoiceToRefund(invoice);
      setRefundMode('full');
      const initialQty: Record<string, number> = {};
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach(item => {
          const key = refundKey(item);
          initialQty[key] = 0;
        });
      }
      setPartialRefundQuantities(initialQty);
      setShowRefundDialog(true);
    });
  };

  const updatePartialQty = (key: string, delta: number, maxQty: number) => {
    setPartialRefundQuantities(prev => {
      const current = prev[key] || 0;
      const updated = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [key]: updated };
    });
  };

  const setAllPartialQtyMax = () => {
    if (!invoiceToRefund?.items) return;
    const allMax: Record<string, number> = {};
    invoiceToRefund.items.forEach(item => {
      const key = refundKey(item);
      allMax[key] = item.quantity;
    });
    setPartialRefundQuantities(allMax);
  };

  const resetAllPartialQty = () => {
    if (!invoiceToRefund?.items) return;
    const allZero: Record<string, number> = {};
    invoiceToRefund.items.forEach(item => {
      const key = refundKey(item);
      allZero[key] = 0;
    });
    setPartialRefundQuantities(allZero);
  };

  const partialRefundStats = useMemo(() => {
    if (!invoiceToRefund || !invoiceToRefund.items) {
      return { totalRefundAmount: 0, itemsCount: 0, unitsCount: 0, isValid: false, cashToReturn: 0, debtReduction: 0 };
    }
    let totalRefundAmount = 0;
    let unitsCount = 0;
    let itemsCount = 0;

    invoiceToRefund.items.forEach(item => {
      const key = refundKey(item);
      const qty = partialRefundQuantities[key] || 0;
      if (qty > 0) {
        unitsCount += qty;
        itemsCount += 1;
        totalRefundAmount += item.price * qty;
      }
    });

    // توزيع الخصم/الضريبة على مستوى الفاتورة بشكل نسبي (مطابق للخادم)
    const sub = Number(invoiceToRefund.subtotal) || 0;
    const ratio = sub > 0 ? (Number(invoiceToRefund.total) || 0) / sub : 1;
    totalRefundAmount = roundCurrency(totalRefundAmount * ratio);

    let cashToReturn = 0;
    let debtReduction = 0;

    if (invoiceToRefund.paymentType === 'debt') {
      const debtRemaining = Number(invoiceToRefund.debtRemaining ?? (invoiceToRefund.total - (invoiceToRefund.debtPaid ?? 0)));
      if (totalRefundAmount <= debtRemaining) {
        debtReduction = totalRefundAmount;
        cashToReturn = 0;
      } else {
        debtReduction = debtRemaining;
        cashToReturn = roundCurrency(totalRefundAmount - debtRemaining);
      }
    } else {
      cashToReturn = totalRefundAmount;
    }

    return {
      totalRefundAmount,
      itemsCount,
      unitsCount,
      isValid: unitsCount > 0,
      cashToReturn,
      debtReduction
    };
  }, [invoiceToRefund, partialRefundQuantities]);

  const confirmRefund = () => refundGuard.run(async () => {
    if (!invoiceToRefund) return;
    const invoice = invoiceToRefund;
    saveRefundMeta(invoice.id);
    // Snapshot invoice-specific data BEFORE running so notifications reflect this exact invoice
    const invoiceLabel = invoice.id;
    const refundFin = getInvoiceFinancials(invoice);
    const invoiceTotal = refundFin.displayTotal;
    const invoiceCurrencySymbol = refundFin.symbol;
    // Unique toast id per invoice → prevents duplicate stacked notifications on re-triggers
    const toastId = `refund-${invoiceLabel}`;

    // ✅ Close the dialog immediately (non-blocking UX) but DO NOT change the
    // invoice state until the server confirms the refund succeeded.
    setShowRefundDialog(false);
    setInvoiceToRefund(null);

    // ✅ Offline path: queue and stop here
    if (!isOnline) {
      addToQueueIfNotExists('invoice_refund', { invoiceNumber: invoiceLabel }, `invoice-refund:${invoiceLabel}`);
      toast.info(`تم جدولة استرداد ${invoiceLabel}`, {
        id: toastId,
        description: `المبلغ: ${formatCurrency(invoiceTotal, invoiceCurrencySymbol, refundFin.decimals)} — سيُنفَّذ عند عودة الإنترنت`,
        duration: 3500,
      });
      return;
    }

    // ✅ Online path: dialog is already closed, but the guard remains held until completion.
    toast.loading(`جاري استرداد ${invoiceLabel}...`, { id: toastId });
    try {
        const result = await refundInvoiceCloud(invoiceLabel, 'online');
        if (typeof result === 'object' && result.alreadyRefunded) {
          setInvoices(prev => prev.map(inv =>
            inv.id === invoiceLabel ? { ...inv, status: 'refunded' as const } : inv
          ));
          toast.info(`الفاتورة ${invoiceLabel} مستردة بالفعل`, {
            id: toastId,
            description: 'لم تتم إضافة أي كمية جديدة إلى المخزون',
            duration: 3500,
          });
          return;
        }

        const ok = result && (result === true || (result as RefundResult).success);
        if (!ok) {
          const reason = typeof result === 'object' ? (result as RefundResult).error : undefined;
          toast.error(`فشل في استرداد ${invoiceLabel}`, {
            id: toastId,
            description: reason || 'لم يطرأ أي تغيير على الفاتورة أو المخزون',
            duration: 5000,
          });
          // No optimistic change was made, so nothing to roll back.
          return;
        }

        // Confirmed by the server → now reflect the refunded state in the list
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceLabel ? { ...inv, status: 'refunded' as const } : inv
        ));
        invalidateInvoicesCache();


        // Refresh stats silently — don't block UI
        getInvoiceStatsCloud().then(setStats).catch(() => {});

        // Refresh product quantities from cloud so local inventory reflects the refund
        try {
          invalidateProductsCache();
          refreshProductsFromCloud().then(() => {
            // Notify listeners that products updated
            emitEvent(EVENTS.PRODUCTS_UPDATED, null);
          }).catch(() => {});
        } catch (e) { /* noop */ }

        const refundedTotal = typeof result === 'object' ? result.invoiceTotal : invoiceTotal;
        const refundedCurrency = typeof result === 'object' ? (result.invoiceCurrency || invoice.currency) : invoice.currency;
        const lines: string[] = [`💵 المبلغ: ${formatCurrency(refundedTotal, refundedCurrency)}`];
        if (typeof result === 'object' && (result as RefundResult).success) {
          const r = result as RefundResult;
          if (r.restoredUnitsCount > 0) {
            lines.push(`📦 أُعيدت ${formatNumber(r.restoredUnitsCount)} قطعة من ${formatNumber(r.restoredItemsCount)} منتج`);
          }
          if (r.deletedDebtAmount > 0) {
            lines.push(`🗑️ دين محذوف: ${r.deletedDebtAmount.toFixed(2)}${invoiceCurrencySymbol}`);
          }
          if (r.cashToRefund && r.cashToRefund > 0) {
            lines.push(`💰 يُرجع نقداً للعميل ومن الوردية: ${formatCurrency(r.cashToRefund, refundedCurrency)}`);
          }
        }
        toast.success(`✅ تم استرداد ${invoiceLabel}`, {
          id: toastId,
          description: lines.join(' • '),
          duration: 4500,
        });

        const cashRefunded = (typeof result === 'object' && (result as RefundResult).cashToRefund) || 0;
        const debtDeleted = (typeof result === 'object' && (result as RefundResult).deletedDebtAmount) || 0;
        const usdSym = currencySymbols?.USD || '$';
        const detailedRefundDesc = debtDeleted > 0
          ? `استرداد فاتورة ${invoiceLabel}: تم تخفيض دين العميل بقيمة ${usdSym}${formatNumber(debtDeleted)}${cashRefunded > 0 ? ` وتم تسليمه نقداً ${usdSym}${formatNumber(cashRefunded)} من الصندوق` : ''}`
          : `استرداد نقدي كامل للفاتورة: ${invoiceLabel} بقيمة ${usdSym}${roundCurrency(refundedTotal)} من الصندوق`;

        void logActivity('invoice_refunded', detailedRefundDesc, {
          entityType: 'invoice',
          entityId: invoice.id,
          entityName: invoice.customerName,
          snapshot: {
            invoiceNumber: invoice.id,
            customerName: invoice.customerName,
            total: refundedTotal,
            paymentType: invoice.paymentType,
            cashToRefund: cashRefunded,
            deletedDebt: debtDeleted,
            items: invoice.items.map(it => ({
              name: it.name,
              quantity: it.quantity,
              price: it.price,
              total: it.total,
            })),
          },
        });
      } catch (err) {
        console.error('[confirmRefund] background error:', err);
        toast.error(`فشل في استرداد ${invoiceLabel}`, { id: toastId, duration: 3500 });
        invalidateInvoicesCache();
        const invoicesData = await loadInvoicesCloud();
        setInvoices(invoicesData);
      }
  });

  const confirmPartialRefund = () => refundGuard.run(async () => {
    if (!invoiceToRefund) return;
    const invoice = invoiceToRefund;
    saveRefundMeta(invoice.id);
    const invoiceLabel = invoice.id;
    const toastId = `refund-${invoiceLabel}`;

    const itemsToRefund: PartialRefundItem[] = [];
    invoice.items?.forEach(item => {
      // ✅ معرف المنتج قد يكون في productId أو id حسب مصدر البيانات
      const pid = item.productId || (item as unknown as { id?: string }).id;
      const key = refundKey(item);
      const qty = partialRefundQuantities[key] || 0;
      if (qty > 0) {
        itemsToRefund.push({
          productId: pid,
          productName: item.name,
          quantityToRefund: qty,
          quantity: qty,
          unitPrice: item.price,
          costPrice: item.costPrice || 0,
          profit: (item.price - (item.costPrice || 0)) * qty
        });
      }
    });

    if (itemsToRefund.length === 0) {
      toast.warning('يرجى تحديد كمية عنصر واحد على الأقل للاسترداد');
      return;
    }

    setShowRefundDialog(false);
    setInvoiceToRefund(null);
    const operationId = crypto.randomUUID();

    if (!isOnline) {
      const refundedTotal = partialRefundStats.totalRefundAmount;
      const remainingTotal = Math.max(0, (invoice.total || 0) - refundedTotal);
      const isFull = remainingTotal <= 0;

      addToQueueIfNotExists(
        'invoice_refund_partial',
        { invoiceNumber: invoiceLabel, itemsToRefund, operationId },
        `invoice-refund-partial:${operationId}`
      );

      setInvoices(prev => prev.map(inv => {
        if (inv.id !== invoiceLabel) return inv;
        return {
          ...inv,
          total: remainingTotal,
          status: isFull ? ('refunded' as const) : inv.status,
          notes: (inv.notes ? inv.notes + '\n' : '') + `مرتجع جزئي (${refundedTotal}) أوفلاين بانتظار المزامنة`,
        };
      }));

      toast.info(`تمت جدولة الاسترداد الجزئي للفاتورة ${invoiceLabel}`, {
        id: toastId,
        description: `قيمة المرتجع: ${formatCurrency(refundedTotal, invoice.currency)} — سيُرفع تلقائياً عند الاتصال`,
        duration: 4000,
      });
      return;
    }

    toast.loading(`جاري الاسترداد الجزئي للفاتورة ${invoiceLabel}...`, { id: toastId });
    try {
      const result = await refundInvoicePartialCloud(invoiceLabel, itemsToRefund, operationId);
      if (!result.success) {
        toast.error(`فشل الاسترداد الجزئي: ${result.error}`, { id: toastId, duration: 5000 });
        return;
      }

      // Invalidate and reload
      invalidateInvoicesCache();
      const [updatedInvoices, statsData] = await Promise.all([
        loadInvoicesCloud(),
        getInvoiceStatsCloud()
      ]);
      setInvoices(updatedInvoices);
      setStats(statsData);

      try {
        invalidateProductsCache();
        refreshProductsFromCloud().then(() => {
          emitEvent(EVENTS.PRODUCTS_UPDATED, null);
        }).catch(() => {});
      } catch (e) { /* noop */ }

      const lines: string[] = [
        `💵 قيمة المرتجع: ${formatCurrency(result.refundedAmount, invoice.currency)}`
      ];
      if (result.cashToRefund > 0) {
        lines.push(`💰 يُرجع نقداً للعميل ومن الوردية: ${formatCurrency(result.cashToRefund, invoice.currency)}`);
      }
      if (result.debtReduced > 0) {
        lines.push(`📉 تخفيض الدين: ${formatCurrency(result.debtReduced, invoice.currency)}`);
      }
      lines.push(`📦 أُعيدت ${formatNumber(result.restoredUnitsCount)} قطعة`);

      toast.success(result.isFullyRefunded ? `✅ تم استرداد كامل الفاتورة ${invoiceLabel}` : `✅ تم الاسترداد الجزئي للفاتورة ${invoiceLabel}`, {
        id: toastId,
        description: lines.join(' • '),
        duration: 5000,
      });

      const usdSym = currencySymbols?.USD || '$';
      const partialRefundDesc = `{t('invoices.partialRefund') || 'استرداد جزئي'} للفاتورة ${invoiceLabel}: بقيمة ${usdSym}${roundCurrency(result.refundedAmount)} ${result.debtReduced > 0 ? `(تخفيض دين: ${usdSym}${formatNumber(result.debtReduced)})` : ''} ${result.cashToRefund > 0 ? `(إرجاع نقدي: ${usdSym}${formatNumber(result.cashToRefund)})` : ''}`;

      void logActivity('invoice_refunded', partialRefundDesc, {
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.customerName,
        snapshot: {
          invoiceNumber: invoice.id,
          customerName: invoice.customerName,
          refundedAmount: result.refundedAmount,
          cashToRefund: result.cashToRefund,
          debtReduced: result.debtReduced,
          items: itemsToRefund.map(it => {
            const qty = it.quantityToRefund ?? it.quantity ?? 1;
            const price = it.unitPrice ?? 0;
            return {
              name: it.productName,
              quantity: qty,
              price: price,
              total: roundCurrency(price * qty),
            };
          }),
        },
      });
    } catch (err) {
      console.error('[confirmPartialRefund] error:', err);
      toast.error(`فشل الاسترداد الجزئي للفاتورة ${invoiceLabel}`, { id: toastId, duration: 4000 });
      const invoicesData = await loadInvoicesCloud();
      setInvoices(invoicesData);
    }
  });

  const handleMarkPaid = (invoice: Invoice) => markPaidGuard.run(async () => {
    let paidAmount = 0;
    try {
      paidAmount = await settleDebtsByInvoiceIdCloud(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تسجيل الدفعة');
      return;
    }
    await updateInvoiceCloud(invoice.id, { status: 'paid', debtPaid: invoice.total, debtRemaining: 0 });
    if (paidAmount > 0) {
      processDebtPayment(paidAmount);
      logActivity('debt_paid', `تسديد كامل لفاتورة ${invoice.id} بقيمة $${paidAmount} - ${invoice.customerName}`, {
        invoiceId: invoice.id,
        customerName: invoice.customerName,
        amount: paidAmount,
        remainingAfter: 0,
      }).catch(() => undefined);
      confirmPendingProfit(invoice.id);
      await confirmPendingProfitCloud(invoice.id).catch(err => console.warn('[handleMarkPaid] confirm profit failed:', err));
    }
    const invoicesData = await loadInvoicesCloud();
    setInvoices(invoicesData);
    toast.success(t('invoices.statusUpdated'));
  });

  // ✅ دالة تعقيم HTML لمنع XSS في template الطباعة
  // القيم المُدخَلة من المستخدم (أسماء المنتجات/العملاء/العناوين) قد تحتوي على
  // رموز HTML خبيثة لو أُدرجت مباشرة في template string.
  const escapeHtml = (unsafe: string | null | undefined): string => {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // فتح نافذة تسديد الدفعة مباشرة داخل صفحة الفواتير
  const handlePayDebt = async (invoice: Invoice) => {
    if (invoice.status === 'refunded') {
      toast.warning('⚠️ هذا الدين مرتبط بفاتورة مستردة. لا يمكن تسديد هذا الدين.');
      return;
    }

    try {
      toast.loading('جاري تحميل بيانات الدين...', { id: 'loading-debt-dialog' });
      invalidateDebtsCache();
      const debtsList = await loadDebtsCloud();
      let targetDebt = debtsList.find(d => d.invoiceId === invoice.id || d.id === invoice.id);

      // إذا لم يكن الدين مسجلاً بعد في جدول الديون ننشئه من الفاتورة
      if (!targetDebt && invoice.paymentType === 'debt') {
        const remaining = (invoice.debtRemaining !== undefined && invoice.debtRemaining !== null) 
          ? invoice.debtRemaining 
          : invoice.total;
        if (remaining > 0) {
          targetDebt = await addDebtFromInvoiceCloud(
            invoice.id,
            invoice.customerName,
            invoice.customerPhone || '',
            remaining,
            invoice.dueDate
          );
        }
      }

      toast.dismiss('loading-debt-dialog');

      if (!targetDebt || targetDebt.remainingDebt <= 0) {
        toast.info('لا يوجد دين متبقي لهذه الفاتورة أو تم سدادها بالكامل');
        return;
      }

      paymentOpIdRef.current = `debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setSelectedDebtForPayment(targetDebt);
      setPaymentCurrency(loadDefaultCurrencyCode());
      setPaymentAmountInput('');
      setShowDebtPaymentDialog(true);
    } catch (err) {
      toast.dismiss('loading-debt-dialog');
      console.error('[Invoices] Error opening debt payment:', err);
      toast.error('تعذر جلب تفاصيل الدين للسداد');
    }
  };

  const handleConfirmDebtPayment = async () => {
    if (paymentBusyRef.current || isSubmittingPayment) return;
    if (!selectedDebtForPayment || amountUSD <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح للدفعة');
      return;
    }

    setIsSubmittingPayment(true);
    paymentBusyRef.current = true;

    try {
      invalidateDebtsCache();
      const latestList = await loadDebtsCloud();
      const latest = latestList.find(d => d.id === selectedDebtForPayment.id) || selectedDebtForPayment;
      const remainingNow = Math.round(latest.remainingDebt * 100) / 100;

      let finalPaymentUSD = amountUSD;
      if (finalPaymentUSD > remainingNow) {
        if (finalPaymentUSD - remainingNow <= 0.05) {
          finalPaymentUSD = remainingNow;
        } else {
          setSelectedDebtForPayment(latest);
          toast.error('المبلغ المدخل يتجاوز إجمالي الدين المتبقي');
          return;
        }
      }

      const paymentRatio = remainingNow > 0 ? finalPaymentUSD / remainingNow : 1;

      await recordPaymentWithInvoiceSyncCloud(selectedDebtForPayment.id, finalPaymentUSD, paymentOpIdRef.current);
      paymentOpIdRef.current = `debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // إضافة المبلغ للصندوق وتحديث الوردية
      processDebtPayment(
        finalPaymentUSD,
        (selectedDebtForPayment as any).customerId,
        user?.id,
        profile?.full_name || user?.email || 'مستخدم',
        paymentCurrency,
        parseFloat(paymentAmountInput) || finalPaymentUSD,
        'cash'
      );

      // تأكيد الأرباح المعلقة
      confirmPendingProfit(selectedDebtForPayment.invoiceId, paymentRatio);
      confirmPendingProfitCloud(selectedDebtForPayment.invoiceId, paymentRatio);

      // تحديث بيانات العميل فوراً
      try {
        const { loadCustomersCloud, updateCustomerStatsCloud, invalidateCustomersCache } = await import('@/lib/cloud/customers-cloud');
        invalidateInvoicesCache();
        invalidateCustomersCache();
        const customers = await loadCustomersCloud();
        const customer = customers.find(c =>
          c.name.trim().toLowerCase() === (selectedDebtForPayment.customerName || '').trim().toLowerCase() ||
          (selectedDebtForPayment.customerPhone && c.phone === selectedDebtForPayment.customerPhone)
        );
        if (customer) await updateCustomerStatsCloud(customer.id);
      } catch (err) {
        console.warn('[Invoices] Failed to update customer stats:', err);
      }
      emitEvent(EVENTS.CUSTOMERS_UPDATED, null);

      // تسجيل في سجل النشاطات
      if (user) {
        const currDesc = paymentCurrency !== 'USD'
          ? `${paymentAmountInput} ${paymentCurrency} (يعادل $${formatNumber(finalPaymentUSD)} بسعر صرف ${currentRate})`
          : `$${formatNumber(finalPaymentUSD)}`;
        addActivityLog(
          'debt_paid',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `تسديد دفعة دين ${currDesc} - ${selectedDebtForPayment.customerName}`,
          {
            debtId: selectedDebtForPayment.id,
            invoiceId: selectedDebtForPayment.invoiceId,
            customerName: selectedDebtForPayment.customerName,
            amountUSD: finalPaymentUSD,
            amountInCurrency: parseFloat(paymentAmountInput) || finalPaymentUSD,
            currency: paymentCurrency,
            rate: currentRate,
            paymentMethod: 'cash',
            totalDebt: latest.totalDebt,
            remainingBefore: remainingNow,
            remainingAfter: Math.max(0, Math.round((remainingNow - finalPaymentUSD) * 100) / 100),
          }
        );
      }

      // تحديث قائمة الفواتير والإحصائيات في الصفحة مباشرة
      invalidateInvoicesCache();
      const [updatedInvoices, updatedStats] = await Promise.all([
        loadInvoicesCloud(),
        getInvoiceStatsCloud()
      ]);
      setInvoices(updatedInvoices);
      setStats(updatedStats);
      emitEvent(EVENTS.INVOICES_UPDATED, null);

      setShowDebtPaymentDialog(false);
      setSelectedDebtForPayment(null);
      setPaymentAmountInput('');
      toast.success('تم تسجيل الدفعة بنجاح');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تسجيل الدفعة');
    } finally {
      paymentBusyRef.current = false;
      setIsSubmittingPayment(false);
    }
  };

  const handlePrint = (invoice: Invoice) => {
    // Dynamic store settings with proper defaults
    const storeDefaults = {
      storeName: 'HyperPOS Store',
      storeAddress: '',
      storePhone: '',
      storeLogo: '',
      footer: 'شكراً لتعاملكم معنا!',
      currencySymbol: currencySymbols?.USD || '$'
    };

    let storeConfig = { ...storeDefaults };

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeConfig = {
          storeName: settings.storeSettings?.name || storeDefaults.storeName,
          storeAddress: settings.storeSettings?.address || storeDefaults.storeAddress,
          storePhone: settings.storeSettings?.phone || storeDefaults.storePhone,
          storeLogo: settings.storeSettings?.logo || storeDefaults.storeLogo,
          footer: settings.printSettings?.footer || storeDefaults.footer,
          currencySymbol: settings.currencySymbol || storeDefaults.currencySymbol,
        };
      }
    } catch (error) {
      console.error('Failed to load store settings for print:', error);
      toast.error(t('invoices.printSettingsError'));
    }

    const { storeName, storeAddress, storePhone, storeLogo, footer } = storeConfig;

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');
    const time = new Date(invoice.createdAt).toLocaleTimeString('ar-SA');

    const printFinancials = getInvoiceFinancials(invoice, true);
    // ✅ جميع القيم المُدخَلة من المستخدم تمر عبر escapeHtml() لمنع XSS
    const itemsHtml = invoice.type === 'sale'
      ? invoice.items.filter(item => !item.refunded && item.quantity > 0).map(item => `
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${formatCurrency(item.total * printFinancials.rate, printFinancials.symbol, printFinancials.decimals)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" style="padding: 10px;">
          <div style="margin-bottom: 5px;"><strong>وصف الخدمة:</strong> ${escapeHtml(invoice.serviceDescription) || 'صيانة'}</div>
          ${invoice.partsCost ? `<div style="margin-bottom: 5px;"><strong>تكلفة القطع:</strong> ${formatCurrency(invoice.partsCost * printFinancials.rate, printFinancials.symbol, printFinancials.decimals)}</div>` : ''}
          <div><strong>المبلغ المقبوض:</strong> ${formatCurrency(printFinancials.displayTotal, printFinancials.symbol, printFinancials.decimals)}</div>
          ${printFinancials.displayProfit > 0 ? `<div style="color: green;"><strong>صافي الربح:</strong> ${formatCurrency(printFinancials.displayProfit, printFinancials.symbol, printFinancials.decimals)}</div>` : ''}
        </td></tr>`;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <title>فاتورة - ${invoice.id}</title>
          <style>
            /* Reset & Base - Mobile First */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { 
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
              padding: 10px; 
              max-width: 80mm; 
              margin: 0 auto; 
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            
            /* Header */
            .header { 
              text-align: center; 
              margin-bottom: 15px; 
              border-bottom: 2px dashed #333; 
              padding-bottom: 12px; 
            }
            .logo { 
              max-width: 60px; 
              max-height: 60px; 
              margin: 0 auto 8px; 
              display: block; 
              object-fit: contain;
            }
            .store-name { 
              font-size: 1.3em; 
              font-weight: bold; 
              margin: 5px 0; 
              word-wrap: break-word;
            }
            .store-info { 
              font-size: 0.85em; 
              color: #555; 
              word-wrap: break-word;
            }
            
            /* Invoice Info */
            .invoice-info { 
              margin: 12px 0; 
              font-size: 0.9em; 
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 10px;
              background: #fafafa;
            }
            .invoice-info > div { 
              padding: 3px 0; 
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
            }
            .invoice-info strong { 
              color: #333;
              min-width: 80px;
            }
            
            /* Table */
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 12px 0; 
              font-size: 0.9em;
            }
            th { 
              background: #333; 
              color: #fff;
              padding: 8px 5px; 
              text-align: right; 
              font-size: 0.85em;
            }
            td { 
              padding: 8px 5px; 
              border-bottom: 1px solid #eee; 
              vertical-align: top;
              word-wrap: break-word;
              max-width: 120px;
            }
            td:first-child {
              max-width: 45%;
              overflow-wrap: break-word;
              hyphens: auto;
            }
            td:nth-child(2) { text-align: center; width: 20%; }
            td:nth-child(3) { text-align: left; width: 25%; white-space: nowrap; }
            
            /* Service description for maintenance */
            .service-desc {
              white-space: pre-wrap;
              word-wrap: break-word;
              line-height: 1.5;
            }
            
            /* Discount */
            .discount-row {
              text-align: left;
              padding: 5px 0;
              color: #c00;
              font-weight: 500;
            }
            
            /* Total */
            .total { 
              font-size: 1.2em; 
              font-weight: bold; 
              margin-top: 12px; 
              border-top: 2px solid #333; 
              padding-top: 10px; 
              text-align: center;
              background: #f5f5f5;
              padding: 12px;
              border-radius: 6px;
            }
            
            /* Footer */
            .footer { 
              text-align: center; 
              margin-top: 20px; 
              font-size: 0.8em; 
              color: #666;
              border-top: 1px dashed #ccc;
              padding-top: 12px;
            }
            
            /* Print Styles */
            @media print {
              body { padding: 5px; max-width: 100%; }
              .header { page-break-after: avoid; }
              table { page-break-inside: avoid; }
              .total { page-break-before: avoid; }
              @page { 
                size: 80mm auto; 
                margin: 5mm; 
              }
            }
            
            /* Mobile Optimization */
            @media screen and (max-width: 320px) {
              body { font-size: 11px; padding: 8px; }
              .store-name { font-size: 1.1em; }
              td { padding: 6px 3px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeLogo ? `<img src="${escapeHtml(storeLogo)}" alt="شعار" class="logo" onerror="this.style.display='none'" />` : ''}
            <div class="store-name">${escapeHtml(storeName)}</div>
            ${storeAddress ? `<div class="store-info">${escapeHtml(storeAddress)}</div>` : ''}
            ${storePhone ? `<div class="store-info">${escapeHtml(storePhone)}</div>` : ''}
          </div>
          <div class="invoice-info">
            <div><strong>رقم الفاتورة:</strong> <span>${escapeHtml(invoice.id)}</span></div>
            <div><strong>التاريخ:</strong> <span>${escapeHtml(date)} - ${escapeHtml(time)}</span></div>
            <div><strong>العميل:</strong> <span>${escapeHtml(invoice.customerName)}</span></div>
            ${invoice.customerPhone ? `<div><strong>الهاتف:</strong> <span>${escapeHtml(invoice.customerPhone)}</span></div>` : ''}
            <div><strong>النوع:</strong> <span>${invoice.type === 'sale' ? 'مبيعات' : 'صيانة'}</span></div>
            <div><strong>الدفع:</strong> <span>${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>البيان</th>
                <th>الكمية</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${invoice.discount > 0 ? `<div class="discount-row">خصم: ${formatCurrency(invoice.discount * printFinancials.rate, printFinancials.symbol, printFinancials.decimals)}</div>` : ''}
          ${invoice.taxAmount && invoice.taxAmount > 0 ? `<div class="discount-row" style="color: #555;">ضريبة${invoice.taxRate ? ` (${invoice.taxRate}%)` : ''}: ${formatCurrency(invoice.taxAmount * printFinancials.rate, printFinancials.symbol, printFinancials.decimals)}</div>` : ''}
          <div class="total">
            الإجمالي: ${formatCurrency(printFinancials.displayTotal, printFinancials.symbol, printFinancials.decimals)}
            ${printFinancials.code !== 'USD' ? `<div style="font-size: 11px; font-weight: normal; color: #555; margin-top: 3px; font-family: monospace;" dir="ltr">(ما يعادل بالدولار: ${currencySymbols?.USD || '$'}${formatNumber(invoice.total || 0, 2)})</div>` : ''}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;

    // استخدام iframe للطباعة بدلاً من window.open
    printHTML(printContent);
    toast.success('جاري إرسال الفاتورة للطابعة...');
  };
  const handleShare = (invoice: Invoice) => {
    setInvoiceToShare(invoice);
    setShowShareSheet(true);
  };

  const executeShareInvoice = async (invoice: Invoice, mode: 'image' | 'text' = 'image') => {
    setIsGeneratingShare(true);
    try {
      let storeName = 'FlowPOS Pro';
      let storePhone = '';
      let storeAddress = '';
      let storeLogo = '';

      try {
        const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
        if (settingsRaw) {
          const settings = JSON.parse(settingsRaw);
          storeName = settings.storeSettings?.name || storeName;
          storePhone = settings.storeSettings?.phone || '';
          storeAddress = settings.storeSettings?.address || '';
          storeLogo = settings.storeSettings?.logo || '';
        }
      } catch (error) {
        console.error('Failed to load store settings for share:', error);
      }

      const localeMap: Record<string, string> = { en: 'en-US', tr: 'tr-TR', fa: 'fa-IR', ku: 'ckb-IQ', ar: 'ar-SA' };
      const date = new Date(invoice.createdAt).toLocaleDateString(localeMap[language] || 'ar-SA');
      const shareFinancials = getInvoiceFinancials(invoice, true);
      const rate = shareFinancials.rate;
      const currencySymbol = shareFinancials.symbol;

      const shareData: InvoiceShareData = {
        id: invoice.id,
        storeName,
        storePhone,
        storeAddress,
        storeLogo,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        date,
        items: invoice.items.filter(item => !item.refunded && item.quantity > 0).map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price * rate,
          total: item.total * rate,
        })),
        subtotal: (invoice.subtotal || 0) * rate,
        discount: (invoice.discount || 0) * rate,
        total: shareFinancials.displayTotal,
        currencySymbol,
        currency: shareFinancials.code,
        exchangeRate: rate,
        totalUSD: invoice.total,
        paymentType: invoice.paymentType,
        downPayment: invoice.debtPaid ? invoice.debtPaid * rate : undefined,
        debtRemaining: ((invoice.debtRemaining !== undefined && invoice.debtRemaining !== null) ? invoice.debtRemaining : (invoice.paymentType === 'debt' ? invoice.total : 0)) * rate,
        serviceDescription: invoice.serviceDescription,
        type: invoice.type,
        taxAmount: invoice.taxAmount ? invoice.taxAmount * rate : 0,
        taxRate: invoice.taxRate,
      };

      if (mode === 'text') {
        const text = generateInvoiceShareText(shareData);
        await nativeShare({
          title: `${t('invoices.invoiceNumber') || (language === 'en' ? 'Invoice #' : 'فاتورة رقم')} ${invoice.id}`,
          text,
          dialogTitle: t('invoices.shareAsText') || (language === 'en' ? 'Share Invoice Text' : 'مشاركة نص الفاتورة'),
        });
        setShowShareSheet(false);
      } else {
        toast.info(t('invoices.generatingShareImage') || (language === 'en' ? 'Generating invoice image for sharing...' : 'جاري إنشاء صورة الفاتورة للمشاركة...'), { duration: 1500 });
        const success = await shareInvoice(shareData);
        if (success) {
          setShowShareSheet(false);
        }
      }
    } catch (err: any) {
      console.error('Error during invoice share:', err);
      toast.error(t('invoices.invoiceShareFailed') || (language === 'en' ? 'Failed to share invoice' : 'تعذر مشاركة الفاتورة'));
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleCopyShareText = async (invoice: Invoice) => {
    try {
      let storeName = 'FlowPOS Pro';
      let storePhone = '';
      try {
        const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
        if (settingsRaw) {
          const settings = JSON.parse(settingsRaw);
          storeName = settings.storeSettings?.name || storeName;
          storePhone = settings.storeSettings?.phone || '';
        }
      } catch (e) {}

      const localeMap: Record<string, string> = { en: 'en-US', tr: 'tr-TR', fa: 'fa-IR', ku: 'ckb-IQ', ar: 'ar-SA' };
      const date = new Date(invoice.createdAt).toLocaleDateString(localeMap[language] || 'ar-SA');
      const shareFinancials = getInvoiceFinancials(invoice, true);
      const rate = shareFinancials.rate;

      const shareData: InvoiceShareData = {
        id: invoice.id,
        storeName,
        storePhone,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        date,
        items: invoice.items.filter(item => !item.refunded && item.quantity > 0).map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price * rate,
          total: item.total * rate,
        })),
        subtotal: (invoice.subtotal || 0) * rate,
        discount: (invoice.discount || 0) * rate,
        total: shareFinancials.displayTotal,
        currencySymbol: shareFinancials.symbol,
        currency: shareFinancials.code,
        exchangeRate: rate,
        totalUSD: invoice.total,
        paymentType: invoice.paymentType,
      };
      const text = generateInvoiceShareText(shareData);
      await navigator.clipboard.writeText(text);
      toast.success(t('invoices.invoiceCopied') || (language === 'en' ? 'Invoice details copied successfully' : 'تم نسخ تفاصيل الفاتورة بنجاح'));
    } catch (e) {
      toast.error(t('invoices.invoiceCopyFailed') || (language === 'en' ? 'Failed to copy invoice details' : 'تعذر نسخ تفاصيل الفاتورة'));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={t('invoices.title')}
        subtitle={t('invoices.subtitle')}
      />

      {/* Fixed 2-button segmented control (strictly non-scrollable) */}
      <div className="w-full sm:w-auto inline-flex p-1 rounded-2xl bg-muted/80 border border-border shadow-sm overflow-hidden select-none">
        <button
          type="button"
          onClick={() => setActiveMainTab('sales')}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 sm:flex-initial",
            activeMainTab === 'sales'
              ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{t('invoices.salesInvoices')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('purchases')}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 sm:flex-initial",
            activeMainTab === 'purchases'
              ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Truck className="w-4 h-4" />
          <span>{t('invoices.purchaseInvoices')}</span>
        </button>
      </div>

      <Tabs value={activeMainTab} onValueChange={(val: any) => setActiveMainTab(val)} className="w-full space-y-6">
        <TabsContent value="sales" className="space-y-3 m-0">
          {/* Interactive KPI Cards Strip */}
          <div className="grid grid-cols-4 gap-1.5 text-center select-none">
            {/* إجمالي الفواتير */}
            <button
              type="button"
              onClick={handleKpiTotal}
              className={cn(
                "py-2 px-1 rounded-xl border text-center transition-all select-none hover:shadow-xs cursor-pointer",
                activeKpi === 'total'
                  ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-xs"
                  : "bg-card border-border hover:border-primary/40 shadow-xs"
              )}
            >
              <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('invoices.totalInvoices')}</span>
              <span className="text-sm font-black text-foreground tabular-nums">{stats.total}</span>
            </button>
            {/* مؤجلة معلقة */}
            <button
              type="button"
              onClick={handleKpiDebt}
              className={cn(
                "py-2 px-1 rounded-xl border text-center transition-all select-none hover:shadow-xs cursor-pointer",
                activeKpi === 'debt'
                  ? "bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/40 shadow-xs"
                  : "bg-card border-border hover:border-orange-500/40 shadow-xs"
              )}
            >
              <span className="text-[9.5px] text-orange-600 dark:text-orange-400 font-medium block truncate">{t('invoices.pendingDeferred')}</span>
              <span className="text-sm font-black text-orange-600 dark:text-orange-400 tabular-nums">{stats.pendingDebts}</span>
            </button>
            {/* مبيعات اليوم */}
            <button
              type="button"
              onClick={handleKpiToday}
              className={cn(
                "py-2 px-1 rounded-xl border text-center transition-all select-none hover:shadow-xs cursor-pointer",
                activeKpi === 'today'
                  ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xs"
                  : "bg-card border-border hover:border-emerald-500/40 shadow-xs"
              )}
            >
              <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('invoices.todaySales')}</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                {formatCurrency(todaySalesDisplay, statCurrencySymbol, statDecimals)}
              </span>
            </button>
            {/* إجمالي الأرباح */}
            <button
              type="button"
              onClick={handleKpiProfit}
              className={cn(
                "py-2 px-1 rounded-xl border text-center transition-all select-none hover:shadow-xs cursor-pointer",
                activeKpi === 'profit'
                  ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-xs"
                  : "bg-card border-border hover:border-primary/40 shadow-xs"
              )}
            >
              <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('invoices.totalProfits')}</span>
              <span className="text-xs font-black text-primary font-mono whitespace-nowrap">
                {formatCurrency(totalProfitDisplay, statCurrencySymbol, statDecimals)}
              </span>
            </button>
          </div>

          {/* Filters & Quick Date Pills */}
          <div className="space-y-2">
            {/* Quick Date Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {[
                { id: 'today' as const, key: 'reports.today', fallback: 'اليوم' },
                { id: 'week' as const, key: 'reports.thisWeek', fallback: 'هذا الأسبوع' },
                { id: 'month' as const, key: 'reports.thisMonth', fallback: 'هذا الشهر' },
                { id: 'year' as const, key: 'reports.thisYear', fallback: 'هذا العام' },
                { id: 'all' as const, key: 'invoices.allInvoices', fallback: 'كل الفواتير' },
              ].map((pill) => {
                const isActive = dateQuickFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      if (pill.id === 'today') {
                        setDateQuickFilter('today');
                        setDateFilter(todayStr);
                        setActiveKpi('today');
                      } else if (pill.id === 'week') {
                        setDateQuickFilter('week');
                        setDateFilter('');
                        setActiveKpi(null);
                      } else if (pill.id === 'month') {
                        setDateQuickFilter('month');
                        setDateFilter('');
                        setActiveKpi(null);
                      } else if (pill.id === 'year') {
                        setDateQuickFilter('year');
                        setDateFilter('');
                        setActiveKpi(null);
                      } else {
                        setDateQuickFilter('all');
                        setDateFilter('');
                        setActiveKpi('total');
                      }
                    }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {t(pill.key as any) || pill.fallback}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={t('invoices.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pr-9 text-xs bg-card border-border rounded-xl font-medium shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <div className="min-w-0">
                <Select
                  value={filterType}
                  onValueChange={(v: 'all' | InvoiceType) => {
                    setFilterType(v);
                    setActiveKpi(null);
                  }}
                >
                  <SelectTrigger className="h-8 px-2 text-[11px] bg-card border-border rounded-xl"><SelectValue placeholder={t('invoices.invoiceType')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('invoices.allTypes')}</SelectItem>
                    <SelectItem value="sale">{t('invoices.sales')}</SelectItem>
                    <SelectItem value="maintenance">{t('invoices.maintenance')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Select
                  value={filterPayment}
                  onValueChange={(v: 'all' | 'cash' | 'debt') => {
                    setFilterPayment(v);
                    setActiveKpi(null);
                  }}
                >
                  <SelectTrigger className="h-8 px-2 text-[11px] bg-card border-border rounded-xl"><SelectValue placeholder={t('invoices.paymentMethod')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('invoices.cashAndCredit')}</SelectItem>
                    <SelectItem value="cash">{t('invoices.cash')}</SelectItem>
                    <SelectItem value="debt">{t('invoices.credit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Select value={displayCurrencyFilter} onValueChange={(v: any) => setDisplayCurrencyFilter(v)}>
                  <SelectTrigger className="h-8 px-2 text-[11px] bg-card border-border rounded-xl"><SelectValue placeholder={t('invoices.displayCurrency')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stored">{t('invoices.asInInvoice')}</SelectItem>
                    {enabledCurrencies.TRY && <SelectItem value="TRY">{currencySymbols?.TRY || '₺'} {currencyNames?.TRY || t('currencies.try')}</SelectItem>}
                    {enabledCurrencies.SYP && <SelectItem value="SYP">{currencySymbols?.SYP || 'ل.س'} {currencyNames?.SYP || t('currencies.syp')}</SelectItem>}
                    {enabledCurrencies.USD !== false && <SelectItem value="USD">$ {t('currencies.usd')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 flex items-center gap-1">
                <DatePicker
                  value={dateFilter}
                  onChange={(val) => {
                    setDateFilter(val);
                    if (val) {
                      setDateQuickFilter('custom');
                      setActiveKpi(null);
                    } else {
                      setDateQuickFilter('all');
                      setActiveKpi('total');
                    }
                  }}
                  placeholder={t('common.allDates')}
                  className="w-full min-w-0 h-8 px-2 text-[11px] bg-card border-border rounded-xl gap-1 [&_svg]:size-3"
                  highlightedDates={salesInvoiceDates}
                />
                {dateFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => {
                      setDateFilter('');
                      setDateQuickFilter('all');
                      setActiveKpi('total');
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Slim فواتير مستردة Strip & Counter */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setShowRefunded(v => !v)}
                className={cn(
                  "rounded-xl border py-1.5 px-3 flex items-center gap-2 text-[11px] font-bold transition-all shadow-xs select-none",
                  showRefunded
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>{t('invoices.refundedInvoices')}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.2 rounded-full font-bold",
                  showRefunded ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {invoices.filter(i => i.status === 'refunded').length}
                </span>
              </button>

              <span className="text-muted-foreground text-[10.5px] font-semibold">
                {filteredInvoices.length} {t('invoices.displayedInvoices')}
              </span>
            </div>
          </div>

          {/* Invoices List */}
          <div className="space-y-2.5">
            {isLoading ? (
              // Skeleton loading state
              [1, 2, 3, 4, 5].map(i => (
                <Card key={i} className="rounded-2xl border-border bg-card">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="w-9 h-9 rounded-xl" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredInvoices.length === 0 ? (
              <Card className="rounded-2xl border-border bg-card">
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('invoices.noInvoices')}</p>
                </CardContent>
              </Card>
            ) : (
              filteredInvoices.map((invoice) => {
                const financials = getInvoiceFinancials(invoice);
                const invUsdTotal = invoice.total || 0;
                const invUsdProfit = financials.baseProfit || 0;
                const invUpper = (invoice.currency || 'USD').toUpperCase();
                const itemCount = invoice.items?.filter(it => !it.refunded && it.quantity > 0).length || 0;

                return (
                  <div
                    key={invoice.id}
                    onClick={() => handleView(invoice)}
                    className="invoice-card bg-card text-card-foreground rounded-xl p-3 border border-border/80 shadow-xs relative hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer select-none"
                  >
                    {/* زر الخيارات ثلاثي النقاط - أعلى اليسار */}
                    <div className="absolute left-2.5 top-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted active:scale-90 transition-transform">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44 text-xs font-bold">
                          <DropdownMenuItem onClick={() => handleView(invoice)} className="justify-between cursor-pointer">
                            <span>{t('common.view')}</span>
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(invoice)} className="justify-between cursor-pointer">
                            <span>{t('common.share')}</span>
                            <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </DropdownMenuItem>
                          {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handlePayDebt(invoice)} className="justify-between cursor-pointer">
                                <span>{t('invoices.payInstallment')}</span>
                                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkPaid(invoice)} className="justify-between cursor-pointer">
                                <span>{t('invoices.markAsPaid')}</span>
                                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                              </DropdownMenuItem>
                            </>
                          )}
                          {invoice.status !== 'refunded' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRefund(invoice)} className="justify-between text-destructive cursor-pointer">
                                <span>{t('invoices.refundInvoice')}</span>
                                <Undo2 className="w-3.5 h-3.5 text-destructive" />
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* السطر الأول: اسم العميل والشارات الأساسية */}
                    <div className="flex items-center flex-wrap gap-1.5 pr-0 pl-8 leading-tight">
                      <span className="font-bold text-foreground text-xs">{invoice.customerName}</span>
                      
                      {/* طريقة الدفع */}
                      {invoice.paymentType === 'cash' ? (
                        <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[9.5px] font-bold px-1.5 py-0.5 rounded">
                          {t('invoices.cash') || 'نقدي'}
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9.5px] font-bold px-1.5 py-0.5 rounded">
                          {t('invoices.credit') || 'بيع مؤجل'}
                        </span>
                      )}

                      {/* حالة الدفع للديون فقط (لا تظهر للفواتير النقدية لمنع التكرار) */}
                      {invoice.paymentType === 'debt' && (
                        invoice.status === 'paid' ? (
                          <span className="bg-emerald-600 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded">
                            {t('invoices.paid') || 'تم السداد'}
                          </span>
                        ) : (invoice.debtPaid && invoice.debtPaid > 0) ? (
                          <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[8.5px] font-bold px-1.5 py-0.5 rounded">
                            {t('invoices.partiallyPaid') || 'مدفوع جزئياً'}
                          </span>
                        ) : (
                          <span className="bg-destructive/15 text-destructive border border-destructive/30 text-[8.5px] font-bold px-1.5 py-0.5 rounded">
                            {t('invoices.unpaid') || 'غير مدفوع'}
                          </span>
                        )
                      )}

                      {/* شارة الاسترداد إن وجدت */}
                      {invoice.status === 'refunded' && (
                        <span className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[8.5px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Undo2 className="w-2.5 h-2.5" />
                          {t('invoices.refunded') || 'مستردة'}
                        </span>
                      )}

                      {/* حالة فحص الفاتورة المستردة */}
                      {refundMeta[invoice.id] && (
                        <span className="text-[8.5px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-medium">
                          {refundMeta[invoice.id].condition === 'damaged' ? t('invoices.conditionDefective') : t('invoices.conditionGood')}
                        </span>
                      )}

                      {/* شارة حالة المزامنة غير المكتملة */}
                      {invoice.pending_sync && (
                        <span className={cn(
                          "text-[8.5px] px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1",
                          invoice.sync_failed
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        )}>
                          {invoice.sync_failed ? (t('invoices.syncFailed') || 'فشل الرفع ⚠️') : (t('invoices.syncPending') || 'قيد المزامنة ⏳')}
                        </span>
                      )}

                      {/* شارة الكاشير */}
                      {invoice.cashierName && (
                        <span className="mr-auto text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                          <User className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                          <span>{invoice.cashierName}</span>
                        </span>
                      )}
                    </div>

                    {/* السطر الثاني: البيانات الوصفية (رقم الفاتورة، التاريخ، عدد المنتجات) */}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      <span className="bg-muted text-foreground/90 font-mono px-1.5 py-0.5 rounded font-semibold text-[9.5px]">
                        #{invoice.id}
                      </span>
                      <span dir="ltr" className="font-mono text-[9.5px]">
                        {formatDateTime(new Date(invoice.createdAt))}
                      </span>
                      <span className="flex items-center gap-1 font-medium mr-auto">
                        <ShoppingCart className="w-3 h-3 text-muted-foreground/70" />
                        <span>{itemCount} {t('invoices.items') || 'عنصر'}</span>
                      </span>
                    </div>

                    {/* السطر الثالث والأخير: البيانات المالية بهندسة مريحة للعين وبدون مربعات معقدة */}
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                      {/* يمين: إجمالي الفاتورة وقيمتها المعروضة والمقابلة بالدولار */}
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-medium">{t('common.total') || 'الإجمالي'}:</span>
                        {financials.code === 'USD' ? (
                          <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-[13px] whitespace-nowrap">
                            {currencySymbols?.USD || '$'}{formatNumber(invUsdTotal, invUsdTotal % 1 === 0 ? 0 : 2)}
                          </span>
                        ) : (
                          <div className="inline-flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-black text-foreground font-mono text-[13px] whitespace-nowrap">
                              {formatNumber(financials.displayTotal, financials.decimals)} <span className="text-[10.5px] font-sans font-bold text-muted-foreground">{financials.symbol}</span>
                            </span>
                            <span className="text-[9.5px] font-mono text-muted-foreground/80 whitespace-nowrap" dir="ltr">
                              ({currencySymbols?.USD || '$'}{formatNumber(invUsdTotal, invUsdTotal % 1 === 0 ? 0 : 2)})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* يسار: صافي الربح بدون حشو نصي وبألوان دلالية واضحة */}
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-medium">{t('invoices.netProfit') || 'الربح'}:</span>
                        {financials.code === 'USD' ? (
                          <span className={cn(
                            "font-bold font-mono text-[11px] whitespace-nowrap",
                            invUsdProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          )}>
                            {currencySymbols?.USD || '$'}{formatNumber(invUsdProfit, invUsdProfit % 1 === 0 ? 0 : 2)}
                          </span>
                        ) : (
                          <div className="inline-flex items-baseline gap-1.5 flex-wrap">
                            <span className={cn(
                              "font-bold font-mono text-[11px] whitespace-nowrap",
                              financials.displayProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {formatNumber(financials.displayProfit, financials.decimals)} <span className="text-[9.5px] font-sans font-bold text-muted-foreground">{financials.symbol}</span>
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground/70 whitespace-nowrap" dir="ltr">
                              ({currencySymbols?.USD || '$'}{formatNumber(invUsdProfit, invUsdProfit % 1 === 0 ? 0 : 2)})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

    <TabsContent value="purchases" className="space-y-6 m-0">
      <PurchaseInvoicesListTab />
    </TabsContent>
  </Tabs>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg rounded-3xl modal-dot-expand overflow-hidden max-h-[92vh] flex flex-col p-0 border border-border bg-card text-card-foreground shadow-2xl">
          <DialogHeader className="p-4 pb-3 border-b border-border/50 text-right bg-muted/30">
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <div className="flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-primary" />
                <span>{t('invoices.details') || 'تفاصيل الفاتورة'}</span>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">تفاصيل الفاتورة الكاملة</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (() => {
            const selectedFinancials = getInvoiceFinancials(selectedInvoice, true);
            const baseInvTotal = selectedInvoice.total || 0;
            const c1Name = currencyNames?.TRY || 'ليرة تركية';
            const c2Name = currencyNames?.SYP || 'ليرة سورية';
            const c1Rate = (selectedInvoice.currency === 'TRY' && typeof selectedInvoice.exchangeRate === 'number' && selectedInvoice.exchangeRate > 0)
              ? selectedInvoice.exchangeRate
              : ((exchangeRates.TRY && exchangeRates.TRY > 0) ? exchangeRates.TRY : 34);
            const c2Rate = (selectedInvoice.currency === 'SYP' && typeof selectedInvoice.exchangeRate === 'number' && selectedInvoice.exchangeRate > 0)
              ? selectedInvoice.exchangeRate
              : ((exchangeRates.SYP && exchangeRates.SYP > 0) ? exchangeRates.SYP : 14500);

            const c1Symbol = selectedInvoice.currency === 'TRY' ? (selectedInvoice.currencySymbol || currencySymbols?.TRY || '₺') : (currencySymbols?.TRY || '₺');
            const c2Symbol = selectedInvoice.currency === 'SYP' ? (selectedInvoice.currencySymbol || currencySymbols?.SYP || 'ل.س') : (currencySymbols?.SYP || 'ل.س');

            const totalUsdStr = formatCurrency(baseInvTotal, currencySymbols?.USD || '$', 2);
            const totalC1Str = formatCurrency(baseInvTotal * c1Rate, c1Symbol, c1Rate >= 100 ? 0 : 2);
            const totalC2Str = formatCurrency(baseInvTotal * c2Rate, c2Symbol, c2Rate >= 100 ? 0 : 2);

            return (
            <div className="space-y-4 p-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('invoices.invoiceNumber')}:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="font-semibold">{selectedInvoice.id}</p>
                    {selectedInvoice.pending_sync && (
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1",
                        selectedInvoice.sync_failed
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      )}>
                        {selectedInvoice.sync_failed ? (t('invoices.syncFailed') || 'فشل الرفع ⚠️') : (t('invoices.syncPending') || 'قيد المزامنة ⏳')}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.date')}:</span>
                  <p className="font-semibold" dir="ltr">
                    {formatDateTime(new Date(selectedInvoice.createdAt))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.customer')}:</span>
                  <p className="font-semibold">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.phone')}:</span>
                  <p className="font-semibold">{selectedInvoice.customerPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.type')}:</span>
                  <Badge variant={selectedInvoice.type === 'sale' ? 'default' : 'secondary'}>
                    {selectedInvoice.type === 'sale' ? t('invoices.sales') : t('invoices.maintenance')}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.payment')}:</span>
                  <Badge variant={selectedInvoice.paymentType === 'cash' ? 'default' : 'destructive'}>
                    {selectedInvoice.paymentType === 'cash' ? t('invoices.cash') : t('invoices.credit')}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.currency') || 'عملة الفاتورة'}:</span>
                  <p className="font-semibold flex items-center gap-1.5 flex-wrap">
                    <span>{currencyNames?.[selectedFinancials.code] || (selectedFinancials.code === 'TRY' ? c1Name : selectedFinancials.code === 'SYP' ? c2Name : (selectedFinancials.code === 'USD' ? (currencyNames?.USD || 'دولار أمريكي') : selectedFinancials.code))}</span>
                    {selectedFinancials.code !== 'USD' && (
                      <span className="text-xs text-muted-foreground font-normal">
                        (1{currencySymbols?.USD || '$'} = {formatNumber(selectedFinancials.rate)} {selectedFinancials.symbol}) | المعادل: {currencySymbols?.USD || '$'}{formatNumber(baseInvTotal, baseInvTotal % 1 === 0 ? 0 : 2)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {selectedInvoice.type === 'maintenance' && (
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">{t('invoices.maintenanceDetails') || 'تفاصيل الصيانة'}:</p>
                  {selectedInvoice.serviceDescription && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('invoices.descOrFault') || 'الوصف / نوع العطل'}:</span>
                      <span className="font-medium text-right max-w-[60%]">{selectedInvoice.serviceDescription}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('pos.receivedAmount') || 'المبلغ المقبوض'}:</span>
                    <span className="font-medium">{formatCurrency(selectedFinancials.displayTotal, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                  </div>
                  {selectedInvoice.partsCost !== undefined && selectedInvoice.partsCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('invoices.partsCost') || 'تكلفة القطع علينا'}:</span>
                      <span className="font-medium text-destructive">{formatCurrency((selectedInvoice.partsCost || 0) * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                    </div>
                  )}
                  {selectedFinancials.displayProfit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('invoices.netProfit')}:</span>
                      <span className="font-medium text-success">{formatCurrency(selectedFinancials.displayProfit, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedInvoice.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">{selectedInvoice.type === 'sale' ? t('invoices.products') : t('invoices.items')}:</span>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-2 text-right font-medium text-muted-foreground">{t('invoices.products') || 'المنتج'}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">{t('pos.quantity') || 'الكمية'}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">{t('pos.price') || 'السعر'}</th>
                          <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{t('pos.total') || 'المجموع'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx} className={cn("border-t border-muted/50", item.refunded && "opacity-60")}>
                            <td className="px-2 py-2 text-right whitespace-normal break-words leading-snug" dir="auto">
                              <span className={cn(item.refunded && "line-through")}>{item.name}</span>
                              {item.refunded && (
                                <span className="mr-2 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">{t('invoices.refunded') || 'مُسترد'}</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center whitespace-nowrap">{item.quantity}</td>
                            <td className="px-2 py-2 text-center whitespace-nowrap font-mono sm:font-sans">{formatCurrency(item.price * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</td>
                            <td className="px-2 py-2 text-left font-medium whitespace-nowrap font-mono sm:font-sans">{formatCurrency((item.refunded ? 0 : (item.price * item.quantity)) * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {selectedInvoice.subtotal !== undefined && selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t('invoices.subtotal') || 'المجموع قبل الخصم'}:</span>
                    <span>{formatCurrency(selectedInvoice.subtotal * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                  </div>
                )}
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('invoices.discount')}{selectedInvoice.discountPercentage ? ` (${selectedInvoice.discountPercentage}%)` : ''}:</span>
                    <span className="text-destructive">-{formatCurrency(selectedInvoice.discount * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline text-lg font-bold">
                  <span>{t('invoices.total')}:</span>
                  <div className="text-left">
                    <span className="text-primary">{formatCurrency(selectedFinancials.displayTotal, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                    {selectedFinancials.code !== 'USD' && (
                      <p className="text-xs font-normal text-muted-foreground" dir="ltr">
                        (ما يعادل بالدولار: {formatCurrency(baseInvTotal, currencySymbols?.USD || '$', 2)})
                      </p>
                    )}
                  </div>
                </div>
                {selectedInvoice.paymentType === 'debt' && selectedInvoice.status === 'pending' && selectedInvoice.debtPaid !== undefined && selectedInvoice.debtPaid > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t('invoices.paidCash') || 'المدفوع نقداً'}:</span>
                    <span className="font-medium text-success">{formatCurrency((selectedInvoice.debtPaid || 0) * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                  </div>
                )}
                {selectedInvoice.paymentType === 'debt' && selectedInvoice.status === 'pending' && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>{t('invoices.debtRemaining') || 'المتبقي (دين)'}:</span>
                    <span className="font-semibold">{formatCurrency(((selectedInvoice.debtRemaining !== undefined && selectedInvoice.debtRemaining !== null) ? selectedInvoice.debtRemaining : (selectedInvoice.total - (selectedInvoice.debtPaid || 0))) * selectedFinancials.rate, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                  </div>
                )}
                {selectedFinancials.displayProfit > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>{t('invoices.profit') || 'صافي الربح'}:</span>
                    <span className="font-semibold">{formatCurrency(selectedFinancials.displayProfit, selectedFinancials.symbol, selectedFinancials.decimals)}</span>
                  </div>
                )}
              </div>

              {/* قسم معادلة العملات أسفل الجدول والملخص المالي */}
              <div className="bg-muted/40 border border-border/70 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1.5 border-b border-border/40">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Coins className="w-3.5 h-3.5 text-primary" />
                    {t('invoices.currencyEquivalent') || 'معادلة العملات (إجمالي الفاتورة)'}:
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex justify-between items-center sm:flex-col sm:items-start bg-background/80 p-2 rounded-md border border-border/40">
                    <span className="text-muted-foreground text-[11px]">{t('invoices.valueInUSD') || 'القيمة بالدولار'}:</span>
                    <span className="font-bold text-foreground text-sm whitespace-nowrap" dir="ltr">{totalUsdStr}</span>
                  </div>
                  {Object.entries(enabledCurrencies).map(([code, isEnabled]) => {
                    const upper = code.toUpperCase();
                    if (!isEnabled || upper === 'USD') return null;
                    const r = (selectedInvoice.currency === upper && typeof selectedInvoice.exchangeRate === 'number' && selectedInvoice.exchangeRate > 0)
                      ? selectedInvoice.exchangeRate
                      : ((exchangeRates[upper] && exchangeRates[upper] > 0) ? exchangeRates[upper] : (upper === 'TRY' ? c1Rate : (upper === 'SYP' ? c2Rate : 1)));
                    const rawSym = (selectedInvoice.currency === upper && selectedFinancials.code === upper)
                      ? selectedFinancials.symbol
                      : (currencySymbols?.[upper] || (upper === 'TRY' ? c1Symbol : (upper === 'SYP' ? c2Symbol : upper)));
                    const sym = (rawSym && rawSym !== '$') ? rawSym : (currencySymbols?.[upper] || upper);
                    const name = currencyNames?.[upper] || (upper === 'TRY' ? c1Name : (upper === 'SYP' ? c2Name : upper));
                    const formatted = formatCurrency(baseInvTotal * r, sym, r >= 100 ? 0 : 2);
                    return (
                      <div key={upper} className="flex justify-between items-center sm:flex-col sm:items-start bg-background/80 p-2 rounded-md border border-border/40">
                        <span className="text-muted-foreground text-[11px]">القيمة بـ {name}:</span>
                        <span className="font-bold text-foreground text-sm whitespace-nowrap">{formatted}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 h-auto rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
                  onClick={() => {
                    setShowViewDialog(false);
                    handleShare(selectedInvoice);
                  }}
                >
                  <Share2 className="w-4 h-4 ml-2" />
                  <span>{t('common.share') || 'مشاركة الفاتورة'}</span>
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Share Bottom Sheet */}
      <Dialog open={showShareSheet} onOpenChange={setShowShareSheet}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 max-w-md mx-auto rounded-t-3xl rounded-b-none border-t border-border bg-card text-card-foreground p-0 max-h-[85vh] flex flex-col overflow-hidden shadow-2xl laser-sheet-content">
          {/* Laser Lead Line */}
          <div className="laser-lead-line h-[2.5px] w-full" />

          {/* Drawer Drag Handle */}
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2.5" />

          <DialogHeader className="px-5 pb-3 pt-0 text-right flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              <DialogTitle className="text-sm font-bold">
                {t('invoices.shareInvoice') || 'مشاركة الفاتورة'} {invoiceToShare?.id}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">نافذة مشاركة الفاتورة</DialogDescription>
          </DialogHeader>

          {invoiceToShare && (() => {
            const shareFin = getInvoiceFinancials(invoiceToShare, true);
            return (
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Invoice Snapshot Card */}
                <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-border/40">
                    <span className="font-bold text-foreground text-sm">{invoiceToShare.customerName}</span>
                    <Badge variant={invoiceToShare.type === 'sale' ? 'default' : 'secondary'} className="text-[10px]">
                      {invoiceToShare.type === 'sale' ? t('invoices.sales') : t('invoices.maintenance')}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>{t('invoices.invoiceNumber') || 'رقم الفاتورة'}:</span>
                    <span className="font-mono text-foreground font-semibold">{invoiceToShare.id}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>{t('invoices.date') || 'التاريخ'}:</span>
                    <span>{formatDateTime(new Date(invoiceToShare.createdAt))}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <span className="font-semibold text-foreground">{t('common.total')}:</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-base text-primary">
                        {formatCurrency(shareFin.displayTotal, shareFin.symbol, shareFin.decimals)}
                      </span>
                      {shareFin.code !== 'USD' && (
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          ({formatCurrency(invoiceToShare.total || 0, currencySymbols?.USD || '$', (invoiceToShare.total || 0) % 1 === 0 ? 0 : 2)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="space-y-2 pt-1">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 h-auto rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
                    disabled={isGeneratingShare}
                    onClick={() => executeShareInvoice(invoiceToShare, 'image')}
                  >
                    {isGeneratingShare ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        <span>{t('common.loading') || 'جاري استخراج ومشاركة الصورة...'}</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 ml-2" />
                        <span>{t('invoices.shareAsImage') || 'مشاركة كصورة (واتساب / تطبيقات)'}</span>
                      </>
                    )}
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl text-xs gap-1.5"
                      disabled={isGeneratingShare}
                      onClick={() => executeShareInvoice(invoiceToShare, 'text')}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t('invoices.shareAsText') || 'مشاركة كنص'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl text-xs gap-1.5"
                      disabled={isGeneratingShare}
                      onClick={() => handleCopyShareText(invoiceToShare)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {t('invoices.copyDetails') || 'نسخ التفاصيل'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog (Bottom Sheet) */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 max-w-xl mx-auto rounded-t-3xl rounded-b-none border-t border-border bg-card text-card-foreground p-0 max-h-[92vh] flex flex-col overflow-hidden shadow-2xl bottom-sheet-content">
          {/* Drawer Drag Handle */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2.5" />

          <DialogHeader className="px-6 pb-3 pt-0 text-right border-b border-border/40">
            <DialogTitle className="text-orange-600 flex items-center justify-between gap-2 text-base font-bold">
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5" />
                <span>{t('invoices.refundInvoice') || 'استرداد الفاتورة'} {invoiceToRefund?.id}</span>
              </div>
              {invoiceToRefund && (
                <Badge variant={invoiceToRefund.paymentType === 'cash' ? 'default' : 'destructive'} className="text-xs">
                  {invoiceToRefund.paymentType === 'cash' ? t('invoices.cash') : t('invoices.debtCredit')}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">استرداد الفاتورة</DialogDescription>
          </DialogHeader>

          {invoiceToRefund?.type === 'sale' && invoiceToRefund.items && invoiceToRefund.items.length > 0 && (
            <div className="sticky top-0 z-10 bg-background px-6 pt-1 pb-2">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={refundMode === 'full' ? 'default' : 'outline'} className="h-auto min-h-10 whitespace-normal text-xs gap-1.5" onClick={() => setRefundMode('full')}>
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  {t('invoices.fullRefund') || 'استرداد كلي'}
                </Button>
                <Button type="button" variant={refundMode === 'partial' ? 'default' : 'outline'} className="h-auto min-h-10 whitespace-normal text-xs gap-1.5" onClick={() => setRefundMode('partial')}>
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  {t('invoices.partialRefund') || 'استرداد جزئي'}
                </Button>
              </div>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            {/* Debt specific alert */}
            {invoiceToRefund?.paymentType === 'debt' && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 p-3.5 space-y-2 text-xs text-amber-900 dark:text-amber-200 text-right">
                <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{t('invoices.debtAlertTitle')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-1 bg-white/70 dark:bg-black/20 rounded p-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">{t('invoices.paidPreviously')} </span>
                    <span className="font-bold text-success">{formatCurrency((invoiceToRefund.debtPaid || 0) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('invoices.remainingCustomerDebt')} </span>
                    <span className="font-bold text-destructive">{formatCurrency((invoiceToRefund.debtRemaining ?? (invoiceToRefund.total - (invoiceToRefund.debtPaid || 0))) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                  </div>
                </div>
                <p className="leading-relaxed">
                  {refundMode === 'full' ? (
                    (invoiceToRefund.debtPaid || 0) > 0 ? (
                      language === 'en' ? (
                        <>
                          ⚠️ <strong>Cash refund to customer:</strong> The customer previously paid <strong>{formatCurrency((invoiceToRefund.debtPaid || 0) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</strong>. This amount must be paid to the customer in cash, <strong>and will be automatically deducted from the cash drawer / current shift</strong>, canceling all remaining debt.
                        </>
                      ) : language === 'tr' ? (
                        <>
                          ⚠️ <strong>Müşteriye Nakit İade:</strong> Müşteri daha önce <strong>{formatCurrency((invoiceToRefund.debtPaid || 0) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</strong> ödedi. Bu tutar müşteriye nakit olarak ödenmeli <strong>ve otomatik olarak kasa çekmecesinden / mevcut vardiyadan düşülecektir</strong>, kalan borç tamamen silinecektir.
                        </>
                      ) : language === 'fa' ? (
                        <>
                          ⚠️ <strong>بازپرداخت نقدی به مشتری:</strong> مشتری قبلاً <strong>{formatCurrency((invoiceToRefund.debtPaid || 0) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</strong> پرداخت کرده است. این مبلغ باید نقداً به مشتری پرداخت شود، <strong>و به طور خودکار از کشوی صندوق / شیفت فعلی کسر می‌شود</strong>، و باقیمانده بدهی کاملاً تسویه خواهد شد.
                        </>
                      ) : language === 'ku' ? (
                        <>
                          ⚠️ <strong>گەڕاندنەوەی نەختینە بۆ کڕیار:</strong> کڕیار پێشتر بڕی <strong>{formatCurrency((invoiceToRefund.debtPaid || 0) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</strong>ی داوە. پێویستە ئەم بڕە بە نەختینە بدرێتەوە بە کڕیار، <strong>و بە شێوەیەکی خۆکار لە سندووقی کاشێر / شیفتی ئێستا دەبڕدرێت</strong>، و تەواوی قەرزەکەی دەسڕدرێتەوە.
                        </>
                      ) : (
                        <>
                          ⚠️ <strong>إرجاع نقدي للعميل:</strong> قام العميل بسداد <strong>{formatCurrency((invoiceToRefund.debtPaid || 0) * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</strong> سابقاً. يجب تسليم هذا المبلغ للعميل نقداً، <strong>وسيتم خصمه تلقائياً من درج الكاشير / الوردية الحالية</strong>، وشطب باقي الدين بالكامل.
                        </>
                      )
                    ) : (
                      language === 'en'
                        ? 'The remaining customer debt will be canceled in full without affecting the cash drawer.'
                        : language === 'tr'
                        ? 'Kalan müşteri borcu kasa çekmecesini etkilemeden tamamen iptal edilecektir.'
                        : language === 'fa'
                        ? 'بدهی باقیمانده مشتری بدون تأثیر بر کشوی صندوق به طور کامل لغو خواهد شد.'
                        : language === 'ku'
                        ? 'تەواوی قەرزی ماوەی کڕیار دەسڕدرێتەوە و پووچەڵ دەکرێتەوە بەبێ ئەوەی کاریگەری لەسەر سندووقی کاشێر هەبێت.'
                        : 'سيتم إلغاء وشطب الدين المتبقي في ذمة العميل بالكامل دون التأثير على درج الكاشير.'
                    )
                  ) : (
                    partialRefundStats.cashToReturn > 0 ? (
                      language === 'en' ? (
                        <>
                          ⚠️ <strong>Cash refund to customer:</strong> The return value ({formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) exceeds remaining debt. The debt will be cleared and the difference <strong>({formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) returned in cash and deducted from current shift</strong>.
                        </>
                      ) : language === 'tr' ? (
                        <>
                          ⚠️ <strong>Müşteriye Nakit İade:</strong> İade tutarı ({formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) kalan borcu aşıyor. Borç tamamen kapatılacak ve fark <strong>({formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) müşteriye nakit iade edilip mevcut vardiyadan düşülecektir</strong>.
                        </>
                      ) : language === 'fa' ? (
                        <>
                          ⚠️ <strong>بازپرداخت نقدی به مشتری:</strong> ارزش مرجوعی ({formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) از بدهی باقیمانده بیشتر است. بدهی تسویه شده و مابه‌التفاوت <strong>({formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) نقداً به مشتری پرداخت و از شیفت فعلی کسر می‌شود</strong>.
                        </>
                      ) : language === 'ku' ? (
                        <>
                          ⚠️ <strong>گەڕاندنەوەی نەختینە بۆ کڕیار:</strong> نرخی گەڕاوە ({formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) لە قەرزی ماوە زیاترە. قەرزەکە بە تەواوی پاکتاو دەکرێت و جیاوازییەکەی <strong>({formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) بە نەختینە دەگەڕێنرێتەوە بۆ کڕیار و لە شیفتی ئێستا دەبڕدرێت</strong>.
                        </>
                      ) : (
                        <>
                          ⚠️ <strong>إرجاع نقدي للعميل:</strong> قيمة المرتجع ({formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) تتجاوز الدين المتبقي. سيتم تصفية الدين بالكامل وإرجاع الفارق <strong>({formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}) نقداً للعميل وخصمه من الوردية الحالية</strong>.
                        </>
                      )
                    ) : (
                      language === 'en'
                        ? `${formatCurrency(partialRefundStats.debtReduction * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)} will be deducted from remaining customer debt without affecting the cash drawer.`
                        : language === 'tr'
                        ? `Kalan müşteri borcundan ${formatCurrency(partialRefundStats.debtReduction * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)} düşülecek, kasa etkilenmeyecektir.`
                        : language === 'fa'
                        ? `مبلغ ${formatCurrency(partialRefundStats.debtReduction * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)} از بدهی باقیمانده کسر می‌شود بدون تأثیر بر کشوی صندوق.`
                        : language === 'ku'
                        ? `بڕی ${formatCurrency(partialRefundStats.debtReduction * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)} لە باڵانسی قەرزی ماوەی کڕیار کەمدەکرێتەوە بەبێ کاریگەری لەسەر سندووقی کاشێر.`
                        : `سيتم تخفيض ${formatCurrency(partialRefundStats.debtReduction * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)} من رصيد دين العميل المتبقي دون التأثير على درج الكاشير.`
                    )
                  )}
                </p>
              </div>
            )}

            {refundMode === 'full' ? (
              <div className="space-y-3 py-1 text-right">
                <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-2 border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('invoices.customer') || 'العميل'}:</span>
                    <span className="font-semibold">{invoiceToRefund?.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('invoices.total') || 'إجمالي الفاتورة'}:</span>
                    <span className="font-bold">{formatCurrency(refundFinancials ? refundFinancials.displayTotal : 0, refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('invoices.itemsAndUnits')}</span>
                    <span>{invoiceToRefund?.items?.length || 0} {t('invoices.itemsCount')} ({invoiceToRefund?.items?.reduce((s, i) => s + i.quantity, 0) || 0} {t('invoices.piecesCount')})</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {t('invoices.fullRefundNotice')}
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-right">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">{t('invoices.selectQuantitiesToReturn')}</span>
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary" onClick={setAllPartialQtyMax}>
                      {t('invoices.selectAll') || 'تحديد الكل'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground" onClick={resetAllPartialQty}>
                      {t('invoices.reset') || 'تصفير'}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-56 overflow-y-auto bg-card">
                  {invoiceToRefund?.items?.filter(i => !i.refunded && i.quantity > 0).map((item) => {
                    const key = refundKey(item);
                    const currentQty = partialRefundQuantities[key] || 0;
                    const isSelected = currentQty > 0;
                    return (
                      <div key={key} className={cn("p-2.5 flex items-center justify-between gap-3 text-sm transition-colors", isSelected && "bg-orange-50/60 dark:bg-orange-950/20")}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{formatCurrency(item.price * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)} {t('common.perPiece')}</span>
                            <span>•</span>
                            <span>{t('invoices.qtyInInvoice')} <strong className="text-foreground">{item.quantity}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border rounded-md overflow-hidden bg-background">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none"
                              onClick={() => updatePartialQty(key, -1, item.quantity)}
                              disabled={currentQty <= 0}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-bold text-xs">{currentQty}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none"
                              onClick={() => updatePartialQty(key, 1, item.quantity)}
                              disabled={currentQty >= item.quantity}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn("h-7 px-2 text-xs", currentQty === item.quantity && "bg-primary text-primary-foreground")}
                            onClick={() => updatePartialQty(key, item.quantity - currentQty, item.quantity)}
                          >
                            {t('common.all')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Partial summary box */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs border">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('invoices.selectedItems')}</span>
                    <span className="font-semibold">{partialRefundStats.itemsCount} {t('invoices.itemsCount')} ({partialRefundStats.unitsCount} {t('invoices.piecesCount')})</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-t pt-1.5">
                    <span>{t('invoices.totalRefundValue')}</span>
                    <span className="text-orange-600">{formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                  </div>
                  {invoiceToRefund?.paymentType === 'debt' ? (
                    <>
                      {partialRefundStats.debtReduction > 0 && (
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{t('invoices.debtDeduction')}</span>
                          <span className="font-semibold text-destructive">-{formatCurrency(partialRefundStats.debtReduction * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                        </div>
                      )}
                      {partialRefundStats.cashToReturn > 0 && (
                        <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>{t('invoices.cashReturnToCustomer')}</span>
                          <span>{formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>{t('invoices.cashReturnToCustomer')}</span>
                      <span>{formatCurrency(partialRefundStats.cashToReturn * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Returned goods condition */}
            <div className="space-y-1.5 text-right">
              <span className="text-xs font-medium text-muted-foreground">{t('invoices.itemCondition') || 'حالة البضاعة المرتجعة'}:</span>
              <div className="grid grid-cols-2 gap-2">
                {(['good', 'damaged'] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={refundCondition === c ? (c === 'good' ? 'default' : 'destructive') : 'outline'}
                    className="h-9 text-xs"
                    onClick={() => setRefundCondition(c)}
                  >
                    {c === 'good' ? (t('invoices.conditionGood') || 'سليم') : (t('invoices.conditionDefective') || 'معيب')}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 gap-2 flex-row justify-end">
            <Button variant="outline" onClick={() => setShowRefundDialog(false)} disabled={refundGuard.isRunning}>
              {t('common.cancel')}
            </Button>
            {refundMode === 'full' ? (
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={confirmRefund}
                disabled={refundGuard.isRunning}
                aria-busy={refundGuard.isRunning}
              >
                <Undo2 className={cn('w-4 h-4 ml-2', refundGuard.isRunning && 'animate-spin')} />
                {refundGuard.isRunning ? (t('common.loading') || 'جاري الاسترداد...') : (t('invoices.confirmFullRefund') || 'تأكيد الاسترداد الكامل')}
              </Button>
            ) : (
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={confirmPartialRefund}
                disabled={refundGuard.isRunning || !partialRefundStats.isValid}
                aria-busy={refundGuard.isRunning}
              >
                <Layers className={cn('w-4 h-4 ml-2', refundGuard.isRunning && 'animate-spin')} />
                {refundGuard.isRunning
                  ? (t('common.loading') || 'جاري الاسترداد...')
                  : `${t('invoices.confirmPartialRefund') || 'تأكيد الاسترداد الجزئي'} (${formatCurrency(partialRefundStats.totalRefundAmount * (refundFinancials?.rate || 1), refundFinancials?.symbol || '$', refundFinancials?.decimals)})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog for Invoices */}
      <Dialog
        open={showDebtPaymentDialog}
        onOpenChange={(open) => {
          if (!isSubmittingPayment) setShowDebtPaymentDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              {t('debts.recordPayment') || 'تسجيل دفعة'}
            </DialogTitle>
            <DialogDescription>
              {t('debts.recordPaymentFor') || 'تسجيل دفعة للعميل'} {selectedDebtForPayment?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedDebtForPayment && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">{t('debts.totalDebt') || 'إجمالي الدين'}</span>
                  <span className="font-bold">{formatCurrency(selectedDebtForPayment.totalDebt)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">{t('debts.paidSoFar') || 'المدفوع حتى الآن'}</span>
                  <span className="font-bold text-success">{formatCurrency(selectedDebtForPayment.totalPaid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">{t('debts.remaining') || 'المتبقي'}</span>
                  <div className="text-left">
                    <span className="font-bold text-destructive block">{formatCurrency(selectedDebtForPayment.remainingDebt)}</span>
                    {paymentCurrency !== 'USD' && (
                      <span className="text-xs text-muted-foreground block font-mono">
                        ≈ {formatNumber(maxInCurrency)} {currencySymbols?.[paymentCurrency] || (paymentCurrency === 'TRY' ? '₺' : 'ل.س')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* اختيار عملة السداد */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('invoices.receivedCurrency') || 'عملة الدفع المستلمة'}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {enabledCurrencies.USD !== false && (
                    <button
                      type="button"
                      disabled={isSubmittingPayment}
                      onClick={() => {
                        setPaymentCurrency('USD');
                        setPaymentAmountInput('');
                      }}
                      className={cn(
                        "min-h-[60px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 leading-tight text-center",
                        isSubmittingPayment && "opacity-50 cursor-not-allowed",
                        paymentCurrency === 'USD'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      <span className="text-sm font-bold">💵 {t('currencies.usd')}</span>
                      <span className="text-xs font-normal opacity-80">(USD)</span>
                    </button>
                  )}
                  {enabledCurrencies.TRY && (
                    <button
                      type="button"
                      disabled={isSubmittingPayment}
                      onClick={() => {
                        setPaymentCurrency('TRY');
                        setPaymentAmountInput('');
                      }}
                      className={cn(
                        "min-h-[60px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 leading-tight text-center",
                        isSubmittingPayment && "opacity-50 cursor-not-allowed",
                        paymentCurrency === 'TRY'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      <span className="text-sm font-bold">{currencySymbols?.TRY || '₺'} {currencyNames?.TRY || t('currencies.try')}</span>
                      <span className="text-xs font-normal opacity-80">({currencySymbols?.TRY || 'TRY'})</span>
                    </button>
                  )}
                  {enabledCurrencies.SYP && (
                    <button
                      type="button"
                      disabled={isSubmittingPayment}
                      onClick={() => {
                        setPaymentCurrency('SYP');
                        setPaymentAmountInput('');
                      }}
                      className={cn(
                        "min-h-[60px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 leading-tight text-center",
                        isSubmittingPayment && "opacity-50 cursor-not-allowed",
                        paymentCurrency === 'SYP'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      <span className="text-sm font-bold">{currencySymbols?.SYP || 'ل.س'} {currencyNames?.SYP || t('currencies.syp')}</span>
                      <span className="text-xs font-normal opacity-80">({currencySymbols?.SYP || 'SYP'})</span>
                    </button>
                  )}
                </div>
                {paymentCurrency !== 'USD' && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 px-1 flex items-center justify-between">
                    <span>{t('invoices.exchangeRate') || 'سعر الصرف المعتمد'}:</span>
                    <span className="font-mono font-bold text-foreground">1 $ = {currentRate} {currencySymbols?.[paymentCurrency] || paymentCurrency}</span>
                  </p>
                )}
              </div>

              {/* حقل إدخال المبلغ */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">
                    {t('invoices.paymentAmount')} ({paymentCurrency === 'USD' ? '$' : (currencySymbols?.[paymentCurrency] || (paymentCurrency === 'TRY' ? '₺' : 'ل.س'))})
                  </label>
                  {paymentCurrency !== 'USD' && amountUSD > 0 && (
                    <span className="text-xs font-bold text-success font-mono">
                      ≈ ${formatNumber(amountUSD)}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  max={maxInCurrency}
                  step={paymentCurrency === 'USD' ? "0.01" : "1"}
                  className="text-lg font-bold"
                  disabled={isSubmittingPayment}
                />

                {/* المعادل بالدولار إذا كانت العملة أجنبية */}
                {paymentCurrency !== 'USD' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('invoices.usdEquivalentDeducted') || 'المبلغ المعادل بالدولار المخصوم من الدين'}:</span>
                    <span className="font-bold text-primary text-sm font-mono">${formatNumber(amountUSD)}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={isSubmittingPayment}
                    onClick={() => setPaymentAmountInput(String(maxInCurrency))}
                  >
                    {t('debts.payFull') || 'تسديد كامل'} ({maxInCurrency} {currencySymbols?.[paymentCurrency] || paymentCurrency})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={isSubmittingPayment}
                    onClick={() => setPaymentAmountInput(String(Math.round((maxInCurrency / 2) * 100) / 100))}
                  >
                    {t('debts.payHalf') || 'تسديد نصف'}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmittingPayment}
                  onClick={() => setShowDebtPaymentDialog(false)}
                >
                  {t('common.cancel') || 'إلغاء'}
                </Button>
                <Button
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={handleConfirmDebtPayment}
                  disabled={isSubmittingPayment || amountUSD <= 0}
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      <span>{t('invoices.payingDebt') || 'جاري الدفع...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 ml-2" />
                      <span>{t('debts.confirmPayment') || 'تأكيد الدفع'}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

