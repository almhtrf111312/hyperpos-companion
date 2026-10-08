import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
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
  RotateCcw,
  Receipt
} from 'lucide-react';
import { UnifiedReportsDashboard } from '@/components/dashboard/UnifiedReportsDashboard';
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
import { toLocalDateString } from '@/lib/date-utils';

const DASHBOARD_CACHE_KEY = 'hyperpos_dashboard_stats_cache_v1';

const getCapitalSettings = () => {
  try {
    const raw = localStorage.getItem('hyperpos_settings_v1');
    if (!raw) return { trackCapital: false, initialCapital: 0 };
    const parsed = JSON.parse(raw);
    const trackCapital = Boolean(
      parsed.trackCapital ?? 
      parsed.syncSettings?.trackCapital ?? 
      parsed.storeSettings?.trackCapital ?? 
      false
    );
    const initialCapital = Number(
      parsed.initialCapital ?? 
      parsed.syncSettings?.initialCapital ?? 
      parsed.storeSettings?.initialCapital ?? 
      0
    ) || 0;
    return { trackCapital, initialCapital };
  } catch {
    return { trackCapital: false, initialCapital: 0 };
  }
};

export default function Dashboard() {
  const [dashboardDesign, setDashboardDesign] = useState<'classic' | 'unified_pro'>(() => {
    return (localStorage.getItem('hyperpos_dashboard_design_v1') as 'classic' | 'unified_pro') || 'classic';
  });

  useEffect(() => {
    const handler = () => {
      const current = (localStorage.getItem('hyperpos_dashboard_design_v1') as 'classic' | 'unified_pro') || 'classic';
      setDashboardDesign(current);
    };
    window.addEventListener('hyperpos:design-changed', handler);
    return () => window.removeEventListener('hyperpos:design-changed', handler);
  }, []);

  const { t, language, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [capitalConfig, setCapitalConfig] = useState(getCapitalSettings);
  const noInventory = isNoInventoryMode();
  // Display-only cache of last successful stats (never used for financial operations)
  const cached = (() => {
    try { const raw = localStorage.getItem(DASHBOARD_CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  })();
  const [hasData, setHasData] = useState<boolean>(!!cached);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState(cached?.stats ?? {
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
    storeInitialCapital: 0,
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
      const currentCap = getCapitalSettings();
      setCapitalConfig(currentCap);

      const [invoices, products, partners, expenses, debts, purchaseInvoices] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadPartnersCloud(),
        loadExpensesCloud(),
        loadDebtsCloud(),
        loadPurchaseInvoicesCloud()
      ]);

      const todayDate = new Date();
      const todayLocalYMD = toLocalDateString(todayDate);
      const thisMonthPrefix = todayLocalYMD.substring(0, 7);
      const isActiveInvoice = (inv: { status?: string }) => inv.status !== 'cancelled' && inv.status !== 'refunded';

      const todayInvoices = invoices.filter(inv =>
        toLocalDateString(inv.createdAt) === todayLocalYMD && isActiveInvoice(inv)
      );

      const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const todayGrossProfit = todayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
      const todayCOGS = todaySales - todayGrossProfit;

      const todayExpensesRecords = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDateStr = typeof exp.date === 'string' && exp.date.length >= 10
          ? exp.date.substring(0, 10)
          : toLocalDateString(exp.date);
        return expDateStr === todayLocalYMD;
      });
      const todayExpenses = todayExpensesRecords.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

      const todayProfit = todayGrossProfit;
      const netProfit = todayGrossProfit - todayExpenses;

      const activeDebts = debts.filter(d => d.status !== 'fully_paid');
      const totalDebtAmount = activeDebts.reduce((sum, d) => sum + d.remainingDebt, 0);
      const debtCustomers = new Set(activeDebts.map(d => d.customerName)).size;

      const profitMargin = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;

      const monthInvoices = invoices.filter(inv => {
        return toLocalDateString(inv.createdAt).substring(0, 7) === thisMonthPrefix && isActiveInvoice(inv);
      });

      const uniqueCustomers = new Set(monthInvoices.map(inv => inv.customerName)).size;
      const monthSales = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoYMD = toLocalDateString(oneWeekAgo);

      const weekInvoices = invoices.filter(inv =>
        toLocalDateString(inv.createdAt) >= oneWeekAgoYMD && isActiveInvoice(inv)
      );
      const weekSales = weekInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const inventoryValue = noInventory ? 0 : products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);

      // Total purchases (sum of finalized purchase invoices)
      const totalPurchases = purchaseInvoices
        .filter(pi => pi.status === 'finalized')
        .reduce((sum, pi) => sum + (pi.actual_grand_total || 0), 0);

      // Helper: generate 7-day array for a metric
      const make7Days = (fn: (dayYmd: string) => number) =>
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          return fn(toLocalDateString(d));
        });

      // Daily sales for last 7 days (sparkline)
      const dailySales = make7Days(dayYmd =>
        invoices.filter(inv => toLocalDateString(inv.createdAt) === dayYmd && isActiveInvoice(inv))
          .reduce((sum, inv) => sum + inv.total, 0)
      );

      const dailyProfit = make7Days(dayYmd =>
        invoices.filter(inv => toLocalDateString(inv.createdAt) === dayYmd && isActiveInvoice(inv))
          .reduce((sum, inv) => sum + (inv.profit || 0), 0)
      );

      const dailyDebts = make7Days(dayYmd =>
        debts.filter(d => toLocalDateString(d.createdAt) === dayYmd && d.status !== 'fully_paid')
          .reduce((sum, d) => sum + d.remainingDebt, 0)
      );

      const dailyCustomers = make7Days(dayYmd =>
        new Set(invoices.filter(inv => toLocalDateString(inv.createdAt) === dayYmd && isActiveInvoice(inv))
          .map(inv => inv.customerName)).size
      );

      const dailyRefunds = make7Days(dayYmd =>
        invoices.filter(inv => toLocalDateString(inv.createdAt) === dayYmd && inv.status === 'refunded')
          .reduce((sum, inv) => sum + inv.total, 0)
      );

      // Week daily sales for "مبيعات الأسبوع" sparkline (same as dailySales)
      const weekDailySales = dailySales;

      // Monthly: 4-week breakdown
      const monthWeeklySales = Array.from({ length: 4 }, (_, i) => {
        const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 6);
        const startYmd = toLocalDateString(weekStart);
        const endYmd = toLocalDateString(weekEnd);
        return invoices.filter(inv => {
          const dStr = toLocalDateString(inv.createdAt);
          return dStr >= startYmd && dStr <= endYmd && isActiveInvoice(inv);
        }).reduce((sum, inv) => sum + inv.total, 0);
      }).reverse();

      // المحاسبة الدقيقة:
      // 1. إجمالي رأس المال التأسيسي = رأس مال المحل التأسيسي + مجموع رؤوس أموال الشركاء
      const partnersCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);
      const storeInitialCapital = currentCap.trackCapital ? (currentCap.initialCapital || 0) : 0;
      const totalCapital = storeInitialCapital + partnersCapital;

      // 2. المبيعات النقدية المقبوضة كاش فقط
      const totalSalesCash = invoices
        .filter(inv => isActiveInvoice(inv))
        .reduce((sum, inv) => {
          if (inv.paymentType === 'cash') return sum + inv.total;
          if ((inv.paymentType as string) === 'split' && (inv as any).downPayment) return sum + Number((inv as any).downPayment);
          return sum;
        }, 0);

      // 3. الديون المحصلة نقداً
      const debtPaidInvoices = invoices
        .filter(inv => isActiveInvoice(inv))
        .reduce((sum, inv) => sum + (inv.debtPaid || 0), 0);
      const debtPaidTable = debts.reduce((sum, d) => sum + (d.totalPaid || 0), 0);
      const totalDebtPaid = Math.max(debtPaidInvoices, debtPaidTable);

      // 4. فواتير الشراء المسددة نقداً فقط (فواتير الآجل لا تُخصم من السيولة النقدية حتى تُسدد)
      const isCashPurchase = (pi: any) => {
        const pType = pi.paymentType || pi.payment_type;
        if (pType === 'debt' || pType === 'credit') return false;
        if (typeof pi.notes === 'string' && (pi.notes.includes('آجل') || pi.notes.includes('دين'))) return false;
        return true;
      };

      const cashPurchasesPaid = purchaseInvoices
        .filter(pi => pi.status === 'finalized' && isCashPurchase(pi))
        .reduce((sum, pi) => sum + (pi.actual_grand_total || pi.expected_grand_total || 0), 0);

      // 5. المصاريف
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      // 6. مسحوبات الشركاء / المالك
      const totalWithdrawals = partners.reduce((sum, p) => sum + (p.totalWithdrawn || 0), 0);

      // 7. رأس المال السائل / السيولة المتوفرة بالصندوق:
      // Liquid Capital = (Total Capital + المبيعات النقدية + الديون المحصلة) - (فواتير الشراء المسددة نقداً + المصاريف)
      const globalCashBalance = (totalCapital + totalSalesCash + totalDebtPaid) - (cashPurchasesPaid + totalExpenses);
      const liquidCapital = globalCashBalance;

      const deficit = liquidCapital < 0 ? Math.abs(liquidCapital) : 0;
      const deficitPercentage = totalCapital > 0 ? (deficit / totalCapital) * 100 : 0;

      // ✅ إحصائيات الفواتير المستردة
      const todayRefundedInvoices = invoices.filter(inv =>
        toLocalDateString(inv.createdAt) === todayLocalYMD && inv.status === 'refunded'
      );
      const todayRefundedCount = todayRefundedInvoices.length;

      const monthRefundedAmount = invoices
        .filter(inv => {
          return toLocalDateString(inv.createdAt).substring(0, 7) === thisMonthPrefix && inv.status === 'refunded';
        })
        .reduce((sum, inv) => sum + inv.total, 0);

      const nextStats = {
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
        storeInitialCapital,
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
      };
      setStats(nextStats);
      setHasData(true);
      setLoadError(false);
      const now = Date.now();
      try { localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ stats: nextStats, at: now })); } catch { /* quota */ }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();

    // Debounce bursts of update events (realtime/sync) into a single reload
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadStats(), 800);
    };
    const evts = [
      EVENTS.INVOICES_UPDATED,
      EVENTS.PRODUCTS_UPDATED,
      EVENTS.PARTNERS_UPDATED,
      EVENTS.EXPENSES_UPDATED,
      EVENTS.RECURRING_EXPENSES_UPDATED,
      EVENTS.CASHBOX_UPDATED,
      EVENTS.CAPITAL_UPDATED,
      EVENTS.SETTINGS_UPDATED,
      EVENTS.PURCHASES_UPDATED,
      EVENTS.DEBTS_UPDATED,
    ];
    evts.forEach(e => window.addEventListener(e, handleUpdate));

    return () => {
      if (timer) clearTimeout(timer);
      evts.forEach(e => window.removeEventListener(e, handleUpdate));
    };
  }, [loadStats]);

    if (dashboardDesign === 'unified_pro') {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <UnifiedReportsDashboard
          stats={stats}
          isLoading={isLoading}
          onRefresh={loadStats}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <PageHeader
        title={t('nav.dashboard')}
        actions={
          loadError ? (
            <button onClick={() => loadStats()} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive">
              تعذّر التحديث — إعادة المحاولة
            </button>
          ) : isLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">{hasData ? 'جارٍ التحديث...' : 'جارٍ الحساب...'}</span>
            </div>
          ) : undefined
        }
      />

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

      {/* Capital / Financial Overview Row */}
      {capitalConfig.trackCapital ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
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
              subtitle="بسعر التكلفة"
              icon={<Package />}
              variant="purple"
              linkTo="/products"
              sparklineData={stats.dailySales}
            />
          )}
          <StatCard
            title={t('dashboard.totalCapital')}
            value={formatCurrency(stats.totalCapital)}
            subtitle={stats.storeInitialCapital > 0 ? `رأس مال المتجر: ${formatCurrency(stats.storeInitialCapital)}` : undefined}
            icon={<Wallet />}
            variant="success"
            linkTo="/partners"
            sparklineData={stats.dailyProfit}
          />
          <StatCard
            title={t('dashboard.liquidCapital')}
            value={formatCurrency(stats.liquidCapital)}
            subtitle={
              stats.deficit > 0
                ? `عجز سيولة: ${formatCurrency(stats.deficit)} (${stats.deficitPercentage.toFixed(1)}%)`
                : 'رصيد الخزينة والنقد الفعلي'
            }
            icon={<Banknote />}
            variant={stats.liquidCapital < 0 ? 'danger' : 'info'}
            linkTo="/reports"
            sparklineData={stats.dailyProfit}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:gap-3">
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
              subtitle="بسعر التكلفة"
              icon={<Package />}
              variant="purple"
              linkTo="/products"
              sparklineData={stats.dailySales}
            />
          )}
          <StatCard
            title="مصاريف اليوم"
            value={formatCurrency(stats.todayExpenses)}
            subtitle="المصروفات التشغيلية اليومية"
            icon={<Receipt />}
            variant="warning"
            linkTo="/expenses"
            sparklineData={stats.dailyProfit}
          />
        </div>
      )}

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
