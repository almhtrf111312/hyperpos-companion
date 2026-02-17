// Professional Excel Export using ExcelJS library (secure, no SheetJS vulnerabilities)
import ExcelJS from 'exceljs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { formatDate, formatDateTime } from './utils';

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
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  reportType?: string;
  summary?: { label: string; value: string | number }[];
}

// Format date in local timezone
const formatLocalDate = (): string => {
  return formatDate(new Date());
};

// Format datetime in local timezone
const formatLocalDateTime = (): string => {
  return formatDateTime(new Date().toISOString());
};

// Get store info from settings
const getStoreInfo = (): { name: string; phone?: string; address?: string } => {
  try {
    const stored = localStorage.getItem('hyperpos_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return {
        name: settings.storeSettings?.name || 'FlowPOS Pro',
        phone: settings.storeSettings?.phone,
        address: settings.storeSettings?.address,
      };
    }
  } catch {
    // ignore
  }
  return { name: 'FlowPOS Pro' };
};

// Generate workbook buffer as base64
const workbookToBase64 = async (wb: ExcelJS.Workbook): Promise<string> => {
  const buffer = await wb.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Save Excel file on native platforms using Filesystem and Share APIs
const saveExcelNative = async (wb: ExcelJS.Workbook, fileName: string): Promise<void> => {
  try {
    const base64 = await workbookToBase64(wb);

    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: fileName,
      url: result.uri,
      dialogTitle: 'حفظ ملف Excel',
    });
  } catch (error) {
    console.error('Error saving Excel on native:', error);
    throw error;
  }
};

// Download workbook in browser
const downloadWorkbook = async (wb: ExcelJS.Workbook, fileName: string): Promise<void> => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Thin border style
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
};

// Create and download Excel file with enhanced header
export const exportToExcel = async (options: ExcelExportOptions): Promise<void> => {
  const {
    sheetName = 'Sheet1',
    fileName = 'export.xlsx',
    columns,
    data,
    totals,
    title,
    subtitle,
    storeName,
    storePhone,
    storeAddress,
    reportType,
    summary,
  } = options;

  const store = storeName ? { name: storeName, phone: storePhone, address: storeAddress } : getStoreInfo();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // Build rows as array of arrays
  const rows: (string | number | undefined)[][] = [];

  // Store header
  rows.push([store.name]);
  if (store.phone) rows.push([`هاتف: ${store.phone}`]);
  if (store.address) rows.push([`العنوان: ${store.address}`]);
  rows.push([]);

  if (reportType) rows.push([`نوع التقرير: ${reportType}`]);
  rows.push([`تاريخ الإصدار: ${formatLocalDateTime()}`]);
  rows.push([]);

  if (title) { rows.push([title]); rows.push([]); }
  if (subtitle) { rows.push([subtitle]); rows.push([]); }

  // Header row
  rows.push(columns.map(col => col.header));

  // Data rows
  data.forEach(item => {
    const row = columns.map(col => {
      const value = item[col.key];
      if (typeof value === 'number') return value;
      return String(value ?? '');
    });
    rows.push(row);
  });

  // Totals row
  if (totals) {
    rows.push([]);
    const totalsRow = columns.map(col => {
      if (totals[col.key] !== undefined) return totals[col.key];
      if (col.key === columns[0].key) return 'الإجمالي';
      return '';
    });
    rows.push(totalsRow);
  }

  // Summary section
  if (summary && summary.length > 0) {
    rows.push([]);
    rows.push(['خلاصة حسابية']);
    rows.push(['البند', 'القيمة']);
    summary.forEach(item => {
      rows.push([item.label, item.value]);
    });
  }

  // Add all rows to worksheet
  rows.forEach(row => ws.addRow(row));

  // Set column widths
  columns.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1);
    wsCol.width = col.width || 15;
  });

  // Apply alternating column colors (Light Blue / Light Green)
  const totalRows = ws.rowCount;
  const totalCols = columns.length;
  for (let c = 1; c <= totalCols; c++) {
    const fillColor = (c - 1) % 2 === 0 ? 'FFE6F3FF' : 'FFF0FFF0';
    for (let r = 1; r <= totalRows; r++) {
      const cell = ws.getCell(r, c);
      if (cell.value !== undefined && cell.value !== null && cell.value !== '') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor },
        };
        cell.border = thinBorder;
      }
    }
  }

  // Generate and download/share file based on platform
  if (Capacitor.isNativePlatform()) {
    await saveExcelNative(wb, fileName);
  } else {
    await downloadWorkbook(wb, fileName);
  }
};

// Export invoices to Excel with enhanced details
export const exportInvoicesToExcel = async (
  invoices: Array<{
    id: string;
    customerName: string;
    total: number;
    discount?: number;
    profit?: number;
    paymentType: string;
    type: string;
    createdAt: string;
    cashierName?: string;
  }>,
  dateRange?: { start: string; end: string }
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'رقم الفاتورة', key: 'id', width: 15 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'العميل', key: 'customerName', width: 20 },
    { header: 'الإجمالي', key: 'total', width: 12 },
    { header: 'الخصم', key: 'discount', width: 10 },
    { header: 'صافي الربح', key: 'profit', width: 12 },
    { header: 'نسبة الربح %', key: 'profitMargin', width: 12 },
    { header: 'نوع الدفع', key: 'paymentType', width: 10 },
    { header: 'الكاشير', key: 'cashierName', width: 15 },
  ];

  const data = invoices.map(inv => ({
    id: inv.id.substring(0, 8),
    date: formatDate(new Date(inv.createdAt)),
    customerName: inv.customerName || 'عميل نقدي',
    total: inv.total,
    discount: inv.discount || 0,
    profit: inv.profit || 0,
    profitMargin: inv.total > 0 ? Math.round(((inv.profit || 0) / inv.total) * 100) : 0,
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
    cashierName: inv.cashierName || '-',
  }));

  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalProfit = invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
  const totalDiscount = invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
  const avgProfitMargin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  const totals: Record<string, number> = {
    total: totalSales,
    discount: totalDiscount,
    profit: totalProfit,
    profitMargin: avgProfitMargin,
  };

  const summary = [
    { label: 'إجمالي المبيعات', value: totalSales },
    { label: 'إجمالي الخصومات', value: totalDiscount },
    { label: 'صافي الأرباح', value: totalProfit },
    { label: 'نسبة الربح الإجمالية %', value: `${avgProfitMargin}%` },
    { label: 'عدد الفواتير', value: invoices.length },
  ];

  const subtitle = dateRange
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${formatLocalDate()}`;

  const fileDate = dateRange
    ? `${dateRange.start}_${dateRange.end}`
    : new Date().toISOString().split('T')[0];

  await exportToExcel({
    sheetName: 'الفواتير',
    fileName: `فواتير_${fileDate}.xlsx`,
    columns,
    data,
    totals,
    title: 'تقرير الفواتير',
    reportType: 'تقرير المبيعات',
    subtitle,
    summary,
  });
};

// Export products to Excel with full details
export const exportProductsToExcel = async (
  products: Array<{
    name: string;
    barcode: string;
    barcode2?: string;
    barcode3?: string;
    variantLabel?: string;
    category: string;
    costPrice: number;
    salePrice: number;
    quantity: number;
    minStockLevel?: number;
  }>
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'المنتج', key: 'name', width: 25 },
    { header: 'المتغير', key: 'variantLabel', width: 15 },
    { header: 'باركود 1', key: 'barcode', width: 15 },
    { header: 'باركود 2', key: 'barcode2', width: 15 },
    { header: 'باركود 3', key: 'barcode3', width: 15 },
    { header: 'سعر التكلفة', key: 'costPrice', width: 12 },
    { header: 'سعر البيع', key: 'salePrice', width: 12 },
    { header: 'الربح', key: 'profit', width: 10 },
    { header: 'الكمية', key: 'quantity', width: 10 },
    { header: 'الحد الأدنى', key: 'minStockLevel', width: 12 },
    { header: 'القسم', key: 'category', width: 15 },
    { header: 'قيمة المخزون', key: 'stockValue', width: 15 },
  ];

  const data = products.map(p => ({
    ...p,
    barcode: p.barcode || '-',
    barcode2: p.barcode2 || '-',
    barcode3: p.barcode3 || '-',
    variantLabel: p.variantLabel || '-',
    profit: p.salePrice - p.costPrice,
    minStockLevel: p.minStockLevel || 0,
    category: p.category || 'بدون تصنيف',
    stockValue: p.costPrice * p.quantity,
  }));

  const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalCostValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  const totalSaleValue = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);

  const totals: Record<string, number> = {
    quantity: totalStock,
    stockValue: totalCostValue,
  };

  const summary = [
    { label: 'عدد المنتجات', value: products.length },
    { label: 'إجمالي المخزون', value: totalStock },
    { label: 'قيمة المخزون (بالتكلفة)', value: totalCostValue },
    { label: 'قيمة المخزون (بالبيع)', value: totalSaleValue },
    { label: 'الربح المتوقع', value: totalSaleValue - totalCostValue },
  ];

  await exportToExcel({
    sheetName: 'المنتجات',
    fileName: `منتجات_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data,
    totals,
    title: 'قائمة المنتجات',
    reportType: 'تقرير المخزون',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    summary,
  });
};

// Export expenses to Excel
export const exportExpensesToExcel = async (
  expenses: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    notes?: string;
  }>,
  dateRange?: { start: string; end: string }
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'رقم', key: 'id', width: 10 },
    { header: 'النوع', key: 'type', width: 20 },
    { header: 'المبلغ', key: 'amount', width: 12 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'ملاحظات', key: 'notes', width: 30 },
  ];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const totals: Record<string, number> = {
    amount: totalExpenses,
  };

  const summary = [
    { label: 'إجمالي المصاريف', value: totalExpenses },
    { label: 'عدد المصاريف', value: expenses.length },
  ];

  const subtitle = dateRange
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${formatLocalDate()}`;

  const fileDate = dateRange
    ? `${dateRange.start}_${dateRange.end}`
    : new Date().toISOString().split('T')[0];

  await exportToExcel({
    sheetName: 'المصاريف',
    fileName: `مصاريف_${fileDate}.xlsx`,
    columns,
    data: expenses,
    totals,
    title: 'تقرير المصاريف',
    reportType: 'تقرير المصروفات',
    subtitle,
    summary,
  });
};

// Export partners report to Excel
export const exportPartnersToExcel = async (
  partners: Array<{
    name: string;
    sharePercentage: number;
    initialCapital: number;
    currentCapital: number;
    totalProfit: number;
    totalWithdrawn: number;
    currentBalance: number;
  }>
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'الشريك', key: 'name', width: 20 },
    { header: 'نسبة الأرباح %', key: 'sharePercentage', width: 15 },
    { header: 'رأس المال الأولي', key: 'initialCapital', width: 15 },
    { header: 'رأس المال الحالي', key: 'currentCapital', width: 15 },
    { header: 'إجمالي الأرباح', key: 'totalProfit', width: 15 },
    { header: 'المسحوبات', key: 'totalWithdrawn', width: 15 },
    { header: 'الرصيد الحالي', key: 'currentBalance', width: 15 },
  ];

  const totalCapital = partners.reduce((sum, p) => sum + p.currentCapital, 0);
  const totalProfit = partners.reduce((sum, p) => sum + p.totalProfit, 0);
  const totalWithdrawn = partners.reduce((sum, p) => sum + p.totalWithdrawn, 0);
  const totalBalance = partners.reduce((sum, p) => sum + p.currentBalance, 0);

  const totals: Record<string, number> = {
    initialCapital: partners.reduce((sum, p) => sum + p.initialCapital, 0),
    currentCapital: totalCapital,
    totalProfit: totalProfit,
    totalWithdrawn: totalWithdrawn,
    currentBalance: totalBalance,
  };

  const summary = [
    { label: 'إجمالي رأس المال', value: totalCapital },
    { label: 'إجمالي الأرباح', value: totalProfit },
    { label: 'إجمالي المسحوبات', value: totalWithdrawn },
    { label: 'إجمالي الأرصدة', value: totalBalance },
  ];

  await exportToExcel({
    sheetName: 'الشركاء',
    fileName: `شركاء_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data: partners,
    totals,
    title: 'تقرير الشركاء',
    reportType: 'تقرير الشراكة',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    summary,
  });
};

// Export customers to Excel
export const exportCustomersToExcel = async (
  customers: Array<{
    name: string;
    phone?: string;
    totalPurchases: number;
    ordersCount: number;
    balance: number;
  }>
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'اسم العميل', key: 'name', width: 25 },
    { header: 'رقم الهاتف', key: 'phone', width: 15 },
    { header: 'إجمالي المشتريات', key: 'totalPurchases', width: 15 },
    { header: 'عدد الطلبات', key: 'ordersCount', width: 12 },
    { header: 'الرصيد', key: 'balance', width: 12 },
  ];

  const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.ordersCount, 0);
  const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);

  const totals: Record<string, number> = {
    totalPurchases: totalPurchases,
    ordersCount: totalOrders,
    balance: totalBalance,
  };

  const summary = [
    { label: 'عدد العملاء', value: customers.length },
    { label: 'إجمالي المشتريات', value: totalPurchases },
    { label: 'إجمالي الطلبات', value: totalOrders },
    { label: 'إجمالي الأرصدة', value: totalBalance },
  ];

  await exportToExcel({
    sheetName: 'العملاء',
    fileName: `عملاء_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data: customers,
    totals,
    title: 'قائمة العملاء',
    reportType: 'تقرير العملاء',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    summary,
  });
};

// Export comprehensive sales report to Excel with multiple sheets
export const exportSalesReportToExcel = async (
  data: {
    dailySales: Array<{ date: string; sales: number; profit: number; orders: number }>;
    topProducts: Array<{ name: string; sales: number; revenue: number }>;
    topCustomers: Array<{ name: string; orders: number; total: number }>;
    summary: { totalSales: number; totalProfit: number; totalOrders: number; avgOrderValue: number };
  },
  dateRange: { start: string; end: string }
): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  const store = getStoreInfo();

  // Summary sheet
  const summarySheet = wb.addWorksheet('الملخص');
  const summaryRows = [
    [store.name],
    store.phone ? [`هاتف: ${store.phone}`] : [],
    store.address ? [`العنوان: ${store.address}`] : [],
    [],
    [`نوع التقرير: تقرير المبيعات التفصيلي`],
    [`تاريخ الإصدار: ${formatLocalDateTime()}`],
    [],
    ['تقرير المبيعات التفصيلي'],
    [`الفترة: من ${dateRange.start} إلى ${dateRange.end}`],
    [],
    ['البند', 'القيمة'],
    ['إجمالي المبيعات', data.summary.totalSales],
    ['صافي الأرباح', data.summary.totalProfit],
    ['عدد الطلبات', data.summary.totalOrders],
    ['متوسط قيمة الطلب', Math.round(data.summary.avgOrderValue)],
  ].filter(row => row.length > 0);
  summaryRows.forEach(row => summarySheet.addRow(row));
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 15;

  // Daily sales sheet
  const dailySheet = wb.addWorksheet('المبيعات اليومية');
  const dailyRows = [
    ['التاريخ', 'المبيعات', 'الأرباح', 'الطلبات'],
    ...data.dailySales.map(d => [d.date, d.sales, d.profit, d.orders]),
    [],
    ['الإجمالي',
      data.dailySales.reduce((s, d) => s + d.sales, 0),
      data.dailySales.reduce((s, d) => s + d.profit, 0),
      data.dailySales.reduce((s, d) => s + d.orders, 0)
    ]
  ];
  dailyRows.forEach(row => dailySheet.addRow(row));
  [12, 12, 12, 10].forEach((w, i) => { dailySheet.getColumn(i + 1).width = w; });

  // Top products sheet
  const productsSheet = wb.addWorksheet('أفضل المنتجات');
  const productsRows = [
    ['المنتج', 'الكمية المباعة', 'الإيرادات'],
    ...data.topProducts.map(p => [p.name, p.sales, p.revenue]),
  ];
  productsRows.forEach(row => productsSheet.addRow(row));
  [25, 15, 15].forEach((w, i) => { productsSheet.getColumn(i + 1).width = w; });

  // Top customers sheet
  const customersSheet = wb.addWorksheet('أفضل العملاء');
  const customersRows = [
    ['العميل', 'عدد الطلبات', 'الإجمالي'],
    ...data.topCustomers.map(c => [c.name, c.orders, c.total]),
  ];
  customersRows.forEach(row => customersSheet.addRow(row));
  [25, 15, 15].forEach((w, i) => { customersSheet.getColumn(i + 1).width = w; });

  const fileName = `تقرير_المبيعات_${dateRange.start}_${dateRange.end}.xlsx`;

  if (Capacitor.isNativePlatform()) {
    await saveExcelNative(wb, fileName);
  } else {
    await downloadWorkbook(wb, fileName);
  }
};

// Export daily report to Excel
export const exportDailyReportToExcel = async (
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
): Promise<void> => {
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

  await exportToExcel({
    sheetName: 'التقرير اليومي',
    fileName: `تقرير_يومي_${report.date}.xlsx`,
    columns,
    data,
    title: 'التقرير اليومي للصندوق',
    reportType: 'تقرير الصندوق',
    subtitle: `التاريخ: ${report.date}`,
  });
};

// Export custody/distributor report to Excel with styled format
export const exportCustodyReportToExcel = async (
  distributors: Array<{
    warehouseName: string;
    totalProducts: number;
    totalQuantity: number;
    totalCostValue: number;
    totalSaleValue: number;
    potentialProfit: number;
    products: Array<{
      productName: string;
      unit: string;
      quantity: number;
      costPrice: number;
      salePrice: number;
      costValue: number;
      saleValue: number;
    }>;
  }>
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'الموزع', key: 'warehouseName', width: 20 },
    { header: 'عدد المنتجات', key: 'totalProducts', width: 12 },
    { header: 'إجمالي الكميات', key: 'totalQuantity', width: 12 },
    { header: 'قيمة التكلفة', key: 'totalCostValue', width: 15 },
    { header: 'قيمة البيع', key: 'totalSaleValue', width: 15 },
    { header: 'الربح المتوقع', key: 'potentialProfit', width: 15 },
  ];

  const data = distributors.map(d => ({
    warehouseName: d.warehouseName,
    totalProducts: d.totalProducts,
    totalQuantity: d.totalQuantity,
    totalCostValue: d.totalCostValue,
    totalSaleValue: d.totalSaleValue,
    potentialProfit: d.potentialProfit,
  }));

  const totalProducts = distributors.reduce((sum, d) => sum + d.totalProducts, 0);
  const totalQuantity = distributors.reduce((sum, d) => sum + d.totalQuantity, 0);
  const totalCostValue = distributors.reduce((sum, d) => sum + d.totalCostValue, 0);
  const totalSaleValue = distributors.reduce((sum, d) => sum + d.totalSaleValue, 0);
  const totalProfit = distributors.reduce((sum, d) => sum + d.potentialProfit, 0);

  const totals: Record<string, number> = {
    totalProducts,
    totalQuantity,
    totalCostValue,
    totalSaleValue,
    potentialProfit: totalProfit,
  };

  const summary = [
    { label: 'عدد الموزعين', value: distributors.length },
    { label: 'إجمالي المنتجات', value: totalProducts },
    { label: 'إجمالي الكميات', value: totalQuantity },
    { label: 'قيمة التكلفة الإجمالية', value: totalCostValue },
    { label: 'قيمة البيع الإجمالية', value: totalSaleValue },
    { label: 'الربح المتوقع', value: totalProfit },
  ];

  await exportToExcel({
    sheetName: 'ملخص العهد',
    fileName: `تقرير_قيمة_العهد_${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    data,
    totals,
    title: 'تقرير قيمة العهدة',
    reportType: 'تقرير جرد الموزعين',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    summary,
  });
};
