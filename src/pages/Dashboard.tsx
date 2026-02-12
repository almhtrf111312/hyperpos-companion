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
  BarChart3
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
  // Dashboard Version 2.0 - Overhaul
  const [stats, setStats] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    todayCount: 0,
    todayProfit: 0,        // Gross profit (Sales - COGS)
    todayCOGS: 0,          // ✅ Cost of Goods Sold
    todayExpenses: 0,
    netProfit: 0,          // Net profit = Gross profit - Expenses
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
      const todayDate = new Date();
      const todayStr = todayDate.toDateString();
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

      // ✅ Calculate debts from actual debts table (more accurate)
      const activeDebts = debts.filter(d => d.status !== 'fully_paid');
      const totalDebtAmount = activeDebts.reduce((sum, d) => sum + d.remainingDebt, 0);
      const debtCustomers = new Set(activeDebts.map(d => d.customerName)).size;

      // Calculate profit margin
      const profitMargin = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;

      // Get unique customers this month & Month Sales
      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();

      const monthInvoices = invoices.filter(inv => {
        const date = new Date(inv.createdAt);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear && inv.status !== 'cancelled';
      });

      const uniqueCustomers = new Set(monthInvoices.map(inv => inv.customerName)).size;
      const monthSales = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Calculate Week Sales
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weekInvoices = invoices.filter(inv =>
        new Date(inv.createdAt) >= oneWeekAgo && inv.status !== 'cancelled'
      );
      const weekSales = weekInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Calculate inventory value
      const inventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);

      // ✅ Calculate total capital from multiple sources
      // 1. Capital from partners (Cloud) - Primary source
      const totalCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);

      // ✅ 2. Calculate cumulative cashbox balance (Calculated Global Cash)
      // Formula: (Cash sales + Debt payments) + (Capital + Money injection) - (Expenses + Withdrawals)
      const totalSalesCash = invoices
        .filter(inv => inv.status !== 'cancelled' && inv.paymentType === 'cash')
        .reduce((sum, inv) => sum + inv.total, 0);

      const totalDebtPaid = invoices
        .filter(inv => inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.debtPaid || 0), 0);

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      const totalWithdrawals = partners.reduce((sum, p) => sum + (p.totalWithdrawn || 0), 0);

      // Use current capital as an indicator of money entering the system
      const globalCashBalance = (totalSalesCash + totalDebtPaid + totalCapital) - (totalExpenses + totalWithdrawals);

      // ✅ 3. Available capital (Liquid Capital) = Cashbox balance
      const liquidCapital = globalCashBalance;

      // ✅ Calculate deficit and percentage
      const deficit = liquidCapital < 0 ? Math.abs(liquidCapital) : 0;
      const deficitPercentage = totalCapital > 0 ? (deficit / totalCapital) * 100 : 0;

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

    // ✅ Listen to all financial events
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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

      {/* Stats Grid - First Row (4 Columns Enforced) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title={t('dashboard.todaySales')}
          value={formatCurrency(stats.todaySales)}
          subtitle={`${stats.todayCount} ${t('dashboard.invoice')}`}
          icon={<DollarSign className="w-6 h-6" />}
          variant="primary"
          linkTo="/pos"
        />
        <StatCard
          title={t('dashboard.netProfit')}
          value={formatCurrency(stats.netProfit)}
          subtitle={`${t('dashboard.profitMargin')} ${stats.profitMargin}% | ${t('nav.expenses')}: ${formatCurrency(stats.todayExpenses)}`}
          icon={<TrendingUp className="w-6 h-6" />}
          variant={stats.netProfit >= 0 ? "success" : "warning"}
          linkTo="/reports"
        />
        <StatCard
          title={t('dashboard.dueDebts')}
          value={formatCurrency(stats.totalDebtAmount)}
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

      {/* Sales Performance Row (New - 2 or 4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">مبيعات هذا الأسبوع</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.weekSales)}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <BarChart3 className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">مبيعات هذا الشهر</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.monthSales)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Capital Row (4 Columns Enforced) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Inventory value */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Package className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.inventoryValue')}</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.inventoryValue)}</p>
            </div>
          </div>
        </div>

        {/* Total capital */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.totalCapital')}</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalCapital)}</p>
            </div>
          </div>
        </div>

        {/* Cashbox balance */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Banknote className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.cashboxBalance')}</p>
              <p className="text-xl font-bold text-success">{formatCurrency(stats.cashboxBalance)}</p>
            </div>
          </div>
        </div>

        {/* Available capital */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stats.liquidCapital >= 0 ? 'bg-info/10' : 'bg-destructive/10'}`}>
              <DollarSign className={`w-5 h-5 ${stats.liquidCapital >= 0 ? 'text-info' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.liquidCapital')}</p>
              <p className={`text-xl font-bold ${stats.liquidCapital >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                {formatCurrency(stats.liquidCapital)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deficit - only shows if > 0 */}
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
                  {formatCurrency(stats.deficit)}
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

      {/* Quick Actions (Compacted) */}
      <QuickActions />

      {/* Main Content Grid (Lists) */}
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
