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
  Ban
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import {
  loadExpensesCloud,
  addExpenseCloud,
  voidExpenseCloud,
  deleteExpenseCloud,
  getExpenseStatsCloud,
  expenseTypes,
  Expense,
  ExpenseType
} from '@/lib/cloud/expenses-cloud';
import {
  loadRecurringExpenses,
  addRecurringExpense,
  deleteRecurringExpense,
  getDueExpenses,
  payRecurringExpense,
  skipRecurringExpense,
  recurringIntervals,
  RecurringExpense
} from '@/lib/recurring-expenses-store';
import { EVENTS } from '@/lib/events';
import { useLanguage } from '@/hooks/use-language';
import { processExpense } from '@/lib/unified-transactions';

export default function Expenses() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => loadRecurringExpenses());
  const [dueExpenses, setDueExpenses] = useState<RecurringExpense[]>(() => getDueExpenses());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [showRecurringListDialog, setShowRecurringListDialog] = useState(false);
  const [showPayConfirmDialog, setShowPayConfirmDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringExpense | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [expenseToVoid, setExpenseToVoid] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [stats, setStats] = useState({ totalExpenses: 0, totalThisMonth: 0, expenseCount: 0, monthlyCount: 0, byType: {} as Record<string, number> });

  // Form state
  const [formData, setFormData] = useState({
    type: 'rent' as ExpenseType,
    customType: '',
    amount: 0,
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Recurring form state
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    type: 'wages' as ExpenseType,
    customType: '',
    amount: 0,
    intervalDays: 30,
    startDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Load expenses from cloud
  useEffect(() => {
    const loadData = async () => {
      const [expensesData, statsData] = await Promise.all([
        loadExpensesCloud(),
        getExpenseStatsCloud()
      ]);
      setExpenses(expensesData);
      setStats(statsData);
    };
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.RECURRING_EXPENSES_UPDATED, () => {
      setRecurringExpenses(loadRecurringExpenses());
      setDueExpenses(getDueExpenses());
    });
    return () => {
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
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
      date: new Date().toISOString().split('T')[0],
    });
  };

  const resetRecurringForm = () => {
    setRecurringForm({
      name: '',
      type: 'wages',
      customType: '',
      amount: 0,
      intervalDays: 30,
      startDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
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
      const created = await addExpenseCloud({
        type: formData.type,
        customType: formData.customType,
        amount: formData.amount,
        notes: formData.notes,
        date: formData.date,
      });

      if (!created) {
        toast.error('فشل في إضافة المصروف');
        return;
      }

      // ✅ خصم المبلغ من الصندوق تلقائياً (الترابط الجديد)
      processExpense(formData.amount, formData.type);

      const expensesData = await loadExpensesCloud();
      setExpenses(expensesData);
      setShowAddDialog(false);
      resetForm();
      toast.success(t('expenses.expenseAdded'));
      import('@/lib/auto-backup').then(({ performActionBackup }) => performActionBackup(`Add Expense - ${formData.type}`));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleAddRecurringExpense = () => {
    if (!recurringForm.name || recurringForm.amount <= 0) {
      toast.error(t('expenses.fillAllFields'));
      return;
    }

    addRecurringExpense({
      name: recurringForm.name,
      type: recurringForm.type,
      customType: recurringForm.customType,
      amount: recurringForm.amount,
      intervalDays: recurringForm.intervalDays,
      startDate: recurringForm.startDate,
      notes: recurringForm.notes,
    });

    setRecurringExpenses(loadRecurringExpenses());
    setDueExpenses(getDueExpenses());
    setShowRecurringDialog(false);
    resetRecurringForm();
    toast.success(t('expenses.fixedExpenseAdded'));
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpense) return;

    await deleteExpenseCloud(selectedExpense.id);
    const expensesData = await loadExpensesCloud();
    setExpenses(expensesData);
    setShowDeleteDialog(false);
    setSelectedExpense(null);
    toast.success(t('expenses.expenseDeleted'));
  };

  const handlePayRecurring = async () => {
    if (!selectedRecurring) return;

    payRecurringExpense(selectedRecurring.id);
    const expensesData = await loadExpensesCloud();
    setExpenses(expensesData);
    setRecurringExpenses(loadRecurringExpenses());
    setDueExpenses(getDueExpenses());
    setShowPayConfirmDialog(false);
    setSelectedRecurring(null);
    toast.success(t('expenses.expensePaid'));
  };

  const handleSkipRecurring = (expense: RecurringExpense) => {
    skipRecurringExpense(expense.id);
    setRecurringExpenses(loadRecurringExpenses());
    setDueExpenses(getDueExpenses());
    toast.info(t('expenses.paymentSkipped'));
  };

  const handleDeleteRecurring = (id: string) => {
    deleteRecurringExpense(id);
    setRecurringExpenses(loadRecurringExpenses());
    setDueExpenses(getDueExpenses());
    toast.success(t('expenses.fixedExpenseDeleted'));
  };

  const openDeleteDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDeleteDialog(true);
  };

  const openVoidDialog = (expense: Expense) => {
    setExpenseToVoid(expense);
    setVoidReason('');
    setShowVoidDialog(true);
  };

  const confirmVoid = async () => {
    if (expenseToVoid) {
      if (!voidReason.trim()) {
        toast.error(t('common.required'));
        return;
      }

      const success = await voidExpenseCloud(expenseToVoid.id, voidReason);

      if (success) {
        const [expensesData, statsData] = await Promise.all([
          loadExpensesCloud(),
          getExpenseStatsCloud()
        ]);
        setExpenses(expensesData);
        setStats(statsData);
        toast.success(t('expenses.voidSuccess') || 'تم إلغاء المصروف بنجاح');
        setShowVoidDialog(false);
        setExpenseToVoid(null);
      } else {
        toast.error(t('common.error'));
      }
    }
  };

  const openPayConfirmDialog = (expense: RecurringExpense) => {
    setSelectedRecurring(expense);
    setShowPayConfirmDialog(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-14 md:pr-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('expenses.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            resetRecurringForm();
            setShowRecurringDialog(true);
          }}>
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('expenses.recurringExpense')}
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('expenses.addExpense')}
          </Button>
        </div>
      </div>

      {/* Due Expenses Alert */}
      {dueExpenses.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-warning">{t('expenses.dueExpenses')} ({dueExpenses.length})</h3>
          </div>
          <div className="space-y-2">
            {dueExpenses.map(expense => (
              <div key={expense.id} className="flex items-center justify-between bg-card rounded-lg p-3">
                <div>
                  <p className="font-medium">{expense.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(expense.amount)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleSkipRecurring(expense)}>
                    <X className="w-4 h-4 ml-1" />
                    {t('expenses.skip')}
                  </Button>
                  <Button size="sm" className="bg-success hover:bg-success/90" onClick={() => openPayConfirmDialog(expense)}>
                    <Check className="w-4 h-4 ml-1" />
                    {t('expenses.pay')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.totalThisMonth)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('expenses.thisMonth')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <Receipt className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.monthlyCount}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('expenses.monthlyExpenses')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-info/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-info" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.totalExpenses)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('expenses.totalExpenses')}</p>
            </div>
          </div>
        </div>
        <div
          className="bg-card rounded-xl border border-border p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setShowRecurringListDialog(true)}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{recurringExpenses.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('expenses.fixedExpenses')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Types Summary */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium mb-3">{t('expenses.monthlyDistribution')}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byType).map(([type, amount]) => (
              <div key={type} className="px-3 py-2 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">{type}: </span>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('expenses.searchExpenses')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9 md:pr-10 bg-muted border-0"
        />
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{t('expenses.noExpenses')}</p>
            <p className="text-sm text-muted-foreground">{t('expenses.startAdding')}</p>
          </div>
        ) : (
          filteredExpenses.map((expense, index) => (
            <div
              key={expense.id}
              className={cn(
                "bg-card rounded-xl border border-border p-4 card-hover fade-in",
                expense.status === 'voided' && "opacity-60 bg-muted/20"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{expense.typeLabel}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{expense.date}</span>
                      {expense.cashierName && (
                        <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-xs">
                          👤 {expense.cashierName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <p className={cn(
                    "text-lg font-bold",
                    expense.status === 'voided' ? "text-muted-foreground line-through" : "text-destructive"
                  )}>
                    -{formatCurrency(expense.amount)}
                  </p>
                  {expense.status === 'voided' && (
                    <span className="text-xs text-destructive font-medium block mt-1">
                      {t('expenses.voided') || 'ملغى'}
                    </span>
                  )}
                </div>
              </div>

              {expense.notes && (
                <p className="mt-2 text-sm text-muted-foreground bg-muted rounded-lg p-2">
                  {expense.notes}
                </p>
              )}

              {expense.distributions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {t('expenses.partnerDistribution')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expense.distributions.map(dist => (
                      <span key={dist.partnerId} className="px-2 py-1 bg-muted rounded-full text-xs">
                        {dist.partnerName}: ${dist.amount.toFixed(0)} ({dist.percentage.toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => openVoidDialog(expense)}
                  disabled={expense.status === 'voided'}
                >
                  <Ban className="w-4 h-4 ml-1" />
                  {t('expenses.void') || 'إلغاء'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div >

      {/* Add Expense Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t('expenses.addNewExpense')}
            </DialogTitle>
            <DialogDescription>{t('expenses.addNewExpenseDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.expenseType')}</label>
              <Select
                value={formData.type}
                onValueChange={(value: ExpenseType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('expenses.selectExpenseType')} />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'other' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('expenses.expenseName')}</label>
                <Input
                  placeholder={t('expenses.expenseNamePlaceholder')}
                  value={formData.customType}
                  onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.amount')}</label>
              <Input
                type="number"
                placeholder="0"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.date')}</label>
              <DatePicker
                value={formData.date}
                onChange={(date) => setFormData({ ...formData, date: date })}
                placeholder={t('common.selectDate')}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.notes')}</label>
              <Textarea
                placeholder={t('expenses.notesPlaceholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                {t('expenses.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddExpense} disabled={isSaving}>
                <Save className="w-4 h-4 ml-2" />
                {isSaving ? 'جاري الحفظ...' : t('expenses.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Add Recurring Expense Dialog */}
      < Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog} >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              {t('expenses.addRecurring')}
            </DialogTitle>
            <DialogDescription>{t('expenses.addRecurringDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.expenseName')}</label>
              <Input
                placeholder={t('expenses.expenseNamePlaceholder')}
                value={recurringForm.name}
                onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.expenseType')}</label>
              <Select
                value={recurringForm.type}
                onValueChange={(value: ExpenseType) => setRecurringForm({ ...recurringForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('expenses.selectExpenseType')} />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.amount')}</label>
              <Input
                type="number"
                placeholder="0"
                value={recurringForm.amount || ''}
                onChange={(e) => setRecurringForm({ ...recurringForm, amount: Number(e.target.value) })}
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.repeatEvery')}</label>
              <Select
                value={String(recurringForm.intervalDays)}
                onValueChange={(value) => setRecurringForm({ ...recurringForm, intervalDays: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('expenses.selectRepeatInterval')} />
                </SelectTrigger>
                <SelectContent>
                  {recurringIntervals.map(interval => (
                    <SelectItem key={interval.value} value={String(interval.value)}>
                      {interval.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.startDate')}</label>
              <Input
                type="date"
                value={recurringForm.startDate}
                onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('expenses.notes')}</label>
              <Textarea
                placeholder={t('expenses.notesPlaceholder')}
                value={recurringForm.notes}
                onChange={(e) => setRecurringForm({ ...recurringForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowRecurringDialog(false)}>
                {t('expenses.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddRecurringExpense}>
                <Save className="w-4 h-4 ml-2" />
                {t('expenses.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Recurring Expenses List Dialog */}
      < Dialog open={showRecurringListDialog} onOpenChange={setShowRecurringListDialog} >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              {t('expenses.manageFixed')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {recurringExpenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t('expenses.noFixedExpenses')}</p>
            ) : (
              recurringExpenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between bg-muted rounded-lg p-3">
                  <div>
                    <p className="font-medium">{expense.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(expense.amount)} - {t('expenses.every')} {expense.intervalDays} {t('expenses.days')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('expenses.nextDue')}: {expense.nextDueDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDeleteRecurring(expense.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog >

      {/* Pay Confirmation Dialog */}
      < AlertDialog open={showPayConfirmDialog} onOpenChange={setShowPayConfirmDialog} >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('expenses.confirmPayExpense')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('expenses.payExpenseConfirm').replace('{name}', selectedRecurring?.name || '').replace('{amount}', formatNumber(selectedRecurring?.amount || 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('expenses.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePayRecurring} className="bg-success hover:bg-success/90">
              <Check className="w-4 h-4 ml-2" />
              {t('expenses.payNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >

      {/* Delete Confirmation Dialog */}
      < AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('expenses.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('expenses.deleteConfirmDesc').replace('{name}', selectedExpense?.typeLabel || '').replace('{amount}', formatNumber(selectedExpense?.amount || 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('expenses.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              {t('expenses.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation Dialog */}
      <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Ban className="w-5 h-5" />
              {t('expenses.voidExpense') || 'إلغاء المصروف'}
            </DialogTitle>
            <DialogDescription>
              {t('expenses.voidConfirm') || 'هل أنت متأكد من إلغاء هذا المصروف؟ سيتم إعادة المبلغ إلى مصدره.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <label className="text-sm font-medium">{t('expenses.voidReason') || 'سبب الإلغاء'}</label>
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="خطأ، مرتجع..."
            />
          </div>

          <DialogHeader className="flex-row justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setShowVoidDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmVoid}>
              {t('common.confirm') || 'تأكيد الإلغاء'}
            </Button>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
