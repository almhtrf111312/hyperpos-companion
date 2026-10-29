import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Phone,
  Calendar,
  Banknote,
  AlertTriangle,
  Clock,
  CheckCircle,
  Eye,
  CreditCard,
  Save,
  Loader2,
  User,
  Share2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatMoney, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/lib/sonner-bridge';
import { showSmartToast } from '@/hooks/use-smart-toast';
import { useCurrency, formatInCurrency, loadDefaultCurrencyCode, loadEnabledCurrencies } from '@/hooks/use-currency';
import { resolveCurrencyMeta } from '@/lib/currencies';
import { EVENTS, emitEvent } from '@/lib/events';
import {
  loadDebtsCloud,
  addDebtCloud,
  recordPaymentWithInvoiceSyncCloud,
  getDebtsStatsCloud,
  deleteDebtCloud,
  getNextManualDebtId,
  Debt,
  invalidateDebtsCache,
} from '@/lib/cloud/debts-cloud';
import { getInvoiceByIdCloud, InvoiceItem } from '@/lib/cloud/invoices-cloud';
import { confirmPendingProfit } from '@/lib/partners-store';
import { confirmPendingProfitCloud } from '@/lib/cloud/partners-cloud';
import { updateCustomerStatsCloud } from '@/lib/cloud/customers-cloud';
import { useActionGuard } from '@/hooks/use-action-guard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addActivityLog } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useMoney } from '@/hooks/use-money';
import { processDebtPayment } from '@/lib/unified-transactions';
import { shareDebt, DebtShareData } from '@/lib/native-share';

interface DebtsProps {
  embedded?: boolean;
  onAddDebt?: boolean;
  onAddDebtChange?: (open: boolean) => void;
}

export default function Debts({ embedded, onAddDebt, onAddDebtChange }: DebtsProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const m = useMoney();
  const [searchParams, setSearchParams] = useSearchParams();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('active');
  const { currencyCode, currencySymbol, exchangeRate } = useCurrency();
  const isNonUsd = currencyCode !== 'USD';

  // Dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showAddDebtDialog, setShowAddDebtDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const paymentBusyRef = useRef(false);
  const paymentOpIdRef = useRef(`debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const autoOpenProcessedRef = useRef<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteGuard = useActionGuard();
  const isSavingRef = useRef(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentCurrency, setPaymentCurrency] = useState<string>(() => loadDefaultCurrencyCode());
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const enabledCurrencies = useMemo(() => loadEnabledCurrencies(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debtItems, setDebtItems] = useState<InvoiceItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Form for adding cash debt
  const [newDebtForm, setNewDebtForm] = useState({
    customerName: '',
    customerPhone: '',
    amount: 0,
    dueDate: '',
    notes: '',
  });

  const statusConfig = {
    due: { label: t('debts.statusDue'), icon: Clock, color: 'badge-info' },
    partially_paid: { label: t('debts.statusPartiallyPaid'), icon: Banknote, color: 'badge-warning' },
    overdue: { label: t('debts.statusOverdue'), icon: AlertTriangle, color: 'badge-danger' },
    fully_paid: { label: t('debts.statusFullyPaid'), icon: CheckCircle, color: 'badge-success' },
  };

  const filterOptions = [
    { key: 'active', label: 'الديون النشطة' },
    { key: 'fully_paid', label: 'الديون المسددة' },
    { key: 'all', label: t('common.all') },
    { key: 'due', label: t('debts.statusDue') },
    { key: 'partially_paid', label: t('debts.statusPartiallyPaid') },
    { key: 'overdue', label: t('debts.statusOverdue') },
  ];

  // Load debts from store
  useEffect(() => {
    const loadData = async () => {
      const debtsData = await loadDebtsCloud();
      setDebts(debtsData);
    };
    loadData();

    // Listen for updates
    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.DEBTS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.APP_REFRESH, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.DEBTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.APP_REFRESH, handleUpdate);
    };
  }, []);

  // Sync embedded add debt dialog
  useEffect(() => {
    if (onAddDebt !== undefined) {
      setShowAddDebtDialog(onAddDebt);
    }
  }, [onAddDebt]);

  // Notify parent when dialog closes
  const handleAddDebtDialogChange = (open: boolean) => {
    setShowAddDebtDialog(open);
    onAddDebtChange?.(open);
  };

  // Fetch items for selected debt
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedDebt || selectedDebt.isCashDebt || !selectedDebt.invoiceId) {
        setDebtItems([]);
        return;
      }

      setIsLoadingItems(true);
      try {
        const invoice = await getInvoiceByIdCloud(selectedDebt.invoiceId);
        if (invoice && invoice.items) {
          setDebtItems(invoice.items);
        } else {
          setDebtItems([]);
        }
      } catch (error) {
        console.error('Error fetching debt items:', error);
        setDebtItems([]);
      } finally {
        setIsLoadingItems(false);
      }
    };

    fetchItems();
  }, [selectedDebt]);

  // Auto-open payment dialog when coming from invoices page
  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    const autoOpen = searchParams.get('autoOpenPayment');

    if (!invoiceId || autoOpen !== 'true') return;
    if (autoOpenProcessedRef.current === invoiceId) return;

    let isMounted = true;

    const findAndOpenPayment = async () => {
      let list = debts;
      if (list.length === 0) {
        list = await loadDebtsCloud();
        if (isMounted && list.length > 0) {
          setDebts(list);
        }
      }

      if (!isMounted) return;

      const targetDebt = list.find(d => d.invoiceId === invoiceId || d.id === invoiceId);
      if (targetDebt && targetDebt.remainingDebt > 0) {
        autoOpenProcessedRef.current = invoiceId;
        openPaymentDialog(targetDebt);
        setSearchParams({}, { replace: true });
      }
    };

    findAndOpenPayment();

    return () => {
      isMounted = false;
    };
  }, [debts, searchParams, setSearchParams]);

  const filteredDebts = debts.filter(debt => {
    const matchesSearch = debt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      debt.customerPhone.includes(searchQuery) ||
      debt.invoiceId.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesFilter = true;
    if (selectedFilter === 'active') {
      matchesFilter = debt.remainingDebt > 0 && debt.status !== 'fully_paid';
    } else if (selectedFilter === 'fully_paid') {
      matchesFilter = debt.remainingDebt <= 0 || debt.status === 'fully_paid';
    } else if (selectedFilter !== 'all') {
      matchesFilter = debt.status === selectedFilter;
    }

    return matchesSearch && matchesFilter;
  });

  const [stats, setStats] = useState({ total: 0, remaining: 0, paid: 0, overdue: 0, count: 0, activeCount: 0 });

  useEffect(() => {
    getDebtsStatsCloud().then(setStats);
  }, [debts]);

  const availableCurrencies = m.enabledCurrencies;
  const currentDef = m.getCurrencyDef(paymentCurrency);
  const currentRate = paymentCurrency === 'USD' ? 1 : (currentDef.rate > 0 ? currentDef.rate : 1);

  const currencySymbols = useMemo(() => {
    const map: Record<string, string> = {};
    availableCurrencies.forEach(c => { map[c.code] = c.symbol; });
    return map;
  }, [availableCurrencies]);

  const currencyNames = useMemo(() => {
    const map: Record<string, string> = {};
    availableCurrencies.forEach(c => { map[c.code] = c.name; });
    return map;
  }, [availableCurrencies]);

  const amountUSD = useMemo(() => {
    const val = parseFloat(paymentAmountInput) || 0;
    if (val <= 0) return 0;
    return m.toUsd(val, paymentCurrency, currentRate);
  }, [paymentAmountInput, paymentCurrency, currentRate, m]);

  const maxInCurrency = useMemo(() => {
    if (!selectedDebt) return 0;
    const raw = m.fromUsd(selectedDebt.remainingDebt, paymentCurrency, currentRate);
    return m.roundForCurrency(raw, paymentCurrency);
  }, [selectedDebt, paymentCurrency, currentRate, m]);

  const openPaymentDialog = async (debt: Debt) => {
    // ✅ منع تسديد دين مرتبط بفاتورة مستردة
    if (debt.invoiceId && !debt.isCashDebt) {
      try {
        const { getInvoiceByIdCloud } = await import('@/lib/cloud/invoices-cloud');
        const invoice = await getInvoiceByIdCloud(debt.invoiceId);
        if (invoice && invoice.status === 'refunded') {
          toast.warning('⚠️ هذا الدين مرتبط بفاتورة مستردة', {
            description: `الفاتورة رقم ${debt.invoiceId} تم استردادها مسبقاً. لا يمكن تسديد هذا الدين.`,
            duration: 5000,
          });
          return;
        }
      } catch (err) {
        console.warn('[openPaymentDialog] Could not verify invoice status:', err);
      }
    }
    let fresh = debt;
    try {
      invalidateDebtsCache();
      const list = await loadDebtsCloud();
      setDebts(list);
      fresh = list.find(d => d.id === debt.id) || debt;
    } catch { /* use cached */ }
    paymentOpIdRef.current = `debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSelectedDebt(fresh);
    setPaymentCurrency(loadDefaultCurrencyCode());
    setPaymentAmountInput('');
    setPaymentAmount(0);
    setShowPaymentDialog(true);
  };

  const openViewDialog = (debt: Debt) => {
    setSelectedDebt(debt);
    setShowViewDialog(true);
  };

  // Share debt via native share (works on Android)
  const handleShareDebt = async (debt: Debt) => {
    // Load store settings
    let storeName = 'FlowPOS Pro';
    let storePhone = '';
    let currencySymbol = '$';
    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storePhone = settings.storeSettings?.phone || '';
        currencySymbol = settings.currencySymbol || '$';
      }
    } catch { }

    const shareData: DebtShareData = {
      customerName: debt.customerName,
      customerPhone: debt.customerPhone,
      totalDebt: debt.totalDebt,
      remainingDebt: debt.remainingDebt,
      currencySymbol: currencySymbol || '$',
      currency: currencyCode,
      exchangeRate: exchangeRate,
      invoiceId: debt.invoiceId,
      dueDate: debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('ar-SA') : undefined,
    };

    await shareDebt(shareData);
  };

  const handlePayment = async () => {
    if (paymentBusyRef.current || isSubmitting) return;
    if (!selectedDebt || amountUSD <= 0) {
      toast.error(t('debts.enterValidAmount'));
      return;
    }

    setIsSubmitting(true);
    paymentBusyRef.current = true;

    try {
      // ط§ظ‚ط±ط£ ط§ظ„ط±طµظٹط¯ ط§ظ„ط­ظ‚ظٹظ‚ظٹ ظ…ظ† ط§ظ„ط®ط§ط¯ظ… ظ‚ط¨ظ„ ط§ظ„طھط­ظ‚ظ‚
      invalidateDebtsCache();
      const latestList = await loadDebtsCloud();
      const latest = latestList.find(d => d.id === selectedDebt.id) || selectedDebt;
      const remainingNow = Math.round(latest.remainingDebt * 100) / 100;

      let finalPaymentUSD = amountUSD;
      if (finalPaymentUSD > remainingNow) {
        if (finalPaymentUSD - remainingNow <= 0.05) {
          finalPaymentUSD = remainingNow;
        } else {
          setDebts(latestList);
          setSelectedDebt(latest);
          toast.error(t('debts.amountExceedsRemaining'));
          return;
        }
      }

      const paymentRatio = remainingNow > 0 ? finalPaymentUSD / remainingNow : 1;

      await recordPaymentWithInvoiceSyncCloud(
        selectedDebt.id,
        finalPaymentUSD,
        paymentOpIdRef.current,
        paymentCurrency,
        parseFloat(paymentAmountInput) || finalPaymentUSD,
        currentDef.rate,
        'cash'
      );
      paymentOpIdRef.current = `debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // ✅ إضافة المبلغ للصندوق وتحديث الوردية بالعملة
      processDebtPayment(
        finalPaymentUSD,
        selectedDebt.customerId,
        user?.id,
        profile?.full_name || user?.email || t('common.user'),
        paymentCurrency,
        parseFloat(paymentAmountInput) || finalPaymentUSD,
        'cash'
      );

      // Confirm pending profits proportionally to payment (ظ…ط­ظ„ظٹط§ظ‹ + ط³ط­ط§ط¨ظٹط§ظ‹)
      confirmPendingProfit(selectedDebt.invoiceId, paymentRatio);
      confirmPendingProfitCloud(selectedDebt.invoiceId, paymentRatio);

      // ✅ إعادة احتساب أرقام العميل من الفواتير النشطة بعد السداد فورياً
      try {
        const { loadCustomersCloud, updateCustomerStatsCloud, invalidateCustomersCache } = await import('@/lib/cloud/customers-cloud');
        const { invalidateInvoicesCache } = await import('@/lib/cloud/invoices-cloud');
        invalidateInvoicesCache();
        invalidateCustomersCache();
        const customers = await loadCustomersCloud();
        const customer = customers.find(c =>
          c.name.trim().toLowerCase() === (selectedDebt.customerName || '').trim().toLowerCase() ||
          (selectedDebt.customerPhone && c.phone === selectedDebt.customerPhone)
        );
        if (customer) await updateCustomerStatsCloud(customer.id);
      } catch (err) {
        console.warn('[Debts] Failed to update customer stats cloud:', err);
      }
      emitEvent(EVENTS.CUSTOMERS_UPDATED, null);

      // Log activity
      if (user) {
        const currDesc = paymentCurrency !== 'USD'
          ? `${paymentAmountInput} ${paymentCurrency} (يعادل ${formatMoney(finalPaymentUSD, 'USD')} بسعر صرف ${currentRate})`
          : formatMoney(finalPaymentUSD, paymentCurrency);
        addActivityLog(
          'debt_paid',
          user.id,
          profile?.full_name || user.email || t('common.user'),
          `${t('debts.paymentRecorded')} ${currDesc} - ${selectedDebt.customerName}`,
          {
            debtId: selectedDebt.id,
            invoiceId: selectedDebt.invoiceId,
            customerName: selectedDebt.customerName,
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

      const debtsData = await loadDebtsCloud();
      setDebts(debtsData);

      setShowPaymentDialog(false);
      const paidAmountSnapshot = finalPaymentUSD;
      const customerSnapshot = selectedDebt?.customerName;
      setSelectedDebt(null);
      setPaymentAmountInput('');
      setPaymentAmount(0);
      showSmartToast({
        type: 'debt_sale',
        title: 'تم تسجيل دفعة الدين بنجاح',
        subtitle: customerSnapshot ? `العميل: ${customerSnapshot}` : undefined,
        primaryLabel: 'المبلغ المدفوع',
        primaryValue: `${paidAmountSnapshot} ${paymentCurrency}`,
        operation: 'سداد دين',
        duration: 4000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ظپط´ظ„ طھط³ط¬ظٹظ„ ط§ظ„ط¯ظپط¹ط©');
    } finally {
      paymentBusyRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAddCashDebt = async () => {
    // ✅ حماية من التكرارات
    if (isSavingRef.current) return;

    if (!newDebtForm.customerName || !newDebtForm.customerPhone || newDebtForm.amount <= 0) {
      toast.error(t('debts.fillRequiredFields'));
      return;
    }

    if (!newDebtForm.dueDate) {
      toast.error(t('debts.selectDueDate'));
      return;
    }

    isSavingRef.current = true;

    try {
      const manualDebtId = await getNextManualDebtId();
      await addDebtCloud({
        invoiceId: manualDebtId,
        customerName: newDebtForm.customerName,
        customerPhone: newDebtForm.customerPhone,
        totalDebt: newDebtForm.amount,
        dueDate: newDebtForm.dueDate,
        notes: newDebtForm.notes,
        isCashDebt: true,
      });

      // Log activity
      if (user) {
        addActivityLog(
          'debt_created',
          user.id,
          profile?.full_name || user.email || t('common.user'),
          `${t('debts.cashDebtCreated')} ${newDebtForm.customerName} - ${formatCurrency(newDebtForm.amount)}`,
          { amount: newDebtForm.amount, customerName: newDebtForm.customerName, isCashDebt: true }
        );
      }

      const debtsData = await loadDebtsCloud();
      setDebts(debtsData);
      handleAddDebtDialogChange(false);
      const addedDebtCustomer = newDebtForm.customerName;
      const addedDebtAmount = newDebtForm.amount;
      const addedDebtCurrency = 'USD';
      setNewDebtForm({
        customerName: '',
        customerPhone: '',
        amount: 0,
        dueDate: '',
        notes: '',
      });
      showSmartToast({
        type: 'debt_sale',
        title: t('debts.debtAddedSuccess') || 'تمت إضافة الدين بنجاح',
        subtitle: `العميل: ${addedDebtCustomer}`,
        primaryLabel: 'قيمة الدين',
        primaryValue: `${addedDebtAmount} ${currencySymbols?.[addedDebtCurrency] || addedDebtCurrency}`,
        operation: 'دين جديد',
        duration: 4000,
      });
    } finally {
      isSavingRef.current = false;
    }
  };

  return (
    <div className={cn(!embedded && "p-3 md:p-6", "space-y-4 md:space-y-6")}>
      {/* Action bar when standalone (no redundant title to save vertical space) */}
      {!embedded && (
        <div className="flex items-center justify-between gap-2 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-9 px-4 rounded-xl shadow-xs text-xs gap-1.5 transition-colors cursor-pointer"
            onClick={() => handleAddDebtDialogChange(true)}
          >
            <Plus className="w-4 h-4" />
            <span>{t('debts.addCashDebt')}</span>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center select-none">
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('debts.total')}</span>
          <span className="text-xs font-black text-foreground font-mono tabular-nums whitespace-nowrap">{formatInCurrency(stats.total, currencyCode, exchangeRate).formatted}</span>
          {isNonUsd && <span className="text-[8.5px] text-muted-foreground font-mono block">{formatInCurrency(stats.total, currencyCode, exchangeRate).usdEquivalent}</span>}
        </div>
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-destructive font-medium block truncate">{t('debts.remaining')}</span>
          <span className="text-xs font-black text-destructive font-mono tabular-nums whitespace-nowrap">{formatInCurrency(stats.remaining, currencyCode, exchangeRate).formatted}</span>
          {isNonUsd && <span className="text-[8.5px] text-muted-foreground font-mono block">{formatInCurrency(stats.remaining, currencyCode, exchangeRate).usdEquivalent}</span>}
        </div>
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">{t('debts.paid')}</span>
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums whitespace-nowrap">{formatInCurrency(stats.paid, currencyCode, exchangeRate).formatted}</span>
          {isNonUsd && <span className="text-[8.5px] text-muted-foreground font-mono block">{formatInCurrency(stats.paid, currencyCode, exchangeRate).usdEquivalent}</span>}
        </div>
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-orange-600 dark:text-orange-400 font-medium block truncate">{t('debts.overdue')}</span>
          <span className="text-xs font-black text-orange-600 dark:text-orange-400 font-mono tabular-nums whitespace-nowrap">{formatInCurrency(stats.overdue, currencyCode, exchangeRate).formatted}</span>
          {isNonUsd && <span className="text-[8.5px] text-muted-foreground font-mono block">{formatInCurrency(stats.overdue, currencyCode, exchangeRate).usdEquivalent}</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('debts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pr-9 text-xs bg-card border-border rounded-xl font-medium shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
          {filterOptions.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key)}
              className={cn(
                "px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition-colors text-[11px] shrink-0 shadow-xs border",
                selectedFilter === filter.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-muted-foreground text-[10.5px] px-1 font-semibold">
          <span>قائمة الديون</span>
          <span className="font-mono">{filteredDebts.length} ديون معروضة</span>
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-2.5">
        {filteredDebts.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد ديون مطابقة</p>
          </div>
        ) : (
          filteredDebts.map((debt) => {
            const status = statusConfig[debt.status];
            const StatusIcon = status.icon;
            const progress = debt.totalDebt > 0 ? Math.min(100, Math.round((debt.totalPaid / debt.totalDebt) * 100)) : 0;

            return (
              <div
                key={debt.id}
                onClick={() => openViewDialog(debt)}
                className="bg-card rounded-2xl p-3 border border-border shadow-xs relative hover:border-primary/40 active:scale-[0.99] transition-[border-color,transform] cursor-pointer select-none"
              >
                {/* Top-Left Options Dropdown */}
                <div className="absolute left-2.5 top-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted active:scale-90 transition-transform">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44 text-xs font-bold">
                      {debt.remainingDebt > 0 && (
                        <DropdownMenuItem onClick={() => openPaymentDialog(debt)} className="justify-between cursor-pointer">
                          <span>تسديد دفعة</span>
                          <Banknote className="w-4 h-4 text-emerald-600" />
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openViewDialog(debt)} className="justify-between cursor-pointer">
                        <span>تفاصيل الدين</span>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareDebt(debt)} className="justify-between cursor-pointer">
                        <span>مشاركة كشف الدين</span>
                        <Share2 className="w-4 h-4 text-muted-foreground" />
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedDebt(debt);
                          setShowDeleteDialog(true);
                        }}
                        className="justify-between text-destructive cursor-pointer"
                      >
                        <span>حذف الدين</span>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Header Row: Customer Name & Badges */}
                <div className="flex items-center gap-2 pr-0 pl-8 flex-wrap min-w-0">
                  <span className="font-black text-foreground text-sm truncate max-w-full" title={debt.customerName}>{debt.customerName}</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border",
                    debt.status === 'fully_paid' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                    debt.status === 'overdue' ? "bg-destructive/10 text-destructive border-destructive/20" :
                    debt.status === 'partially_paid' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                  )}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{status.label}</span>
                  </span>
                  {debt.isCashDebt && (
                    <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      سلفة نقدية
                    </span>
                  )}
                  {debt.pending_sync && (
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded border font-semibold",
                      debt.sync_failed ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {debt.sync_failed ? 'فشل المزامنة' : 'غير متزامنة'}
                    </span>
                  )}
                </div>

                {/* Meta Tags Row */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10.5px]">
                  <span className="bg-muted text-muted-foreground font-mono px-1.5 py-0.5 rounded font-bold" dir="ltr">
                    📞 {debt.customerPhone}
                  </span>
                  {debt.dueDate && (
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      📅 استحقاق: <span dir="ltr">{debt.dueDate}</span>
                    </span>
                  )}
                  {debt.invoiceId && (
                    <span className="bg-muted/70 text-muted-foreground font-mono px-1.5 py-0.5 rounded font-bold">
                      #{debt.invoiceId}
                    </span>
                  )}
                  {debt.cashierName && (
                    <span className="text-primary font-bold flex items-center gap-0.5 bg-primary/10 px-1.5 py-0.5 rounded mr-auto">
                      👤 {debt.cashierName}
                    </span>
                  )}
                </div>

                {/* Progress Line */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>نسبة السداد: <b className="text-foreground font-mono">{progress}%</b></span>
                    <span>الأصل: <b className="text-foreground font-mono">{formatInCurrency(debt.totalDebt, currencyCode, exchangeRate).formatted}</b>{isNonUsd && <span className="text-[9px] text-muted-foreground font-mono mr-1">({formatInCurrency(debt.totalDebt, currencyCode, exchangeRate).usdEquivalent})</span>}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-[width] duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Financial Box */}
                <div className="mt-2.5 pt-2 border-t border-dashed border-border flex items-end justify-between">
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <div className="font-medium">
                      المسدد: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatInCurrency(debt.totalPaid, currencyCode, exchangeRate).formatted}</span>{isNonUsd && <span className="text-[9px] text-muted-foreground font-mono mr-1">({formatInCurrency(debt.totalPaid, currencyCode, exchangeRate).usdEquivalent})</span>}
                    </div>
                  </div>
                  <div className="text-left whitespace-nowrap shrink-0">
                    <span className="text-[9.5px] text-muted-foreground block font-sans">المتبقي</span>
                    <span className={cn(
                      "text-base font-black font-mono whitespace-nowrap",
                      debt.remainingDebt > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {formatInCurrency(debt.remainingDebt, currencyCode, exchangeRate).formatted}
                    </span>
                    {isNonUsd && (
                      <span className="text-[9px] text-muted-foreground font-mono block">
                        {formatInCurrency(debt.remainingDebt, currencyCode, exchangeRate).usdEquivalent}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Cash Debt Dialog */}
      <Dialog open={showAddDebtDialog} onOpenChange={handleAddDebtDialogChange}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),28rem)] max-h-[calc(100dvh-1.5rem)] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl modal-dot-expand bg-card">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <span>{t('debts.addCashDebt')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                {t('debts.addDebtWithoutInvoice')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('debts.customerName')} *</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('debts.customerName')}
                  value={newDebtForm.customerName}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, customerName: e.target.value })}
                  className="pr-9 h-10 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('common.phone')} *</label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="+963 xxx xxx xxx"
                  value={newDebtForm.customerPhone}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, customerPhone: e.target.value })}
                  className="pr-9 h-10 rounded-xl font-mono text-xs"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('debts.amount')} ($) *</label>
              <div className="relative">
                <Banknote className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newDebtForm.amount || ''}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, amount: Number(e.target.value) })}
                  className="pr-9 h-10 rounded-xl font-mono text-sm font-bold"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('debts.dueDate')} *</label>
              <DatePicker
                value={newDebtForm.dueDate}
                onChange={(date) => setNewDebtForm({ ...newDebtForm, dueDate: date })}
                placeholder={t('debts.selectDueDate')}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('common.notes')}</label>
              <Input
                placeholder={t('debts.notesPlaceholder')}
                value={newDebtForm.notes}
                onChange={(e) => setNewDebtForm({ ...newDebtForm, notes: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>
          <div className="p-3 bg-muted/20 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs" onClick={() => handleAddDebtDialogChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1 h-9 rounded-xl text-xs font-bold" onClick={handleAddCashDebt}>
              <Save className="w-3.5 h-3.5" />
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          if (!isSubmitting) setShowPaymentDialog(open);
        }}
      >
        <DialogContent className="w-[min(calc(100vw-1.5rem),28rem)] max-h-[calc(100dvh-1.5rem)] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl modal-dot-expand bg-card">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
                <span>{t('debts.recordPayment')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                {t('debts.recordPaymentFor')} <strong className="text-foreground">{selectedDebt?.customerName}</strong>
              </DialogDescription>
            </DialogHeader>
          </div>
          {selectedDebt && (
            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('debts.totalDebt')}</span>
                  <span className="font-bold font-mono">{formatCurrency(selectedDebt.totalDebt)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('debts.paidSoFar')}</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedDebt.totalPaid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground font-semibold">{t('debts.remaining')}</span>
                  <div className="text-left">
                    <span className="font-black font-mono text-sm text-destructive block whitespace-nowrap">{formatCurrency(selectedDebt.remainingDebt)}</span>
                    {paymentCurrency !== 'USD' && (
                      <span className="text-[11px] text-muted-foreground block font-mono">
                        ≈ {formatNumber(maxInCurrency)} {currencySymbols[paymentCurrency as keyof typeof currencySymbols] || paymentCurrency}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* اختيار عملة السداد */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">عملة الدفع المستلمة</label>
                <div className="flex gap-2 flex-wrap">
                  {availableCurrencies.map((curr) => (
                    <button
                      key={curr.code}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setPaymentCurrency(curr.code);
                        setPaymentAmountInput('');
                      }}
                      className={cn(
                        "flex-1 min-w-[5rem] min-h-[3.7rem] p-2 rounded-xl border transition-colors flex flex-col items-center justify-center gap-0.5 leading-tight text-center",
                        isSubmitting && "opacity-50 cursor-not-allowed",
                        paymentCurrency === curr.code
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-xs font-bold">{curr.symbol} {curr.name}</span>
                      <span className="text-[10px] opacity-80">({curr.code})</span>
                    </button>
                  ))}
                </div>
                {paymentCurrency !== 'USD' && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 px-1 flex items-center justify-between">
                    <span>سعر الصرف المعتمد:</span>
                    <span className="font-mono font-bold text-foreground">1 $ = {currentRate} {currencySymbols[paymentCurrency] || paymentCurrency}</span>
                  </p>
                )}
              </div>

              {/* حقل إدخال المبلغ */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    مبلغ الدفعة ({currencySymbols[paymentCurrency] || (paymentCurrency === 'USD' ? '$' : paymentCurrency)})
                  </label>
                  {paymentCurrency !== 'USD' && amountUSD > 0 && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ≈ {currencySymbols.USD}{formatNumber(amountUSD)}
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
                  className="text-base font-bold font-mono h-11 rounded-xl"
                  disabled={isSubmitting}
                />

                {/* المعادل بالدولار إذا كانت العملة أجنبية */}
                {paymentCurrency !== 'USD' && (
                  <div className="mt-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">المبلغ المخصوم من الدين:</span>
                    <span className="font-bold text-primary font-mono">${formatNumber(amountUSD)}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-[11px] h-8 rounded-lg font-medium"
                    disabled={isSubmitting}
                    onClick={() => setPaymentAmountInput(String(maxInCurrency))}
                  >
                    {t('debts.payFull')} ({maxInCurrency} {currencySymbols[paymentCurrency] || paymentCurrency})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-[11px] h-8 rounded-lg font-medium"
                    disabled={isSubmitting}
                    onClick={() => setPaymentAmountInput(String(Math.round((maxInCurrency / 2) * 100) / 100))}
                  >
                    {t('debts.payHalf')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="p-3 bg-muted/20 border-t border-border flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 rounded-xl text-xs"
              disabled={isSubmitting}
              onClick={() => setShowPaymentDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePayment}
              disabled={isSubmitting || amountUSD <= 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الدفع...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('debts.confirmPayment')}</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),28rem)] max-h-[calc(100dvh-1.5rem)] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl modal-dot-expand bg-card">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <span>{t('debts.debtDetails')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                تفاصيل دين {selectedDebt?.customerName}
              </DialogDescription>
            </DialogHeader>
          </div>
          {selectedDebt && (
            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-2xl border border-border/50">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                  {selectedDebt.customerName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold truncate text-foreground">{selectedDebt.customerName}</h3>
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">{selectedDebt.customerPhone}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{t('debts.invoiceId')}</span>
                  <span className="font-semibold font-mono">{selectedDebt.invoiceId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{t('debts.createdAt')}</span>
                  <span className="font-semibold" dir="ltr">
                    {formatDateTime(new Date(selectedDebt.createdAt))}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{t('debts.dueDate')}</span>
                  <span className="font-semibold">{selectedDebt.dueDate}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{t('debts.totalDebt')}</span>
                  <span className="font-bold font-mono">{formatCurrency(selectedDebt.totalDebt)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{t('debts.paid')}</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedDebt.totalPaid)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground font-bold">{t('debts.remaining')}</span>
                  <span className="font-black font-mono text-sm text-destructive">{formatCurrency(selectedDebt.remainingDebt)}</span>
                </div>
              </div>

              {/* Items Table */}
              {!selectedDebt.isCashDebt && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-muted-foreground">{t('invoices.products')}:</span>
                  {isLoadingItems ? (
                    <div className="py-3 text-center text-xs text-muted-foreground">
                      جاري التحميل...
                    </div>
                  ) : debtItems.length > 0 ? (
                    <div className="bg-muted/40 rounded-xl p-2.5 space-y-1.5 max-h-36 overflow-y-auto border border-border/50">
                      {debtItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs py-1 border-b border-border/40 last:border-0">
                          <span className="truncate max-w-[65%]">{item.name} <span className="text-muted-foreground font-mono">×{item.quantity}</span></span>
                          <span className="font-bold font-mono shrink-0">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-muted-foreground italic">
                      لا توجد أصناف
                    </div>
                  )}
                </div>
              )}

              {selectedDebt.notes && (
                <div className="bg-muted/40 rounded-xl p-2.5 border border-border/50">
                  <p className="text-[11px] text-muted-foreground font-semibold">{t('common.notes')}:</p>
                  <p className="text-xs text-foreground mt-0.5">{selectedDebt.notes}</p>
                </div>
              )}
            </div>
          )}
          <div className="p-3 bg-muted/20 border-t border-border flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 rounded-xl text-xs"
              onClick={() => setShowViewDialog(false)}
            >
              {t('common.close') || 'إغلاق'}
            </Button>
            {selectedDebt && selectedDebt.remainingDebt > 0 && (
              <Button
                className="flex-1 h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  setShowViewDialog(false);
                  openPaymentDialog(selectedDebt);
                }}
              >
                <Banknote className="w-3.5 h-3.5" />
                {t('debts.recordPayment')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md w-[95vw] rounded-3xl p-5 border border-border shadow-2xl modal-dot-expand bg-card">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <span>{t('common.confirmDelete')}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-2">
              {selectedDebt && (
                <>
                  هل أنت متأكد من حذف دين <strong>{selectedDebt.customerName}</strong> بقيمة <strong className="font-mono text-destructive">{formatCurrency(selectedDebt.totalDebt)}</strong>؟
                  <br />
                  <span className="text-destructive font-medium mt-1 block">هذا الإجراء لا يمكن التراجع عنه.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 pt-3">
            <AlertDialogCancel disabled={deleteGuard.isRunning} className="flex-1 h-9 rounded-xl text-xs">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteGuard.isRunning}
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteGuard.run(async () => {
                if (!selectedDebt) return;
                const debtSnapshot = selectedDebt;
                const toastId = `delete-debt-${debtSnapshot.id}`;
                // Close dialog immediately for responsive UX
                setShowDeleteDialog(false);
                setSelectedDebt(null);
                toast.loading('جاري الحذف...', { id: toastId });
                try {
                  const success = await deleteDebtCloud(debtSnapshot.id);
                  if (success) {
                    toast.success(t('debts.deleteSuccess'), { id: toastId });
                    const debtsData = await loadDebtsCloud();
                    setDebts(debtsData);
                  } else {
                    toast.error(t('debts.deleteFailed'), { id: toastId });
                  }
                } catch (error) {
                  console.error('Delete debt error:', error);
                  toast.error(t('common.deleteError'), { id: toastId });
                }
              })}
            >
              {deleteGuard.isRunning ? 'جاري الحذف...' : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

