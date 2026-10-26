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
  Banknote,
  CreditCard,
  Wrench,
  ShoppingCart,
  Truck,
  X,
  XCircle,
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
  TrendingUp,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
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
import { toast } from '@/lib/sonner-bridge';
import { showSmartToast } from '@/hooks/use-smart-toast';
import { isNotificationEventAllowed } from '@/lib/notification-events-config';
import { cn, formatNumber, formatCurrency, formatMoney, formatDateTime, roundCurrency } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useCurrency, loadDefaultCurrencyCode } from '@/hooks/use-currency';
import { useDebounce } from '@/hooks/use-debounce';
import { getCurrencySymbolByCode, resolveHistoricalCurrency, resolveInvoiceCurrencySymbol, resolveInvoiceCurrencyName, PREDEFINED_CURRENCIES } from '@/lib/currencies';
import { emitEvent, EVENTS } from '@/lib/events';
import {
  loadInvoicesCloud,
  loadCachedInvoicesSync,
  invalidateInvoicesCache,
  deleteInvoiceCloud,
  refundInvoiceCloud,
  refundInvoicePartialCloud,
  markInvoiceRefundedLocally,
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
import { usePageActivity } from '@/contexts/PageActivityContext';

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

/**
 * فحص مطابقة تاريخ الفاتورة ضمن نطاق زمني (من تاريخ إلى تاريخ)
 */
export function isInvoiceInRange(createdAt?: string | null, from?: string, to?: string): boolean {
  if (!createdAt) return false;
  if (!from && !to) return true;
  try {
    const invDate = getLocalDateString(new Date(createdAt));
    if (from && invDate < from) return false;
    if (to && invDate > to) return false;
    return true;
  } catch {
    return false;
  }
}


export default function Invoices() {
  const { t, language, isRTL } = useLanguage();
  const { isActive: isPageActive } = usePageActivity();

  // Helper to ensure clean Arabic text and eliminate translation key leaks
  const tx = useCallback((key: string, arabicFallback: string): string => {
    if (!language || language === 'ar') return arabicFallback;
    try {
      const val = t(key as any);
      if (val && val !== key && !val.includes('.')) return val;
    } catch {}
    return arabicFallback;
  }, [t, language]);

  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'sales' | 'purchases'>('sales');
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    return loadCachedInvoicesSync(); // قراءة مباشرة من localStorage بدون انتظار
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState<boolean>(() => invoices.length === 0);
  const [filterType, setFilterType] = useState<'all' | InvoiceType | 'shipping'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'debt' | 'card'>('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(true);

  const [customDateMode, setCustomDateMode] = useState<'single' | 'range'>('single');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const todayStr = useMemo(() => getLocalDateString(), []);
  const [dateQuickFilter, setDateQuickFilter] = useState<DateQuickFilter>('week');
  const [dateFilter, setDateFilter] = useState<string>(() => getLocalDateString());
  const [activeKpi, setActiveKpi] = useState<'total' | 'debt' | 'today' | 'profit' | null>(null);
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
  // ✅ حالة البضاعة المرتجعة مثبتة دائماً على 'good' (سليم) لتعود الكميات تلقائياً إلى المخزون
  const refundCondition: 'good' = 'good';
  const [refundMeta, setRefundMeta] = useState<Record<string, { condition: 'good' | 'damaged'; at: string; mode: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('hyperpos_refund_meta_v1') || '{}'); } catch { return {}; }
  });
  const saveRefundMeta = (invoiceId: string, mode: 'full' | 'partial' = refundMode) => {
    setRefundMeta(prev => {
      const next = { ...prev, [invoiceId]: { condition: 'good' as const, at: new Date().toISOString(), mode } };
      try { localStorage.setItem('hyperpos_refund_meta_v1', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const canPartialRefund = useMemo(() => {
    const items = invoiceToRefund?.items || [];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return items.length > 1 || totalQuantity > 1;
  }, [invoiceToRefund]);
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

  const [displayCurrencyFilter, setDisplayCurrencyFilter] = useState<'stored' | string>('stored');

  // Debt Payment Dialog State
  const [showDebtPaymentDialog, setShowDebtPaymentDialog] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<Debt | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<string>(() => {
    const defaultCurr = loadDefaultCurrencyCode();
    return defaultCurr || 'USD';
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

  const availableFilterCurrencies = useMemo(() => {
    const list: Array<{ code: string; name: string; symbol: string }> = [];
    const seen = new Set<string>();

    Object.entries(enabledCurrencies).forEach(([code, isEnabled]) => {
      if (isEnabled && !seen.has(code)) {
        seen.add(code);
        list.push({
          code,
          name: currencyNames?.[code] || resolveInvoiceCurrencyName(code),
          symbol: resolveInvoiceCurrencySymbol(code, currencySymbols?.[code]),
        });
      }
    });

    invoices.forEach(inv => {
      const c = (inv.currencyCode || inv.currency || '').trim().toUpperCase();
      if (c && !seen.has(c)) {
        seen.add(c);
        list.push({
          code: c,
          name: currencyNames?.[c] || resolveInvoiceCurrencyName(c),
          symbol: resolveInvoiceCurrencySymbol(c, inv.currencySymbol || currencySymbols?.[c]),
        });
      }
    });

    return list;
  }, [enabledCurrencies, currencyNames, currencySymbols, invoices]);

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
        rate = (exchangeRates[code] && exchangeRates[code] > 0) ? exchangeRates[code] : 1;
        symbol = resolveInvoiceCurrencySymbol(code, currencySymbols?.[code]);
      }
    } else {
      // 'stored': استخدام العملة وسعر الصرف والرمز التاريخي المجمد للفاتورة لمنع تشوهها بأي تغيير لاحق
      const rawCode = inv.currencyCode || inv.currency;
      const rawRate = typeof inv.exchangeRate === 'number' && inv.exchangeRate > 0 ? inv.exchangeRate : 1;
      const rawSymbol = inv.currencySymbol;
      const resolved = resolveHistoricalCurrency({
        currency: rawCode,
        currencySymbol: rawSymbol,
        exchangeRate: rawRate,
      }, {
        currencyCode,
        currencySymbol,
        currencySymbols: currencySymbols as unknown as Record<string, string>,
      });
      code = resolved.code;
      rate = resolved.rate;
      symbol = resolveInvoiceCurrencySymbol(rawCode || code, rawSymbol || resolved.symbol);
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
      : ((exchangeRates.TRY && exchangeRates.TRY > 0) ? exchangeRates.TRY : 1);

    const sypRate = (invUpper === 'SYP' && typeof inv.exchangeRate === 'number' && inv.exchangeRate > 0)
      ? inv.exchangeRate
      : ((exchangeRates.SYP && exchangeRates.SYP > 0) ? exchangeRates.SYP : 1);

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
    : ((exchangeRates[statCurrencyCode] && exchangeRates[statCurrencyCode] > 0)
        ? exchangeRates[statCurrencyCode]
        : 1);
  const statCurrencySymbol = statCurrencyCode === 'USD' ? (currencySymbols?.USD || '$') : (currencySymbols?.[statCurrencyCode] || getCurrencySymbolByCode(statCurrencyCode));
  const statDecimals = statExchangeRate >= 100 ? 0 : 2;

  // مواءمة مبيعات اليوم مع فواتير اليوم الفعلية المعروضة لمنع أي تفاوت عند منتصف الليل
  const computedTodaySales = useMemo(() => {
    const todayInvs = invoices.filter(inv => inv.status !== 'refunded' && inv.status !== 'cancelled' && isInvoiceToday(inv.createdAt));
    return todayInvs.reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [invoices]);

  const effectiveTodaySales = computedTodaySales > 0 ? computedTodaySales : stats.todaySales;
  const todaySalesDisplay = roundCurrency(effectiveTodaySales * statExchangeRate);
  const totalProfitDisplay = roundCurrency(stats.totalProfit * statExchangeRate);

  const refundFinancials = invoiceToRefund ? getInvoiceFinancials(invoiceToRefund, true) : null;

  // مبيعات الفترات المختلفة للبطاقة الذكية الموحدة (مبيعات اليوم / الأسبوع / الشهر / العام / الكل)
  const periodSales = useMemo(() => {
    let today = 0, week = 0, month = 0, year = 0, all = 0;
    let todayCount = 0, weekCount = 0, monthCount = 0, yearCount = 0, allCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'refunded' || inv.status === 'cancelled') continue;
      const total = inv.total || 0;
      all += total;
      allCount++;
      if (isInvoiceToday(inv.createdAt)) {
        today += total;
        todayCount++;
      }
      if (isInvoiceThisWeek(inv.createdAt)) {
        week += total;
        weekCount++;
      }
      if (isInvoiceThisMonth(inv.createdAt)) {
        month += total;
        monthCount++;
      }
      if (isInvoiceThisYear(inv.createdAt)) {
        year += total;
        yearCount++;
      }
    }

    const effToday = today > 0 ? today : (stats.todaySales || 0);
    const effAll = all > 0 ? all : (stats.totalSales || 0);

    return {
      today: { total: roundCurrency(effToday * statExchangeRate), count: todayCount || stats.todayCount },
      week: { total: roundCurrency(week * statExchangeRate), count: weekCount },
      month: { total: roundCurrency(month * statExchangeRate), count: monthCount },
      year: { total: roundCurrency(year * statExchangeRate), count: yearCount },
      all: { total: roundCurrency(effAll * statExchangeRate), count: allCount || stats.total },
    };
  }, [invoices, statExchangeRate, stats]);

  const currentPeriodSales = useMemo(() => {
    if (dateQuickFilter === 'today') return periodSales.today;
    if (dateQuickFilter === 'week') return periodSales.week;
    if (dateQuickFilter === 'month') return periodSales.month;
    if (dateQuickFilter === 'year') return periodSales.year;
    if (dateQuickFilter === 'custom') {
      if (customDateMode === 'single' && dateFilter) {
        const customInvs = invoices.filter(inv => inv.status !== 'refunded' && inv.status !== 'cancelled' && isInvoiceCustomDate(inv.createdAt, dateFilter));
        const sum = customInvs.reduce((acc, inv) => acc + (inv.total || 0), 0);
        return { total: roundCurrency(sum * statExchangeRate), count: customInvs.length };
      } else if (customDateMode === 'range' && (dateFrom || dateTo)) {
        const customInvs = invoices.filter(inv => inv.status !== 'refunded' && inv.status !== 'cancelled' && isInvoiceInRange(inv.createdAt, dateFrom, dateTo));
        const sum = customInvs.reduce((acc, inv) => acc + (inv.total || 0), 0);
        return { total: roundCurrency(sum * statExchangeRate), count: customInvs.length };
      }
    }
    return periodSales.all;
  }, [dateQuickFilter, dateFilter, customDateMode, dateFrom, dateTo, periodSales, invoices, statExchangeRate]);

  const currentPeriodTitle = useMemo(() => {
    switch (dateQuickFilter) {
      case 'today': return tx('reports.today', 'اليوم');
      case 'week': return tx('reports.thisWeek', 'هذا الأسبوع');
      case 'month': return tx('reports.thisMonth', 'هذا الشهر');
      case 'year': return tx('reports.thisYear', 'هذا العام');
      case 'custom':
        if (customDateMode === 'range' && (dateFrom || dateTo)) {
          return `${dateFrom || '...'} → ${dateTo || '...'}`;
        }
        return dateFilter || tx('common.customDate', 'تاريخ مخصص');
      default: return tx('invoices.allInvoices', 'كل الفترات');
    }
  }, [dateQuickFilter, dateFilter, customDateMode, dateFrom, dateTo, tx]);

  const handleSetPeriod = (period: 'today' | 'week' | 'month' | 'year' | 'all') => {
    setDateQuickFilter(period);
    if (period === 'today') {
      setDateFilter(todayStr);
      setActiveKpi('today');
    } else if (period === 'all') {
      setDateFilter('');
      setActiveKpi('total');
    } else {
      setDateFilter('');
      setActiveKpi(null);
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateQuickFilter !== 'all') count++;
    if (dateQuickFilter === 'custom') {
      if (customDateMode === 'single' && dateFilter) count++;
      if (customDateMode === 'range' && (dateFrom || dateTo)) count++;
    }
    if (filterPayment !== 'all') count++;
    if (filterType !== 'all') count++;
    if (displayCurrencyFilter !== 'stored') count++;
    if (showRefunded) count++;
    return count;
  }, [dateQuickFilter, dateFilter, customDateMode, dateFrom, dateTo, filterPayment, filterType, displayCurrencyFilter, showRefunded]);

  const resetAllFilters = () => {
    setDateQuickFilter('all');
    setDateFilter('');
    setCustomDateMode('single');
    setDateFrom('');
    setDateTo('');
    setFilterPayment('all');
    setFilterType('all');
    setDisplayCurrencyFilter('stored');
    setShowRefunded(false);
    setSearchQuery('');
    setActiveKpi('total');
  };

  // Load invoices with proper cleanup & silent background updates
  const isAnyModalOpenRef = useRef(false);
  isAnyModalOpenRef.current = Boolean(showViewDialog || showShareSheet || showRefundDialog || showDebtPaymentDialog);

  const selectedInvoiceRef = useRef<Invoice | null>(null);
  selectedInvoiceRef.current = selectedInvoice;

  const pendingUpdateRef = useRef(false);
  const isRefreshingRef = useRef(false);

  // إطلاق التحديث السحابي في الخلفية (Background Revalidation) مع تحديث القائمة دون اهتزاز
  useEffect(() => {
    let isMounted = true;
    async function fetchFreshInvoices() {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      try {
        const [fresh, statsData] = await Promise.all([
          loadInvoicesCloud(),
          getInvoiceStatsCloud().catch(() => null)
        ]);
        if (isMounted && fresh && fresh.length > 0) {
          setInvoices(fresh);
        }
        if (isMounted && statsData) {
          setStats(statsData);
        }
        if (isMounted && selectedInvoiceRef.current && fresh) {
          const currentId = selectedInvoiceRef.current.id;
          const freshSelected = fresh.find(i => i.id === currentId);
          if (freshSelected) {
            setSelectedInvoice(freshSelected);
          }
        }
      } catch (err) {
        console.warn('[Invoices] Error fetching fresh invoices:', err);
      } finally {
        if (isMounted) setIsLoading(false);
        isRefreshingRef.current = false;
      }
    }

    fetchFreshInvoices();

    const handleUpdate = () => {
      // 🛡️ إذا كانت هناك نافذة تفاعلية مفتوحة (عرض، مشاركة، استرداد، سداد)، نؤجل التحديث حتى تغلق
      if (isAnyModalOpenRef.current) {
        pendingUpdateRef.current = true;
        return;
      }
      // 🚀 تحديث صامت في الخلفية دائماً عند وصول أحداث التحديث لمنع وميض الشاشة أو تصفير التمرير
      fetchFreshInvoices();
    };

    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.APP_REFRESH, handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.APP_REFRESH, handleUpdate);
    };
  }, []);

  // تنفيذ أي تحديث مؤجل بمجرد إغلاق كافة النوافذ المنبثقة
  useEffect(() => {
    const isAnyOpen = showViewDialog || showShareSheet || showRefundDialog || showDebtPaymentDialog;
    if (!isAnyOpen && pendingUpdateRef.current) {
      pendingUpdateRef.current = false;
      loadInvoicesCloud().then(fresh => {
        if (fresh && fresh.length > 0) setInvoices(fresh);
      }).catch(() => {});
      getInvoiceStatsCloud().then(statsData => {
        if (statsData) setStats(statsData);
      }).catch(() => {});
    }
  }, [showViewDialog, showShareSheet, showRefundDialog, showDebtPaymentDialog]);

  // Memoized filtered invoices for performance
  // Refunded invoices appear only in the "فواتير مستردة" view (full or partial refunds)
  const filteredInvoices = useMemo(() => {
    let result = showRefunded
      ? invoices.filter(inv => inv.status === 'refunded' || inv.status === 'cancelled' || !!refundMeta[inv.id])
      : invoices.filter(inv => inv.status !== 'refunded' && inv.status !== 'cancelled');

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
      if (filterType === 'shipping') {
        result = result.filter(inv => (inv.type as any) === 'shipping' || inv.serviceType === 'shipping' || (inv.serviceDescription && inv.serviceDescription.includes('شحن')));
      } else {
        result = result.filter(inv => inv.type === filterType);
      }
    }

    if (filterPayment !== 'all') {
      if (filterPayment === 'card') {
        result = result.filter(inv => (inv.paymentType as any) === 'card' || (inv as any).paymentType === 'network' || (inv as any).paymentMethod === 'card');
      } else {
        result = result.filter(inv => inv.paymentType === filterPayment);
      }
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
    } else if (dateQuickFilter === 'custom') {
      if (customDateMode === 'single' && dateFilter) {
        result = result.filter(inv => isInvoiceCustomDate(inv.createdAt, dateFilter));
      } else if (customDateMode === 'range' && (dateFrom || dateTo)) {
        result = result.filter(inv => isInvoiceInRange(inv.createdAt, dateFrom, dateTo));
      }
    }

    return result;
  }, [invoices, debouncedSearch, filterType, filterPayment, dateQuickFilter, dateFilter, customDateMode, dateFrom, dateTo, showRefunded, refundMeta]);

  // Progressive rendering limits to keep initial render <10ms for large invoice lists
  const INITIAL_INVOICES_LIMIT = 40;
  const INVOICES_BATCH_SIZE = 30;
  const [invoiceDisplayLimit, setInvoiceDisplayLimit] = useState(INITIAL_INVOICES_LIMIT);
  const invoiceSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInvoiceDisplayLimit(INITIAL_INVOICES_LIMIT);
  }, [debouncedSearch, filterType, filterPayment, dateQuickFilter, dateFilter, customDateMode, dateFrom, dateTo, showRefunded]);

  const displayedInvoices = useMemo(() => {
    return filteredInvoices.slice(0, invoiceDisplayLimit);
  }, [filteredInvoices, invoiceDisplayLimit]);

  useEffect(() => {
    if (!isPageActive) return;
    if (displayedInvoices.length >= filteredInvoices.length) return;

    const sentinel = invoiceSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInvoiceDisplayLimit((prev) => Math.min(prev + INVOICES_BATCH_SIZE, filteredInvoices.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isPageActive, displayedInvoices.length, filteredInvoices.length]);

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
    saveRefundMeta(invoice.id, 'full');
    // Snapshot invoice-specific data BEFORE running so notifications reflect this exact invoice
    const invoiceLabel = invoice.id;
    const refundFin = getInvoiceFinancials(invoice, true);
    const invoiceTotal = refundFin.displayTotal;
    const invoiceCurrencySymbol = refundFin.symbol;
    // Unique toast id per invoice → prevents duplicate stacked notifications on re-triggers
    const toastId = `refund-${invoiceLabel}`;

    // ✅ Close the dialog immediately (non-blocking UX) but DO NOT change the
    // invoice state until the server confirms the refund succeeded.
    setShowRefundDialog(false);
    setInvoiceToRefund(null);

    // ✅ Offline path: update local state immediately and queue
    if (!isOnline) {
      markInvoiceRefundedLocally(invoiceLabel);
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceLabel ? { ...inv, status: 'refunded' as const } : inv
      ));

      // ⚡ إعادة كميات الأصناف محلياً وفورياً لنقطة البيع (Delta Update)
      if (invoice.items && invoice.items.length > 0) {
        import('@/lib/cloud/products-cloud').then(({ restoreProductsQuantitiesLocally }) => {
          const itemsToRestore = invoice.items.map(item => ({
            productId: item.productId || item.id,
            quantity: item.quantity,
          }));
          restoreProductsQuantitiesLocally(itemsToRestore);
        }).catch(() => {});
      }

      if (invoice.customerId) {
        import('@/lib/cloud/customers-cloud').then(({ updateCustomerStatsCloud }) => {
          updateCustomerStatsCloud(invoice.customerId!).catch(() => {});
        });
      }
      addToQueueIfNotExists('invoice_refund', { invoiceNumber: invoiceLabel }, `invoice-refund:${invoiceLabel}`);
      toast.info(`تم استرداد ${invoiceLabel} محلياً`, {
        id: toastId,
        description: `المبلغ: ${formatCurrency(invoiceTotal, invoiceCurrencySymbol, refundFin.decimals)} — سيُرفع الاسترداد تلقائياً عند عودة الإنترنت`,
        duration: 3500,
      });
      return;
    }

    // ✅ Online path: dialog is already closed, but the guard remains held until completion.
    toast.loading(`جاري استرداد ${invoiceLabel}...`, { id: toastId });
    try {
        const result = await refundInvoiceCloud(invoiceLabel, 'online');
        if (typeof result === 'object' && result.alreadyRefunded) {
          markInvoiceRefundedLocally(invoiceLabel);
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

        // Confirmed by the server → now reflect the refunded state in the list and local cache
        markInvoiceRefundedLocally(invoiceLabel);
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceLabel ? { ...inv, status: 'refunded' as const } : inv
        ));
        invalidateInvoicesCache();

        if (invoice.customerId) {
          import('@/lib/cloud/customers-cloud').then(({ updateCustomerStatsCloud }) => {
            updateCustomerStatsCloud(invoice.customerId!).catch(() => {});
          });
        }


        // Refresh stats silently — don't block UI
        getInvoiceStatsCloud().then(setStats).catch(() => {});

        // Refresh product quantities from cloud so local inventory reflects the refund
        try {
          if (invoice.items && invoice.items.length > 0) {
            import('@/lib/cloud/products-cloud').then(({ restoreProductsQuantitiesLocally }) => {
              const itemsToRestore = invoice.items.map(item => ({
                productId: item.productId || item.id,
                quantity: item.quantity,
              }));
              restoreProductsQuantitiesLocally(itemsToRestore);
            }).catch(() => {});
          }
          invalidateProductsCache();
          refreshProductsFromCloud().then(() => {
            // Background sync completes quietly
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
        showSmartToast({
          id: toastId,
          type: 'refund',
          title: `تم استرداد ${invoiceLabel}`,
          subtitle: `#${invoice.id || invoice.invoiceNumber}`,
          description: lines.join(' • '),
          pillText: formatCurrency(refundedTotal, refundedCurrency),
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
    saveRefundMeta(invoice.id, 'partial');
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

      showSmartToast({
        id: toastId,
        type: 'refund',
        title: result.isFullyRefunded ? `تم استرداد كامل الفاتورة ${invoiceLabel}` : `تم الاسترداد الجزئي للفاتورة ${invoiceLabel}`,
        subtitle: `#${invoice.id || invoice.invoiceNumber}`,
        description: lines.join(' • '),
        pillText: formatCurrency(result.refundedAmount, invoice.currency),
        duration: 5000,
      });

      const usdSym = currencySymbols?.USD || '$';
      const partialRefundDesc = `${tx('invoices.partialRefund', 'استرداد جزئي')} للفاتورة ${invoiceLabel}: بقيمة ${usdSym}${roundCurrency(result.refundedAmount)} ${result.debtReduced > 0 ? `(تخفيض دين: ${usdSym}${formatNumber(result.debtReduced)})` : ''} ${result.cashToRefund > 0 ? `(إرجاع نقدي: ${usdSym}${formatNumber(result.cashToRefund)})` : ''}`;

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
      logActivity('debt_paid', `تسديد كامل لفاتورة ${invoice.id} بقيمة ${formatMoney(paidAmount)} - ${invoice.customerName}`, {
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
          ? `${paymentAmountInput} ${paymentCurrency} (يعادل ${formatMoney(finalPaymentUSD, 'USD')} بسعر صرف ${currentRate})`
          : formatMoney(finalPaymentUSD, paymentCurrency);
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
      const paidAmountSnapshot = parseFloat(paymentAmountInput) || finalPaymentUSD;
      const debtCustSnapshot = selectedDebtForPayment?.customerName;
      setSelectedDebtForPayment(null);
      setPaymentAmountInput('');
      showSmartToast({
        type: 'debt_sale',
        title: 'تم تسجيل دفعة الدين بنجاح',
        subtitle: debtCustSnapshot ? `العميل: ${debtCustSnapshot}` : undefined,
        primaryLabel: 'المبلغ المدفوع',
        primaryValue: `${paidAmountSnapshot} ${paymentCurrency}`,
        operation: 'سداد دين',
        duration: 4000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تسجيل الدفعة');
    } finally {
      paymentBusyRef.current = false;
      setIsSubmittingPayment(false);
    }
  };

  useEffect(() => {
    const handleRequestPairing = () => {
      toast.info(isRTL ? 'يرجى ربط طابعة بلوتوث من شاشة الإعدادات > الطباعة' : 'Please pair a Bluetooth printer in Settings > Printing');
    };
    window.addEventListener('flowpos:request-printer-pairing', handleRequestPairing);
    return () => window.removeEventListener('flowpos:request-printer-pairing', handleRequestPairing);
  }, [isRTL]);

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
        if (isNotificationEventAllowed('invoices_share_image_generating')) {
          toast.info(t('invoices.generatingShareImage') || (language === 'en' ? 'Generating invoice image for sharing...' : 'جاري إنشاء صورة الفاتورة للمشاركة...'), { duration: 1500 });
        }
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
      if (isNotificationEventAllowed('invoices_copied_clipboard')) {
        toast.success(t('invoices.invoiceCopied') || (language === 'en' ? 'Invoice details copied successfully' : 'تم نسخ تفاصيل الفاتورة بنجاح'));
      }
    } catch (e) {
      toast.error(t('invoices.invoiceCopyFailed') || (language === 'en' ? 'Failed to copy invoice details' : 'تعذر نسخ تفاصيل الفاتورة'));
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-3.5">
      {/* Top Bar: Header pill with safe offset for mobile menu trigger */}
      <div className={cn(
        "flex items-center justify-between gap-2 select-none",
        isRTL ? "pr-14 md:pr-0" : "pl-14 md:pl-0"
      )}>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-2xl bg-gradient-primary text-primary-foreground shadow-xs border border-primary/20 select-none">
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap leading-relaxed pt-0.5">
            {tx('invoices.salesInvoices', 'فواتير المبيعات')}
          </span>
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={(val: any) => setActiveMainTab(val)} className="w-full space-y-4">
        <TabsContent value="sales" className="space-y-3 m-0">

          {/* 1. Sleek Sales Snapshot Card (بطاقة مبيعات موحدة + خيار المزيد) */}
          <div className="bg-gradient-to-r from-card via-card to-primary/5 p-3 sm:p-3.5 rounded-2xl border border-border shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-black text-sm">
                  {statCurrencySymbol || '$'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-foreground">
                      {tx('invoices.salesPeriodTitle', `مبيعات ${currentPeriodTitle}:`)}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                      {formatCurrency(currentPeriodSales.total, statCurrencySymbol, statDecimals)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold truncate mt-0.5">
                    {currentPeriodSales.count} {tx('invoices.displayedInvoices', 'فاتورة')} • {stats.pendingDebts} {tx('invoices.pendingDeferred', 'مؤجلة')}
                  </div>
                </div>
              </div>

              {/* المزيد / التفاصيل Dropdown & Toggle */}
              <div className="flex items-center gap-1 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="px-2.5 py-1.5 rounded-xl bg-background border border-border text-[11px] font-bold text-foreground hover:bg-muted flex items-center gap-1 active:scale-95 transition-[colors,transform] shadow-2xs cursor-pointer"
                    >
                      <span>{tx('common.more', 'المزيد')}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl p-1.5 text-xs font-bold w-48 shadow-xl">
                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-black border-b border-border/50 mb-1">
                      {tx('invoices.selectPeriod', 'فترة العرض:')}
                    </div>
                    <DropdownMenuItem onClick={() => handleSetPeriod('today')} className="rounded-xl flex items-center justify-between cursor-pointer">
                      <span>{tx('reports.today', 'اليوم')}</span>
                      {dateQuickFilter === 'today' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSetPeriod('week')} className="rounded-xl flex items-center justify-between cursor-pointer">
                      <span>{tx('reports.thisWeek', 'هذا الأسبوع')}</span>
                      {dateQuickFilter === 'week' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSetPeriod('month')} className="rounded-xl flex items-center justify-between cursor-pointer">
                      <span>{tx('reports.thisMonth', 'هذا الشهر')}</span>
                      {dateQuickFilter === 'month' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSetPeriod('year')} className="rounded-xl flex items-center justify-between cursor-pointer">
                      <span>{tx('reports.thisYear', 'هذا العام')}</span>
                      {dateQuickFilter === 'year' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSetPeriod('all')} className="rounded-xl flex items-center justify-between cursor-pointer">
                      <span>{tx('invoices.allInvoices', 'كل الفواتير')}</span>
                      {dateQuickFilter === 'all' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem onClick={() => setShowDetailedStats(prev => !prev)} className="rounded-xl text-primary font-bold cursor-pointer">
                      <Layers className="w-3.5 h-3.5 ml-1.5" />
                      <span>{showDetailedStats ? tx('invoices.hideStats', 'إخفاء الإحصائيات') : tx('invoices.showStats', 'عرض تفاصيل الإحصائيات')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={() => setShowDetailedStats(prev => !prev)}
                  title={showDetailedStats ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                  className="p-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground active:scale-90 transition-[colors,transform] cursor-pointer"
                >
                  {showDetailedStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Collapsible Detailed Stats (تظهر عند النقر على خيار التفاصيل من زر المزيد) */}
            {showDetailedStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center select-none pt-3 mt-3 border-t border-dashed border-border/80">
                <button
                  type="button"
                  onClick={handleKpiTotal}
                  className={cn(
                    "py-2 px-1 rounded-xl border text-center transition-colors select-none hover:shadow-xs cursor-pointer",
                    activeKpi === 'total'
                      ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-xs"
                      : "bg-background/80 border-border hover:border-primary/40 shadow-xs"
                  )}
                >
                  <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{tx('invoices.totalInvoices', 'إجمالي الفواتير')}</span>
                  <span className="text-xs sm:text-sm font-black text-foreground tabular-nums">{stats.total}</span>
                </button>
                <button
                  type="button"
                  onClick={handleKpiDebt}
                  className={cn(
                    "py-2 px-1 rounded-xl border text-center transition-colors select-none hover:shadow-xs cursor-pointer",
                    activeKpi === 'debt'
                      ? "bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/40 shadow-xs"
                      : "bg-background/80 border-border hover:border-orange-500/40 shadow-xs"
                  )}
                >
                  <span className="text-[9.5px] text-orange-600 dark:text-orange-400 font-medium block truncate">{tx('invoices.pendingDeferred', 'مؤجلة معلقة')}</span>
                  <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400 tabular-nums">{stats.pendingDebts}</span>
                </button>
                <button
                  type="button"
                  onClick={handleKpiToday}
                  className={cn(
                    "py-2 px-1 rounded-xl border text-center transition-colors select-none hover:shadow-xs cursor-pointer",
                    activeKpi === 'today'
                      ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xs"
                      : "bg-background/80 border-border hover:border-emerald-500/40 shadow-xs"
                  )}
                >
                  <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{tx('invoices.todaySales', 'مبيعات اليوم')}</span>
                  <span className="text-[11px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums whitespace-nowrap">
                    {formatCurrency(todaySalesDisplay, statCurrencySymbol, statDecimals)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleKpiProfit}
                  className={cn(
                    "py-2 px-1 rounded-xl border text-center transition-colors select-none hover:shadow-xs cursor-pointer",
                    activeKpi === 'profit'
                      ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-xs"
                      : "bg-background/80 border-border hover:border-primary/40 shadow-xs"
                  )}
                >
                  <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{tx('invoices.totalProfits', 'إجمالي الأرباح')}</span>
                  <span className="text-[11px] sm:text-xs font-black text-primary font-mono tabular-nums whitespace-nowrap">
                    {formatCurrency(totalProfitDisplay, statCurrencySymbol, statDecimals)}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Unified Search + «التصفية» Button Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={tx('invoices.searchPlaceholder', 'بحث برقم الفاتورة، العميل، الهاتف...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pr-9 pl-8 text-xs bg-card border-border rounded-2xl font-medium shadow-2xs focus-visible:ring-1 focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* زر «التصفية» الموحد مع شارة عدد الفلاتر النشطة */}
            <Button
              type="button"
              onClick={() => setIsFilterSheetOpen(true)}
              variant="outline"
              className={cn(
                "h-10 px-3.5 rounded-2xl flex items-center gap-1.5 text-xs font-black transition-[colors,transform] shrink-0 border shadow-2xs active:scale-95 cursor-pointer",
                activeFiltersCount > 0
                  ? "bg-primary/10 border-primary text-primary hover:bg-primary/15"
                  : "bg-card border-border hover:bg-muted/60 text-foreground"
              )}
            >
              <Filter className="w-4 h-4 text-primary shrink-0" />
              <span>{tx('common.filter', 'التصفية')}</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-gradient-primary text-primary-foreground font-mono text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>

          {/* 3. شريط بطاقات الفلاتر النشطة (Active Filter Chips Strip) */}
          {(filterPayment !== 'all' || filterType !== 'all' || displayCurrencyFilter !== 'stored' || showRefunded) && (
            <div className="bg-muted/60 p-1 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none w-full border border-border/40 shadow-xs text-xs font-bold select-none">
              {filterPayment !== 'all' && (
                <div className="bg-card border border-border/70 text-foreground px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs">
                  <span>
                    💳 {filterPayment === 'cash' ? tx('invoices.cash', 'نقداً') : filterPayment === 'debt' ? tx('invoices.credit', 'دين') : tx('invoices.network', 'شبكة')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterPayment('all')}
                    className="text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer ml-0.5"
                    title={tx('common.clear', 'إلغاء')}
                  >
                    ✕
                  </button>
                </div>
              )}
              {filterType !== 'all' && (
                <div className="bg-card border border-border/70 text-foreground px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs">
                  <span>
                    🧾 {filterType === 'sale' ? tx('invoices.sales', 'بيع') : filterType === 'maintenance' ? tx('invoices.maintenance', 'صيانة') : tx('invoices.shipping', 'شحن')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className="text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer ml-0.5"
                    title={tx('common.clear', 'إلغاء')}
                  >
                    ✕
                  </button>
                </div>
              )}
              {displayCurrencyFilter !== 'stored' && (
                <div className="bg-card border border-border/70 text-foreground px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs">
                  <span>💱 {displayCurrencyFilter}</span>
                  <button
                    type="button"
                    onClick={() => setDisplayCurrencyFilter('stored')}
                    className="text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer ml-0.5"
                    title={tx('common.clear', 'إلغاء')}
                  >
                    ✕
                  </button>
                </div>
              )}
              {showRefunded && (
                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs">
                  <span>↩️ {tx('invoices.refundedInvoices', 'المسترجعة')}</span>
                  <button
                    type="button"
                    onClick={() => setShowRefunded(false)}
                    className="text-rose-500 hover:text-rose-700 font-mono text-xs cursor-pointer ml-0.5"
                    title={tx('common.clear', 'إلغاء')}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. ملخص الفواتير المعروضة */}
          <div className="flex items-center justify-between px-1 text-muted-foreground text-xs font-bold">
            <span>
              {tx('invoices.displayedInvoices', 'الفواتير المعروضة')}: <b className="text-foreground font-mono">{displayedInvoices.length < filteredInvoices.length ? `${displayedInvoices.length} / ${filteredInvoices.length}` : filteredInvoices.length}</b>
            </span>
          </div>

          {/* Invoices List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {isLoading ? (
              // Skeleton loading state
              [1, 2, 3, 4, 5, 6].map(i => (
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
              <div className="col-span-full">
                <Card className="rounded-2xl border-border bg-card">
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">{t('invoices.noInvoices')}</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              displayedInvoices.map((invoice) => {
                const financials = getInvoiceFinancials(invoice);
                const invUsdTotal = invoice.total || 0;
                const invUsdProfit = financials.baseProfit || 0;
                const invUpper = (invoice.currency || 'USD').toUpperCase();
                const itemCount = invoice.items?.filter(it => !it.refunded && it.quantity > 0).length || 0;
                const isFullyRefunded = invoice.status === 'refunded';
                const isPartiallyRefunded = !isFullyRefunded && (
                  refundMeta[invoice.id]?.mode === 'partial' ||
                  Boolean(invoice.items && invoice.items.length > 0 && invoice.items.some(it => it.refunded || it.quantity <= 0)) ||
                  Boolean((invoice as any).is_partially_refunded || (invoice as any).partially_refunded)
                );

                return (
                  <div
                    key={invoice.id}
                    onClick={() => handleView(invoice)}
                    className={cn(
                      "invoice-card rounded-xl p-3 border shadow-xs relative active:scale-[0.99] transition-[colors,transform] cursor-pointer select-none",
                      isFullyRefunded
                        ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60"
                        : "border-border/80 bg-card text-card-foreground hover:border-primary/40"
                    )}
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
                            <span>{t('common.view') || 'عرض'}</span>
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(invoice)} className="justify-between cursor-pointer">
                            <span>{t('common.share') || 'مشاركة'}</span>
                            <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </DropdownMenuItem>
                          {invoice.paymentType === 'debt' && invoice.status !== 'paid' && invoice.status !== 'refunded' && invoice.status !== 'cancelled' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handlePayDebt(invoice)} className="justify-between cursor-pointer">
                                <span>{t('invoices.payInstallment') || 'تسديد دفعة'}</span>
                                <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkPaid(invoice)} className="justify-between cursor-pointer">
                                <span>{t('invoices.markAsPaid') || 'تحديد كمدفوع'}</span>
                                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                              </DropdownMenuItem>
                            </>
                          )}
                          {!isFullyRefunded && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRefund(invoice)} className="justify-between text-destructive cursor-pointer">
                                <span>{t('invoices.refundInvoice') || 'استرداد الفاتورة'}</span>
                                <Undo2 className="w-3.5 h-3.5 text-destructive" />
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* السطر الأول: اسم العميل والشارات الأساسية */}
                    <div className="flex items-center flex-wrap gap-1.5 pr-0 pl-8 leading-tight min-w-0">
                      <span className="font-bold text-foreground text-xs truncate max-w-full" title={invoice.customerName}>{invoice.customerName}</span>
                      
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

                      {/* شارة الاسترداد الكلي */}
                      {isFullyRefunded && (
                        <span className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 text-[8.5px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                          <Undo2 className="w-2.5 h-2.5" />
                          {t('refundedInvoiceBadge') || t('invoices.refundedInvoiceBadge') || 'مستردة بالكامل'}
                        </span>
                      )}

                      {/* شارة الاسترداد الجزئي */}
                      {isPartiallyRefunded && (
                        <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[8.5px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                          <Layers className="w-2.5 h-2.5" />
                          {t('partiallyRefundedBadge') || t('invoices.partiallyRefundedBadge') || 'مستردة جزئياً'}
                        </span>
                      )}

                      {/* شارة الإلغاء إن وجدت */}
                      {invoice.status === 'cancelled' && (
                        <span className="bg-destructive/15 text-destructive border border-destructive/30 text-[8.5px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <XCircle className="w-2.5 h-2.5" />
                          {'ملغاة'}
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

            {/* Progressive Rendering Load More Sentinel for Invoices */}
            {displayedInvoices.length < filteredInvoices.length && (
              <div className="col-span-full pt-4 pb-2 flex flex-col items-center justify-center gap-2">
                <div ref={invoiceSentinelRef} className="h-4 w-full" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setInvoiceDisplayLimit(prev => Math.min(prev + INVOICES_BATCH_SIZE, filteredInvoices.length))}
                  className="px-5 py-2.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted text-xs font-bold transition-[colors,transform] active:scale-95 shadow-2xs flex items-center gap-2"
                >
                  <span>{tx('invoices.loadMore', 'عرض المزيد من الفواتير')}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({displayedInvoices.length} / {filteredInvoices.length})
                  </span>
                </button>
              </div>
            )}
          </div>
        </TabsContent>

    <TabsContent value="purchases" className="space-y-6 m-0">
      <PurchaseInvoicesListTab />
    </TabsContent>
  </Tabs>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),38rem)] max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
          <DialogHeader className="shrink-0 p-4 pb-3 border-b border-border/50 text-start bg-muted/30">
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
              : ((exchangeRates.TRY && exchangeRates.TRY > 0) ? exchangeRates.TRY : 1);
            const c2Rate = (selectedInvoice.currency === 'SYP' && typeof selectedInvoice.exchangeRate === 'number' && selectedInvoice.exchangeRate > 0)
              ? selectedInvoice.exchangeRate
              : ((exchangeRates.SYP && exchangeRates.SYP > 0) ? exchangeRates.SYP : 1);

            const c1Symbol = resolveInvoiceCurrencySymbol('TRY', selectedInvoice.currency === 'TRY' ? (selectedInvoice.currencySymbol || currencySymbols?.TRY) : currencySymbols?.TRY);
            const c2Symbol = resolveInvoiceCurrencySymbol('SYP', selectedInvoice.currency === 'SYP' ? (selectedInvoice.currencySymbol || currencySymbols?.SYP) : currencySymbols?.SYP);

            const totalUsdStr = formatCurrency(baseInvTotal, currencySymbols?.USD || '$', 2);

            return (
            <div className="flex-1 min-h-0 space-y-4 p-4 sm:p-5 overflow-y-auto">
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
                    <span>{currencyNames?.[selectedFinancials.code] || resolveInvoiceCurrencyName(selectedFinancials.code, selectedInvoice.currencyName)}</span>
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

              <div className="pt-3 flex items-center gap-2">
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 h-auto rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-98 transition-[colors,transform] cursor-pointer"
                  onClick={() => handlePrint(selectedInvoice)}
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('common.print') || 'طباعة الفاتورة'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="px-4 py-2.5 h-auto rounded-2xl flex items-center justify-center gap-2 border-border font-bold active:scale-98 transition-[colors,transform] cursor-pointer"
                  onClick={() => {
                    setShowViewDialog(false);
                    handleShare(selectedInvoice);
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t('common.share') || 'مشاركة'}</span>
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Share Bottom Sheet */}
      <Dialog open={showShareSheet} onOpenChange={showShareSheet => setShowShareSheet(showShareSheet)}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 max-w-md mx-auto rounded-t-3xl rounded-b-none border-t border-border bg-card text-card-foreground p-0 max-h-[85vh] max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl laser-sheet-content">
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
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 h-auto rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-[colors,transform]"
                    disabled={isGeneratingShare}
                    onClick={() => executeShareInvoice(invoiceToShare, 'image')}
                  >
                    {isGeneratingShare ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('common.loading') || 'جاري استخراج ومشاركة الصورة...'}</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
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
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 max-w-xl mx-auto rounded-t-3xl rounded-b-none border-t border-border bg-card text-card-foreground p-0 max-h-[92vh] max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl bottom-sheet-content">
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
                <Button
                  type="button"
                  variant={refundMode === 'full' ? 'default' : 'outline'}
                  className="h-auto min-h-10 whitespace-normal text-xs gap-1.5"
                  onClick={() => setRefundMode('full')}
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  {t('invoices.fullRefund') || 'استرداد كلي'}
                </Button>
                <Button
                  type="button"
                  variant={refundMode === 'partial' ? 'default' : 'outline'}
                  className={cn(
                    "h-auto min-h-10 whitespace-normal text-xs gap-1.5",
                    !canPartialRefund && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!canPartialRefund}
                  onClick={() => {
                    if (canPartialRefund) {
                      setRefundMode('partial');
                    }
                  }}
                  title={!canPartialRefund ? (t('invoices.partialRefundNotAvailable') || 'الاسترداد الجزئي يتطلب أكثر من صنف أو أكثر من قطعة') : undefined}
                >
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
                <Undo2 className={cn('w-4 h-4', refundGuard.isRunning && 'animate-spin')} />
                {refundGuard.isRunning ? (t('common.loading') || 'جاري الاسترداد...') : (t('confirmReturnAction') || t('invoices.confirmFullRefund') || 'تأكيد الاسترجاع')}
              </Button>
            ) : (
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={confirmPartialRefund}
                disabled={refundGuard.isRunning || !partialRefundStats.isValid}
                aria-busy={refundGuard.isRunning}
              >
                <Layers className={cn('w-4 h-4', refundGuard.isRunning && 'animate-spin')} />
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
        <DialogContent className="w-[min(calc(100vw-1.5rem),30rem)] max-h-[calc(100dvh-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-success" />
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
                        ≈ {formatNumber(maxInCurrency)} {resolveInvoiceCurrencySymbol(paymentCurrency, currencySymbols?.[paymentCurrency])}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* اختيار عملة السداد */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('invoices.receivedCurrency') || 'عملة الدفع المستلمة'}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(enabledCurrencies).map(([code, isEnabled]) => {
                    if (!isEnabled) return null;
                    const isSelected = paymentCurrency === code;
                    const sym = resolveInvoiceCurrencySymbol(code, currencySymbols?.[code]);
                    const name = currencyNames?.[code] || resolveInvoiceCurrencyName(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        disabled={isSubmittingPayment}
                        onClick={() => {
                          setPaymentCurrency(code);
                          setPaymentAmountInput('');
                        }}
                        className={cn(
                          "min-h-[4.3rem] p-2 rounded-lg border transition-colors flex flex-col items-center justify-center gap-1 leading-tight text-center",
                          isSubmittingPayment && "opacity-50 cursor-not-allowed",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                        )}
                      >
                        <span className="text-sm font-bold">{code === 'USD' ? '💵 ' : sym + ' '}{name}</span>
                        <span className="text-xs font-normal opacity-80">({code})</span>
                      </button>
                    );
                  })}
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
                    {t('invoices.paymentAmount')} ({paymentCurrency === 'USD' ? '$' : (resolveInvoiceCurrencySymbol(paymentCurrency, currencySymbols?.[paymentCurrency]))})
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
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('invoices.payingDebt') || 'جاري الدفع...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{t('debts.confirmPayment') || 'تأكيد الدفع'}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. The Smart Filter Sheet (لوحة التصفية الشاملة السلسة) */}
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-w-md sm:max-w-lg mx-auto rounded-t-3xl border-t border-border bg-card text-card-foreground p-0 max-h-[88vh] flex flex-col shadow-2xl overflow-hidden focus:outline-none"
        >
          {/* Laser Accent Line */}
          <div className="h-[2.5px] w-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-xs" />

          {/* Grab Handle */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2.5 shrink-0" />

          {/* Sheet Header */}
          <div className="px-5 pb-3 border-b border-border/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="font-black text-sm text-foreground leading-tight text-right">
                  {tx('invoices.filterSheetTitle', 'لوحة الفلاتر والتصفية الذكية')}
                </SheetTitle>
                <SheetDescription className="text-[10px] text-muted-foreground font-medium text-right">
                  {tx('invoices.filterSheetSubtitle', 'حدد المعايير المطلوبة لعرض الفواتير بدقة')}
                </SheetDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="text-primary hover:text-primary/80 text-xs font-bold px-2 py-1 h-auto rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 ml-1" />
              <span>{tx('common.reset', 'إعادة ضبط')}</span>
            </Button>
          </div>

          {/* Scrollable Filter Controls */}
          <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden w-full max-w-full box-border text-xs font-bold flex-1">
            {/* 1. Time Period */}
            <div>
              <label className="text-foreground text-xs block mb-2 font-black flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{tx('invoices.timePeriod', 'الفترة الزمنية:')}</span>
              </label>
              <div className="grid grid-cols-5 gap-1 text-center">
                {[
                  { id: 'today' as const, label: tx('reports.today', 'اليوم') },
                  { id: 'week' as const, label: tx('reports.thisWeek', 'الأسبوع') },
                  { id: 'month' as const, label: tx('reports.thisMonth', 'الشهر') },
                  { id: 'year' as const, label: tx('reports.thisYear', 'العام') },
                  { id: 'all' as const, label: tx('invoices.allInvoices', 'الكل') },
                ].map((p) => {
                  const isSelected = dateQuickFilter === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSetPeriod(p.id)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-colors border cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date / Range Selector in Sheet */}
              <div className="mt-2.5 bg-muted/30 p-2.5 rounded-xl border border-border/70 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-bold">{tx('common.customDate', 'تاريخ مخصص:')}</span>
                  <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDateMode('single');
                        if (dateFilter) {
                          setDateQuickFilter('custom');
                          setActiveKpi(null);
                        }
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                        customDateMode === 'single'
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tx('invoices.singleDate', 'يوم محدد')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDateMode('range');
                        if (dateFrom || dateTo) {
                          setDateQuickFilter('custom');
                          setActiveKpi(null);
                        }
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                        customDateMode === 'range'
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tx('invoices.dateRange', 'من تاريخ إلى تاريخ')}
                    </button>
                  </div>
                </div>

                {customDateMode === 'single' ? (
                  <div className="flex items-center gap-1 w-full">
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
                      placeholder={tx('common.allDates', 'كل التواريخ')}
                      className="h-8 px-2 text-[11px] bg-card border-border rounded-xl flex-1"
                      highlightedDates={salesInvoiceDates}
                    />
                    {dateFilter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
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
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block">{tx('common.from', 'من:')}</span>
                      <DatePicker
                        value={dateFrom}
                        onChange={(val) => {
                          setDateFrom(val);
                          if (val || dateTo) {
                            setDateQuickFilter('custom');
                            setActiveKpi(null);
                          } else {
                            setDateQuickFilter('all');
                            setActiveKpi('total');
                          }
                        }}
                        placeholder={tx('common.fromDate', 'من تاريخ')}
                        className="h-8 px-2 text-[11px] bg-card border-border rounded-xl w-full"
                        highlightedDates={salesInvoiceDates}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block">{tx('common.to', 'إلى:')}</span>
                      <DatePicker
                        value={dateTo}
                        onChange={(val) => {
                          setDateTo(val);
                          if (val || dateFrom) {
                            setDateQuickFilter('custom');
                            setActiveKpi(null);
                          } else {
                            setDateQuickFilter('all');
                            setActiveKpi('total');
                          }
                        }}
                        placeholder={tx('common.toDate', 'إلى تاريخ')}
                        className="h-8 px-2 text-[11px] bg-card border-border rounded-xl w-full"
                        highlightedDates={salesInvoiceDates}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Payment Method */}
            <div>
              <label className="text-foreground text-xs block mb-2 font-black flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>{tx('invoices.paymentMethod', 'طريقة الدفع:')}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'all' as const, label: tx('common.all', 'الكل') },
                  { id: 'cash' as const, label: tx('invoices.cash', 'نقداً') },
                  { id: 'debt' as const, label: tx('invoices.credit', 'دين') },
                ].map((pm) => {
                  const isSelected = filterPayment === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setFilterPayment(pm.id)}
                      className={cn(
                        "py-2 px-1 rounded-xl text-xs font-bold transition-colors border cursor-pointer text-center",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Invoice Type */}
            <div>
              <label className="text-foreground text-xs block mb-2 font-black flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>{tx('invoices.invoiceType', 'نوع الفاتورة:')}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'all' as const, label: tx('common.all', 'الكل') },
                  { id: 'sale' as const, label: tx('invoices.sales', 'بيع') },
                  { id: 'maintenance' as const, label: tx('invoices.maintenance', 'صيانة') },
                ].map((it) => {
                  const isSelected = filterType === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setFilterType(it.id as any)}
                      className={cn(
                        "py-2 px-1 rounded-xl text-xs font-bold transition-colors border cursor-pointer text-center",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Invoice Status (مكتملة / مستردة) */}
            <div>
              <label className="text-foreground text-xs block mb-2 font-black flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-primary" />
                <span>{tx('invoices.status', 'حالة الفاتورة:')}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowRefunded(false)}
                  className={cn(
                    "py-2 px-1 rounded-xl text-xs font-bold transition-colors border cursor-pointer text-center",
                    !showRefunded
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {tx('invoices.activeInvoices', 'مكتملة')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefunded(true)}
                  className={cn(
                    "py-2 px-1 rounded-xl text-xs font-bold transition-colors border cursor-pointer text-center",
                    showRefunded
                      ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                      : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {tx('invoices.refundedInvoices', 'مستردة / ملغاة')}
                </button>
              </div>
            </div>

            {/* 5. Display Currency */}
            <div>
              <label className="text-foreground text-xs block mb-2 font-black flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-primary" />
                <span>{tx('invoices.displayCurrency', 'عملة العرض في القائمة:')}</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <Button
                  type="button"
                  variant={displayCurrencyFilter === 'stored' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDisplayCurrencyFilter('stored')}
                  className={cn(
                    "h-9 text-xs font-bold rounded-xl transition-colors",
                    displayCurrencyFilter === 'stored'
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border-border/60 hover:bg-muted text-muted-foreground"
                  )}
                >
                  {tx('invoices.asInInvoice', 'العملة الأصلية')}
                </Button>

                {availableFilterCurrencies.map(({ code: currCode, name, symbol: sym }) => {
                  const isSelected = displayCurrencyFilter === currCode;
                  return (
                    <Button
                      key={currCode}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDisplayCurrencyFilter(currCode)}
                      className={cn(
                        "h-9 text-xs font-bold rounded-xl transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border-border/60 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <span>{name}</span>
                      <span className="opacity-80 text-[10px] mr-1">({sym})</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* 5. Show Refunded Invoices Switch */}
            <div className="bg-muted/30 p-3 rounded-2xl border border-border/70 flex items-center justify-between">
              <div>
                <span className="text-foreground font-black block text-xs">
                  {tx('invoices.refundedInvoices', 'إظهار الفواتير المستردة')}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  تضمين {invoices.filter(i => i.status === 'refunded').length} فاتورة مستردة في القائمة
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRefunded(prev => !prev)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  showRefunded ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    showRefunded ? (isRTL ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Sheet Footer */}
          <div className="p-3 bg-muted/20 border-t border-border flex gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => {
                setIsFilterSheetOpen(false);
                toast.success(tx('invoices.filterApplied', 'تم تطبيق التصفية بنجاح'), { duration: 1500 });
              }}
              className="flex-1 bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground font-black py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{tx('common.apply', 'تطبيق التصفية')}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterSheetOpen(false)}
              className="px-5 border-border text-foreground font-bold rounded-xl text-xs cursor-pointer"
            >
              {tx('common.close', 'إغلاق')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

