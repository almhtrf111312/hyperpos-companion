import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDailyProfitStats } from '@/lib/profits-store';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProfitTrendChartProps {
  days?: number;
  startDate?: string;
  endDate?: string;
}

const chartConfig = {
  grossProfit: {
    label: 'الربح الإجمالي',
    color: 'hsl(142, 76%, 36%)', // Green
  },
  netProfit: {
    label: 'صافي الربح',
    color: 'hsl(217, 91%, 60%)', // Blue
  },
  sales: {
    label: 'المبيعات',
    color: 'hsl(280, 65%, 60%)', // Purple
  },
  expenses: {
    label: 'المصروفات',
    color: 'hsl(0, 84%, 60%)', // Red
  },
} satisfies ChartConfig;

export function ProfitTrendChart({ days = 30, startDate, endDate }: ProfitTrendChartProps) {
  const { t, isRTL } = useLanguage();
  
  const chartData = useMemo(() => {
    const stats = getDailyProfitStats(days);
    
    // Filter by date range if provided
    let filteredStats = stats;
    if (startDate && endDate) {
      filteredStats = stats.filter(s => s.date >= startDate && s.date <= endDate);
    }
    
    // Sort ascending for chart display
    return filteredStats
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(stat => ({
        ...stat,
        dateLabel: new Date(stat.date).toLocaleDateString('ar-SA', { 
          month: 'short', 
          day: 'numeric' 
        }),
      }));
  }, [days, startDate, endDate]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalGrossProfit = chartData.reduce((sum, d) => sum + d.grossProfit, 0);
    const totalNetProfit = chartData.reduce((sum, d) => sum + d.netProfit, 0);
    const totalSales = chartData.reduce((sum, d) => sum + d.sales, 0);
    const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    const avgDailyProfit = chartData.length > 0 ? totalNetProfit / chartData.length : 0;
    
    // Calculate trend (compare last 7 days to previous 7 days)
    const recentDays = chartData.slice(-7);
    const previousDays = chartData.slice(-14, -7);
    
    const recentProfit = recentDays.reduce((sum, d) => sum + d.netProfit, 0);
    const previousProfit = previousDays.reduce((sum, d) => sum + d.netProfit, 0);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;
    
    if (previousProfit > 0) {
      trendPercentage = ((recentProfit - previousProfit) / previousProfit) * 100;
      trend = trendPercentage > 5 ? 'up' : trendPercentage < -5 ? 'down' : 'stable';
    } else if (recentProfit > 0) {
      trend = 'up';
      trendPercentage = 100;
    }
    
    return {
      totalGrossProfit,
      totalNetProfit,
      totalSales,
      totalExpenses,
      avgDailyProfit,
      trend,
      trendPercentage: Math.abs(trendPercentage),
      profitMargin: totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0,
    };
  }, [chartData]);

  const TrendIcon = summary.trend === 'up' ? TrendingUp : summary.trend === 'down' ? TrendingDown : Minus;
  const trendColor = summary.trend === 'up' ? 'text-green-500' : summary.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            تطور الأرباح
          </CardTitle>
          <CardDescription>لا توجد بيانات في الفترة المحددة</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            تطور الأرباح - آخر {chartData.length} يوم
          </span>
          <span className={`flex items-center gap-1 text-sm font-normal ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            {summary.trendPercentage.toFixed(1)}%
          </span>
        </CardTitle>
        <CardDescription>
          مقارنة الربح الإجمالي وصافي الربح على مدار الفترة
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(summary.totalSales)}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">الربح الإجمالي</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary.totalGrossProfit)}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">المصروفات</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatCurrency(summary.totalExpenses)}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">صافي الربح</p>
            <p className={`text-lg font-bold ${summary.totalNetProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'}`}>
              {formatCurrency(summary.totalNetProfit)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dateLabel" 
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `$${value}`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    labelFormatter={(value) => `التاريخ: ${value}`}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        grossProfit: 'الربح الإجمالي',
                        netProfit: 'صافي الربح',
                        sales: 'المبيعات',
                        expenses: 'المصروفات',
                      };
                      return [formatCurrency(Number(value)), labels[name as string] || name];
                    }}
                  />
                }
              />
              <Legend 
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    grossProfit: 'الربح الإجمالي',
                    netProfit: 'صافي الربح',
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="grossProfit"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="netProfit"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(217, 91%, 60%)', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Additional Stats */}
        <div className="mt-4 pt-4 border-t flex justify-between text-sm text-muted-foreground">
          <span>متوسط الربح اليومي: <strong className="text-foreground">{formatCurrency(summary.avgDailyProfit)}</strong></span>
          <span>هامش الربح: <strong className="text-foreground">{summary.profitMargin.toFixed(1)}%</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}
