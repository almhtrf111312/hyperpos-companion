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
        />
        <StatCard
          title="مبيعات الأسبوع"
          value={formatCurrency(stats.weekSales)}
          icon={<Calendar />}
          variant="primary"
          linkTo="/invoices"
        />
        <StatCard
          title="مبيعات الشهر"
          value={formatCurrency(stats.monthSales)}
          icon={<BarChart3 />}
          variant="primary"
          linkTo="/reports"
        />
      </div>

      {/* Financial Performance Row */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <StatCard
          title={t('dashboard.netProfit')}
          value={formatCurrency(stats.netProfit)}
          subtitle={`${t('dashboard.profitMargin')} ${stats.profitMargin}%`}
          icon={<TrendingUp />}
          variant="primary"
          linkTo="/reports"
        />
        <StatCard
          title={t('dashboard.dueDebts')}
          value={formatCurrency(stats.totalDebtAmount)}
          subtitle={`${stats.debtCustomers} ${t('dashboard.client')}`}
          icon={<CreditCard />}
          variant="primary"
          linkTo="/debts"
        />
        <StatCard
          title={t('dashboard.customersThisMonth')}
          value={stats.uniqueCustomers.toString()}
          subtitle={t('dashboard.uniqueCustomers')}
          icon={<Users />}
          variant="primary"
          linkTo="/customers"
        />
      </div>

      {/* Capital Row - 4 columns on desktop, 2x2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {noInventory ? (
          <StatCard
            title="إجمالي المشتريات"
            value={formatCurrency(stats.totalPurchases)}
            icon={<ShoppingCart />}
            variant="primary"
            linkTo="/products"
          />
        ) : (
          <StatCard
            title={t('dashboard.inventoryValue')}
            value={formatCurrency(stats.inventoryValue)}
            icon={<Package />}
            variant="primary"
            linkTo="/products"
          />
        )}
        <StatCard
          title={t('dashboard.totalCapital')}
          value={formatCurrency(stats.totalCapital)}
          icon={<Wallet />}
          variant="primary"
          linkTo="/partners"
        />
        <StatCard
          title={t('dashboard.cashboxBalance')}
          value={formatCurrency(stats.cashboxBalance)}
          icon={<Banknote />}
          variant="primary"
          linkTo="/cashbox"
        />
        <StatCard
          title={t('dashboard.liquidCapital')}
          value={formatCurrency(stats.liquidCapital)}
          icon={<DollarSign />}
          variant="primary"
          linkTo="/reports"
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
