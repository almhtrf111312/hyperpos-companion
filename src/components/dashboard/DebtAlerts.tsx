import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebtAlert {
  id: string;
  customer: string;
  phone: string;
  amount: number;
  dueDate: string;
  status: 'overdue' | 'due_today' | 'due_soon';
}

const mockDebts: DebtAlert[] = [
  { id: '1', customer: 'أحمد محمد', phone: '+963 912 345 678', amount: 1500, dueDate: '2025-01-05', status: 'overdue' },
  { id: '2', customer: 'خالد عمر', phone: '+963 998 765 432', amount: 850, dueDate: '2025-01-08', status: 'due_today' },
  { id: '3', customer: 'سامي حسن', phone: '+963 933 111 222', amount: 2200, dueDate: '2025-01-10', status: 'due_soon' },
];

const statusConfig = {
  overdue: {
    icon: AlertTriangle,
    label: 'متأخر',
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/20',
  },
  due_today: {
    icon: Clock,
    label: 'اليوم',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/20',
  },
  due_soon: {
    icon: CheckCircle,
    label: 'قريباً',
    bgColor: 'bg-info/10',
    textColor: 'text-info',
    borderColor: 'border-info/20',
  },
};

export function DebtAlerts() {
  const navigate = useNavigate();

  const handleViewAllDebts = () => {
    navigate('/debts');
  };

  const handleDebtClick = (debtId: string) => {
    navigate('/debts');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">تنبيهات الديون</h3>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium badge-danger">
          {mockDebts.filter(d => d.status === 'overdue').length} متأخرة
        </span>
      </div>
      <div className="space-y-3">
        {mockDebts.map((debt, index) => {
          const config = statusConfig[debt.status];
          const StatusIcon = config.icon;
          
          return (
            <div 
              key={debt.id}
              className={cn(
                "p-4 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer fade-in",
                config.bgColor,
                config.borderColor
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleDebtClick(debt.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", config.bgColor)}>
                    <StatusIcon className={cn("w-5 h-5", config.textColor)} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{debt.customer}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {debt.phone}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg text-foreground">${debt.amount}</p>
                  <p className={cn("text-xs font-medium", config.textColor)}>{config.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button 
        onClick={handleViewAllDebts}
        className="w-full mt-4 py-3 text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        عرض جميع الديون
      </button>
    </div>
  );
}
