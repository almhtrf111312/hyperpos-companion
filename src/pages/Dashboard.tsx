import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  CreditCard,
  Package,
  Wallet,
  Loader2,
  Banknote,
  TrendingDown
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentInvoices } from '@/components/dashboard/RecentInvoices';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { DebtAlerts } from '@/components/dashboard/DebtAlerts';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { getInvoiceStatsCloud, loadInvoicesCloud } from '@/lib/cloud/invoices-cloud';
import { loadProductsCloud } from '@/lib/cloud/products-cloud';
import { loadPartnersCloud } from '@/lib/cloud/partners-cloud';
import { loadExpensesCloud } from '@/lib/cloud/expenses-cloud';
import { loadCashboxState } from '@/lib/cashbox-store';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    todayProfit: 0,
    todayExpenses: 0,
    netProfit: 0, // صافي الربح الحقيقي = الأرباح - المصاريف
    profitMargin: 0,
    totalDebtAmount: 0,
    debtCustomers: 0,
    uniqueCustomers: 0,
    inventoryValue: 0,
    totalCapital: 0,
    availableCapital: 0,
    // ✅ مؤشرات جديدة
    cashboxBalance: 0,      // رصيد الصندوق الفعلي
    liquidCapital: 0,       // رأس المال المتاح = إجمالي - مخزون
    deficit: 0,             // العجز (إذا كان المتاح سالباً)
    deficitPercentage: 0,   // نسبة العجز من رأس المال
  });
  
  const today = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Load stats from cloud
  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invoices, products, partners, expenses] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadPartnersCloud(),
        loadExpensesCloud()
      ]);
      
      // Calculate today's sales
      const todayStr = new Date().toDateString();
      const todayInvoices = invoices.filter(inv => 
        new Date(inv.createdAt).toDateString() === todayStr && inv.status !== 'cancelled'
      );
      const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const todayProfit = todayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
      
      // ✅ Calculate today's expenses
      const todayExpenses = expenses.filter(exp => 
        new Date(exp.createdAt).toDateString() === todayStr
      ).reduce((sum, exp) => sum + exp.amount, 0);
      
      // ✅ Calculate NET profit (Profit - Expenses)
      const netProfit = todayProfit - todayExpenses;
      
      // Calculate pending debts
      const pendingDebts = invoices.filter(inv => inv.paymentType === 'debt' && inv.status === 'pending');
      const totalDebtAmount = pendingDebts.reduce((sum, inv) => sum + inv.total, 0);
      const debtCustomers = new Set(pendingDebts.map(inv => inv.customerName)).size;
      
      // Calculate profit margin
      const profitMargin = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;
      
      // Get unique customers this month
      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const monthInvoices = invoices.filter(inv => {
        const date = new Date(inv.createdAt);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
      });
      const uniqueCustomers = new Set(monthInvoices.map(inv => inv.customerName)).size;

      // Calculate inventory value
      const inventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);

      // ✅ حساب رأس المال الإجمالي من مصادر متعددة
      // 1. رأس المال من الشركاء (Cloud)
      const partnersCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);
      
      // 2. رأس المال المحلي (من capital-store)
      const { loadCapitalState } = await import('@/lib/capital-store');
      const capitalState = loadCapitalState();
      
      // استخدم القيمة الأعلى للتوافق مع كلا المصدرين
      const totalCapital = Math.max(partnersCapital, capitalState.currentCapital);
      
      // ✅ رصيد الصندوق الفعلي (النقد المتوفر)
      const cashboxState = loadCashboxState();
      const cashboxBalance = cashboxState.currentBalance;
      
      // ✅ رأس المال المتاح = رأس المال الإجمالي - قيمة المخزون
      const liquidCapital = totalCapital - inventoryValue;
      
      // ✅ حساب العجز والنسبة
      const deficit = liquidCapital < 0 ? Math.abs(liquidCapital) : 0;
      const deficitPercentage = totalCapital > 0 ? (deficit / totalCapital) * 100 : 0;

      setStats({
        todaySales,
        todayCount: todayInvoices.length,
        todayProfit,
        todayExpenses,
        netProfit,
        profitMargin,
        totalDebtAmount,
        debtCustomers,
        uniqueCustomers,
        inventoryValue,
        totalCapital,
        availableCapital: cashboxBalance, // رصيد الصندوق للتوافق مع الشفرة القديمة
        cashboxBalance,
        liquidCapital,
        deficit,
        deficitPercentage,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();

    const handleUpdate = () => loadStats();
    
    // ✅ الاستماع لجميع الأحداث المالية
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.CASHBOX_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.CAPITAL_UPDATED, handleUpdate);
    window.addEventListener('focus', loadStats);
    
    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CASHBOX_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CAPITAL_UPDATED, handleUpdate);
      window.removeEventListener('focus', loadStats);
    };
  }, [loadStats]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pr-14 md:pr-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.welcome')} 👋</h1>
          <p className="text-muted-foreground mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/20">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-medium text-success">{t('dashboard.synced')}</span>
        </div>
      </div>

      {/* Stats Grid - First Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <StatCard
          title={t('dashboard.todaySales')}
          value={`$${stats.todaySales.toLocaleString()}`}
          subtitle={`${stats.todayCount} ${t('dashboard.invoice')}`}
          icon={<DollarSign className="w-6 h-6" />}
          variant="primary"
          linkTo="/pos"
        />
        <StatCard
          title={t('dashboard.netProfit')}
          value={`$${stats.netProfit.toLocaleString()}`}
          subtitle={`${t('dashboard.profitMargin')} ${stats.profitMargin}% | مصاريف: $${stats.todayExpenses.toLocaleString()}`}
          icon={<TrendingUp className="w-6 h-6" />}
          variant={stats.netProfit >= 0 ? "success" : "warning"}
          linkTo="/reports"
        />
        <StatCard
          title={t('dashboard.dueDebts')}
          value={`$${stats.totalDebtAmount.toLocaleString()}`}
          subtitle={`${stats.debtCustomers} ${t('dashboard.client')}`}
          icon={<CreditCard className="w-6 h-6" />}
          variant="warning"
          linkTo="/debts"
        />
        <StatCard
          title={t('dashboard.customersThisMonth')}
          value={stats.uniqueCustomers.toString()}
          subtitle={t('dashboard.uniqueCustomers')}
          icon={<Users className="w-6 h-6" />}
          variant="default"
          linkTo="/customers"
        />
      </div>

      {/* Stats Grid - Capital Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {/* قيمة المخزون */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Package className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.inventoryValue')}</p>
              <p className="text-xl font-bold text-foreground">${stats.inventoryValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* رأس المال الإجمالي */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.totalCapital')}</p>
              <p className="text-xl font-bold text-foreground">${stats.totalCapital.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* رصيد الصندوق */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Banknote className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.cashboxBalance') || 'رصيد الصندوق'}</p>
              <p className="text-xl font-bold text-success">${stats.cashboxBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* رأس المال المتاح */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stats.liquidCapital >= 0 ? 'bg-info/10' : 'bg-destructive/10'}`}>
              <DollarSign className={`w-5 h-5 ${stats.liquidCapital >= 0 ? 'text-info' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.liquidCapital') || 'رأس المال المتاح'}</p>
              <p className={`text-xl font-bold ${stats.liquidCapital >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                ${stats.liquidCapital.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* العجز - يظهر فقط إذا كان > 0 */}
      {stats.deficit > 0 && (
        <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-destructive/80">{t('dashboard.deficit') || 'العجز'}</p>
                <p className="text-2xl font-bold text-destructive">
                  ${stats.deficit.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-destructive/80">{t('dashboard.deficitPercentage') || 'نسبة العجز'}</p>
              <p className="text-xl font-bold text-destructive">{stats.deficitPercentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices - Takes 2 columns */}
        <div className="lg:col-span-2">
          <RecentInvoices />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <LowStockAlerts />
          <DebtAlerts />
        </div>
      </div>

      {/* Top Products */}
      <TopProducts />
    </div>
  );
}
