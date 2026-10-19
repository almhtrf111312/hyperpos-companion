import { useEffect } from 'react';
import { getDueExpenses, executeAutoPayRecurringExpenses } from '@/lib/recurring-expenses-store';
import { toast } from 'sonner';
import { formatNumber, formatMoney } from '@/lib/utils';

export function useDueExpensesChecker() {
  useEffect(() => {
    const checkAndAutoPay = async () => {
      try {
        // 1. تنفيذ الدفع التلقائي للمصاريف المجدولة مع ضمان عدم التكرار (Idempotency)
        const autoPaidCount = await executeAutoPayRecurringExpenses();
        if (autoPaidCount > 0) {
          toast.info('دفع تلقائي لمصروف دوري', {
            id: 'auto-pay-due-expenses',
            description: `تم خصم وسداد ${autoPaidCount} مصروف دوري مستحق تلقائياً من الصندوق`,
            duration: 4500,
          });
        }

        // 2. التنبيه بالمصاريف المستحقة التي تتطلب مراجعة وسداد يدوي
        const manualDue = getDueExpenses().filter(e => !e.autoPay);
        if (manualDue.length > 0) {
          const totalAmount = manualDue.reduce((sum, e) => sum + e.amount, 0);
          toast.warning(`تنبيه: يوجد ${manualDue.length} مصروف مستحق السداد اليوم`, {
            id: 'manual-due-expenses-alert',
            description: `إجمالي المستحق: ${formatMoney(totalAmount, undefined, 2)} - اضغط للمراجعة والسداد`,
            duration: 6000,
            action: {
              label: 'مراجعة وسداد',
              onClick: () => {
                window.location.hash = '#/expenses';
              },
            },
          });
        }
      } catch (err) {
        console.error('[DueExpensesChecker] Error:', err);
      }
    };

    const timer = setTimeout(checkAndAutoPay, 2000);
    return () => clearTimeout(timer);
  }, []);
}
