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
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

const mockDebts: Debt[] = [
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('الكل');

  const filterStatusMap: Record<string, string | null> = {
    'الكل': null,
    'مستحق': 'due',
    'مدفوع جزئياً': 'partially_paid',
    'متأخر': 'overdue',
    'مدفوع بالكامل': 'fully_paid',
  };

  const filteredDebts = mockDebts.filter(debt => {
    const matchesSearch = debt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         debt.customerPhone.includes(searchQuery) ||
                         debt.invoiceId.toLowerCase().includes(searchQuery.toLowerCase());
    const filterStatus = filterStatusMap[selectedFilter];
    const matchesFilter = !filterStatus || debt.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: mockDebts.reduce((sum, d) => sum + d.totalDebt, 0),
    remaining: mockDebts.reduce((sum, d) => sum + d.remainingDebt, 0),
    paid: mockDebts.reduce((sum, d) => sum + d.totalPaid, 0),
    overdue: mockDebts.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.remainingDebt, 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة الديون</h1>
          <p className="text-muted-foreground mt-1">تتبع وإدارة ديون العملاء</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-5 h-5 ml-2" />
          تسجيل دفعة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.total.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">إجمالي الديون</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.remaining.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">الديون المتبقية</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">المدفوعات</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.overdue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">ديون متأخرة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="بحث بالاسم أو رقم الفاتورة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 bg-muted border-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
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
      <div className="space-y-4">
        {filteredDebts.map((debt, index) => {
          const status = statusConfig[debt.status];
          const StatusIcon = status.icon;
          const progress = (debt.totalPaid / debt.totalDebt) * 100;

          return (
            <div 
              key={debt.id}
              className="bg-card rounded-2xl border border-border p-6 card-hover fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Customer Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-primary-foreground">
                      {debt.customerName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{debt.customerName}</h3>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        status.color
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                <div className="flex-1 md:max-w-xs">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">التقدم</span>
                    <span className="font-medium text-foreground">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>مدفوع: ${debt.totalPaid}</span>
                    <span>المجموع: ${debt.totalDebt}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-left md:text-right">
                  <p className="text-sm text-muted-foreground">المبلغ المتبقي</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    debt.remainingDebt > 0 ? "text-destructive" : "text-success"
                  )}>
                    ${debt.remainingDebt.toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 ml-1" />
                    عرض
                  </Button>
                  {debt.remainingDebt > 0 && (
                    <Button size="sm" className="bg-success hover:bg-success/90">
                      <DollarSign className="w-4 h-4 ml-1" />
                      تسجيل دفعة
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
