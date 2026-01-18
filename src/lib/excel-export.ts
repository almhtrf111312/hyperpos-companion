// Professional Excel Export using xlsx library
import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelExportOptions {
  sheetName?: string;
  fileName?: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  totals?: Record<string, number>;
  title?: string;
  subtitle?: string;
}

// Create and download Excel file
export const exportToExcel = (options: ExcelExportOptions): void => {
  const {
    sheetName = 'Sheet1',
    fileName = 'export.xlsx',
    columns,
    data,
    totals,
    title,
    subtitle,
  } = options;
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare data rows
  const rows: (string | number | undefined)[][] = [];
  
  // Add title if provided
  if (title) {
    rows.push([title]);
    rows.push([]); // Empty row
  }
  
  // Add subtitle if provided
  if (subtitle) {
    rows.push([subtitle]);
    rows.push([]); // Empty row
  }
  
  // Add header row
  rows.push(columns.map(col => col.header));
  
  // Add data rows
  data.forEach(item => {
    const row = columns.map(col => {
      const value = item[col.key];
      if (typeof value === 'number') {
        return value;
      }
      return String(value ?? '');
    });
    rows.push(row);
  });
  
  // Add totals row if provided
  if (totals) {
    rows.push([]); // Empty row before totals
    const totalsRow = columns.map(col => {
      if (totals[col.key] !== undefined) {
        return totals[col.key];
      }
      if (col.key === columns[0].key) {
        return 'الإجمالي';
      }
      return '';
    });
    rows.push(totalsRow);
  }
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Set column widths
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Generate and download file
  XLSX.writeFile(wb, fileName);
};

// Export invoices to Excel
export const exportInvoicesToExcel = (
  invoices: Array<{
    id: string;
    customerName: string;
    total: number;
    profit?: number;
    paymentType: string;
    type: string;
    createdAt: string;
  }>,
  dateRange?: { start: string; end: string }
): void => {
  const columns: ExcelColumn[] = [
    { header: 'رقم الفاتورة', key: 'id', width: 15 },
    { header: 'العميل', key: 'customerName', width: 20 },
    { header: 'النوع', key: 'type', width: 12 },
    { header: 'الدفع', key: 'paymentType', width: 10 },
    { header: 'الإجمالي', key: 'total', width: 12 },
    { header: 'الربح', key: 'profit', width: 12 },
    { header: 'التاريخ', key: 'date', width: 12 },
  ];
  
  const data = invoices.map(inv => ({
    id: inv.id,
    customerName: inv.customerName,
    type: inv.type === 'maintenance' ? 'صيانة' : 'مبيعات',
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
    total: inv.total,
    profit: inv.profit || 0,
    date: new Date(inv.createdAt).toLocaleDateString('ar-SA'),
  }));
  
  const totals: Record<string, number> = {
    total: invoices.reduce((sum, inv) => sum + inv.total, 0),
    profit: invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0),
  };
  
  const subtitle = dateRange 
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`;
  
  exportToExcel({
    sheetName: 'الفواتير',
    fileName: `فواتير_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data,
    totals,
    title: 'تقرير الفواتير',
    subtitle,
  });
};

// Export products to Excel
export const exportProductsToExcel = (
  products: Array<{
    name: string;
    barcode: string;
    category: string;
    costPrice: number;
    salePrice: number;
    quantity: number;
  }>
): void => {
  const columns: ExcelColumn[] = [
    { header: 'المنتج', key: 'name', width: 25 },
    { header: 'الباركود', key: 'barcode', width: 15 },
    { header: 'التصنيف', key: 'category', width: 15 },
    { header: 'سعر التكلفة', key: 'costPrice', width: 12 },
    { header: 'سعر البيع', key: 'salePrice', width: 12 },
    { header: 'الكمية', key: 'quantity', width: 10 },
    { header: 'قيمة المخزون', key: 'stockValue', width: 15 },
  ];
  
  const data = products.map(p => ({
    ...p,
    stockValue: p.costPrice * p.quantity,
  }));
  
  const totals: Record<string, number> = {
    quantity: products.reduce((sum, p) => sum + p.quantity, 0),
    stockValue: products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0),
  };
  
  exportToExcel({
    sheetName: 'المنتجات',
    fileName: `منتجات_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data,
    totals,
    title: 'قائمة المنتجات',
    subtitle: `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
  });
};

// Export expenses to Excel
export const exportExpensesToExcel = (
  expenses: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    notes?: string;
  }>,
  dateRange?: { start: string; end: string }
): void => {
  const columns: ExcelColumn[] = [
    { header: 'رقم', key: 'id', width: 10 },
    { header: 'النوع', key: 'type', width: 20 },
    { header: 'المبلغ', key: 'amount', width: 12 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'ملاحظات', key: 'notes', width: 30 },
  ];
  
  const totals: Record<string, number> = {
    amount: expenses.reduce((sum, e) => sum + e.amount, 0),
  };
  
  const subtitle = dateRange 
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`;
  
  exportToExcel({
    sheetName: 'المصاريف',
    fileName: `مصاريف_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data: expenses,
    totals,
    title: 'تقرير المصاريف',
    subtitle,
  });
};

// Export partners report to Excel
export const exportPartnersToExcel = (
  partners: Array<{
    name: string;
    sharePercentage: number;
    initialCapital: number;
    currentCapital: number;
    totalProfit: number;
    totalWithdrawn: number;
    currentBalance: number;
  }>
): void => {
  const columns: ExcelColumn[] = [
    { header: 'الشريك', key: 'name', width: 20 },
    { header: 'نسبة الأرباح %', key: 'sharePercentage', width: 15 },
    { header: 'رأس المال الأولي', key: 'initialCapital', width: 15 },
    { header: 'رأس المال الحالي', key: 'currentCapital', width: 15 },
    { header: 'إجمالي الأرباح', key: 'totalProfit', width: 15 },
    { header: 'المسحوبات', key: 'totalWithdrawn', width: 15 },
    { header: 'الرصيد الحالي', key: 'currentBalance', width: 15 },
  ];
  
  const totals: Record<string, number> = {
    initialCapital: partners.reduce((sum, p) => sum + p.initialCapital, 0),
    currentCapital: partners.reduce((sum, p) => sum + p.currentCapital, 0),
    totalProfit: partners.reduce((sum, p) => sum + p.totalProfit, 0),
    totalWithdrawn: partners.reduce((sum, p) => sum + p.totalWithdrawn, 0),
    currentBalance: partners.reduce((sum, p) => sum + p.currentBalance, 0),
  };
  
  exportToExcel({
    sheetName: 'الشركاء',
    fileName: `شركاء_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data: partners,
    totals,
    title: 'تقرير الشركاء',
    subtitle: `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
  });
};

// Export daily report to Excel
export const exportDailyReportToExcel = (
  report: {
    date: string;
    openingCash: number;
    sales: number;
    expenses: number;
    deposits: number;
    withdrawals: number;
    closingCash: number;
    discrepancy: number;
  }
): void => {
  const columns: ExcelColumn[] = [
    { header: 'البند', key: 'item', width: 25 },
    { header: 'المبلغ', key: 'amount', width: 15 },
  ];
  
  const data = [
    { item: 'رصيد الافتتاح', amount: report.openingCash },
    { item: 'المبيعات', amount: report.sales },
    { item: 'الإيداعات', amount: report.deposits },
    { item: 'المصاريف', amount: -report.expenses },
    { item: 'السحوبات', amount: -report.withdrawals },
    { item: 'رصيد الإغلاق (متوقع)', amount: report.openingCash + report.sales + report.deposits - report.expenses - report.withdrawals },
    { item: 'رصيد الإغلاق (فعلي)', amount: report.closingCash },
    { item: 'الفارق', amount: report.discrepancy },
  ];
  
  exportToExcel({
    sheetName: 'التقرير اليومي',
    fileName: `تقرير_يومي_${report.date}.xlsx`,
    columns,
    data,
    title: 'التقرير اليومي للصندوق',
    subtitle: `التاريخ: ${report.date}`,
  });
};
