import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Receipt,
  Calendar,
  DollarSign,
  Trash2,
  Save,
  Users,
  TrendingDown,
  RefreshCw,
  Clock,
  Check,
  X,
  Bell,
  Settings2,
  Pencil,
  RotateCcw,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatNumber, formatCurrency, formatDateTime } from '@/lib/utils';
import { useMoney } from '@/hooks/use-money';
import { Button } from '@/components/ui/button';
import { SmartFab } from '@/components/ui/SmartFab';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/lib/sonner-bridge';
import {
  loadExpensesCloud,
  addExpenseCloud,
  deleteExpenseCloud,
  reverseExpenseCloud,
  getExpenseStatsCloud,
  expenseTypes,
  Expense,
  ExpenseType
} from '@/lib/cloud/expenses-cloud';
import {
  loadRecurringExpenses,
  loadRecurringExpensesCloud,
  addRecurringExpenseCloud,
  updateRecurringExpenseCloud,
  deleteRecurringExpenseCloud,
  getDueExpenses,
  payRecurringExpense,
  skipRecurringExpense,
  recurringIntervals,
  RecurringExpense
} from '@/lib/recurring-expenses-store';
import { emitEvent, EVENTS } from '@/lib/events';
import { useLanguage } from '@/hooks/use-language';
import { processExpense, reverseExpenseTransaction, restoreExpenseCash } from '@/lib/unified-transactions';
import { toLocalDateString } from '@/lib/date-utils';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Expenses() {
  const m = useMoney();
  const [expenseCurrency, setExpenseCurrency] = useState<string>(() => m.activeCode);
  const selectedCurrencyDef = m.enabledCurrencies.find(c => c.code === expenseCurrency) || m.getCurrencyDef(expenseCurrency);
  const currentExpenseDef = selectedCurrencyDef;
  const { t, isRTL } = useLanguage();

  const getLocalizedExpenseType = (type: string, fallback?: string): string => {
    const translationKey = `expenses.types.${type}`;
    const translated = (t as any)(translationKey);
    if (translated && translated !== translationKey) return translated;
    return fallback || type;
  };

  const getLocalizedInterval = (interval: { value: number; label: string; interval: string }): string => {
    return (t as any)(`expenses.intervals.${interval.interval}`) || interval.label;
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => loadRecurringExpenses());
  const [dueExpenses, setDueExpenses] = useState<RecurringExpense[]>(() => getDueExpenses());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const savingRef = useRef(false);

  // Scroll detection for Smart FAB
  const [isFabVisible, setIsFabVisible] = useState(true);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
      if (currentScrollTop < 40) {
        setIsFabVisible(true);
      } else if (currentScrollTop > lastScrollTopRef.current + 10) {
        setIsFabVisible(false);
      } else if (currentScrollTop < lastScrollTopRef.current - 10) {
        setIsFabVisible(true);
      }
      lastScrollTopRef.current = currentScrollTop;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [showRecurringListDialog, setShowRecurringListDialog] = useState(false);
  const [showEditRecurringDialog, setShowEditRecurringDialog] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [editRecurringForm, setEditRecurringForm] = useState({
    name: '',
    type: 'wages' as ExpenseType,
    customType: '',
    amount: 0,
    currency: m.activeCode,
    intervalDays: 30,
    notes: '',
    autoPay: false,
  });
  const [showPayConfirmDialog, setShowPayConfirmDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringExpense | null>(null);
  const [stats, setStats] = useState({ totalExpenses: 0, totalThisMonth: 0, expenseCount: 0, monthlyCount: 0, byType: {} as Record<string, number> });

  // Form state
  const [formData, setFormData] = useState({
    type: 'rent' as ExpenseType,
    customType: '',
    amount: 0,
    notes: '',
    date: toLocalDateString(new Date()),
  });

  // Recurring form state
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    type: 'wages' as ExpenseType,
    customType: '',
    amount: 0,
    currency: m.activeCode,
    intervalDays: 30,
    startDate: toLocalDateString(new Date()),
    notes: '',
    payImmediately: false,
    autoPay: false,
  });

  const recurringCurrencyDef = m.enabledCurrencies.find(c => c.code === (recurringForm.currency || m.activeCode)) || m.getCurrencyDef(recurringForm.currency || m.activeCode);
  const editRecurringCurrencyDef = m.enabledCurrencies.find(c => c.code === (editRecurringForm.currency || m.activeCode)) || m.getCurrencyDef(editRecurringForm.currency || m.activeCode);

  // Load expenses and recurring expenses from cloud
  useEffect(() => {
    const loadData = async () => {
      const [expensesData, statsData, recurringData] = await Promise.all([
        loadExpensesCloud(),
        getExpenseStatsCloud(),
        loadRecurringExpensesCloud(),
      ]);
      setExpenses(expensesData);
      setStats(statsData);
      setRecurringExpenses(recurringData);
      setDueExpenses(getDueExpenses());
    };
    loadData();

    const handleUpdate = () => loadData();
    const handleRecurringUpdate = async () => {
      const recurringData = await loadRecurringExpensesCloud();
      setRecurringExpenses(recurringData);
      setDueExpenses(getDueExpenses());
    };

    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.RECURRING_EXPENSES_UPDATED, handleRecurringUpdate);
    return () => {
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.RECURRING_EXPENSES_UPDATED, handleRecurringUpdate);
    };
  }, []);

  // Auto-open add dialog from URL params
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      resetForm();
      setShowAddDialog(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Auto-open pay confirmation dialog from URL param (e.g., from SyncStatusMenu)
  useEffect(() => {
    const payId = searchParams.get('payRecurringId');
    if (payId && recurringExpenses.length > 0) {
      const target = recurringExpenses.find(e => e.id === payId);
      if (target) {
        setSelectedRecurring(target);
        setShowPayConfirmDialog(true);
      }
      searchParams.delete('payRecurringId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, recurringExpenses]);

  const filteredExpenses = expenses.filter(expense =>
    expense.typeLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      type: 'rent',
      customType: '',
      amount: 0,
      notes: '',
      date: toLocalDateString(new Date()),
    });
  };

  const resetRecurringForm = () => {
    setRecurringForm({
      name: '',
      type: 'wages',
      customType: '',
      amount: 0,
      currency: m.activeCode,
      intervalDays: 30,
      startDate: toLocalDateString(new Date()),
      notes: '',
      payImmediately: false,
      autoPay: false,
    });
  };

  const setShowAddExpense = (open: boolean) => {
    if (open) resetForm();
    setShowAddDialog(open);
  };

  const handleAddExpense = async () => {
    // ✅ منع تكرار الإدخال عند الضغط المتعدد
    if (isSaving || savingRef.current) return;

    if (formData.amount <= 0) {
      toast.error(t('expenses.enterValidAmount'));
      return;
    }

    if (formData.type === 'other' && !formData.customType) {
      toast.error(t('expenses.specifyExpenseType'));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const amountUSD = m.toUsd(formData.amount, expenseCurrency, selectedCurrencyDef.rate);
      const noteSuffix = expenseCurrency !== 'USD'
        ? ` (${m.roundForCurrency(formData.amount, expenseCurrency)} ${selectedCurrencyDef.symbol})`
        : '';
      const finalNotes = formData.notes ? `${formData.notes}${noteSuffix}` : (noteSuffix.trim() || undefined);

      const created = await addExpenseCloud({
        type: formData.type,
        customType: formData.customType,
        amount: amountUSD,
        notes: finalNotes,
        date: formData.date,
      });

      if (!created) {
        toast.error(t('expenses.addError') || 'فشل في إضافة المصروف');
        return;
      }

      // ✅ خصم المبلغ من الصندوق تلقائياً بعملة الأساس
      processExpense(amountUSD, formData.type);

      const [expensesData, statsData] = await Promise.all([
        loadExpensesCloud(),
        getExpenseStatsCloud()
      ]);
      setExpenses(expensesData);
      setStats(statsData);
      setShowAddDialog(false);
      resetForm();
      toast.success(t('expenses.expenseAdded'));
      import('@/lib/activity-log').then(({ logActivity }) => logActivity('expense_added', `إضافة مصروف (${formData.type}): ${amountUSD}`, { id: created.id, amount: amountUSD, type: formData.type }));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleAddRecurringExpense = async () => {
    if (!recurringForm.name || recurringForm.amount <= 0) {
      toast.error(t('expenses.fillAllFields'));
      return;
    }

    const curr = recurringForm.currency || m.activeCode;
    const currDef = m.enabledCurrencies.find(c => c.code === curr) || m.getCurrencyDef(curr);
    const amountUSD = m.toUsd(recurringForm.amount, curr, currDef.rate);
    const currencySuffix = curr !== 'USD'
      ? ` (${m.roundForCurrency(recurringForm.amount, curr)} ${currDef.symbol})`
      : '';
    const finalNotes = recurringForm.notes
      ? `${recurringForm.notes}${currencySuffix}`
      : (currencySuffix.trim() || undefined);

    try {
      const newExpense = await addRecurringExpenseCloud({
        name: recurringForm.name,
        type: recurringForm.type,
        customType: recurringForm.customType,
        amount: amountUSD,
        currency: curr,
        exchangeRate: currDef.rate,
        intervalDays: recurringForm.intervalDays,
        startDate: recurringForm.startDate,
        notes: finalNotes,
        autoPay: recurringForm.autoPay,
      });

      if (recurringForm.payImmediately) {
        const todayStr = toLocalDateString(new Date());
        await addExpenseCloud({
          type: recurringForm.type,
          customType: recurringForm.customType || recurringForm.name,
          amount: amountUSD,
          notes: `${recurringForm.name} - دفعة سداد فوري لمصروف ثابت${currencySuffix}`,
          date: todayStr,
        });

        processExpense(amountUSD, recurringForm.type);

        const nextDate = new Date(recurringForm.startDate || todayStr);
        nextDate.setDate(nextDate.getDate() + (recurringForm.intervalDays || 30));
        await updateRecurringExpenseCloud(newExpense.id, {
          lastPaidDate: todayStr,
          nextDueDate: toLocalDateString(nextDate),
        });

        emitEvent(EVENTS.EXPENSES_UPDATED, null);
      }

      const [expensesData, statsData, recurringData] = await Promise.all([
        loadExpensesCloud(),
        getExpenseStatsCloud(),
        loadRecurringExpensesCloud(),
      ]);
      setExpenses(expensesData);
      setStats(statsData);
      setRecurringExpenses(recurringData);
      setDueExpenses(getDueExpenses());
      setShowRecurringDialog(false);
      resetRecurringForm();
      toast.success(t('expenses.fixedExpenseAdded'));
    } catch (err) {
      console.error('[Expenses] Error adding recurring expense:', err);
      toast.error(t('expenses.addRecurringError') || 'فشل في إضافة المصروف الثابت');
    }
  };

  const handleOpenEditRecurring = (expense: RecurringExpense) => {
    setEditingRecurring(expense);
    const curr = expense.currency || 'USD';
    const currDef = m.enabledCurrencies.find(c => c.code === curr) || m.getCurrencyDef(curr);
    const effectiveRate = expense.exchangeRate || currDef.rate;
    const displayAmount = curr !== 'USD'
      ? m.roundForCurrency(m.fromUsd(expense.amount, curr, effectiveRate), curr)
      : expense.amount;

    setEditRecurringForm({
      name: expense.name,
      type: expense.type,
      customType: expense.customType || '',
      amount: displayAmount,
      currency: curr,
      intervalDays: expense.intervalDays,
      notes: expense.notes ? expense.notes.replace(/\s*\[CURRENCY:[^\]]+\]/g, '').replace(/\s*\([^)]*([₺$]|ل\.س|ج\.م|ر\.س|د\.إ|د\.ع|د\.أ|ل\.ل|د\.ك|ر\.ق|د\.ب|ر\.ع)[^)]*\)/g, '').trim() : '',
      autoPay: expense.autoPay ?? false,
    });
    setShowEditRecurringDialog(true);
  };

  const handleUpdateRecurringExpense = async () => {
    if (!editingRecurring) return;
    if (!editRecurringForm.name || editRecurringForm.amount <= 0) {
      toast.error(t('expenses.fillAllFields'));
      return;
    }

    const intervalInfo = recurringIntervals.find(i => i.value === editRecurringForm.intervalDays) || recurringIntervals[1];
    const curr = editRecurringForm.currency || m.activeCode;
    const currDef = m.enabledCurrencies.find(c => c.code === curr) || m.getCurrencyDef(curr);
    const amountUSD = m.toUsd(editRecurringForm.amount, curr, currDef.rate);
    const currencySuffix = curr !== 'USD'
      ? ` (${m.roundForCurrency(editRecurringForm.amount, curr)} ${currDef.symbol})`
      : '';
    const cleanNotes = editRecurringForm.notes ? editRecurringForm.notes.replace(/\s*\[CURRENCY:[^\]]+\]/g, '').replace(/\s*\([^)]*([₺$]|ل\.س|ج\.م|ر\.س|د\.إ|د\.ع|د\.أ|ل\.ل|د\.ك|ر\.ق|د\.ب|ر\.ع)[^)]*\)/g, '').trim() : '';
    const finalNotes = cleanNotes
      ? (currencySuffix ? `${cleanNotes}${currencySuffix}` : cleanNotes)
      : (currencySuffix.trim() || undefined);

    try {
      await updateRecurringExpenseCloud(editingRecurring.id, {
        name: editRecurringForm.name,
        type: editRecurringForm.type,
        customType: editRecurringForm.customType,
        amount: amountUSD,
        currency: curr,
        exchangeRate: currDef.rate,
        interval: intervalInfo.interval,
        intervalDays: editRecurringForm.intervalDays,
        notes: finalNotes,
        autoPay: editRecurringForm.autoPay,
      });

      const recurringData = await loadRecurringExpensesCloud();
      setRecurringExpenses(recurringData);
      setDueExpenses(getDueExpenses());
      setShowEditRecurringDialog(false);
      setEditingRecurring(null);
      toast.success(t('expenses.editRecurringSuccess') || 'تم تعديل المصروف الثابت بنجاح');
    } catch (err) {
      console.error('[Expenses] Error updating recurring expense:', err);
      toast.error(t('expenses.editRecurringError') || 'فشل في تعديل المصروف الثابت');
    }
  };

  const handleReverseExpense = async (expenseToReverse?: Expense) => {
    const expense = expenseToReverse || selectedExpense;
    if (!expense || expense.is_reversed) return;

    const reversedAmount = expense.amount;
    const reversedType = expense.type;
    const reversedId = expense.id;

    try {
      // 1. استدعاء السحابة لتعليم المصروف كمسترد مع السبب
      await reverseExpenseCloud(reversedId, 'تراجع بواسطة المستخدم');

      // 2. إعادة المبلغ المخصوم إلى رصيد الصندوق فوراً وحذف المصروف التشغيلي من الأرباح
      restoreExpenseCash(reversedAmount, reversedType, reversedId, ((expense as any).currency as any) || 'USD');

      // 3. تحديث البيانات محلياً
      const [expensesData, statsData] = await Promise.all([
        loadExpensesCloud(),
        getExpenseStatsCloud()
      ]);
      setExpenses(expensesData);
      setStats(statsData);
      setShowDeleteDialog(false);
      setSelectedExpense(null);

      toast.success(`تم استرداد المصروف وإعادة ${m.fmt(reversedAmount)} للصندوق`);
      import('@/lib/activity-log').then(({ logActivity }) => logActivity('expense_refund', `استرداد وتراجع عن مصروف (${reversedType}): +${reversedAmount}`, { id: reversedId, amount: reversedAmount, type: reversedType }));
    } catch (error) {
      toast.error(t('expenses.reverseError') || 'فشل التراجع عن المصروف');
    }
  };

  const handleDeleteExpense = () => handleReverseExpense();

  // فتح نافذة التأكيد قبل الدفع لضمان عدم السداد المكرر العرضي
  const handleQuickPayRecurring = (expense: RecurringExpense) => {
    openPayConfirmDialog(expense);
  };

  const handlePayRecurring = async () => {
    if (!selectedRecurring || isPaying) return;
    setIsPaying(true);
    try {
      const success = await payRecurringExpense(selectedRecurring.id);
      if (success) {
        const [expensesData, statsData, recurringData] = await Promise.all([
          loadExpensesCloud(),
          getExpenseStatsCloud(),
          loadRecurringExpensesCloud(),
        ]);
        setExpenses(expensesData);
        setStats(statsData);
        setRecurringExpenses(recurringData);
        setDueExpenses(getDueExpenses());
        emitEvent(EVENTS.RECURRING_EXPENSES_UPDATED, null);
        toast.success(t('expenses.payExpenseSuccess') || `تم صرف مصروف: ${selectedRecurring.name}`);
      } else {
        toast.error(t('expenses.alreadyPaidToday') || 'هذا المصروف تم سداده اليوم بالفعل أو قيد المعالجة');
      }
    } catch (err) {
      console.error('[Expenses] Error paying recurring expense:', err);
      toast.error(t('expenses.payExpenseError') || 'فشل في تنفيذ عملية الصرف');
    } finally {
      setIsPaying(false);
      setShowPayConfirmDialog(false);
      setSelectedRecurring(null);
    }
  };

  const handleSkipRecurring = async (expense: RecurringExpense) => {
    try {
      skipRecurringExpense(expense.id);
      const recurringData = await loadRecurringExpensesCloud();
      setRecurringExpenses(recurringData);
      setDueExpenses(getDueExpenses());
      toast.info(t('expenses.paymentSkipped'));
    } catch (err) {
      console.error('[Expenses] Error skipping recurring expense:', err);
      toast.error(t('expenses.skipError') || 'فشل في تأجيل المصروف');
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    try {
      await deleteRecurringExpenseCloud(id);
      const recurringData = await loadRecurringExpensesCloud();
      setRecurringExpenses(recurringData);
      setDueExpenses(getDueExpenses());
      toast.success(t('expenses.fixedExpenseDeleted'));
    } catch (err) {
      console.error('[Expenses] Error deleting recurring expense:', err);
      toast.error(t('expenses.deleteRecurringError') || 'فشل في حذف المصروف الثابت');
    }
  };

  const openDeleteDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDeleteDialog(true);
  };

  const openPayConfirmDialog = (expense: RecurringExpense) => {
    setSelectedRecurring(expense);
    setShowPayConfirmDialog(true);
  };

  return (
    <div className="p-2.5 sm:p-4 md:p-6 pt-2 sm:pt-3 space-y-3 overflow-x-hidden relative min-h-screen">
      {/* Top Header with Fixed Add Button */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <PageHeader title={t('expenses.title')} className="mb-0 md:mb-0 min-h-0" />
        <Button 
          onClick={() => setShowAddExpense(true)}
          className="h-10 px-4 rounded-xl gap-2 bg-primary text-primary-foreground font-bold shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t('expenses.addExpense') || 'إضافة مصروف'}</span>
        </Button>
      </div>

      {/* Top Search with Smart Mobile Clearance */}
      <div className="flex items-center justify-between gap-2 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('expenses.searchExpenses')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-10 text-xs md:text-sm bg-card border-border rounded-xl shadow-2xs"
          />
        </div>
      </div>

      {/* Due Expenses Alert Banner */}
      {dueExpenses.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-foreground block truncate">
                {dueExpenses.length} {t('expenses.dueToday')}
              </span>
              <p className="text-[11px] text-muted-foreground font-mono">
                {t('common.total')}: <span className="font-bold text-foreground">{m.fmt(dueExpenses.reduce((sum, e) => sum + e.amount, 0))}</span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 hover:bg-amber-500/15 text-xs font-bold h-8 px-3 rounded-xl shrink-0 text-amber-700 dark:text-amber-300"
            onClick={() => setShowRecurringListDialog(true)}
          >
            {t('expenses.reviewAndPay')}
          </Button>
        </div>
      )}

      {/* Compressed 4-Metric Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-3">
        {/* Metric 1: هذا الشهر */}
        <div className="bg-card border border-border rounded-xl md:rounded-2xl p-2 md:p-3 text-center relative overflow-hidden">
          <span className="text-[10px] md:text-xs text-muted-foreground block truncate font-medium">
            {t('expenses.thisMonth')}
          </span>
          <span className="text-xs sm:text-sm md:text-lg font-black font-mono text-destructive block mt-0.5 truncate whitespace-nowrap">
            {m.fmt(stats.totalThisMonth)}
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] md:text-[10px] text-muted-foreground">
            <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
            <span className="truncate">{t('expenses.expense')}</span>
          </div>
        </div>

        {/* Metric 2: عمليات الشهر */}
        <div className="bg-card border border-border rounded-xl md:rounded-2xl p-2 md:p-3 text-center relative overflow-hidden">
          <span className="text-[10px] md:text-xs text-muted-foreground block truncate font-medium">
            {t('expenses.monthlyExpenses')}
          </span>
          <span className="text-xs sm:text-sm md:text-lg font-black font-mono text-foreground block mt-0.5 truncate">
            {stats.monthlyCount}
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] md:text-[10px] text-muted-foreground">
            <Receipt className="w-3 h-3 text-warning shrink-0" />
            <span className="truncate">{t('expenses.operations')}</span>
          </div>
        </div>

        {/* Metric 3: إجمالي المصاريف */}
        <div className="bg-card border border-border rounded-xl md:rounded-2xl p-2 md:p-3 text-center relative overflow-hidden">
          <span className="text-[10px] md:text-xs text-muted-foreground block truncate font-medium">
            {t('expenses.totalExpenses')}
          </span>
          <span className="text-xs sm:text-sm md:text-lg font-black font-mono text-foreground block mt-0.5 truncate whitespace-nowrap">
            {m.fmt(stats.totalExpenses)}
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] md:text-[10px] text-muted-foreground">
            <DollarSign className="w-3 h-3 text-info shrink-0" />
            <span className="truncate">{t('expenses.total')}</span>
          </div>
        </div>

        {/* Metric 4: مصاريف ثابتة */}
        <div
          className="bg-card border border-border rounded-xl md:rounded-2xl p-2 md:p-3 text-center relative overflow-hidden cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => setShowRecurringListDialog(true)}
          title={t('expenses.manageRecurring')}
        >
          <span className="text-[10px] md:text-xs text-muted-foreground block truncate font-medium">
            {t('expenses.fixedExpenses')}
          </span>
          <span className="text-xs sm:text-sm md:text-lg font-black font-mono text-primary block mt-0.5 truncate">
            {recurringExpenses.length}
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] md:text-[10px] text-primary">
            <RefreshCw className="w-3 h-3 shrink-0" />
            <span className="truncate font-semibold">{t('expenses.manage')}</span>
          </div>
        </div>
      </div>

      {/* Expense Types Summary */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-2.5 md:p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-0.5">
            <span>{t('expenses.monthlyDistribution')}</span>
            <span className="text-[11px] font-mono">{Object.keys(stats.byType).length} {t('expenses.categories')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.byType).map(([type, amount]) => (
              <div key={type} className="px-2 py-1 bg-muted/60 border border-border/40 rounded-xl text-xs flex items-center gap-1.5">
                <span className="text-muted-foreground">{getLocalizedExpenseType(type)}:</span>
                <span className="font-bold font-mono text-foreground whitespace-nowrap">{m.fmt(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Expenses List */}
      <div className="space-y-2 md:space-y-2.5">
        {filteredExpenses.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-xs md:text-sm font-semibold text-muted-foreground">{t('expenses.noExpenses')}</p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">{t('expenses.startAdding')}</p>
          </div>
        ) : (
          filteredExpenses.map((expense, index) => (
            <div
              key={expense.id}
              className="bg-card rounded-2xl border border-border p-3 md:p-3.5 relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/40 fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* 3-Dots Dropdown Menu in Top-Left */}
              <div className="absolute left-2.5 top-2.5 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      title={t('common.options')}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 rounded-2xl p-1.5 border-border shadow-xl">
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(expense)}
                      disabled={expense.is_reversed}
                      className="gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 focus:text-amber-700 focus:bg-amber-500/10 rounded-xl cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{expense.is_reversed ? t('expenses.alreadyReversed') : t('expenses.reverseExpense')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Title & Amount Row */}
              <div className="flex items-start justify-between gap-2 pl-8">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-xs md:text-sm text-foreground truncate">{getLocalizedExpenseType(expense.type, expense.typeLabel)}</h3>
                      {expense.is_reversed && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                          {t('expenses.reversed')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left shrink-0 whitespace-nowrap">
                  <span className={cn(
                    "text-sm md:text-base font-black font-mono whitespace-nowrap",
                    expense.is_reversed ? "line-through text-muted-foreground" : "text-destructive"
                  )}>
                    -{m.fmt(expense.amount)}
                  </span>
                </div>
              </div>

              {/* Meta Tags Row */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10.5px]">
                <span className="text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded font-medium" dir="ltr">
                  📅 {expense.date}
                </span>
                {expense.cashierName && (
                  <span className="text-primary font-bold flex items-center gap-0.5 bg-primary/10 px-1.5 py-0.5 rounded">
                    👤 {expense.cashierName}
                  </span>
                )}
              </div>

              {/* Notes */}
              {expense.notes && (
                <p className="mt-2 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl p-2 leading-relaxed">
                  {expense.notes}
                </p>
              )}

              {/* Partner Distributions */}
              {expense.distributions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-dashed border-border">
                  <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1 font-medium">
                    <Users className="w-3 h-3 text-primary" />
                    <span>{t('expenses.partnerDistribution')}:</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {expense.distributions.map(dist => (
                      <span key={dist.partnerId} className="px-2 py-0.5 bg-muted/70 border border-border/50 rounded-lg text-[10.5px] font-mono font-medium text-foreground">
                        {dist.partnerName}: ${dist.amount.toFixed(0)} ({dist.percentage.toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),28rem)] max-h-[calc(100dvh-1.5rem)] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl modal-dot-expand bg-card text-sm flex flex-col">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <span>{t('expenses.addNewExpense')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                {t('expenses.addNewExpenseDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.expenseType')}</label>
              <Select
                value={formData.type}
                onValueChange={(value: ExpenseType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder={t('expenses.selectExpenseType')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {expenseTypes.map(type => (
                    <SelectItem key={type.value} value={type.value} className="rounded-xl">
                      {getLocalizedExpenseType(type.value, type.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'other' && (
              <div>
                <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.expenseName')}</label>
                <Input
                  placeholder={t('expenses.expenseNamePlaceholder')}
                  value={formData.customType}
                  onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
            )}

            {/* Currency Selector */}
            <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 rounded-xl border border-border/60">
              <span className="text-xs font-semibold text-muted-foreground">عملة المصروف:</span>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                {m.enabledCurrencies.map((curr) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setExpenseCurrency(curr.code)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1",
                      expenseCurrency === curr.code
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{curr.symbol}</span>
                    <span>{curr.code}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.amount')} ({currentExpenseDef.symbol})</label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-muted-foreground">{currentExpenseDef.symbol}</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  min="0"
                  className="pr-9 h-10 rounded-xl font-mono text-sm font-bold"
                />
              </div>
              {expenseCurrency !== 'USD' && formData.amount > 0 && (
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  ≈ ${m.toUsd(formData.amount, expenseCurrency, currentExpenseDef.rate).toFixed(2)} USD
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.date')}</label>
              <DatePicker
                value={formData.date}
                onChange={(date) => setFormData({ ...formData, date: date })}
                placeholder={t('common.selectDate')}
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.notes')}</label>
              <Textarea
                placeholder={t('expenses.notesPlaceholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="rounded-xl text-xs resize-none"
              />
            </div>
          </div>
          <div className="shrink-0 p-3 bg-muted/30 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs" onClick={() => setShowAddDialog(false)}>
              {t('expenses.cancel')}
            </Button>
            <Button className="flex-1 h-9 rounded-xl text-xs font-bold bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground shadow-sm" onClick={handleAddExpense} disabled={isSaving}>
              <Save className="w-3.5 h-3.5" />
              {isSaving ? t('common.saving') : t('expenses.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Recurring Expense Dialog */}
      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),28rem)] max-h-[calc(100dvh-1.5rem)] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl modal-dot-expand bg-card text-sm flex flex-col">
          <div className="shrink-0 p-4 bg-muted/40 border-b border-border flex items-center justify-between">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span>{t('expenses.addRecurring')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                {t('expenses.addRecurringDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.expenseName')}</label>
              <Input
                placeholder={t('expenses.expenseNamePlaceholder')}
                value={recurringForm.name}
                onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.expenseType')}</label>
              <Select
                value={recurringForm.type}
                onValueChange={(value: ExpenseType) => setRecurringForm({ ...recurringForm, type: value })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder={t('expenses.selectExpenseType')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {expenseTypes.map(type => (
                    <SelectItem key={type.value} value={type.value} className="rounded-xl">
                      {getLocalizedExpenseType(type.value, type.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency Selector for Recurring Expense */}
            <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 rounded-xl border border-border/60">
              <span className="text-xs font-semibold text-muted-foreground">عملة المصروف:</span>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                {m.enabledCurrencies.map((curr) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setRecurringForm({ ...recurringForm, currency: curr.code })}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1",
                      (recurringForm.currency || m.activeCode) === curr.code
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{curr.symbol}</span>
                    <span>{curr.code}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">
                {t('expenses.amount')} ({recurringCurrencyDef.symbol})
              </label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-muted-foreground">
                  {recurringCurrencyDef.symbol}
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={recurringForm.amount || ''}
                  onChange={(e) => setRecurringForm({ ...recurringForm, amount: Number(e.target.value) })}
                  min="0"
                  className="pr-9 h-10 rounded-xl font-mono text-sm font-bold"
                />
              </div>
              {(recurringForm.currency || m.activeCode) !== 'USD' && recurringForm.amount > 0 && (
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  ≈ ${m.toUsd(recurringForm.amount, recurringForm.currency || m.activeCode, recurringCurrencyDef.rate).toFixed(2)} USD
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.repeatEvery')}</label>
              <Select
                value={String(recurringForm.intervalDays)}
                onValueChange={(value) => setRecurringForm({ ...recurringForm, intervalDays: Number(value) })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder={t('expenses.selectRepeatInterval')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {recurringIntervals.map(interval => (
                    <SelectItem key={interval.value} value={String(interval.value)} className="rounded-xl">
                      {getLocalizedInterval(interval)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.startDate')}</label>
              <Input
                type="date"
                value={recurringForm.startDate}
                onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.notes')}</label>
              <Textarea
                placeholder={t('expenses.notesPlaceholder')}
                value={recurringForm.notes}
                onChange={(e) => setRecurringForm({ ...recurringForm, notes: e.target.value })}
                rows={2}
                className="rounded-xl text-xs resize-none"
              />
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-1">
              <Checkbox
                id="payToday"
                checked={recurringForm.payImmediately}
                onCheckedChange={(checked) => setRecurringForm({ ...recurringForm, payImmediately: !!checked })}
              />
              <label
                htmlFor="payToday"
                className="text-xs font-medium leading-none cursor-pointer select-none text-foreground"
              >
                {t('expenses.payTodayImmediately')}
              </label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-1">
              <Checkbox
                id="autoPay"
                checked={recurringForm.autoPay}
                onCheckedChange={(checked) => setRecurringForm({ ...recurringForm, autoPay: !!checked })}
              />
              <label
                htmlFor="autoPay"
                className="text-xs font-medium leading-none cursor-pointer select-none text-foreground"
              >
                {t('expenses.autoPayDescription')}
              </label>
            </div>
          </div>
          <div className="shrink-0 p-3 bg-muted/30 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs" onClick={() => setShowRecurringDialog(false)}>
              {t('expenses.cancel')}
            </Button>
            <Button className="flex-1 h-9 rounded-xl text-xs font-bold bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground shadow-sm" onClick={handleAddRecurringExpense}>
              <Save className="w-3.5 h-3.5" />
              {t('expenses.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recurring Expenses List Dialog */}
      <Dialog open={showRecurringListDialog} onOpenChange={setShowRecurringListDialog}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),32rem)] max-h-[calc(100dvh-1.5rem)] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl modal-dot-expand bg-card text-sm flex flex-col">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Settings2 className="w-4 h-4" />
                </div>
                <span>{t('expenses.manageFixed')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                {t('expenses.recurringSubtitle')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 overscroll-contain">
            {recurringExpenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-xs">{t('expenses.noFixedExpenses')}</p>
            ) : (
              recurringExpenses.map(expense => {
                const todayStr = toLocalDateString(new Date());
                const isPaidToday = expense.lastPaidDate === todayStr;
                const dueDate = new Date(expense.nextDueDate || todayStr);
                dueDate.setHours(0, 0, 0, 0);
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const isDue = (dueDate <= todayDate || !expense.nextDueDate) && !isPaidToday && (expense.isActive !== false);

                return (
                  <div key={expense.id} className="flex items-center justify-between bg-muted/40 border border-border/50 rounded-2xl p-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-xs truncate text-foreground">{expense.name}</p>
                        {isPaidToday && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                            {t('expenses.paidTodayBadge')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        <span className="font-bold text-foreground">{expense.currency && expense.currency !== 'USD' && expense.exchangeRate ? `${m.roundForCurrency(m.fromUsd(expense.amount, expense.currency, expense.exchangeRate), expense.currency)} ${expense.currency} (≈ ${m.fmt(expense.amount)})` : m.fmt(expense.amount)}</span> - {t('expenses.every')} {expense.intervalDays} {t('expenses.days')}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                        <span>{t('expenses.nextDue')}: {expense.nextDueDate}</span>
                        {expense.lastPaidDate && (
                          <span className="text-muted-foreground/80">({t('expenses.lastPaid')}: {expense.lastPaidDate})</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPaidToday ? (
                        <Button
                          size="sm"
                          disabled
                          className="h-8 text-xs bg-muted text-muted-foreground gap-1 px-2.5 rounded-xl font-bold cursor-not-allowed opacity-60"
                          title={t('expenses.paidTodayBadge')}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('expenses.paidTodayBadge')}
                        </Button>
                      ) : !isDue ? (
                        <Button
                          size="sm"
                          disabled
                          variant="outline"
                          className="h-8 text-xs text-muted-foreground gap-1 px-2.5 rounded-xl font-medium cursor-not-allowed opacity-50"
                          title={t('expenses.notDueYet')}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {t('expenses.notDueYet')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 rounded-xl font-bold shadow-sm"
                          onClick={() => openPayConfirmDialog(expense)}
                          title={t('expenses.payNow')}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('expenses.pay')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-xl"
                        onClick={() => handleOpenEditRecurring(expense)}
                        title={t('common.edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-xl"
                        onClick={() => handleDeleteRecurring(expense.id)}
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="shrink-0 p-3 bg-muted/30 border-t border-border flex justify-end">
            <Button variant="outline" className="h-9 px-4 rounded-xl text-xs" onClick={() => setShowRecurringListDialog(false)}>
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Recurring Expense Dialog */}
      <Dialog open={showEditRecurringDialog} onOpenChange={setShowEditRecurringDialog}>
        <DialogContent className="w-[min(calc(100vw-1.5rem),28rem)] max-h-[calc(100dvh-1.5rem)] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl modal-dot-expand bg-card text-sm flex flex-col">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
            <DialogHeader className="p-0 space-y-0.5 text-right">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Pencil className="w-4 h-4" />
                </div>
                <span>{t('expenses.editRecurring')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-10">
                {t('expenses.editRecurringDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.expenseName')}</label>
              <Input
                placeholder={t('expenses.expenseNamePlaceholder')}
                value={editRecurringForm.name}
                onChange={(e) => setEditRecurringForm({ ...editRecurringForm, name: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.expenseType')}</label>
              <Select
                value={editRecurringForm.type}
                onValueChange={(value: ExpenseType) => setEditRecurringForm({ ...editRecurringForm, type: value })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder={t('expenses.selectExpenseType')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {expenseTypes.map(type => (
                    <SelectItem key={type.value} value={type.value} className="rounded-xl">
                      {getLocalizedExpenseType(type.value, type.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency Selector for Editing Recurring Expense */}
            <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 rounded-xl border border-border/60">
              <span className="text-xs font-semibold text-muted-foreground">عملة المصروف:</span>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                {m.enabledCurrencies.map((curr) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setEditRecurringForm({ ...editRecurringForm, currency: curr.code })}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1",
                      (editRecurringForm.currency || m.activeCode) === curr.code
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{curr.symbol}</span>
                    <span>{curr.code}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">
                {t('expenses.amount')} ({editRecurringCurrencyDef.symbol})
              </label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-muted-foreground">
                  {editRecurringCurrencyDef.symbol}
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={editRecurringForm.amount || ''}
                  onChange={(e) => setEditRecurringForm({ ...editRecurringForm, amount: Number(e.target.value) })}
                  min="0"
                  className="pr-9 h-10 rounded-xl font-mono text-sm font-bold"
                />
              </div>
              {(editRecurringForm.currency || m.activeCode) !== 'USD' && editRecurringForm.amount > 0 && (
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  ≈ ${m.toUsd(editRecurringForm.amount, editRecurringForm.currency || m.activeCode, editRecurringCurrencyDef.rate).toFixed(2)} USD
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.repeatEvery')}</label>
              <Select
                value={String(editRecurringForm.intervalDays)}
                onValueChange={(value) => setEditRecurringForm({ ...editRecurringForm, intervalDays: Number(value) })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder={t('expenses.selectRepeatInterval')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {recurringIntervals.map(interval => (
                    <SelectItem key={interval.value} value={String(interval.value)} className="rounded-xl">
                      {getLocalizedInterval(interval)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-muted-foreground">{t('expenses.notes')}</label>
              <Textarea
                placeholder={t('expenses.notesPlaceholder')}
                value={editRecurringForm.notes}
                onChange={(e) => setEditRecurringForm({ ...editRecurringForm, notes: e.target.value })}
                rows={2}
                className="rounded-xl text-xs resize-none"
              />
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-1">
              <Checkbox
                id="editAutoPay"
                checked={editRecurringForm.autoPay}
                onCheckedChange={(checked) => setEditRecurringForm({ ...editRecurringForm, autoPay: !!checked })}
              />
              <label
                htmlFor="editAutoPay"
                className="text-xs font-medium leading-none cursor-pointer select-none text-foreground"
              >
                {t('expenses.autoPayDescription')}
              </label>
            </div>
          </div>
          <div className="shrink-0 p-3 bg-muted/30 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs" onClick={() => setShowEditRecurringDialog(false)}>
              {t('expenses.cancel')}
            </Button>
            <Button className="flex-1 h-9 rounded-xl text-xs font-bold bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground shadow-sm" onClick={handleUpdateRecurringExpense}>
              <Save className="w-3.5 h-3.5" />
              {t('expenses.saveChanges')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Confirmation Dialog */}
      <AlertDialog open={showPayConfirmDialog} onOpenChange={setShowPayConfirmDialog}>
        <AlertDialogContent className="max-w-md w-[95vw] rounded-3xl p-5 border border-border shadow-2xl modal-dot-expand bg-card">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <span>{t('expenses.confirmPayExpense')}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-2">
              {t('expenses.payExpenseConfirm').replace('{name}', selectedRecurring?.name || '').replace('{amount}', selectedRecurring ? m.fmt(selectedRecurring.amount) : '0')}
              <span className="block mt-2 font-medium text-emerald-600 dark:text-emerald-400">
                💰 {t('expenses.confirmDeductFromCashbox')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 pt-3">
            <AlertDialogCancel disabled={isPaying} className="flex-1 h-9 rounded-xl text-xs">{t('expenses.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePayRecurring} 
              disabled={isPaying}
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              {isPaying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {isPaying ? t('common.loading') : t('expenses.payNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete/Refund Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md w-[95vw] rounded-3xl p-5 border border-border shadow-2xl modal-dot-expand bg-card">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <span>{t('expenses.reverseExpense')}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-2">
              {t('expenses.deleteConfirmDesc').replace('{name}', selectedExpense ? getLocalizedExpenseType(selectedExpense.type, selectedExpense.typeLabel) : '').replace('{amount}', formatNumber(selectedExpense?.amount || 0))}
              <span className="block mt-2 font-medium text-emerald-600 dark:text-emerald-400">
                💰 {t('expenses.reverseExpenseNote')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 pt-3">
            <AlertDialogCancel className="flex-1 h-9 rounded-xl text-xs">{t('expenses.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="flex-1 h-9 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white">
              {t('expenses.confirmReverse')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scroll-aware Smart FAB with Speed Dial Options عبر المكوّن الذكي الموحد */}
      <SmartFab label={t('expenses.addExpense')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "pointer-events-auto flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full",
                "bg-gradient-primary hover:opacity-95 active:scale-95 text-primary-foreground font-bold",
                "shadow-xl shadow-primary/35 hover:shadow-2xl border border-primary-foreground/25 ring-4 ring-primary/15 transition-[transform,opacity] duration-300 ease-out cursor-pointer"
              )}
              title={t('expenses.addExpense')}
              aria-label={t('expenses.addExpense')}
            >
              <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[2.5]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align={isRTL ? "start" : "end"}
            className="w-56 p-1.5 rounded-2xl border-border bg-card shadow-2xl space-y-1 mb-2 z-50 pointer-events-auto"
          >
            <DropdownMenuItem
              className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-primary/10 hover:text-primary transition-all"
              onClick={() => {
                resetForm();
                setShowAddDialog(true);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground">{t('expenses.oneTimeExpense') || 'مصروف لمرة واحدة'}</span>
                <span className="text-[10px] text-muted-foreground font-normal">فاتورة، نثرية، أو مشترى فوري</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-info/10 hover:text-info transition-all"
              onClick={() => {
                resetRecurringForm();
                setShowRecurringDialog(true);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground">{t('expenses.recurringExpense') || 'مصروف ثابت / متكرر'}</span>
                <span className="text-[10px] text-muted-foreground font-normal">إيجار، رواتب، اشتراكات</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SmartFab>
    </div>
  );
}
