import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  CreditCard,
  Package,
  Wallet,
  Loader2
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
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    todayProfit: 0,
    profitMargin: 0,
    totalDebtAmount: 0,
    debtCustomers: 0,
    uniqueCustomers: 0,
    inventoryValue: 0,
    totalCapital: 0,
    availableCapital: 0,
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
      const [invoices, products, partners] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadPartnersCloud()
      ]);
      
      // Calculate today's sales
      const todayStr = new Date().toDateString();
      const todayInvoices = invoices.filter(inv => 
        new Date(inv.createdAt).toDateString() === todayStr && inv.status !== 'cancelled'
      );
      const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const todayProfit = todayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
      
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

      // Calculate total capital from partners
      const totalCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);
      const availableCapital = totalCapital - inventoryValue;

      setStats({
        todaySales,
        todayCount: todayInvoices.length,
        todayProfit,
        profitMargin,
        totalDebtAmount,
        debtCustomers,
        uniqueCustomers,
        inventoryValue,
        totalCapital,
        availableCapital,
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
    window.addEventListener('focus', loadStats);
    
    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
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
          value={`$${stats.todayProfit.toLocaleString()}`}
          subtitle={`${t('dashboard.profitMargin')} ${stats.profitMargin}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          variant="success"
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
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
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stats.availableCapital >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <DollarSign className={`w-5 h-5 ${stats.availableCapital >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.availableCapital')}</p>
              <p className={`text-xl font-bold ${stats.availableCapital >= 0 ? 'text-success' : 'text-destructive'}`}>
                ${stats.availableCapital.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

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
