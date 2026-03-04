import { useState, useEffect, useCallback } from 'react';
import { formatNumber, formatCurrency } from '@/lib/utils';
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
  TrendingDown,
  Calendar,
  BarChart3,
  RotateCcw
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { DebtAlerts } from '@/components/dashboard/DebtAlerts';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { RecentInvoices } from '@/components/dashboard/RecentInvoices';
import { loadInvoicesCloud } from '@/lib/cloud/invoices-cloud';
import { loadProductsCloud } from '@/lib/cloud/products-cloud';
import { loadPartnersCloud } from '@/lib/cloud/partners-cloud';
import { loadExpensesCloud } from '@/lib/cloud/expenses-cloud';
import { loadDebtsCloud } from '@/lib/cloud/debts-cloud';
import { loadPurchaseInvoicesCloud } from '@/lib/cloud/purchase-invoices-cloud';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';
import { isNoInventoryMode } from '@/lib/store-type-config';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const noInventory = isNoInventoryMode();
  const [stats, setStats] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    todayCount: 0,
    todayProfit: 0,
    todayCOGS: 0,
    todayExpenses: 0,
    netProfit: 0,
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
    totalPurchases: 0,
    dailySales: [] as number[],
    todayRefundedCount: 0,
    monthRefundedAmount: 0,
    // Sparkline data arrays (7 days)
    dailyProfit: [] as number[],
    dailyDebts: [] as number[],
    dailyCustomers: [] as number[],
    dailyInventory: [] as number[],
    dailyCapital: [] as number[],
    dailyCashbox: [] as number[],
    dailyLiquid: [] as number[],
    dailyRefunds: [] as number[],
    weekDailySales: [] as number[],
    monthWeeklySales: [] as number[],
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
      const [invoices, products, partners, expenses, debts, purchaseInvoices] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadPartnersCloud(),
        loadExpensesCloud(),
        loadDebtsCloud(),
        loadPurchaseInvoicesCloud()
      ]);

      const todayDate = new Date();
      const todayStr = todayDate.toDateString();
      const todayInvoices = invoices.filter(inv =>
        new Date(inv.createdAt).toDateString() === todayStr && inv.status !== 'cancelled'
      );

      const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const todayGrossProfit = todayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
      const todayCOGS = todaySales - todayGrossProfit;

      const todayExpensesRecords = expenses.filter(exp =>
        new Date(exp.date).toDateString() === todayStr
      );
      const todayExpenses = todayExpensesRecords.reduce((sum, exp) => sum + exp.amount, 0);

      const todayProfit = todayGrossProfit;
      const netProfit = todayGrossProfit - todayExpenses;

      const activeDebts = debts.filter(d => d.status !== 'fully_paid');
      const totalDebtAmount = activeDebts.reduce((sum, d) => sum + d.remainingDebt, 0);
      const debtCustomers = new Set(activeDebts.map(d => d.customerName)).size;

      const profitMargin = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;

      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();

      const monthInvoices = invoices.filter(inv => {
        const date = new Date(inv.createdAt);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear && inv.status !== 'cancelled';
      });

      const uniqueCustomers = new Set(monthInvoices.map(inv => inv.customerName)).size;
      const monthSales = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weekInvoices = invoices.filter(inv =>
        new Date(inv.createdAt) >= oneWeekAgo && inv.status !== 'cancelled'
      );
      const weekSales = weekInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const inventoryValue = noInventory ? 0 : products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);

      // Total purchases (sum of finalized purchase invoices)
      const totalPurchases = purchaseInvoices
        .filter(pi => pi.status === 'finalized')
        .reduce((sum, pi) => sum + (pi.actual_grand_total || 0), 0);

      // Helper: generate 7-day array for a metric
      const make7Days = (fn: (dayStr: string) => number) =>
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          return fn(d.toDateString());
        });

      // Daily sales for last 7 days (sparkline)
      const dailySales = make7Days(dayStr =>
        invoices.filter(inv => new Date(inv.createdAt).toDateString() === dayStr && inv.status !== 'cancelled')
          .reduce((sum, inv) => sum + inv.total, 0)
      );

      const dailyProfit = make7Days(dayStr =>
        invoices.filter(inv => new Date(inv.createdAt).toDateString() === dayStr && inv.status !== 'cancelled')
          .reduce((sum, inv) => sum + (inv.profit || 0), 0)
      );

      const dailyDebts = make7Days(dayStr =>
        debts.filter(d => new Date(d.createdAt).toDateString() === dayStr && d.status !== 'fully_paid')
          .reduce((sum, d) => sum + d.remainingDebt, 0)
      );

      const dailyCustomers = make7Days(dayStr =>
        new Set(invoices.filter(inv => new Date(inv.createdAt).toDateString() === dayStr && inv.status !== 'cancelled')
          .map(inv => inv.customerName)).size
      );

      const dailyRefunds = make7Days(dayStr =>
        invoices.filter(inv => new Date(inv.createdAt).toDateString() === dayStr && inv.status === 'refunded')
          .reduce((sum, inv) => sum + inv.total, 0)
      );

      // Week daily sales for "مبيعات الأسبوع" sparkline (same as dailySales)
      const weekDailySales = dailySales;

      // Monthly: 4-week breakdown
      const monthWeeklySales = Array.from({ length: 4 }, (_, i) => {
        const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 6);
        return invoices.filter(inv => {
          const d = new Date(inv.createdAt);
          return d >= weekStart && d <= weekEnd && inv.status !== 'cancelled';
        }).reduce((sum, inv) => sum + inv.total, 0);
      }).reverse();

      const totalCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);

      const totalSalesCash = invoices
        .filter(inv => inv.status !== 'cancelled' && inv.paymentType === 'cash')
        .reduce((sum, inv) => sum + inv.total, 0);

      const totalDebtPaid = invoices
        .filter(inv => inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.debtPaid || 0), 0);

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      const totalWithdrawals = partners.reduce((sum, p) => sum + (p.totalWithdrawn || 0), 0);

      const globalCashBalance = (totalSalesCash + totalDebtPaid + totalCapital) - (totalExpenses + totalWithdrawals);

      const liquidCapital = globalCashBalance;

      const deficit = liquidCapital < 0 ? Math.abs(liquidCapital) : 0;
      const deficitPercentage = totalCapital > 0 ? (deficit / totalCapital) * 100 : 0;

      // ✅ إحصائيات الفواتير المستردة
      const todayRefundedInvoices = invoices.filter(inv =>
        new Date(inv.createdAt).toDateString() === todayStr && inv.status === 'refunded'
      );
      const todayRefundedCount = todayRefundedInvoices.length;

      const monthRefundedAmount = invoices
        .filter(inv => {
          const d = new Date(inv.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear && inv.status === 'refunded';
        })
        .reduce((sum, inv) => sum + inv.total, 0);

      setStats({
        todaySales,
        weekSales,
        monthSales,
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
        totalPurchases,
        dailySales,
        todayRefundedCount,
        monthRefundedAmount,
        dailyProfit,
        dailyDebts,
        dailyCustomers,
        dailyInventory: dailySales, // reuse sales trend for inventory visualization
        dailyCapital: dailyProfit,
        dailyCashbox: dailySales,
        dailyLiquid: dailyProfit,
        dailyRefunds,
        weekDailySales,
        monthWeeklySales,
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
    <div className="p-4 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('dashboard.welcome')} 👋</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-success">{t('dashboard.synced')}</span>
        </div>
      </div>

      {/* Quick Actions - Compact Toolbar */}
      <QuickActions />

      {/* Sales Row */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <StatCard
          title={t('dashboard.todaySales')}
          value={formatCurrency(stats.todaySales)}
          subtitle={`${stats.todayCount} ${t('dashboard.invoice')}`}
          icon={<DollarSign />}
          variant="primary"
          linkTo="/pos"
          sparklineData={stats.dailySales}
        />
        <StatCard
          title="مبيعات الأسبوع"
          value={formatCurrency(stats.weekSales)}
          icon={<Calendar />}
          variant="info"
          linkTo="/invoices"
          sparklineData={stats.weekDailySales}
        />
        <StatCard
          title="مبيعات الشهر"
          value={formatCurrency(stats.monthSales)}
          icon={<BarChart3 />}
          variant="purple"
          linkTo="/reports"
          sparklineData={stats.monthWeeklySales}
        />
      </div>

      {/* Financial Performance Row */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <StatCard
          title={t('dashboard.netProfit')}
          value={formatCurrency(stats.netProfit)}
          subtitle={`${t('dashboard.profitMargin')} ${stats.profitMargin}%`}
          icon={<TrendingUp />}
          variant="success"
          linkTo="/reports"
          sparklineData={stats.dailyProfit}
        />
        <StatCard
          title={t('dashboard.dueDebts')}
          value={formatCurrency(stats.totalDebtAmount)}
          subtitle={`${stats.debtCustomers} ${t('dashboard.client')}`}
          icon={<CreditCard />}
          variant="danger"
          linkTo="/debts"
          sparklineData={stats.dailyDebts}
        />
        <StatCard
          title={t('dashboard.customersThisMonth')}
          value={stats.uniqueCustomers.toString()}
          subtitle={t('dashboard.uniqueCustomers')}
          icon={<Users />}
          variant="info"
          linkTo="/customers"
          sparklineData={stats.dailyCustomers}
        />
      </div>

      {/* Capital Row - 4 columns on desktop, 2x2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {noInventory ? (
          <StatCard
            title="إجمالي المشتريات"
            value={formatCurrency(stats.totalPurchases)}
            icon={<ShoppingCart />}
            variant="purple"
            linkTo="/products"
            sparklineData={stats.dailySales}
          />
        ) : (
          <StatCard
            title={t('dashboard.inventoryValue')}
            value={formatCurrency(stats.inventoryValue)}
            icon={<Package />}
            variant="purple"
            linkTo="/products"
            sparklineData={stats.dailySales}
          />
        )}
        <StatCard
          title={t('dashboard.totalCapital')}
          value={formatCurrency(stats.totalCapital)}
          icon={<Wallet />}
          variant="success"
          linkTo="/partners"
          sparklineData={stats.dailyProfit}
        />
        <StatCard
          title={t('dashboard.cashboxBalance')}
          value={formatCurrency(stats.cashboxBalance)}
          icon={<Banknote />}
          variant="primary"
          linkTo="/cashbox"
          sparklineData={stats.dailySales}
        />
        <StatCard
          title={t('dashboard.liquidCapital')}
          value={formatCurrency(stats.liquidCapital)}
          icon={<DollarSign />}
          variant="info"
          linkTo="/reports"
          sparklineData={stats.dailyProfit}
        />
      </div>

      {/* Refund Stats Row */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <StatCard
          title="مسترجعة اليوم"
          value={stats.todayRefundedCount.toString()}
          subtitle="فاتورة مستردة"
          icon={<RotateCcw />}
          variant="warning"
          linkTo="/invoices"
          sparklineData={stats.dailyRefunds}
        />
        <StatCard
          title="إجمالي المسترجع (الشهر)"
          value={formatCurrency(stats.monthRefundedAmount)}
          subtitle="فواتير مستردة هذا الشهر"
          icon={<TrendingDown />}
          variant="warning"
          linkTo="/invoices"
          sparklineData={stats.dailyRefunds}
        />
      </div>

      {/* Recent Invoices */}
      <RecentInvoices />

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!noInventory && <LowStockAlerts />}
        <DebtAlerts />
      </div>
    </div>
  );
}
