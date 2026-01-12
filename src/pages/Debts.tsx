import { useState } from 'react';
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
  Save
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

interface Debt {
  id: string;
  invoiceId: string;
  customerName: string;
  customerPhone: string;
  totalDebt: number;
  totalPaid: number;
  remainingDebt: number;
  dueDate: string;
  status: 'due' | 'partially_paid' | 'overdue' | 'fully_paid';
  createdAt: string;
}

const initialDebts: Debt[] = [
  { id: '1', invoiceId: 'INV_001', customerName: 'محمد أحمد', customerPhone: '+963 912 345 678', totalDebt: 2500, totalPaid: 0, remainingDebt: 2500, dueDate: '2025-01-15', status: 'due', createdAt: '2025-01-05' },
  { id: '2', invoiceId: 'INV_002', customerName: 'فاطمة محمود', customerPhone: '+963 933 111 222', totalDebt: 5000, totalPaid: 2000, remainingDebt: 3000, dueDate: '2025-01-10', status: 'partially_paid', createdAt: '2025-01-03' },
  { id: '3', invoiceId: 'INV_003', customerName: 'خالد عمر', customerPhone: '+963 944 555 666', totalDebt: 850, totalPaid: 0, remainingDebt: 850, dueDate: '2025-01-05', status: 'overdue', createdAt: '2025-01-01' },
  { id: '4', invoiceId: 'INV_004', customerName: 'أحمد سالم', customerPhone: '+963 966 222 333', totalDebt: 1200, totalPaid: 500, remainingDebt: 700, dueDate: '2025-01-20', status: 'partially_paid', createdAt: '2025-01-06' },
  { id: '5', invoiceId: 'INV_005', customerName: 'سمير حسن', customerPhone: '+963 977 444 555', totalDebt: 3500, totalPaid: 3500, remainingDebt: 0, dueDate: '2025-01-08', status: 'fully_paid', createdAt: '2025-01-02' },
];

const statusConfig = {
  due: { label: 'مستحق', icon: Clock, color: 'badge-info' },
  partially_paid: { label: 'مدفوع جزئياً', icon: DollarSign, color: 'badge-warning' },
  overdue: { label: 'متأخر', icon: AlertTriangle, color: 'badge-danger' },
  fully_paid: { label: 'مدفوع بالكامل', icon: CheckCircle, color: 'badge-success' },
};

const filterOptions = ['الكل', 'مستحق', 'مدفوع جزئياً', 'متأخر', 'مدفوع بالكامل'];

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('الكل');
  
  // Dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

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

  const stats = {
    total: debts.reduce((sum, d) => sum + d.totalDebt, 0),
    remaining: debts.reduce((sum, d) => sum + d.remainingDebt, 0),
    paid: debts.reduce((sum, d) => sum + d.totalPaid, 0),
    overdue: debts.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.remainingDebt, 0),
  };

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

    setDebts(debts.map(d => {
      if (d.id === selectedDebt.id) {
        const newTotalPaid = d.totalPaid + paymentAmount;
        const newRemainingDebt = d.totalDebt - newTotalPaid;
        const newStatus = newRemainingDebt === 0 ? 'fully_paid' : 'partially_paid';
        return {
          ...d,
          totalPaid: newTotalPaid,
          remainingDebt: newRemainingDebt,
          status: newStatus as Debt['status'],
        };
      }
      return d;
    }));

    setShowPaymentDialog(false);
    setSelectedDebt(null);
    setPaymentAmount(0);
    toast.success('تم تسجيل الدفعة بنجاح');
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">إدارة الديون</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">تتبع وإدارة ديون العملاء</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => toast.info('يتم إضافة الديون من خلال فواتير البيع بالدين')}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          تسجيل دفعة
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
              
              <div className="space-y-2 bg-muted rounded-lg p-4">
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
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">إجمالي</p>
                  <p className="text-lg font-bold">${selectedDebt.totalDebt}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">مدفوع</p>
                  <p className="text-lg font-bold text-success">${selectedDebt.totalPaid}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">متبقي</p>
                  <p className={cn("text-lg font-bold", selectedDebt.remainingDebt > 0 ? "text-destructive" : "text-success")}>
                    ${selectedDebt.remainingDebt}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
