import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Users,
  Calendar,
  Download,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { loadInvoices } from '@/lib/invoices-store';
import { loadProducts } from '@/lib/products-store';
import { loadCustomers } from '@/lib/customers-store';

export default function Reports() {
  const [dateRange, setDateRange] = useState({ 
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });
  const [activeReport, setActiveReport] = useState('sales');

  const reports = [
    { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
    { id: 'profits', label: 'الأرباح', icon: TrendingUp },
    { id: 'products', label: 'المنتجات', icon: BarChart3 },
    { id: 'customers', label: 'العملاء', icon: Users },
  ];

  // Calculate real data from stores
  const reportData = useMemo(() => {
    const allInvoices = loadInvoices();
    const products = loadProducts();
    const customers = loadCustomers();
    
    // Filter invoices by date range
    const filteredInvoices = allInvoices.filter(inv => {
      const invDate = new Date(inv.createdAt).toISOString().split('T')[0];
      return invDate >= dateRange.from && invDate <= dateRange.to && inv.type === 'sale';
    });
    
    // Calculate summary stats
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalProfit = filteredInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
    const totalOrders = filteredInvoices.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Calculate daily sales
    const dailySalesMap: Record<string, { sales: number; profit: number; orders: number }> = {};
    filteredInvoices.forEach(inv => {
      const date = new Date(inv.createdAt).toISOString().split('T')[0];
      if (!dailySalesMap[date]) {
        dailySalesMap[date] = { sales: 0, profit: 0, orders: 0 };
      }
      dailySalesMap[date].sales += inv.total;
      dailySalesMap[date].profit += inv.profit || 0;
      dailySalesMap[date].orders += 1;
    });
    
    const dailySales = Object.entries(dailySalesMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days with data
    
    // Calculate top products
    const productSalesMap: Record<string, { name: string; sales: number; revenue: number }> = {};
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.id || item.name;
        if (!productSalesMap[key]) {
          productSalesMap[key] = { name: item.name, sales: 0, revenue: 0 };
        }
        productSalesMap[key].sales += item.quantity;
        productSalesMap[key].revenue += item.total;
      });
    });
    
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Calculate top customers
    const customerPurchasesMap: Record<string, { name: string; orders: number; total: number }> = {};
    filteredInvoices.forEach(inv => {
      const name = inv.customerName || 'عميل نقدي';
      if (!customerPurchasesMap[name]) {
        customerPurchasesMap[name] = { name, orders: 0, total: 0 };
      }
      customerPurchasesMap[name].orders += 1;
      customerPurchasesMap[name].total += inv.total;
    });
    
    const topCustomers = Object.values(customerPurchasesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    // Find top product name
    const topProduct = topProducts.length > 0 ? topProducts[0].name : 'لا يوجد';
    const topCustomer = topCustomers.length > 0 ? topCustomers[0].name : 'لا يوجد';
    
    return {
      summary: { totalSales, totalProfit, totalOrders, avgOrderValue, topProduct, topCustomer },
      dailySales,
      topProducts,
      topCustomers,
      hasData: filteredInvoices.length > 0,
    };
  }, [dateRange]);

  const handleExportPDF = () => {
    const content = `
تقرير المبيعات
================
التاريخ: ${dateRange.from} - ${dateRange.to}
تاريخ التصدير: ${new Date().toLocaleString('ar-SA')}

ملخص:
- إجمالي المبيعات: $${reportData.summary.totalSales.toLocaleString()}
- صافي الأرباح: $${reportData.summary.totalProfit.toLocaleString()}
- عدد الطلبات: ${reportData.summary.totalOrders}
- متوسط قيمة الطلب: $${reportData.summary.avgOrderValue.toFixed(0)}

المبيعات اليومية:
${reportData.dailySales.map(d => `${d.date}: $${d.sales.toLocaleString()} (ربح: $${d.profit.toLocaleString()}, طلبات: ${d.orders})`).join('\n')}

أفضل المنتجات:
${reportData.topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.sales} قطعة - $${p.revenue.toLocaleString()}`).join('\n')}

أفضل العملاء:
${reportData.topCustomers.map((c, i) => `${i + 1}. ${c.name}: ${c.orders} طلب - $${c.total.toLocaleString()}`).join('\n')}
    `;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_المبيعات_${dateRange.from}_${dateRange.to}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('تم تصدير التقرير بنجاح');
  };

  const handleExportExcel = () => {
    const headers = ['التاريخ', 'المبيعات', 'الأرباح', 'الطلبات'];
    const rows = reportData.dailySales.map(d => [d.date, d.sales, d.profit, d.orders]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_المبيعات_${dateRange.from}_${dateRange.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('تم تصدير التقرير بصيغة Excel بنجاح');
  };

  const handleBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        invoices: loadInvoices(),
        products: loadProducts(),
        customers: loadCustomers(),
      }
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hyperpos_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('تم إنشاء النسخة الاحتياطية بنجاح');
  };

  // Find max sales for chart scaling
  const maxSales = Math.max(...reportData.dailySales.map(d => d.sales), 1);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">التقارير</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">تحليل شامل للمبيعات والأرباح</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 ml-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 ml-2" />
            Excel
          </Button>
          <Button onClick={handleBackup}>
            <Download className="w-4 h-4 ml-2" />
            نسخ احتياطي
          </Button>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">من:</span>
          <Input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">إلى:</span>
          <Input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="w-40"
          />
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                activeReport === report.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Icon className="w-4 h-4" />
              {report.label}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-primary" />
            {reportData.summary.totalSales > 0 && (
              <span className="flex items-center text-xs text-success">
                <ArrowUpRight className="w-3 h-3" />
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">${reportData.summary.totalSales.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-success" />
            {reportData.summary.totalProfit > 0 && (
              <span className="flex items-center text-xs text-success">
                <ArrowUpRight className="w-3 h-3" />
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">${reportData.summary.totalProfit.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">صافي الأرباح</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-5 h-5 text-info" />
          </div>
          <p className="text-2xl font-bold text-foreground">{reportData.summary.totalOrders}</p>
          <p className="text-xs text-muted-foreground">عدد الطلبات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <PieChart className="w-5 h-5 text-warning" />
          </div>
          <p className="text-2xl font-bold text-foreground">${reportData.summary.avgOrderValue.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">متوسط قيمة الطلب</p>
        </div>
      </div>

      {/* No Data Message */}
      {!reportData.hasData && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">لا توجد بيانات في الفترة المحددة</p>
          <p className="text-sm text-muted-foreground">جرب تغيير نطاق التاريخ</p>
        </div>
      )}

      {/* Sales Chart */}
      {reportData.hasData && (activeReport === 'sales' || activeReport === 'profits') && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">
            {activeReport === 'sales' ? 'المبيعات اليومية' : 'الأرباح اليومية'}
          </h3>
          {reportData.dailySales.length > 0 ? (
            <div className="space-y-3">
              {reportData.dailySales.map((day, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-24">{day.date}</span>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gradient-primary rounded-lg transition-all duration-500"
                      style={{ width: `${(activeReport === 'sales' ? day.sales : day.profit) / maxSales * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-24 text-left">
                    ${(activeReport === 'sales' ? day.sales : day.profit).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">لا توجد بيانات يومية</p>
          )}
        </div>
      )}

      {/* Top Products */}
      {reportData.hasData && activeReport === 'products' && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">أفضل المنتجات مبيعاً</h3>
          {reportData.topProducts.length > 0 ? (
            <div className="space-y-3">
              {reportData.topProducts.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-foreground">${product.revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{product.sales} قطعة</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">لا توجد منتجات مباعة</p>
          )}
        </div>
      )}

      {/* Top Customers */}
      {reportData.hasData && activeReport === 'customers' && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">أفضل العملاء</h3>
          {reportData.topCustomers.length > 0 ? (
            <div className="space-y-3">
              {reportData.topCustomers.map((customer, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{customer.name}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-foreground">${customer.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{customer.orders} طلب</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">لا يوجد عملاء</p>
          )}
        </div>
      )}

      {/* Default view - Top Products when on sales tab */}
      {reportData.hasData && activeReport === 'sales' && reportData.topProducts.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">أفضل المنتجات مبيعاً</h3>
          <div className="space-y-3">
            {reportData.topProducts.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{product.name}</span>
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground">${product.revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{product.sales} قطعة</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
