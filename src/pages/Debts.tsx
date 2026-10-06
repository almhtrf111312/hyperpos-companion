import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Phone,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  Eye,
  CreditCard,
  Save,
  Loader2,
  User,
  Share2,
  Trash2
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('active');

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
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'TRY' | 'SYP'>('USD');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
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
    partially_paid: { label: t('debts.statusPartiallyPaid'), icon: DollarSign, color: 'badge-warning' },
    overdue: { label: t('debts.statusOverdue'), icon: AlertTriangle, color: 'badge-danger' },
    fully_paid: { label: t('debts.statusFullyPaid'), icon: CheckCircle, color: 'badge-success' },
  };

  const filterOptions = [
    { key: 'active', label: 'ط§ظ„ط¯ظٹظˆظ† ط§ظ„ظ†ط´ط·ط©' },
    { key: 'fully_paid', label: 'ط§ظ„ط¯ظٹظˆظ† ط§ظ„ظ…ط³ط¯ط¯ط©' },
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

    return () => {
      window.removeEventListener(EVENTS.DEBTS_UPDATED, handleUpdate);
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

  const exchangeRates = useMemo(() => {
    try {
      const raw = localStorage.getItem('hyperpos_settings_v1');
      if (!raw) return { TRY: 32, SYP: 14500 };
      const parsed = JSON.parse(raw);
      const ex = parsed?.exchangeRates;
      return {
        TRY: Number(ex?.TRY ?? 32) || 32,
        SYP: Number(ex?.SYP ?? 14500) || 14500,
      };
    } catch {
      return { TRY: 32, SYP: 14500 };
    }
  }, []);

  const currentRate = paymentCurrency === 'USD' ? 1 : exchangeRates[paymentCurrency];

  const amountUSD = useMemo(() => {
    const val = parseFloat(paymentAmountInput) || 0;
    if (val <= 0) return 0;
    if (paymentCurrency === 'USD') return Math.round(val * 100) / 100;
    return Math.round((val / currentRate) * 100) / 100;
  }, [paymentAmountInput, paymentCurrency, currentRate]);

  const maxInCurrency = useMemo(() => {
    if (!selectedDebt) return 0;
    if (paymentCurrency === 'USD') return selectedDebt.remainingDebt;
    return Math.round(selectedDebt.remainingDebt * currentRate * 100) / 100;
  }, [selectedDebt, paymentCurrency, currentRate]);

  const openPaymentDialog = async (debt: Debt) => {
    // âœ… ظ…ظ†ط¹ طھط³ط¯ظٹط¯ ط¯ظٹظ† ظ…ط±طھط¨ط· ط¨ظپط§طھظˆط±ط© ظ…ط³طھط±ط¯ط©
    if (debt.invoiceId && !debt.isCashDebt) {
      try {
        const { getInvoiceByIdCloud } = await import('@/lib/cloud/invoices-cloud');
        const invoice = await getInvoiceByIdCloud(debt.invoiceId);
        if (invoice && invoice.status === 'refunded') {
          toast.warning('âڑ ï¸ڈ ظ‡ط°ط§ ط§ظ„ط¯ظٹظ† ظ…ط±طھط¨ط· ط¨ظپط§طھظˆط±ط© ظ…ط³طھط±ط¯ط©', {
            description: `ط§ظ„ظپط§طھظˆط±ط© ط±ظ‚ظ… ${debt.invoiceId} طھظ… ط§ط³طھط±ط¯ط§ط¯ظ‡ط§ ظ…ط³ط¨ظ‚ط§ظ‹. ظ„ط§ ظٹظ…ظƒظ† طھط³ط¯ظٹط¯ ظ‡ط°ط§ ط§ظ„ط¯ظٹظ†.`,
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
    setPaymentCurrency('USD');
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

    // طھط­ط¶ظٹط± ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط´ط§ط±ظƒط©
    const shareData: DebtShareData = {
      customerName: debt.customerName,
      customerPhone: debt.customerPhone,
      totalDebt: debt.totalDebt,
      remainingDebt: debt.remainingDebt,
      currencySymbol,
      invoiceId: debt.invoiceId,
      dueDate: debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('ar-SA') : undefined,
    };

    const success = await shareDebt(shareData);
    if (success) {
      toast.success(t('debts.shareOpened'));
    }
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

      await recordPaymentWithInvoiceSyncCloud(selectedDebt.id, finalPaymentUSD, paymentOpIdRef.current);
      paymentOpIdRef.current = `debtpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // âœ… ط¥ط¶ط§ظپط© ط§ظ„ظ…ط¨ظ„ط؛ ظ„ظ„طµظ†ط¯ظˆظ‚ ظˆطھط­ط¯ظٹط« ط§ظ„ظˆط±ط¯ظٹط© ط¨ط§ظ„ط¹ظ…ظ„ط©
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

      // âœ… ط¥ط¹ط§ط¯ط© ط§ط­طھط³ط§ط¨ ط£ط±ظ‚ط§ظ… ط§ظ„ط¹ظ…ظٹظ„ ظ…ظ† ط§ظ„ظپظˆط§طھظٹط± ط§ظ„ظ†ط´ط·ط© ط¨ط¹ط¯ ط§ظ„ط³ط¯ط§ط¯ ظپظˆط±ظٹط§ظ‹
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
          ? `${paymentAmountInput} ${paymentCurrency} (ظٹط¹ط§ط¯ظ„ $${formatNumber(finalPaymentUSD)} ط¨ط³ط¹ط± طµط±ظپ ${currentRate})`
          : `$${formatNumber(finalPaymentUSD)}`;
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
      setSelectedDebt(null);
      setPaymentAmountInput('');
      setPaymentAmount(0);
      toast.success('طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط¯ظپط¹ط© ط¨ظ†ط¬ط§ط­');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ظپط´ظ„ طھط³ط¬ظٹظ„ ط§ظ„ط¯ظپط¹ط©');
    } finally {
      paymentBusyRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAddCashDebt = async () => {
    // âœ… ط­ظ…ط§ظٹط© ظ…ظ† ط§ظ„طھظƒط±ط§ط±ط§طھ
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
      setNewDebtForm({
        customerName: '',
        customerPhone: '',
        amount: 0,
        dueDate: '',
        notes: '',
      });
      toast.success(t('debts.debtAddedSuccess'));
    } finally {
      isSavingRef.current = false;
    }
  };

  return (
    <div className={cn(!embedded && "p-3 md:p-6", "space-y-4 md:space-y-6")}>
      {/* Header - hidden when embedded */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('debts.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">{t('debts.subtitle')}</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => handleAddDebtDialogChange(true)}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('debts.addCashDebt')}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.total)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('debts.total')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.remaining)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('debts.remaining')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.paid)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('debts.paid')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.overdue)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('debts.overdue')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('debts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 md:pr-10 bg-muted border-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key)}
              className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                selectedFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-3 md:space-y-4">
        {filteredDebts.map((debt, index) => {
          const status = statusConfig[debt.status];
          const StatusIcon = status.icon;
          const progress = (debt.totalPaid / debt.totalDebt) * 100;

          return (
            <div
              key={debt.id}
              className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 card-hover fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col gap-4">
                {/* Customer Info */}
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-base md:text-xl font-bold text-primary-foreground">
                      {debt.customerName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground text-sm md:text-base">{debt.customerName}</h3>
                            {debt.pending_sync && (
                              <Badge variant={debt.sync_failed ? 'destructive' : 'outline'} className={!debt.sync_failed ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : ''}>
                                {debt.sync_failed ? '\u0641\u0634\u0644 \u0641\u064A \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629' : '\u063A\u064A\u0631 \u0645\u062A\u0632\u0627\u0645\u0646\u0629'}
                              </Badge>
                            )}
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium",
                        status.color
                      )}>
                        <StatusIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        {status.label}
                      </span>
                      {debt.isCashDebt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-accent/20 text-accent">
                          {t('debts.cash')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {debt.customerPhone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {debt.dueDate}
                      </span>
                      {debt.cashierName && (
                        <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-[10px] md:text-xs">
                          ًں‘¤ {debt.cashierName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs md:text-sm mb-1.5 md:mb-2">
                    <span className="text-muted-foreground">{t('debts.progress')}</span>
                    <span className="font-medium text-foreground">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground mt-1">
                    <span>{t('debts.paidAmount')}: {formatCurrency(debt.totalPaid)}</span>
                    <span>{t('debts.totalAmount')}: {formatCurrency(debt.totalDebt)}</span>
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">{t('debts.remainingAmount')}</p>
                    <p className={cn(
                      "text-lg md:text-2xl font-bold",
                      debt.remainingDebt > 0 ? "text-destructive" : "text-success"
                    )}>
                      {formatCurrency(debt.remainingDebt)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(debt)}>
                      <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                      {t('common.view')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 md:h-9 text-xs md:text-sm" onClick={() => handleShareDebt(debt)}>
                      <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                      {t('common.share')}
                    </Button>
                    {debt.remainingDebt > 0 && (
                      <Button size="sm" className="h-8 md:h-9 bg-success hover:bg-success/90 text-xs md:text-sm" onClick={() => openPaymentDialog(debt)}>
                        <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                        {t('debts.payment')}
                      </Button>
                    )}
                    {/* âœ… ط²ط± ط­ط°ظپ ط§ظ„ط¯ظٹظ† */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 md:h-9 text-xs md:text-sm"
                      onClick={() => {
                        setSelectedDebt(debt);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Cash Debt Dialog */}
      <Dialog open={showAddDebtDialog} onOpenChange={handleAddDebtDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {t('debts.addCashDebt')}
            </DialogTitle>
            <DialogDescription>
              {t('debts.addDebtWithoutInvoice')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('debts.customerName')} *</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('debts.customerName')}
                  value={newDebtForm.customerName}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, customerName: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.phone')} *</label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="+963 xxx xxx xxx"
                  value={newDebtForm.customerPhone}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, customerPhone: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('debts.amount')} ($) *</label>
              <div className="relative">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0"
                  value={newDebtForm.amount || ''}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, amount: Number(e.target.value) })}
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('debts.dueDate')} *</label>
              <DatePicker
                value={newDebtForm.dueDate}
                onChange={(date) => setNewDebtForm({ ...newDebtForm, dueDate: date })}
                placeholder={t('debts.selectDueDate')}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.notes')}</label>
              <Input
                placeholder={t('debts.notesPlaceholder')}
                value={newDebtForm.notes}
                onChange={(e) => setNewDebtForm({ ...newDebtForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleAddDebtDialogChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddCashDebt}>
                <Save className="w-4 h-4 ml-2" />
                {t('common.save')}
              </Button>
            </div>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              {t('debts.recordPayment')}
            </DialogTitle>
            <DialogDescription>
              {t('debts.recordPaymentFor')} {selectedDebt?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">{t('debts.totalDebt')}</span>
                  <span className="font-bold">{formatCurrency(selectedDebt.totalDebt)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">{t('debts.paidSoFar')}</span>
                  <span className="font-bold text-success">{formatCurrency(selectedDebt.totalPaid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">{t('debts.remaining')}</span>
                  <div className="text-left">
                    <span className="font-bold text-destructive block">{formatCurrency(selectedDebt.remainingDebt)}</span>
                    {paymentCurrency !== 'USD' && (
                      <span className="text-xs text-muted-foreground block font-mono">
                        â‰ˆ {formatNumber(maxInCurrency)} {paymentCurrency === 'TRY' ? 'â‚؛' : 'ظ„.ط³'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ط§ط®طھظٹط§ط± ط¹ظ…ظ„ط© ط§ظ„ط³ط¯ط§ط¯ */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ط¹ظ…ظ„ط© ط§ظ„ط¯ظپط¹ ط§ظ„ظ…ط³طھظ„ظ…ط©</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setPaymentCurrency('USD');
                      setPaymentAmountInput('');
                    }}
                    className={cn(
                      "min-h-[60px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 leading-tight text-center",
                      isSubmitting && "opacity-50 cursor-not-allowed",
                      paymentCurrency === 'USD'
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                  >
                    <span className="text-sm font-bold">ًں’µ ط¯ظˆظ„ط§ط±</span>
                    <span className="text-xs font-normal opacity-80">(USD)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setPaymentCurrency('TRY');
                      setPaymentAmountInput('');
                    }}
                    className={cn(
                      "min-h-[60px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 leading-tight text-center",
                      isSubmitting && "opacity-50 cursor-not-allowed",
                      paymentCurrency === 'TRY'
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                  >
                    <span className="text-sm font-bold">â‚؛ طھط±ظƒظٹ</span>
                    <span className="text-xs font-normal opacity-80">(TRY)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setPaymentCurrency('SYP');
                      setPaymentAmountInput('');
                    }}
                    className={cn(
                      "min-h-[60px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 leading-tight text-center",
                      isSubmitting && "opacity-50 cursor-not-allowed",
                      paymentCurrency === 'SYP'
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                  >
                    <span className="text-sm font-bold">ظ„.ط³ ط³ظˆط±ظٹ</span>
                    <span className="text-xs font-normal opacity-80">(SYP)</span>
                  </button>
                </div>
                {paymentCurrency !== 'USD' && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 px-1 flex items-center justify-between">
                    <span>ط³ط¹ط± ط§ظ„طµط±ظپ ط§ظ„ظ…ط¹طھظ…ط¯:</span>
                    <span className="font-mono font-bold text-foreground">1 $ = {currentRate} {paymentCurrency}</span>
                  </p>
                )}
              </div>


              {/* ط­ظ‚ظ„ ط¥ط¯ط®ط§ظ„ ط§ظ„ظ…ط¨ظ„ط؛ */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">
                    ظ…ط¨ظ„ط؛ ط§ظ„ط¯ظپط¹ط© ({paymentCurrency === 'USD' ? '$' : paymentCurrency === 'TRY' ? 'â‚؛' : 'ظ„.ط³'})
                  </label>
                  {paymentCurrency !== 'USD' && amountUSD > 0 && (
                    <span className="text-xs font-bold text-success font-mono">
                      â‰ˆ ${formatNumber(amountUSD)}
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
                  disabled={isSubmitting}
                />

                {/* ط§ظ„ظ…ط¹ط§ط¯ظ„ ط¨ط§ظ„ط¯ظˆظ„ط§ط± ط¥ط°ط§ ظƒط§ظ†طھ ط§ظ„ط¹ظ…ظ„ط© ط£ط¬ظ†ط¨ظٹط© */}
                {paymentCurrency !== 'USD' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…ط¹ط§ط¯ظ„ ط¨ط§ظ„ط¯ظˆظ„ط§ط± ط§ظ„ظ…ط®طµظˆظ… ظ…ظ† ط§ظ„ط¯ظٹظ†:</span>
                    <span className="font-bold text-primary text-sm font-mono">${formatNumber(amountUSD)}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={isSubmitting}
                    onClick={() => setPaymentAmountInput(String(maxInCurrency))}
                  >
                    {t('debts.payFull')} ({maxInCurrency} {paymentCurrency})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={isSubmitting}
                    onClick={() => setPaymentAmountInput(String(Math.round((maxInCurrency / 2) * 100) / 100))}
                  >
                    {t('debts.payHalf')}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => setShowPaymentDialog(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={handlePayment}
                  disabled={isSubmitting || amountUSD <= 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      <span>ط¬ط§ط±ظٹ ط§ظ„ط¯ظپط¹...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 ml-2" />
                      <span>{t('debts.confirmPayment')}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              {t('debts.debtDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-xl font-bold text-primary-foreground">
                    {selectedDebt.customerName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedDebt.customerName}</h3>
                  <p className="text-muted-foreground">{selectedDebt.customerPhone}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{t('debts.invoiceId')}</span>
                    <span className="font-medium font-mono">{selectedDebt.invoiceId}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{t('debts.createdAt')}</span>
                    <span className="font-medium" dir="ltr">
                      {formatDateTime(new Date(selectedDebt.createdAt))}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{t('debts.dueDate')}</span>
                    <span className="font-medium">{selectedDebt.dueDate}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{t('debts.totalDebt')}</span>
                    <span className="font-bold">{formatCurrency(selectedDebt.totalDebt)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{t('debts.paid')}</span>
                    <span className="font-bold text-success">{formatCurrency(selectedDebt.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{t('debts.remaining')}</span>
                    <span className="font-bold text-destructive">{formatCurrency(selectedDebt.remainingDebt)}</span>
                  </div>
                </div>

                {/* Items Table */}
                {!selectedDebt.isCashDebt && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('invoices.products')}:</span>
                    {isLoadingItems ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Loading items...
                      </div>
                    ) : debtItems.length > 0 ? (
                      <div className="bg-muted rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                        {debtItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                            <span>{item.name} <span className="text-muted-foreground">أ—{item.quantity}</span></span>
                            <span className="font-medium">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-sm text-muted-foreground italic">
                        No items found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedDebt.notes && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">{t('common.notes')}:</p>
                  <p className="text-sm">{selectedDebt.notes}</p>
                </div>
              )}

              {selectedDebt.remainingDebt > 0 && (
                <Button
                  className="w-full bg-success hover:bg-success/90"
                  onClick={() => {
                    setShowViewDialog(false);
                    openPaymentDialog(selectedDebt);
                  }}
                >
                  <DollarSign className="w-4 h-4 ml-2" />
                  {t('debts.recordPayment')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {t('common.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDebt && (
                <>
                  ظ‡ظ„ ط£ظ†طھ ظ…طھط£ظƒط¯ ظ…ظ† ط­ط°ظپ ط¯ظٹظ† <strong>{selectedDebt.customerName}</strong> ط¨ظ‚ظٹظ…ط© <strong>{formatCurrency(selectedDebt.totalDebt)}</strong>طں
                  <br />
                  <span className="text-destructive">ظ‡ط°ط§ ط§ظ„ط¥ط¬ط±ط§ط، ظ„ط§ ظٹظ…ظƒظ† ط§ظ„طھط±ط§ط¬ط¹ ط¹ظ†ظ‡.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGuard.isRunning}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteGuard.isRunning}
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteGuard.run(async () => {
                if (!selectedDebt) return;
                const debtSnapshot = selectedDebt;
                const toastId = `delete-debt-${debtSnapshot.id}`;
                // Close dialog immediately for responsive UX
                setShowDeleteDialog(false);
                setSelectedDebt(null);
                toast.loading('ط¬ط§ط±ظٹ ط§ظ„ط­ط°ظپ...', { id: toastId });
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
              {deleteGuard.isRunning ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ط°ظپ...' : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

