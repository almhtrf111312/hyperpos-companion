import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Users,
  UsersRound,
  Calendar,
  Download,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Banknote,
  Receipt,
  Share2,
  MessageCircle,
  ClipboardList
} from 'lucide-react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { loadInvoices } from '@/lib/invoices-store';
import { loadProducts } from '@/lib/products-store';
import { loadCustomers } from '@/lib/customers-store';
import { loadPartners, Partner, ProfitRecord } from '@/lib/partners-store';
import { loadCategories } from '@/lib/categories-store';
import { loadExpenses, Expense, getExpenseStats } from '@/lib/expenses-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PartnerProfitDetailedReport } from '@/components/reports/PartnerProfitDetailedReport';
import { downloadText, downloadCSV, downloadJSON, isNativePlatform } from '@/lib/file-download';

export default function Reports() {
  const [searchParams] = useSearchParams();
  const [dateRange, setDateRange] = useState({ 
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });
  const [activeReport, setActiveReport] = useState('sales');

  // Auto-open tab from URL params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['sales', 'profits', 'products', 'customers', 'partners', 'partner-detailed', 'expenses'].includes(tab)) {
      setActiveReport(tab);
    }
  }, [searchParams]);

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');

  const reports = [
    { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
    { id: 'profits', label: 'الأرباح', icon: TrendingUp },
    { id: 'products', label: 'المنتجات', icon: BarChart3 },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'partners', label: 'الشركاء', icon: UsersRound },
    { id: 'partner-detailed', label: 'تفاصيل الأرباح', icon: ClipboardList },
    { id: 'expenses', label: 'المصاريف', icon: Receipt },
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

  // Partner report data
  const partnerReportData = useMemo(() => {
    const partners = loadPartners();
    const categories = loadCategories();
    
    // Filter partners based on selection
    const filteredPartners = selectedPartnerId === 'all' 
      ? partners 
      : partners.filter(p => p.id === selectedPartnerId);
    
    // Calculate partner profit data within date range
    const partnerProfitData = filteredPartners.map(partner => {
      // Filter profit history by date range
      const filteredProfitHistory = (partner.profitHistory || []).filter(record => {
        const recordDate = new Date(record.createdAt).toISOString().split('T')[0];
        return recordDate >= dateRange.from && recordDate <= dateRange.to;
      });
      
      // Total profit in period
      const totalProfitInPeriod = filteredProfitHistory.reduce((sum, r) => sum + r.amount, 0);
      
      // Group by category
      const profitByCategory: Record<string, { categoryName: string; amount: number; count: number }> = {};
      filteredProfitHistory.forEach(record => {
        const catName = record.category || 'بدون صنف';
        if (!profitByCategory[catName]) {
          profitByCategory[catName] = { categoryName: catName, amount: 0, count: 0 };
        }
        profitByCategory[catName].amount += record.amount;
        profitByCategory[catName].count += 1;
      });
      
      // Daily profit within period
      const dailyProfitMap: Record<string, number> = {};
      filteredProfitHistory.forEach(record => {
        const date = new Date(record.createdAt).toISOString().split('T')[0];
        if (!dailyProfitMap[date]) {
          dailyProfitMap[date] = 0;
        }
        dailyProfitMap[date] += record.amount;
      });
      
      const dailyProfit = Object.entries(dailyProfitMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Filter withdrawals by date range
      const filteredWithdrawals = (partner.withdrawalHistory || []).filter(w => {
        const wDate = new Date(w.date).toISOString().split('T')[0];
        return wDate >= dateRange.from && wDate <= dateRange.to;
      });
      
      const totalWithdrawnInPeriod = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      
      return {
        id: partner.id,
        name: partner.name,
        sharePercentage: partner.sharePercentage,
        accessAll: partner.accessAll,
        currentBalance: partner.currentBalance,
        currentCapital: partner.currentCapital,
        totalProfitInPeriod,
        totalWithdrawnInPeriod,
        profitByCategory: Object.values(profitByCategory).sort((a, b) => b.amount - a.amount),
        dailyProfit,
        pendingProfit: partner.pendingProfit,
        confirmedProfit: partner.confirmedProfit,
        totalProfitEarned: partner.totalProfitEarned,
      };
    });
    
    // Summary stats for all filtered partners
    const totalPartnerProfitInPeriod = partnerProfitData.reduce((sum, p) => sum + p.totalProfitInPeriod, 0);
    const totalPartnerWithdrawnInPeriod = partnerProfitData.reduce((sum, p) => sum + p.totalWithdrawnInPeriod, 0);
    const totalCurrentBalance = partnerProfitData.reduce((sum, p) => sum + p.currentBalance, 0);
    const totalPendingProfit = partnerProfitData.reduce((sum, p) => sum + p.pendingProfit, 0);
    
    // Aggregate category breakdown across all selected partners
    const aggregatedCategoryProfits: Record<string, { categoryName: string; amount: number; count: number }> = {};
    partnerProfitData.forEach(partner => {
      partner.profitByCategory.forEach(cat => {
        if (!aggregatedCategoryProfits[cat.categoryName]) {
          aggregatedCategoryProfits[cat.categoryName] = { categoryName: cat.categoryName, amount: 0, count: 0 };
        }
        aggregatedCategoryProfits[cat.categoryName].amount += cat.amount;
        aggregatedCategoryProfits[cat.categoryName].count += cat.count;
      });
    });
    
    return {
      partners: partnerProfitData,
      allPartners: partners,
      categories,
      summary: {
        totalProfitInPeriod: totalPartnerProfitInPeriod,
        totalWithdrawnInPeriod: totalPartnerWithdrawnInPeriod,
        totalCurrentBalance,
        totalPendingProfit,
        partnersCount: filteredPartners.length,
      },
      aggregatedCategoryProfits: Object.values(aggregatedCategoryProfits).sort((a, b) => b.amount - a.amount),
      hasData: partnerProfitData.some(p => p.totalProfitInPeriod > 0 || p.currentBalance > 0),
    };
  }, [dateRange, selectedPartnerId]);

  // Expense report data
  const expenseReportData = useMemo(() => {
    const allExpenses = loadExpenses();
    const partners = loadPartners();
    
    // Filter expenses by date range
    const filteredExpenses = allExpenses.filter(exp => {
      const expDate = exp.date;
      return expDate >= dateRange.from && expDate <= dateRange.to;
    });
    
    // Total expenses in period
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Group by type
    const byType: Record<string, { type: string; amount: number; count: number }> = {};
    filteredExpenses.forEach(exp => {
      const type = exp.typeLabel;
      if (!byType[type]) {
        byType[type] = { type, amount: 0, count: 0 };
      }
      byType[type].amount += exp.amount;
      byType[type].count += 1;
    });
    
    // Partner expense breakdown
    const partnerExpenses: Record<string, { name: string; amount: number; percentage: number }> = {};
    filteredExpenses.forEach(exp => {
      exp.distributions.forEach(dist => {
        if (!partnerExpenses[dist.partnerId]) {
          partnerExpenses[dist.partnerId] = { name: dist.partnerName, amount: 0, percentage: 0 };
        }
        partnerExpenses[dist.partnerId].amount += dist.amount;
      });
    });
    
    // Calculate percentages
    Object.values(partnerExpenses).forEach(pe => {
      pe.percentage = totalExpenses > 0 ? (pe.amount / totalExpenses) * 100 : 0;
    });
    
    // Daily expenses
    const dailyExpenseMap: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      if (!dailyExpenseMap[exp.date]) {
        dailyExpenseMap[exp.date] = 0;
      }
      dailyExpenseMap[exp.date] += exp.amount;
    });
    
    const dailyExpenses = Object.entries(dailyExpenseMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      expenses: filteredExpenses,
      totalExpenses,
      byType: Object.values(byType).sort((a, b) => b.amount - a.amount),
      partnerExpenses: Object.values(partnerExpenses).sort((a, b) => b.amount - a.amount),
      dailyExpenses,
      hasData: filteredExpenses.length > 0,
      allPartners: partners,
    };
  }, [dateRange]);

  const handleExportPDF = useCallback(async () => {
    const content = `
تقرير المبيعات
================
التاريخ: ${dateRange.from} - ${dateRange.to}
تاريخ التصدير: ${new Date().toLocaleString('ar-SA')}

ملخص:
- إجمالي المبيعات: $${formatNumber(reportData.summary.totalSales)}
- صافي الأرباح: $${formatNumber(reportData.summary.totalProfit)}
- عدد الطلبات: ${formatNumber(reportData.summary.totalOrders)}
- متوسط قيمة الطلب: $${formatNumber(Math.round(reportData.summary.avgOrderValue))}

المبيعات اليومية:
${reportData.dailySales.map(d => `${d.date}: $${formatNumber(d.sales)} (ربح: $${formatNumber(d.profit)}, طلبات: ${d.orders})`).join('\n')}

أفضل المنتجات:
${reportData.topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.sales} قطعة - $${formatNumber(p.revenue)}`).join('\n')}

أفضل العملاء:
${reportData.topCustomers.map((c, i) => `${i + 1}. ${c.name}: ${c.orders} طلب - $${formatNumber(c.total)}`).join('\n')}
    `;
    
    const filename = `تقرير_المبيعات_${dateRange.from}_${dateRange.to}.txt`;
    const success = await downloadText(filename, content);
    
    if (success) {
      toast.success('تم تصدير التقرير بنجاح');
    } else {
      toast.error('فشل في تصدير التقرير');
    }
  }, [dateRange, reportData]);

  const handleExportExcel = useCallback(async () => {
    const headers = ['التاريخ', 'المبيعات', 'الأرباح', 'الطلبات'];
    const rows = reportData.dailySales.map(d => [d.date, d.sales, d.profit, d.orders]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const filename = `تقرير_المبيعات_${dateRange.from}_${dateRange.to}.csv`;
    const success = await downloadCSV(filename, csvContent);
    
    if (success) {
      toast.success('تم تصدير التقرير بصيغة Excel بنجاح');
    } else {
      toast.error('فشل في تصدير التقرير');
    }
  }, [dateRange, reportData]);

  // Export expenses report as Excel
  const handleExportExpensesExcel = useCallback(async () => {
    const headers = ['التاريخ', 'النوع', 'المبلغ', 'الملاحظات', 'توزيع الشركاء'];
    const rows = expenseReportData.expenses.map(exp => [
      exp.date,
      exp.typeLabel,
      exp.amount,
      exp.notes || '',
      exp.distributions.map(d => `${d.partnerName}: $${formatNumber(d.amount)}`).join(' | ')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const filename = `تقرير_المصاريف_${dateRange.from}_${dateRange.to}.csv`;
    const success = await downloadCSV(filename, csvContent);
    
    if (success) {
      toast.success('تم تصدير تقرير المصاريف بنجاح');
    } else {
      toast.error('فشل في تصدير تقرير المصاريف');
    }
  }, [dateRange, expenseReportData]);

  // Generate partner expense report for WhatsApp
  const handleShareExpenseReport = (partnerName: string) => {
    const partnerExpenses = expenseReportData.expenses.filter(exp => 
      exp.distributions.some(d => d.partnerName === partnerName)
    );
    
    const partnerTotal = partnerExpenses.reduce((sum, exp) => {
      const dist = exp.distributions.find(d => d.partnerName === partnerName);
      return sum + (dist?.amount || 0);
    }, 0);
    
    const report = `📊 تقرير المصاريف - ${partnerName}
📅 الفترة: ${dateRange.from} إلى ${dateRange.to}

💰 إجمالي المصاريف المشتركة: $${formatNumber(partnerTotal)}

📋 التفاصيل:
${partnerExpenses.map(exp => {
  const dist = exp.distributions.find(d => d.partnerName === partnerName);
  return `• ${exp.date} - ${exp.typeLabel}: $${formatNumber(dist?.amount || 0)}`;
}).join('\n')}

---
تم إنشاء التقرير بواسطة HyperPOS`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('تم فتح واتساب للمشاركة');
  };

  const handleBackup = useCallback(async () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        invoices: loadInvoices(),
        products: loadProducts(),
        customers: loadCustomers(),
      }
    };
    
    const filename = `hyperpos_backup_${new Date().toISOString().split('T')[0]}.json`;
    const success = await downloadJSON(filename, backupData);
    
    if (success) {
      toast.success(isNativePlatform() ? 'تم حفظ النسخة الاحتياطية بنجاح' : 'تم إنشاء النسخة الاحتياطية بنجاح');
    } else {
      toast.error('فشل في إنشاء النسخة الاحتياطية');
    }
  }, []);

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

      {/* Partners Report */}
      {activeReport === 'partners' && (
        <div className="space-y-6">
          {/* Partner Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <span className="text-sm text-muted-foreground">اختر شريك:</span>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="جميع الشركاء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشركاء</SelectItem>
                {partnerReportData.allPartners.map(partner => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Partner Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <p className="text-2xl font-bold text-foreground">${partnerReportData.summary.totalProfitInPeriod.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">الأرباح في الفترة</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">${partnerReportData.summary.totalCurrentBalance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <Banknote className="w-5 h-5 text-warning" />
              </div>
              <p className="text-2xl font-bold text-foreground">${partnerReportData.summary.totalWithdrawnInPeriod.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">المسحوب في الفترة</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <UsersRound className="w-5 h-5 text-info" />
              </div>
              <p className="text-2xl font-bold text-foreground">{partnerReportData.summary.partnersCount}</p>
              <p className="text-xs text-muted-foreground">عدد الشركاء</p>
            </div>
          </div>

          {!partnerReportData.hasData && partnerReportData.allPartners.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center">
              <UsersRound className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">لا يوجد شركاء مسجلين</p>
              <p className="text-sm text-muted-foreground">أضف شركاء من صفحة الشركاء</p>
            </div>
          ) : (
            <>
              {/* Profit by Category */}
              {partnerReportData.aggregatedCategoryProfits.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">الأرباح حسب الصنف</h3>
                  <div className="space-y-3">
                    {partnerReportData.aggregatedCategoryProfits.map((cat, idx) => {
                      const maxCatProfit = Math.max(...partnerReportData.aggregatedCategoryProfits.map(c => c.amount), 1);
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <span className="text-sm font-medium w-32 truncate">{cat.categoryName}</span>
                          <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-l from-primary to-primary/60 rounded-lg transition-all duration-500"
                              style={{ width: `${(cat.amount / maxCatProfit) * 100}%` }}
                            />
                          </div>
                          <div className="text-left w-28">
                            <p className="text-sm font-semibold">${cat.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{cat.count} عملية</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Partner Details */}
              {partnerReportData.partners.map(partner => (
                <div key={partner.id} className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                        {partner.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{partner.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {partner.accessAll ? `نسبة عامة: ${partner.sharePercentage}%` : 'شريك متخصص'}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-bold text-success">${partner.totalProfitInPeriod.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">أرباح الفترة</p>
                    </div>
                  </div>

                  {/* Partner Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
                      <p className="text-lg font-bold text-foreground">${partner.currentBalance.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">رأس المال</p>
                      <p className="text-lg font-bold text-foreground">${partner.currentCapital.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">أرباح معلقة</p>
                      <p className="text-lg font-bold text-warning">${partner.pendingProfit.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">المسحوب في الفترة</p>
                      <p className="text-lg font-bold text-foreground">${partner.totalWithdrawnInPeriod.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Partner Category Breakdown */}
                  {partner.profitByCategory.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">توزيع الأرباح حسب الصنف</h4>
                      <div className="flex flex-wrap gap-2">
                        {partner.profitByCategory.slice(0, 5).map((cat, idx) => (
                          <span 
                            key={idx} 
                            className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                          >
                            {cat.categoryName}: ${cat.amount.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Partner Daily Profit Chart */}
                  {partner.dailyProfit.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">الأرباح اليومية</h4>
                      <div className="space-y-2">
                        {partner.dailyProfit.slice(-5).map((day, idx) => {
                          const maxDayProfit = Math.max(...partner.dailyProfit.map(d => d.amount), 1);
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-20">{day.date}</span>
                              <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                                <div 
                                  className="h-full bg-success/70 rounded transition-all duration-500"
                                  style={{ width: `${(day.amount / maxDayProfit) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold w-20 text-left">${day.amount.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Partner Detailed Report */}
      {activeReport === 'partner-detailed' && (
        <PartnerProfitDetailedReport dateRange={dateRange} />
      )}

      {/* Expenses Report */}
      {activeReport === 'expenses' && (
        <div className="space-y-6">
          {/* Expense Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExpensesExcel}>
              <Download className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          {/* Expense Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <Receipt className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-foreground">${formatNumber(expenseReportData.totalExpenses)}</p>
              <p className="text-xs text-muted-foreground">إجمالي المصاريف</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-5 h-5 text-info" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(expenseReportData.expenses.length)}</p>
              <p className="text-xs text-muted-foreground">عدد المصاريف</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <PieChart className="w-5 h-5 text-warning" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(expenseReportData.byType.length)}</p>
              <p className="text-xs text-muted-foreground">أنواع المصاريف</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <UsersRound className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(expenseReportData.partnerExpenses.length)}</p>
              <p className="text-xs text-muted-foreground">الشركاء المشاركون</p>
            </div>
          </div>

          {!expenseReportData.hasData ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">لا توجد مصاريف في الفترة المحددة</p>
              <p className="text-sm text-muted-foreground">جرب تغيير نطاق التاريخ</p>
            </div>
          ) : (
            <>
              {/* Expenses by Type */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">المصاريف حسب النوع</h3>
                <div className="space-y-3">
                  {expenseReportData.byType.map((type, idx) => {
                    const maxAmount = Math.max(...expenseReportData.byType.map(t => t.amount), 1);
                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="text-sm font-medium w-28 truncate">{type.type}</span>
                        <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-l from-destructive to-destructive/60 rounded-lg transition-all duration-500"
                            style={{ width: `${(type.amount / maxAmount) * 100}%` }}
                          />
                        </div>
                        <div className="text-left w-28">
                          <p className="text-sm font-semibold">${formatNumber(type.amount)}</p>
                          <p className="text-xs text-muted-foreground">{type.count} مصروف</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Partner Expense Distribution */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">توزيع المصاريف على الشركاء</h3>
                <div className="space-y-4">
                  {expenseReportData.partnerExpenses.map((partner, idx) => (
                    <div key={idx} className="bg-muted rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                            {partner.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold">{partner.name}</h4>
                            <p className="text-sm text-muted-foreground">{formatNumber(Math.round(partner.percentage))}% من الإجمالي</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-left">
                            <p className="text-lg font-bold text-destructive">${formatNumber(partner.amount)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-success hover:text-success"
                            onClick={() => handleShareExpenseReport(partner.name)}
                            title="مشاركة عبر واتساب"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-destructive/70 rounded-full transition-all duration-500"
                          style={{ width: `${partner.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Expenses Chart */}
              {expenseReportData.dailyExpenses.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">المصاريف اليومية</h3>
                  <div className="space-y-3">
                    {expenseReportData.dailyExpenses.slice(-7).map((day, idx) => {
                      const maxDaily = Math.max(...expenseReportData.dailyExpenses.map(d => d.amount), 1);
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground w-24">{day.date}</span>
                          <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-destructive/60 rounded-lg transition-all duration-500"
                              style={{ width: `${(day.amount / maxDaily) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold w-24 text-left">
                            ${formatNumber(day.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expense List */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">قائمة المصاريف</h3>
                <div className="space-y-3">
                  {expenseReportData.expenses.slice(0, 10).map((expense, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                          <Receipt className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                          <h4 className="font-medium">{expense.typeLabel}</h4>
                          <p className="text-xs text-muted-foreground">{expense.date}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-destructive">-${formatNumber(expense.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.distributions.length} شريك
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
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
                  <p className="font-bold text-foreground">${formatNumber(product.revenue)}</p>
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
