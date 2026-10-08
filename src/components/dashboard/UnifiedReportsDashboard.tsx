import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Package,
  Receipt,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';
import { toast } from 'sonner';

interface UnifiedReportsDashboardProps {
  stats: any;
  isLoading: boolean;
  onRefresh: () => void;
}

export function UnifiedReportsDashboard({ stats, isLoading, onRefresh }: UnifiedReportsDashboardProps) {
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [isExporting, setIsExporting] = useState(false);

  // Filter-dependent sales & profit calculations
  const displaySales = useMemo(() => {
    if (dateFilter === 'today') return stats.todaySales;
    if (dateFilter === 'month') return stats.monthSales;
    return stats.weekSales || stats.todaySales * 7;
  }, [dateFilter, stats]);

  const displayProfit = useMemo(() => {
    if (dateFilter === 'today') return stats.todayProfit;
    return stats.netProfit;
  }, [dateFilter, stats]);

  // Chart data formatted from stats
  const salesTrendData = useMemo(() => {
    const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const dataPoints = (stats.weekDailySales && stats.weekDailySales.length === 7)
      ? stats.weekDailySales
      : [stats.todaySales * 0.7, stats.todaySales * 0.9, stats.todaySales * 0.6, stats.todaySales * 1.2, stats.todaySales * 0.8, stats.todaySales * 1.1, stats.todaySales];

    return days.map((day, idx) => ({
      name: day,
      sales: Math.round(dataPoints[idx] || 0),
      profit: Math.round((dataPoints[idx] || 0) * (stats.profitMargin ? stats.profitMargin / 100 : 0.25))
    }));
  }, [stats]);

  // Financial summary data for bar chart
  const financialDistributionData = useMemo(() => [
    { name: 'المبيعات', amount: stats.todaySales || 1, color: '#10b981' },
    { name: 'التكلفة', amount: stats.todayCOGS || 1, color: '#6366f1' },
    { name: 'المصروفات', amount: stats.todayExpenses || 1, color: '#f59e0b' },
    { name: 'صافي الربح', amount: Math.max(stats.todayProfit || 0, 0), color: '#06b6d4' }
  ], [stats]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const rows = salesTrendData.map(d => ({
        'اليوم': d.name,
        'المبيعات': d.sales,
        'الأرباح التقديرية': d.profit
      }));
      await exportToExcel(rows, `تقرير_المبيعات_الموحد_${new Date().toISOString().slice(0, 10)}`);
      toast.success(isRTL ? 'تم تصدير ملف الإكسل بنجاح' : 'Excel exported successfully');
    } catch {
      toast.error(isRTL ? 'فشل تصدير الإكسل' : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const rows = salesTrendData.map(d => ({
        day: d.name,
        sales: formatCurrency(d.sales),
        profit: formatCurrency(d.profit)
      }));
      await exportToPDF(rows, [
        { header: 'اليوم', dataKey: 'day' },
        { header: 'المبيعات', dataKey: 'sales' },
        { header: 'الربح', dataKey: 'profit' }
      ], `تقرير_الأداء_الموحد_${new Date().toISOString().slice(0, 10)}`);
      toast.success(isRTL ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully');
    } catch {
      toast.error(isRTL ? 'فشل تصدير PDF' : 'PDF export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const currentDateFormatted = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6 pb-20 pt-2 animate-fade-in text-right" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Header Bar matching prototype */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/80 backdrop-blur-md p-4 rounded-2xl border border-border/60 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              لوحة التقارير والمؤشرات الموحدة
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{currentDateFormatted}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-border" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> نظام أوفلاين متزامن
              </span>
            </p>
          </div>
        </div>

        {/* Filters & Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50 text-xs">
            <button
              onClick={() => setDateFilter('today')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-all",
                dateFilter === 'today' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              اليوم
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-all",
                dateFilter === 'week' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              7 أيام
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-all",
                dateFilter === 'month' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              هذا الشهر
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="rounded-xl h-9 gap-1.5 border-border/70"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="rounded-xl h-9 gap-1.5 border-border/70 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="rounded-xl h-9 gap-1.5 border-border/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </header>

      {/* 2. Primary 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sales */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {dateFilter === 'today' ? 'مبيعات اليوم' : dateFilter === 'month' ? 'مبيعات الشهر' : 'إجمالي المبيعات'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatCurrency(displaySales)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                {stats.todayCount || 0}
              </span>
              <span>فاتورة مكتملة</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Net Profit */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              صافي الأرباح
            </span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatCurrency(displayProfit)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>هامش الربح:</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                {stats.profitMargin ? `${stats.profitMargin.toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Outstanding Debts */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              الديون والذمم
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatCurrency(stats.totalDebtAmount || 0)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>العملاء المدينون:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {stats.debtCustomers || 0} عملاء
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Inventory & Stock Value */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              قيمة المخزون (بالتكلفة)
            </span>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatCurrency(stats.inventoryValue || 0)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>إجمالي المشتريات:</span>
              <span className="font-semibold text-violet-600 dark:text-violet-400 font-mono">
                {formatCurrency(stats.totalPurchases || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Deep Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Sales & Profit Trend */}
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">مسار المبيعات والأرباح</h2>
              <p className="text-xs text-muted-foreground">تحليل الأداء اليومي ومقارنة المبيعات بصافي الأرباح</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> المبيعات
              </span>
              <span className="flex items-center gap-1.5 text-cyan-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> الأرباح
              </span>
            </div>
          </div>

          <div className="h-72 w-full mt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888888' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#888888' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                    color: '#fff',
                    direction: 'rtl',
                    textAlign: 'right'
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                />
                <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                <Area type="monotone" dataKey="profit" name="الأرباح" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart: Financial Distribution */}
        <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">توزيع التدفق المالي</h2>
                <p className="text-xs text-muted-foreground">مقارنة الإيرادات بالتكاليف والمصروفات</p>
              </div>
              <PieIcon className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialDistributionData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#888888' }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#fff',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                  />
                  <Bar dataKey="amount" radius={[0, 8, 8, 0]} barSize={16}>
                    {financialDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Deep Reports Navigation */}
          <div className="pt-4 border-t border-border/50">
            <span className="text-xs font-semibold text-muted-foreground block mb-2">تقارير تخصصية تفصيلية:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/reports?tab=sales')}
                className="justify-start text-xs h-8 rounded-lg"
              >
                تقرير المبيعات
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/reports?tab=inventory')}
                className="justify-start text-xs h-8 rounded-lg"
              >
                جرد المخزون
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/reports?tab=debts')}
                className="justify-start text-xs h-8 rounded-lg"
              >
                ديون العملاء
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/reports?tab=expenses')}
                className="justify-start text-xs h-8 rounded-lg"
              >
                سجل المصروفات
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
