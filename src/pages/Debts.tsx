import { useState, useEffect } from 'react';
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
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { 
  loadDebts, 
  addDebt, 
  recordPayment,
  getDebtsStats,
  Debt 
} from '@/lib/debts-store';
import { confirmPendingProfit } from '@/lib/partners-store';
import { addActivityLog } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

export default function Debts() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // Dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showAddDebtDialog, setShowAddDebtDialog] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

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
    { key: 'all', label: t('common.all') },
    { key: 'due', label: t('debts.statusDue') },
    { key: 'partially_paid', label: t('debts.statusPartiallyPaid') },
    { key: 'overdue', label: t('debts.statusOverdue') },
    { key: 'fully_paid', label: t('debts.statusFullyPaid') },
  ];

  // Load debts from store
  useEffect(() => {
    const loadData = () => setDebts(loadDebts());
    loadData();
    
    // Listen for updates
    window.addEventListener('debtsUpdated', loadData);
    window.addEventListener('storage', loadData);
    window.addEventListener('focus', loadData);
    
    return () => {
      window.removeEventListener('debtsUpdated', loadData);
      window.removeEventListener('storage', loadData);
      window.removeEventListener('focus', loadData);
    };
  }, []);

  const filteredDebts = debts.filter(debt => {
    const matchesSearch = debt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         debt.customerPhone.includes(searchQuery) ||
                         debt.invoiceId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || debt.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const stats = getDebtsStats();

  const openPaymentDialog = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount(0);
    setShowPaymentDialog(true);
  };

  const openViewDialog = (debt: Debt) => {
    setSelectedDebt(debt);
    setShowViewDialog(true);
  };

  const handlePayment = () => {
    if (!selectedDebt || paymentAmount <= 0) {
      toast.error(t('debts.enterValidAmount'));
      return;
    }

    if (paymentAmount > selectedDebt.remainingDebt) {
      toast.error(t('debts.amountExceedsRemaining'));
      return;
    }

    // Calculate payment ratio for partial profit confirmation
    const paymentRatio = paymentAmount / selectedDebt.remainingDebt;
    
    recordPayment(selectedDebt.id, paymentAmount);
    
    // Confirm pending profits proportionally to payment
    confirmPendingProfit(selectedDebt.invoiceId, paymentRatio);
    
    // Log activity
    if (user) {
      addActivityLog(
        'debt_paid',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `${t('debts.paymentRecorded')} $${paymentAmount.toLocaleString()} - ${selectedDebt.customerName}`,
        { debtId: selectedDebt.id, amount: paymentAmount, customerName: selectedDebt.customerName }
      );
    }
    
    setDebts(loadDebts());
    
    setShowPaymentDialog(false);
    setSelectedDebt(null);
    setPaymentAmount(0);
    toast.success(t('debts.paymentSuccess'));
  };

  const handleAddCashDebt = () => {
    if (!newDebtForm.customerName || !newDebtForm.customerPhone || newDebtForm.amount <= 0) {
      toast.error(t('debts.fillRequiredFields'));
      return;
    }

    if (!newDebtForm.dueDate) {
      toast.error(t('debts.selectDueDate'));
      return;
    }

    addDebt({
      invoiceId: `CASH_${Date.now()}`,
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
        profile?.full_name || user.email || 'مستخدم',
        `${t('debts.cashDebtCreated')} ${newDebtForm.customerName} - $${newDebtForm.amount.toLocaleString()}`,
        { amount: newDebtForm.amount, customerName: newDebtForm.customerName, isCashDebt: true }
      );
    }

    setDebts(loadDebts());
    setShowAddDebtDialog(false);
    setNewDebtForm({
      customerName: '',
      customerPhone: '',
      amount: 0,
      dueDate: '',
      notes: '',
    });
    toast.success(t('debts.debtAddedSuccess'));
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('debts.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{t('debts.subtitle')}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowAddDebtDialog(true)}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          {t('debts.addCashDebt')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.total.toLocaleString()}</p>
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
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.remaining.toLocaleString()}</p>
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
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p>
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
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.overdue.toLocaleString()}</p>
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
                    <span>{t('debts.paidAmount')}: ${debt.totalPaid}</span>
                    <span>{t('debts.totalAmount')}: ${debt.totalDebt}</span>
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
                      ${debt.remainingDebt.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(debt)}>
                      <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                      {t('common.view')}
                    </Button>
                    {debt.remainingDebt > 0 && (
                      <Button size="sm" className="h-8 md:h-9 bg-success hover:bg-success/90 text-xs md:text-sm" onClick={() => openPaymentDialog(debt)}>
                        <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                        {t('debts.payment')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Cash Debt Dialog */}
      <Dialog open={showAddDebtDialog} onOpenChange={setShowAddDebtDialog}>
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
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={newDebtForm.dueDate}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, dueDate: e.target.value })}
                  className="pr-10"
                />
              </div>
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
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDebtDialog(false)}>
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
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
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
                  <span className="font-bold">${selectedDebt.totalDebt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">{t('debts.paidSoFar')}</span>
                  <span className="font-bold text-success">${selectedDebt.totalPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">{t('debts.remaining')}</span>
                  <span className="font-bold text-destructive">${selectedDebt.remainingDebt.toLocaleString()}</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('debts.paymentAmount')} ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  max={selectedDebt.remainingDebt}
                />
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => setPaymentAmount(selectedDebt.remainingDebt)}
                  >
                    {t('debts.payFull')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => setPaymentAmount(Math.round(selectedDebt.remainingDebt / 2))}
                  >
                    {t('debts.payHalf')}
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPaymentDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button className="flex-1 bg-success hover:bg-success/90" onClick={handlePayment}>
                  <Save className="w-4 h-4 ml-2" />
                  {t('debts.confirmPayment')}
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
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('debts.invoiceId')}</span>
                  <span className="font-medium font-mono">{selectedDebt.invoiceId}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('debts.createdAt')}</span>
                  <span className="font-medium">{selectedDebt.createdAt}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('debts.dueDate')}</span>
                  <span className="font-medium">{selectedDebt.dueDate}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('debts.totalDebt')}</span>
                  <span className="font-bold">${selectedDebt.totalDebt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('debts.paid')}</span>
                  <span className="font-bold text-success">${selectedDebt.totalPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">{t('debts.remaining')}</span>
                  <span className="font-bold text-destructive">${selectedDebt.remainingDebt.toLocaleString()}</span>
                </div>
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
    </div>
  );
}
