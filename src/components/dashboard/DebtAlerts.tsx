import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Phone, FileX, Loader2 } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { loadDebtsCloud } from '@/lib/cloud/debts-cloud';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';

interface DebtAlert {
  id: string;
  customer: string;
  phone: string;
  amount: number;
  status: 'overdue' | 'due_today' | 'due_soon';
}

export function DebtAlerts() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [debts, setDebts] = useState<DebtAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const statusConfig = {
    overdue: {
      icon: AlertTriangle,
      labelKey: 'debtAlerts.overdueLabel' as const,
      bgColor: 'bg-destructive/10',
      textColor: 'text-destructive',
      borderColor: 'border-destructive/20',
    },
    due_today: {
      icon: Clock,
      labelKey: 'debtAlerts.dueToday' as const,
      bgColor: 'bg-warning/10',
      textColor: 'text-warning',
      borderColor: 'border-warning/20',
    },
    due_soon: {
      icon: CheckCircle,
      labelKey: 'debtAlerts.dueSoon' as const,
      bgColor: 'bg-info/10',
      textColor: 'text-info',
      borderColor: 'border-info/20',
    },
  };

  // Load debts from Cloud
  const loadData = useCallback(async () => {
    try {
      const cloudDebts = await loadDebtsCloud();
      const activeDebts = cloudDebts.filter(d => d.status !== 'fully_paid');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mapped = activeDebts.map(debt => {
        const createdDate = new Date(debt.createdAt);
        const daysSinceCreated = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        // Determine status based on days since debt created
        let status: 'overdue' | 'due_today' | 'due_soon';
        if (daysSinceCreated > 30 || debt.status === 'overdue') {
          status = 'overdue';
        } else if (daysSinceCreated > 14) {
          status = 'due_today';
        } else {
          status = 'due_soon';
        }

        return {
          id: debt.id,
          customer: debt.customerName,
          phone: debt.customerPhone || '',
          amount: debt.remainingDebt,
          status,
        } as DebtAlert;
      }).slice(0, 5); // Show top 5 debts

      setDebts(mapped);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    window.addEventListener(EVENTS.DEBTS_UPDATED, loadData);
    window.addEventListener(EVENTS.INVOICES_UPDATED, loadData);
    return () => {
      window.removeEventListener(EVENTS.DEBTS_UPDATED, loadData);
      window.removeEventListener(EVENTS.INVOICES_UPDATED, loadData);
    };
  }, [loadData]);

  const handleViewAllDebts = () => {
    navigate('/debts');
  };

  const handleDebtClick = (debtId: string) => {
    navigate('/debts');
  };

  const overdueCount = debts.filter(d => d.status === 'overdue').length;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">{t('debtAlerts.title')}</h3>
        {overdueCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium badge-danger">
            {overdueCount} {t('debtAlerts.overdue')}
          </span>
        )}
      </div>

      {debts.length === 0 ? (
        <div className="py-8 text-center">
          <FileX className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">{t('debtAlerts.noDebts')}</p>
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
                    <p className="font-bold text-lg text-foreground">${formatNumber(debt.amount)}</p>
                    <p className={cn("text-xs font-medium", config.textColor)}>{t(config.labelKey)}</p>
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
        {t('debtAlerts.viewAllDebts')}
      </button>
    </div>
  );
}
