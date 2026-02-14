import { useMemo } from 'react';
import { FileText, Download, Calendar, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Invoice } from '@/lib/cloud/invoices-cloud';
import { Expense } from '@/lib/cloud/expenses-cloud';
import { Debt } from '@/lib/cloud/debts-cloud';
import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface Props {
  invoices: Invoice[];
  expenses: Expense[];
  debts: Debt[];
  isLoading: boolean;
}

export function DailyClosingReport({ invoices, expenses, debts, isLoading }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const data = useMemo(() => {
    const dayInvoices = invoices.filter(inv => {
      const d = getLocalDateString(new Date(inv.createdAt));
      return d === selectedDate;
    });

    const dayExpenses = expenses.filter(exp => exp.date === selectedDate);

    const dayDebts = debts.filter(d => {
      const date = d.createdAt?.split('T')[0] || '';
      return date === selectedDate;
    });

    const salesInvoices = dayInvoices.filter(i => i.type === 'sale');
    const maintenanceInvoices = dayInvoices.filter(i => i.type === 'maintenance');

    const totalSales = salesInvoices.reduce((s, i) => s + i.total, 0);
    const totalMaintenance = maintenanceInvoices.reduce((s, i) => s + i.total, 0);
    const totalProfit = dayInvoices.reduce((s, i) => s + (i.profit || 0), 0);
    const totalExpenses = dayExpenses.reduce((s, e) => s + e.amount, 0);
    const cashSales = dayInvoices.filter(i => i.paymentType === 'cash').reduce((s, i) => s + i.total, 0);
    const debtSales = dayInvoices.filter(i => i.paymentType === 'debt').reduce((s, i) => s + i.total, 0);
    const newDebts = dayDebts.reduce((s, d) => s + d.totalDebt, 0);
    const debtPayments = dayDebts.reduce((s, d) => s + d.totalPaid, 0);
    const netProfit = totalProfit - totalExpenses;

    return {
      salesInvoices,
      maintenanceInvoices,
      dayExpenses,
      dayDebts,
      totalSales,
      totalMaintenance,
      totalRevenue: totalSales + totalMaintenance,
      totalProfit,
      totalExpenses,
      cashSales,
      debtSales,
      newDebts,
      debtPayments,
      netProfit,
      invoiceCount: dayInvoices.length,
      expenseCount: dayExpenses.length,
    };
  }, [invoices, expenses, debts, selectedDate]);

  const handleExportExcel = async () => {
    const items = [
      { item: 'إجمالي المبيعات', amount: data.totalSales },
      { item: 'إيرادات الصيانة', amount: data.totalMaintenance },
      { item: 'إجمالي الإيرادات', amount: data.totalRevenue },
      { item: 'المبيعات النقدية', amount: data.cashSales },
      { item: 'المبيعات الآجلة', amount: data.debtSales },
      { item: 'إجمالي الأرباح', amount: data.totalProfit },
      { item: 'إجمالي المصاريف', amount: data.totalExpenses },
      { item: 'صافي الربح', amount: data.netProfit },
      { item: 'ديون جديدة', amount: data.newDebts },
      { item: 'تسديدات ديون', amount: data.debtPayments },
    ];

    await exportToExcel({
      sheetName: 'الإغلاق اليومي',
      fileName: `إغلاق_يومي_${selectedDate}.xlsx`,
      columns: [
        { header: 'البند', key: 'item', width: 25 },
        { header: 'المبلغ', key: 'amount', width: 15 },
      ],
      data: items,
      title: 'تقرير الإغلاق اليومي',
      reportType: 'تقرير يومي',
      subtitle: `التاريخ: ${selectedDate}`,
      summary: [
        { label: 'عدد الفواتير', value: data.invoiceCount },
        { label: 'عدد المصاريف', value: data.expenseCount },
        { label: 'صافي الربح', value: data.netProfit },
      ],
    });
    toast.success('تم تصدير Excel بنجاح');
  };

  const handleExportPDF = async () => {
    const items = [
      { item: 'إجمالي المبيعات', amount: data.totalSales },
      { item: 'إيرادات الصيانة', amount: data.totalMaintenance },
      { item: 'إجمالي الإيرادات', amount: data.totalRevenue },
      { item: 'المبيعات النقدية', amount: data.cashSales },
      { item: 'المبيعات الآجلة', amount: data.debtSales },
      { item: 'إجمالي الأرباح', amount: data.totalProfit },
      { item: 'إجمالي المصاريف', amount: data.totalExpenses },
      { item: 'صافي الربح', amount: data.netProfit },
    ];

    await exportToPDF({
      title: 'تقرير الإغلاق اليومي',
      reportType: 'تقرير يومي',
      subtitle: `التاريخ: ${selectedDate}`,
      columns: [
        { header: 'البند', key: 'item' },
        { header: 'المبلغ', key: 'amount' },
      ],
      data: items,
      summary: [
        { label: 'عدد الفواتير', value: data.invoiceCount },
        { label: 'صافي الربح', value: data.netProfit },
      ],
      fileName: `إغلاق_يومي_${selectedDate}.pdf`,
    });
    toast.success('تم تصدير PDF بنجاح');
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-card rounded-lg border border-border px-3 py-1.5">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">اختر اليوم:</span>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-36 h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="w-3.5 h-3.5 ml-1" />PDF</Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="w-3.5 h-3.5 ml-1" />Excel</Button>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <DollarSign className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(data.totalProfit)}</p>
          <p className="text-xs text-muted-foreground">إجمالي الأرباح</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <TrendingDown className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground">المصاريف</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <Wallet className="w-5 h-5 text-emerald-500 mb-2" />
          <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground">صافي الربح</p>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          ملخص يوم {selectedDate}
        </h3>
        <div className="space-y-3">
          {[
            { label: 'مبيعات المنتجات', value: data.totalSales, color: 'text-foreground', count: `${data.salesInvoices.length} فاتورة` },
            { label: 'إيرادات الصيانة', value: data.totalMaintenance, color: 'text-foreground', count: `${data.maintenanceInvoices.length} خدمة` },
            { label: 'المبيعات النقدية', value: data.cashSales, color: 'text-green-600' },
            { label: 'المبيعات الآجلة', value: data.debtSales, color: 'text-amber-600' },
            { label: 'إجمالي الأرباح', value: data.totalProfit, color: 'text-green-600' },
            { label: 'المصاريف', value: data.totalExpenses, color: 'text-red-500', count: `${data.expenseCount} مصروف` },
            { label: 'ديون جديدة', value: data.newDebts, color: 'text-red-500', count: `${data.dayDebts.length} دين` },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{item.label}</span>
                {item.count && <span className="text-xs text-muted-foreground">({item.count})</span>}
              </div>
              <span className={`font-bold ${item.color}`}>{formatCurrency(item.value)}</span>
            </div>
          ))}

          <div className="flex items-center justify-between py-3 border-t-2 border-primary/20 mt-2">
            <span className="text-base font-bold">صافي الربح</span>
            <span className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
