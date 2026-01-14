import { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  CreditCard,
  Package,
  Wallet
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentInvoices } from '@/components/dashboard/RecentInvoices';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { DebtAlerts } from '@/components/dashboard/DebtAlerts';
import { loadInvoices, getInvoiceStats } from '@/lib/invoices-store';
import { loadProducts } from '@/lib/products-store';
import { loadPartners } from '@/lib/partners-store';

export default function Dashboard() {
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Load real stats from invoices
  const stats = useMemo(() => {
    const invoiceStats = getInvoiceStats();
    const invoices = loadInvoices();
    
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
    const products = loadProducts();
    const inventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);

    // Calculate total capital from partners
    const partners = loadPartners();
    const totalCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);
    const availableCapital = totalCapital - inventoryValue;

    return {
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
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">مرحباً بك 👋</h1>
          <p className="text-muted-foreground mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/20">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-medium text-success">متزامن</span>
        </div>
      </div>

      {/* Stats Grid - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="المبيعات اليوم"
          value={`$${stats.todaySales.toLocaleString()}`}
          subtitle={`${stats.todayCount} فاتورة`}
          icon={<DollarSign className="w-6 h-6" />}
          variant="primary"
          linkTo="/pos"
        />
        <StatCard
          title="صافي الأرباح"
          value={`$${stats.todayProfit.toLocaleString()}`}
          subtitle={`هامش ربح ${stats.profitMargin}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          variant="success"
          linkTo="/reports"
        />
        <StatCard
          title="الديون المستحقة"
          value={`$${stats.totalDebtAmount.toLocaleString()}`}
          subtitle={`${stats.debtCustomers} عميل`}
          icon={<CreditCard className="w-6 h-6" />}
          variant="warning"
          linkTo="/debts"
        />
        <StatCard
          title="العملاء هذا الشهر"
          value={stats.uniqueCustomers.toString()}
          subtitle="عملاء فريدين"
          icon={<Users className="w-6 h-6" />}
          variant="default"
          linkTo="/customers"
        />
      </div>

      {/* Stats Grid - Capital Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Package className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">قيمة المخزون</p>
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
              <p className="text-sm text-muted-foreground">رأس المال الإجمالي</p>
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
              <p className="text-sm text-muted-foreground">رأس المال المتاح</p>
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
          <DebtAlerts />
        </div>
      </div>

      {/* Top Products */}
      <TopProducts />
    </div>
  );
}