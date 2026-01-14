import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Phone, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadInvoices } from '@/lib/invoices-store';

interface DebtAlert {
  id: string;
  customer: string;
  phone: string;
  amount: number;
  currency: string;
  currencySymbol: string;
  dueDate: string;
  status: 'overdue' | 'due_today' | 'due_soon';
}

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

  // Load debts from invoices
  const debts = useMemo(() => {
    const invoices = loadInvoices();
    const pendingDebts = invoices.filter(
      inv => inv.paymentType === 'debt' && inv.status === 'pending'
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return pendingDebts.map(inv => {
      const createdDate = new Date(inv.createdAt);
      const daysSinceCreated = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine status based on days since invoice created
      let status: 'overdue' | 'due_today' | 'due_soon';
      if (daysSinceCreated > 30) {
        status = 'overdue';
      } else if (daysSinceCreated > 14) {
        status = 'due_today';
      } else {
        status = 'due_soon';
      }

      return {
        id: inv.id,
        customer: inv.customerName,
        phone: inv.customerPhone || '',
        amount: inv.totalInCurrency,
        currency: inv.currency,
        currencySymbol: inv.currencySymbol,
        dueDate: inv.createdAt,
        status,
      } as DebtAlert;
    }).slice(0, 5); // Show top 5 debts
  }, []);

  const handleViewAllDebts = () => {
    navigate('/debts');
  };

  const handleDebtClick = (debtId: string) => {
    navigate('/debts');
  };

  const overdueCount = debts.filter(d => d.status === 'overdue').length;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">تنبيهات الديون</h3>
        {overdueCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium badge-danger">
            {overdueCount} متأخرة
          </span>
        )}
      </div>
      
      {debts.length === 0 ? (
        <div className="py-8 text-center">
          <FileX className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">لا توجد ديون مستحقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map((debt, index) => {
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
                      {debt.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {debt.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg text-foreground">{debt.currencySymbol}{debt.amount.toLocaleString()}</p>
                    <p className={cn("text-xs font-medium", config.textColor)}>{config.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <button 
        onClick={handleViewAllDebts}
        className="w-full mt-4 py-3 text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        عرض جميع الديون
      </button>
    </div>
  );
}