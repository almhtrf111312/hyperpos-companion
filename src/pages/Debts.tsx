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

const statusConfig = {
  due: { label: 'مستحق', icon: Clock, color: 'badge-info' },
  partially_paid: { label: 'مدفوع جزئياً', icon: DollarSign, color: 'badge-warning' },
  overdue: { label: 'متأخر', icon: AlertTriangle, color: 'badge-danger' },
  fully_paid: { label: 'مدفوع بالكامل', icon: CheckCircle, color: 'badge-success' },
};

const filterOptions = ['الكل', 'مستحق', 'مدفوع جزئياً', 'متأخر', 'مدفوع بالكامل'];

export default function Debts() {
  const { user, profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('الكل');
  
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

  const filterStatusMap: Record<string, string | null> = {
    'الكل': null,
    'مستحق': 'due',
    'مدفوع جزئياً': 'partially_paid',
    'متأخر': 'overdue',
    'مدفوع بالكامل': 'fully_paid',
  };

  const filteredDebts = debts.filter(debt => {
    const matchesSearch = debt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         debt.customerPhone.includes(searchQuery) ||
                         debt.invoiceId.toLowerCase().includes(searchQuery.toLowerCase());
    const filterStatus = filterStatusMap[selectedFilter];
    const matchesFilter = !filterStatus || debt.status === filterStatus;
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
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (paymentAmount > selectedDebt.remainingDebt) {
      toast.error('المبلغ أكبر من الدين المتبقي');
      return;
    }

    // Calculate payment ratio for partial profit confirmation
    const paymentRatio = paymentAmount / selectedDebt.remainingDebt;
    
    recordPayment(selectedDebt.id, paymentAmount);
    
    // Confirm pending profits proportionally to payment
    // If full payment (ratio = 1), confirm all pending profits
    // If partial payment, confirm proportional amount
    confirmPendingProfit(selectedDebt.invoiceId, paymentRatio);
    
    // Log activity
    if (user) {
      addActivityLog(
        'debt_paid',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `تم تسديد دفعة $${paymentAmount.toLocaleString()} من دين ${selectedDebt.customerName}`,
        { debtId: selectedDebt.id, amount: paymentAmount, customerName: selectedDebt.customerName }
      );
    }
    
    setDebts(loadDebts());
    
    setShowPaymentDialog(false);
    setSelectedDebt(null);
    setPaymentAmount(0);
    toast.success('تم تسجيل الدفعة بنجاح');
  };

  const handleAddCashDebt = () => {
    if (!newDebtForm.customerName || !newDebtForm.customerPhone || newDebtForm.amount <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!newDebtForm.dueDate) {
      toast.error('يرجى تحديد تاريخ الاستحقاق');
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
        `تم إنشاء دين نقدي للعميل ${newDebtForm.customerName} بقيمة $${newDebtForm.amount.toLocaleString()}`,
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
    toast.success('تم إضافة الدين النقدي بنجاح');
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">إدارة الديون</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">تتبع وإدارة ديون العملاء</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowAddDebtDialog(true)}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          إضافة دين نقدي
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
              <p className="text-xs md:text-sm text-muted-foreground">إجمالي</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">المتبقي</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">المدفوع</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">متأخر</p>
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
            placeholder="بحث بالاسم أو رقم الفاتورة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 md:pr-10 bg-muted border-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                selectedFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {filter}
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
                          نقدي
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
                    <span className="text-muted-foreground">التقدم</span>
                    <span className="font-medium text-foreground">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground mt-1">
                    <span>مدفوع: ${debt.totalPaid}</span>
                    <span>المجموع: ${debt.totalDebt}</span>
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">المبلغ المتبقي</p>
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
                      عرض
                    </Button>
                    {debt.remainingDebt > 0 && (
                      <Button size="sm" className="h-8 md:h-9 bg-success hover:bg-success/90 text-xs md:text-sm" onClick={() => openPaymentDialog(debt)}>
                        <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                        دفعة
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
              إضافة دين نقدي
            </DialogTitle>
            <DialogDescription>
              إضافة دائن جديد بدون فاتورة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم العميل *</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="اسم العميل"
                  value={newDebtForm.customerName}
                  onChange={(e) => setNewDebtForm({ ...newDebtForm, customerName: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
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
              <label className="text-sm font-medium mb-1.5 block">المبلغ ($) *</label>
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
              <label className="text-sm font-medium mb-1.5 block">تاريخ الاستحقاق *</label>
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
              <label className="text-sm font-medium mb-1.5 block">ملاحظات</label>
              <Input
                placeholder="ملاحظات إضافية..."
                value={newDebtForm.notes}
                onChange={(e) => setNewDebtForm({ ...newDebtForm, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDebtDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddCashDebt}>
                <Save className="w-4 h-4 ml-2" />
                إضافة الدين
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
              تسجيل دفعة جديدة
            </DialogTitle>
            <DialogDescription>
              تسجيل دفعة للعميل {selectedDebt?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">إجمالي الدين:</span>
                  <span className="font-semibold">${selectedDebt.totalDebt}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المدفوع:</span>
                  <span className="font-semibold text-success">${selectedDebt.totalPaid}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground">المتبقي:</span>
                  <span className="font-bold text-destructive">${selectedDebt.remainingDebt}</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block">مبلغ الدفعة ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  max={selectedDebt.remainingDebt}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setPaymentAmount(selectedDebt.remainingDebt)}
                >
                  دفع كامل المبلغ
                </Button>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowPaymentDialog(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 bg-success hover:bg-success/90" onClick={handlePayment}>
                  <Save className="w-4 h-4 ml-2" />
                  تأكيد الدفعة
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
              <CreditCard className="w-5 h-5 text-primary" />
              تفاصيل الدين
            </DialogTitle>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {selectedDebt.customerName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedDebt.customerName}</h3>
                  <p className="text-muted-foreground">{selectedDebt.customerPhone}</p>
                </div>
              </div>
              
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم الفاتورة:</span>
                  <span className="font-mono">{selectedDebt.invoiceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                  <span>{selectedDebt.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الاستحقاق:</span>
                  <span>{selectedDebt.dueDate}</span>
                </div>
                {selectedDebt.isCashDebt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">النوع:</span>
                    <span className="text-accent font-medium">دين نقدي</span>
                  </div>
                )}
                {selectedDebt.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ملاحظات:</span>
                    <span>{selectedDebt.notes}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي الدين</p>
                  <p className="text-lg font-bold">${selectedDebt.totalDebt}</p>
                </div>
                <div className="bg-success/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                  <p className="text-lg font-bold text-success">${selectedDebt.totalPaid}</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
                  <p className="text-lg font-bold text-destructive">${selectedDebt.remainingDebt}</p>
                </div>
              </div>

              {selectedDebt.remainingDebt > 0 && (
                <Button 
                  className="w-full bg-success hover:bg-success/90" 
                  onClick={() => {
                    setShowViewDialog(false);
                    openPaymentDialog(selectedDebt);
                  }}
                >
                  <DollarSign className="w-4 h-4 ml-2" />
                  تسجيل دفعة
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
