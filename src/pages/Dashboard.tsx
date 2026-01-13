import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  CreditCard
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentInvoices } from '@/components/dashboard/RecentInvoices';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { DebtAlerts } from '@/components/dashboard/DebtAlerts';

export default function Dashboard() {
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="المبيعات اليوم"
          value="$12,450"
          subtitle="42 فاتورة"
          icon={<DollarSign className="w-6 h-6" />}
          trend={{ value: 12, label: 'من أمس' }}
          variant="primary"
          linkTo="/pos"
        />
        <StatCard
          title="صافي الأرباح"
          value="$3,240"
          subtitle="هامش ربح 26%"
          icon={<TrendingUp className="w-6 h-6" />}
          trend={{ value: 8, label: 'من الأسبوع الماضي' }}
          variant="success"
          linkTo="/reports"
        />
        <StatCard
          title="الديون المستحقة"
          value="$8,750"
          subtitle="15 عميل"
          icon={<CreditCard className="w-6 h-6" />}
          trend={{ value: -5, label: 'من الشهر الماضي' }}
          variant="warning"
          linkTo="/debts"
        />
        <StatCard
          title="العملاء الجدد"
          value="28"
          subtitle="هذا الشهر"
          icon={<Users className="w-6 h-6" />}
          trend={{ value: 15, label: 'من الشهر الماضي' }}
          variant="default"
          linkTo="/customers"
        />
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
