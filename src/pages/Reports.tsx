import { useState } from 'react';
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

export default function Reports() {
  const [dateRange, setDateRange] = useState({ from: '2025-01-01', to: '2025-01-13' });
  const [activeReport, setActiveReport] = useState('sales');

  const reports = [
    { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
    { id: 'profits', label: 'الأرباح', icon: TrendingUp },
    { id: 'products', label: 'المنتجات', icon: BarChart3 },
    { id: 'customers', label: 'العملاء', icon: Users },
  ];

  const summaryData = {
    totalSales: 125450,
    totalProfit: 32560,
    totalOrders: 342,
    avgOrderValue: 367,
    topProduct: 'iPhone 15 Pro',
    topCustomer: 'محمد أحمد',
  };

  const salesData = [
    { date: '2025-01-07', sales: 15200, profit: 3800, orders: 45 },
    { date: '2025-01-08', sales: 18500, profit: 4600, orders: 52 },
    { date: '2025-01-09', sales: 12300, profit: 3100, orders: 38 },
    { date: '2025-01-10', sales: 21000, profit: 5250, orders: 61 },
    { date: '2025-01-11', sales: 19800, profit: 4950, orders: 55 },
    { date: '2025-01-12', sales: 16200, profit: 4050, orders: 47 },
    { date: '2025-01-13', sales: 22450, profit: 5810, orders: 44 },
  ];

  const topProducts = [
    { name: 'iPhone 15 Pro', sales: 25, revenue: 32500 },
    { name: 'Samsung Galaxy S24', sales: 18, revenue: 21600 },
    { name: 'AirPods Pro', sales: 32, revenue: 8000 },
    { name: 'شاحن سريع', sales: 85, revenue: 4250 },
    { name: 'كفر حماية', sales: 120, revenue: 3600 },
  ];

  const handleExportPDF = () => {
    // Simulate PDF export with data
    const reportData = {
      title: 'تقرير المبيعات',
      dateRange,
      summary: summaryData,
      salesData,
      topProducts,
      generatedAt: new Date().toLocaleString('ar-SA'),
    };
    
    // Create a simple text representation for download
    const content = `
تقرير المبيعات
================
التاريخ: ${reportData.dateRange.from} - ${reportData.dateRange.to}
تاريخ التصدير: ${reportData.generatedAt}

ملخص:
- إجمالي المبيعات: $${reportData.summary.totalSales.toLocaleString()}
- صافي الأرباح: $${reportData.summary.totalProfit.toLocaleString()}
- عدد الطلبات: ${reportData.summary.totalOrders}
- متوسط قيمة الطلب: $${reportData.summary.avgOrderValue}

المبيعات اليومية:
${reportData.salesData.map(d => `${d.date}: $${d.sales.toLocaleString()} (ربح: $${d.profit.toLocaleString()}, طلبات: ${d.orders})`).join('\n')}

أفضل المنتجات:
${reportData.topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.sales} قطعة - $${p.revenue.toLocaleString()}`).join('\n')}
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
    // Create CSV content for Excel compatibility
    const headers = ['التاريخ', 'المبيعات', 'الأرباح', 'الطلبات'];
    const rows = salesData.map(d => [d.date, d.sales, d.profit, d.orders]);
    
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
    // Create comprehensive backup
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        summaryData,
        salesData,
        topProducts,
        dateRange,
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
            <span className="flex items-center text-xs text-success">
              <ArrowUpRight className="w-3 h-3" />
              12%
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">${summaryData.totalSales.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <span className="flex items-center text-xs text-success">
              <ArrowUpRight className="w-3 h-3" />
              8%
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">${summaryData.totalProfit.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">صافي الأرباح</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-5 h-5 text-info" />
            <span className="flex items-center text-xs text-destructive">
              <ArrowDownRight className="w-3 h-3" />
              3%
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{summaryData.totalOrders}</p>
          <p className="text-xs text-muted-foreground">عدد الطلبات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <PieChart className="w-5 h-5 text-warning" />
          </div>
          <p className="text-2xl font-bold text-foreground">${summaryData.avgOrderValue}</p>
          <p className="text-xs text-muted-foreground">متوسط قيمة الطلب</p>
        </div>
      </div>

      {/* Sales Chart Placeholder */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">المبيعات اليومية</h3>
        <div className="space-y-3">
          {salesData.map((day, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-24">{day.date}</span>
              <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                <div 
                  className="h-full bg-gradient-primary rounded-lg transition-all duration-500"
                  style={{ width: `${(day.sales / 25000) * 100}%` }}
                />
              </div>
              <span className="text-sm font-semibold w-20 text-left">${day.sales.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">أفضل المنتجات مبيعاً</h3>
        <div className="space-y-3">
          {topProducts.map((product, idx) => (
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
    </div>
  );
}
