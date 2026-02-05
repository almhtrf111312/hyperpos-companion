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
import { loadDebtsCloud } from '@/lib/cloud/debts-cloud';
import { loadCashboxState } from '@/lib/cashbox-store';
import { getTodayProfit } from '@/lib/profits-store';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    todayProfit: 0,        // الربح الإجمالي (المبيعات - COGS)
    todayCOGS: 0,          // ✅ تكلفة البضاعة المباعة
    todayExpenses: 0,
    netProfit: 0,          // صافي الربح = الربح الإجمالي - المصاريف
    profitMargin: 0,
    totalDebtAmount: 0,
    debtCustomers: 0,
    uniqueCustomers: 0,
    inventoryValue: 0,
    totalCapital: 0,
    availableCapital: 0,
    cashboxBalance: 0,
    liquidCapital: 0,
    deficit: 0,
    deficitPercentage: 0,
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
      const [invoices, products, partners, expenses, debts] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadPartnersCloud(),
        loadExpensesCloud(),
        loadDebtsCloud()
      ]);

      // Calculate today's sales and profit from Cloud Invoices
      const todayStr = new Date().toDateString();
      const todayInvoices = invoices.filter(inv =>
        new Date(inv.createdAt).toDateString() === todayStr && inv.status !== 'cancelled'
      );

      const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // ✅ Calculate Profit & COGS directly from Cloud Data (Source of Truth)
      const todayGrossProfit = todayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);

      // Calculate COGS = Sales - Profit (Approximation if strictly not stored on invoice root, 
      // but usually available or derivable. Ideally items have cost, but invoice.profit is stored)
      const todayCOGS = todaySales - todayGrossProfit; // Derived

      // Calculate Today's Expenses from Cloud
      const todayExpensesRecords = expenses.filter(exp =>
        new Date(exp.date).toDateString() === todayStr
      );
      const todayExpenses = todayExpensesRecords.reduce((sum, exp) => sum + exp.amount, 0);

      // ✅ Net Profit = Gross Profit - Expenses
      const todayProfit = todayGrossProfit; // For consistency with UI naming (Gross)
      const netProfit = todayGrossProfit - todayExpenses;

      // ✅ حساب الديون من جدول الديون الفعلي (أكثر دقة)
      const activeDebts = debts.filter(d => d.status !== 'fully_paid');
      const totalDebtAmount = activeDebts.reduce((sum, d) => sum + d.remainingDebt, 0);
      const debtCustomers = new Set(activeDebts.map(d => d.customerName)).size;

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
      // 1. رأس المال من الشركاء (Cloud) - المصدر الأساسي
      const totalCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);

      // ✅ 2. حساب رصيد الصندوق التراكمي (Calculated Global Cash)
      // المعادلة: (مبيعات نقدية + سداد ديون) + (رأس المال + ضخ أموال) - (مصاريف + مسحوبات)
      const totalSalesCash = invoices
        .filter(inv => inv.status !== 'cancelled' && inv.paymentType === 'cash')
        .reduce((sum, inv) => sum + inv.total, 0);

      const totalDebtPaid = invoices
        .filter(inv => inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.debtPaid || 0), 0);

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      const totalWithdrawals = partners.reduce((sum, p) => sum + (p.totalWithdrawn || 0), 0);

      // نستخدم رأس المال الحالي كمؤشر على الأموال التي دخلت النظام
      const globalCashBalance = (totalSalesCash + totalDebtPaid + totalCapital) - (totalExpenses + totalWithdrawals);

      // ✅ 3. رأس المال المتاح (Liquid Capital) = رصيد الصندوق
      const liquidCapital = globalCashBalance;

      // ✅ حساب العجز والنسبة
      const deficit = liquidCapital < 0 ? Math.abs(liquidCapital) : 0;
      const deficitPercentage = totalCapital > 0 ? (deficit / totalCapital) * 100 : 0;

      setStats({
        todaySales,
        todayCount: todayInvoices.length,
        todayProfit,
        todayCOGS,
        todayExpenses,
        netProfit,
        profitMargin,
        totalDebtAmount,
        debtCustomers,
        uniqueCustomers,
        inventoryValue,
        totalCapital,
        availableCapital: globalCashBalance,
        cashboxBalance: globalCashBalance,
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

      {/* Stats Grid - Main Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cashier / POS */}
        <StatCard
          title={t('nav.pos')}
          value={`$${stats.todaySales.toLocaleString()}`}
          subtitle={`${stats.todayCount} ${t('dashboard.invoice')}`}
          icon={<ShoppingCart className="w-8 h-8" />}
          variant="primary"
          linkTo="/"
        />

        {/* Stock / Products */}
        <StatCard
          title={t('nav.products')}
          value={`$${stats.inventoryValue.toLocaleString()}`}
          subtitle={t('dashboard.inventoryValue')}
          icon={<Package className="w-8 h-8" />}
          variant="default"
          linkTo="/products"
        />

        {/* Sales / Invoices */}
        <StatCard
          title={t('nav.invoices')}
          value={stats.todayCount.toString()}
          subtitle={`${t('dashboard.todaySales')}`}
          icon={<TrendingUp className="w-8 h-8" />}
          variant="success"
          linkTo="/invoices"
        />

        {/* Reports */}
        <StatCard
          title={t('nav.reports')}
          value={`$${stats.netProfit.toLocaleString()}`}
          subtitle={t('dashboard.netProfit')}
          icon={<Banknote className="w-8 h-8" />}
          variant="warning"
          linkTo="/reports"
        />
      </div>

      {/* Stats Grid - Capital Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
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
              <p className="text-sm text-muted-foreground">{t('dashboard.cashboxBalance')}</p>
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
              <p className="text-sm text-muted-foreground">{t('dashboard.liquidCapital')}</p>
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
                <p className="text-sm text-destructive/80">{t('dashboard.deficit')}</p>
                <p className="text-2xl font-bold text-destructive">
                  ${stats.deficit.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-destructive/80">{t('dashboard.deficitPercentage')}</p>
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
