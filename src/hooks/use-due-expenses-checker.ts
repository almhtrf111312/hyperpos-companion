import { useEffect } from 'react';
import { getDueExpenses, executeAutoPayRecurringExpenses } from '@/lib/recurring-expenses-store';
import { showSmartToast } from '@/hooks/use-smart-toast';
import { formatNumber } from '@/lib/utils';

export function useDueExpensesChecker() {
  useEffect(() => {
    const checkAndAutoPay = async () => {
      try {
        // 1. تنفيذ الدفع التلقائي للمصاريف المجدولة مع ضمان عدم التكرار (Idempotency)
        const autoPaidCount = await executeAutoPayRecurringExpenses();
        if (autoPaidCount > 0) {
          showSmartToast({
            title: 'دفع تلقائي لمصروف دوري',
            subtitle: `تم خصم وسداد ${autoPaidCount} مصروف دوري مستحق تلقائياً من الصندوق`,
            type: 'info',
            time: 'الآن',
            duration: 4500
          });
        }

        // 2. التنبيه بالمصاريف المستحقة التي تتطلب مراجعة وسداد يدوي
        const manualDue = getDueExpenses().filter(e => !e.autoPay);
        if (manualDue.length > 0) {
          const totalAmount = manualDue.reduce((sum, e) => sum + e.amount, 0);
          showSmartToast({
            title: `تنبيه: يوجد ${manualDue.length} مصروف مستحق السداد اليوم`,
            subtitle: `إجمالي المستحق: $${formatNumber(totalAmount, 2)} - اضغط للمراجعة والسداد`,
            type: 'warning',
            time: 'الآن',
            duration: 6000,
            primaryAction: {
              label: 'مراجعة وسداد',
              onClick: () => {
                window.location.hash = '#/expenses';
              }
            }
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
