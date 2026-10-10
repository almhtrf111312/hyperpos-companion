import { useEffect } from 'react';
import { getDueExpenses, payRecurringExpense } from '@/lib/recurring-expenses-store';
import { showSmartToast } from '@/hooks/use-smart-toast';
import { formatNumber } from '@/lib/utils';

export function useDueExpensesChecker() {
  useEffect(() => {
    const checkAndAutoPay = async () => {
      try {
        const due = getDueExpenses();
        if (!due || due.length === 0) return;

        for (const exp of due) {
          // إذا كان المصروف مفعلاً للدفع التلقائي
          if (exp.autoPay) {
            await payRecurringExpense(exp.id);
            showSmartToast({
              title: 'دفع تلقائي لمصروف دوري',
              subtitle: `تم خصم ${exp.name} بقيمة $${formatNumber(exp.amount, 2)} من الصندوق`,
              type: 'info',
              time: 'الآن',
              duration: 4000
            });
          }
        }

        // التنبيه بالمصاريف المستحقة التي تتطلب مراجعة يدوية
        const manualDue = getDueExpenses().filter(e => !e.autoPay);
        if (manualDue.length > 0) {
          showSmartToast({
            title: `تنبيه: لديك ${manualDue.length} مصاريف مستحقة الصرف`,
            subtitle: 'انقر للانتقال لشاشة المصاريف ومراجعتها وسدادها',
            type: 'warning',
            time: 'الآن',
            duration: 6000,
            primaryAction: {
              label: 'عرض المصاريف',
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
