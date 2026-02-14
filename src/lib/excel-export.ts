// Professional Excel Export using xlsx-js-style library for colors
import XLSX from 'xlsx-js-style';
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

// Save Excel file on native platforms using Filesystem and Share APIs
const saveExcelNative = async (wb: any, fileName: string): Promise<void> => {
  try {
    // Convert workbook to base64
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    // Save file to cache directory
    const result = await Filesystem.writeFile({
      path: fileName,
      data: wbout,
      directory: Directory.Cache,
    });

    // Share the file
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

  // Get store info if not provided
  const store = storeName ? { name: storeName, phone: storePhone, address: storeAddress } : getStoreInfo();

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Prepare data rows
  const rows: (string | number | undefined)[][] = [];

  // Add store header
  rows.push([store.name]);
  if (store.phone) {
    rows.push([`هاتف: ${store.phone}`]);
  }
  if (store.address) {
    rows.push([`العنوان: ${store.address}`]);
  }
  rows.push([]); // Empty row

  // Add report type and date
  if (reportType) {
    rows.push([`نوع التقرير: ${reportType}`]);
  }
  rows.push([`تاريخ الإصدار: ${formatLocalDateTime()}`]);
  rows.push([]); // Empty row

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

  // Add summary section if provided
  if (summary && summary.length > 0) {
    rows.push([]); // Empty row
    rows.push(['خلاصة حسابية']);
    rows.push(['البند', 'القيمة']);
    summary.forEach(item => {
      rows.push([item.label, item.value]);
    });
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Apply alternating column colors (Light Blue / Light Green)
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = range.s.c; c <= range.e.c; ++c) {
      // Determined color for this column
      const fillColor = c % 2 === 0 ? 'E6F3FF' : 'F0FFF0'; // Blue for A, C, E..., Green for B, D, F...

      for (let r = range.s.r; r <= range.e.r; ++r) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (ws[cellAddress]) {
          // Apply style to existing cell
          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.fill = {
            fgColor: { rgb: fillColor }
          };
          // Add border for cleaner look
          ws[cellAddress].s.border = {
            top: { style: 'thin', color: { rgb: "CCCCCC" } },
            bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
            left: { style: 'thin', color: { rgb: "CCCCCC" } },
            right: { style: 'thin', color: { rgb: "CCCCCC" } }
          };
        }
      }
    }
  }

  // Set column widths
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate and download/share file based on platform
  if (Capacitor.isNativePlatform()) {
    await saveExcelNative(wb, fileName);
  } else {
    XLSX.writeFile(wb, fileName);
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
    { header: 'نوع الدفع', key: 'paymentType', width: 10 },
  ];

  const data = invoices.map(inv => ({
    id: inv.id.substring(0, 8),
    date: formatDate(new Date(inv.createdAt)),
    customerName: inv.customerName || 'عميل نقدي',
    total: inv.total,
    discount: inv.discount || 0,
    profit: inv.profit || 0,
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
  }));

  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalProfit = invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
  const totalDiscount = invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);

  const totals: Record<string, number> = {
    total: totalSales,
    discount: totalDiscount,
    profit: totalProfit,
  };

  const summary = [
    { label: 'إجمالي المبيعات', value: totalSales },
    { label: 'إجمالي الخصومات', value: totalDiscount },
    { label: 'صافي الأرباح', value: totalProfit },
    { label: 'عدد الفواتير', value: invoices.length },
  ];

  const subtitle = dateRange
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${formatLocalDate()}`;

  await exportToExcel({
    sheetName: 'الفواتير',
    fileName: `فواتير_${new Date().toISOString().split('T')[0]}.xlsx`,
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

  await exportToExcel({
    sheetName: 'المصاريف',
    fileName: `مصاريف_${new Date().toISOString().split('T')[0]}.xlsx`,
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

// Save multi-sheet Excel file on native platforms
const saveMultiSheetExcelNative = async (wb: any, fileName: string): Promise<void> => {
  try {
    // Convert workbook to base64
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    // Save file to cache directory
    const result = await Filesystem.writeFile({
      path: fileName,
      data: wbout,
      directory: Directory.Cache,
    });

    // Share the file
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
  const wb = XLSX.utils.book_new();
  const store = getStoreInfo();

  // Summary sheet with store header
  const summaryData = [
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

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'الملخص');

  // Daily sales sheet
  const dailyData = [
    ['التاريخ', 'المبيعات', 'الأرباح', 'الطلبات'],
    ...data.dailySales.map(d => [d.date, d.sales, d.profit, d.orders]),
    [],
    ['الإجمالي',
      data.dailySales.reduce((s, d) => s + d.sales, 0),
      data.dailySales.reduce((s, d) => s + d.profit, 0),
      data.dailySales.reduce((s, d) => s + d.orders, 0)
    ]
  ];
  const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
  dailySheet['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, dailySheet, 'المبيعات اليومية');

  // Top products sheet
  const productsData = [
    ['المنتج', 'الكمية المباعة', 'الإيرادات'],
    ...data.topProducts.map(p => [p.name, p.sales, p.revenue]),
  ];
  const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
  productsSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, productsSheet, 'أفضل المنتجات');

  // Top customers sheet
  const customersData = [
    ['العميل', 'عدد الطلبات', 'الإجمالي'],
    ...data.topCustomers.map(c => [c.name, c.orders, c.total]),
  ];
  const customersSheet = XLSX.utils.aoa_to_sheet(customersData);
  customersSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, customersSheet, 'أفضل العملاء');

  const fileName = `تقرير_المبيعات_${dateRange.start}_${dateRange.end}.xlsx`;

  // Generate and download/share file based on platform
  if (Capacitor.isNativePlatform()) {
    await saveMultiSheetExcelNative(wb, fileName);
  } else {
    XLSX.writeFile(wb, fileName);
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
