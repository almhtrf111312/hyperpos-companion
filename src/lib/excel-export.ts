// Professional Excel Export using ExcelJS library (secure, no SheetJS vulnerabilities)
import ExcelJS from 'exceljs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { formatDate, formatDateTime } from './utils';
import { getReportCurrency } from './currencies';
import { roundForCurrency } from './money-engine';

export interface ExportCurrencySnapshot {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  decimals: number;
}

export type ExportValueKind = 'money' | 'quantity' | 'percent' | 'date' | 'text';

export interface ReportExportColumn {
  header: string;
  key: string;
  width?: number;
  kind?: ExportValueKind;
}

export type ExcelColumn = ReportExportColumn;

export interface ExcelExportOptions {
  sheetName?: string;
  fileName?: string;
  currency?: ExportCurrencySnapshot;
  columns: ReportExportColumn[];
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
    const stored = localStorage.getItem('hyperpos_settings_v1') || localStorage.getItem('hyperpos_settings');
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

// Normalize customer name for exports
const normalizeExportCustomerName = (name: string | undefined, paymentType: string): string => {
  if (name && name.trim() && name.trim() !== 'عميل') return name.trim();
  return paymentType === 'debt' ? 'عميل دين' : 'عميل نقدي';
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
    currency,
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

  const reportCurr = getReportCurrency();
  const currencySnapshot: ExportCurrencySnapshot = currency || {
    code: reportCurr.code,
    name: reportCurr.name,
    symbol: reportCurr.symbol,
    rate: reportCurr.isUsd ? 1 : reportCurr.rate,
    decimals: 2,
  };

  const store = storeName ? { name: storeName, phone: storePhone, address: storeAddress } : getStoreInfo();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true } as any] });

  // Store header
  ws.addRow([store.name]);
  const storeNameRow = ws.lastRow;
  if (storeNameRow) {
      storeNameRow.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      storeNameRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      storeNameRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  }
  
  if (store.phone) {
      ws.addRow([`هاتف: ${store.phone}`]);
      ws.lastRow!.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      ws.lastRow!.font = { name: 'Segoe UI', size: 11, color: { argb: 'FFFFFFFF' } };
  }
  if (store.address) {
      ws.addRow([`العنوان: ${store.address}`]);
      ws.lastRow!.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      ws.lastRow!.font = { name: 'Segoe UI', size: 11, color: { argb: 'FFFFFFFF' } };
  }
  
  ws.mergeCells(1, 1, store.address ? 3 : store.phone ? 2 : 1, columns.length);
  ws.addRow([]);

  if (reportType) {
      ws.addRow([`نوع التقرير: ${reportType}`]);
      ws.lastRow!.font = { name: 'Segoe UI', size: 12, bold: true };
  }
  ws.addRow([`عملة التقرير: ${currencySnapshot.name} (${currencySnapshot.symbol}) - سعر الصرف: ${currencySnapshot.rate}`]);
  ws.lastRow!.font = { name: 'Segoe UI', size: 10, italic: true };
  ws.addRow([`تاريخ الإصدار: ${formatLocalDateTime()}`]);
  ws.addRow([]);

  if (title) { 
      ws.addRow([title]); 
      ws.lastRow!.font = { name: 'Segoe UI', size: 14, bold: true };
      ws.addRow([]); 
  }
  if (subtitle) { 
      ws.addRow([subtitle]); 
      ws.addRow([]); 
  }

  // Header row
  const headerRow = ws.addRow(columns.map(col => col.header));
  headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      cell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
  });

  // تنسيق مالي مناسب لعدد المنازل العشرية
  const numFmt = currencySnapshot.decimals === 0
    ? '#,##0'
    : currencySnapshot.decimals === 3
      ? '#,##0.000'
      : '#,##0.00';

  // معالجة صفوف البيانات بدقة
  data.forEach((item, index) => {
    const row = columns.map(col => {
      const val = item[col.key];
      if (typeof val === 'number') {
        if (col.kind === 'money') {
          return roundForCurrency(val, currencySnapshot.code);
        }
        return val;
      }
      return String(val ?? '');
    });

    const dataRow = ws.addRow(row);
    const isZebra = index % 2 !== 0;

    columns.forEach((col, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      cell.font = { name: 'Segoe UI', size: 11 };
      cell.border = thinBorder;
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      if (col.kind === 'money') {
        cell.numFmt = numFmt;
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (typeof cell.value === 'number') {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  });

  // Totals row
  if (totals) {
    ws.addRow([]);
    const totalsRowValues = columns.map(col => {
      if (totals[col.key] !== undefined) return totals[col.key];
      if (col.key === columns[0].key) return 'الإجمالي الكلي';
      return '';
    });
    const totalsRow = ws.addRow(totalsRowValues);
    totalsRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 12, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = thinBorder;
        const col = columns[colNumber - 1];
        if (col?.kind === 'money') {
          cell.numFmt = numFmt;
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
    });
  }

  // Summary section
  if (summary && summary.length > 0) {
    ws.addRow([]);
    ws.addRow(['خلاصة التقرير']).font = { name: 'Segoe UI', size: 13, bold: true };
    const summaryHeader = ws.addRow(['المؤشر', 'القيمة']);
    summaryHeader.eachCell(cell => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } };
        cell.border = thinBorder;
    });
    summary.forEach(item => {
      const sumRow = ws.addRow([item.label, item.value]);
      sumRow.eachCell(cell => {
          cell.font = { name: 'Segoe UI', size: 11 };
          cell.border = thinBorder;
      });
    });
  }

  // Set column widths
  columns.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1);
    wsCol.width = col.width || 15;
  });

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
  dateRange?: { start: string; end: string },
  customSummary?: { label: string; value: string | number }[]
): Promise<void> => {
  const reportCurr = getReportCurrency();
  const rate = reportCurr.rate > 0 ? reportCurr.rate : 1;
  const toCurr = (valUsd: number) => roundForCurrency((valUsd || 0) * rate, reportCurr.code);

  const columns: ExcelColumn[] = [
    { header: 'رقم الفاتورة', key: 'id', width: 15 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'العميل', key: 'customerName', width: 20 },
    { header: `الإجمالي (${reportCurr.symbol})`, key: 'total', width: 14 },
    { header: `الخصم (${reportCurr.symbol})`, key: 'discount', width: 12 },
    { header: `صافي الربح (${reportCurr.symbol})`, key: 'profit', width: 14 },
    { header: 'نسبة الربح %', key: 'profitMargin', width: 12 },
    { header: 'نوع الدفع', key: 'paymentType', width: 10 },
    { header: 'الكاشير', key: 'cashierName', width: 15 },
  ];

  const data = invoices.map(inv => ({
    id: inv.id,
    date: formatDate(new Date(inv.createdAt)),
    customerName: normalizeExportCustomerName(inv.customerName, inv.paymentType),
    total: toCurr(inv.total),
    discount: toCurr(inv.discount || 0),
    profit: toCurr(inv.profit || 0),
    profitMargin: inv.total > 0 ? Math.round(((inv.profit || 0) / inv.total) * 100) : 0,
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
    cashierName: inv.cashierName || '-',
  }));

  const totalSales = toCurr(invoices.reduce((sum, inv) => sum + inv.total, 0));
  const totalProfit = toCurr(invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0));
  const totalDiscount = toCurr(invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0));
  const avgProfitMargin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  const totals: Record<string, number> = {
    total: totalSales,
    discount: totalDiscount,
    profit: totalProfit,
    profitMargin: avgProfitMargin,
  };

  const summary = customSummary || [
    { label: `إجمالي المبيعات (${reportCurr.symbol})`, value: totalSales },
    { label: `إجمالي الخصومات (${reportCurr.symbol})`, value: totalDiscount },
    { label: `صافي الأرباح (${reportCurr.symbol})`, value: totalProfit },
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
  products: Array<any>,
  customSummary?: { label: string; value: string | number }[]
): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'كود المنتج / المعرف', key: 'id', width: 20 },
    { header: 'الباركود', key: 'barcode', width: 15 },
    { header: 'اسم المنتج', key: 'name', width: 25 },
    { header: 'التصنيف', key: 'category', width: 15 },
    { header: 'الوحدة', key: 'unit', width: 10 },
    { header: 'سعر التكلفة', key: 'costPrice', width: 12 },
    { header: 'سعر البيع', key: 'salePrice', width: 12 },
    { header: 'سعر الجملة', key: 'wholesalePrice', width: 12 },
    { header: 'الربح (قيمة)', key: 'profit', width: 10 },
    { header: 'الربح (%)', key: 'profitMargin', width: 10 },
    { header: 'الكمية الحالية', key: 'quantity', width: 12 },
    { header: 'حد إعادة الطلب', key: 'minStockLevel', width: 12 },
    { header: 'القيمة (تكلفة)', key: 'totalCost', width: 15 },
    { header: 'القيمة (بيع)', key: 'totalValue', width: 15 },
    { header: 'حالة المنتج', key: 'status', width: 15 }
  ];

  const data = products.map(p => {
    const profit = p.salePrice - p.costPrice;
    const profitMargin = p.salePrice > 0 ? Math.round((profit / p.salePrice) * 100) : 0;
    
    let status = 'نشط';
    if (p.quantity <= 0) status = 'نفد المخزون';
    else if (p.minStockLevel && p.quantity <= p.minStockLevel) status = 'منخفض';

    return {
      id: p.id || '-',
      barcode: p.barcode || '-',
      name: p.name || '-',
      category: p.category || 'عام',
      unit: p.unit || 'قطعة',
      costPrice: p.costPrice || 0,
      salePrice: p.salePrice || 0,
      wholesalePrice: p.wholesalePrice || p.salePrice || 0,
      profit: profit,
      profitMargin: profitMargin,
      quantity: p.quantity || 0,
      minStockLevel: p.minStockLevel || 0,
      totalCost: (p.quantity || 0) * (p.costPrice || 0),
      totalValue: (p.quantity || 0) * (p.salePrice || 0),
      status: status
    };
  });

  const totals: Record<string, number> = {
    totalCost: data.reduce((sum, p) => sum + p.totalCost, 0),
    totalValue: data.reduce((sum, p) => sum + p.totalValue, 0),
    quantity: data.reduce((sum, p) => sum + p.quantity, 0)
  };

  const summary = customSummary || [
    { label: 'إجمالي عدد المنتجات', value: products.length },
    { label: 'إجمالي القيمة (بسعر التكلفة)', value: totals.totalCost },
    { label: 'إجمالي القيمة (بسعر البيع المفرق)', value: totals.totalValue }
  ];

  const fileDate = new Date().toISOString().split('T')[0];

  await exportToExcel({
    sheetName: 'المنتجات والمخزون',
    fileName: `products_${fileDate}.xlsx`,
    columns,
    data,
    totals,
    title: 'تقرير المنتجات وقيمة المخزون التفصيلي',
    reportType: 'جرد وتفاصيل المنتجات',
    summary
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
  dateRange?: { start: string; end: string },
  customSummary?: { label: string; value: string | number }[]
): Promise<void> => {
  const reportCurr = getReportCurrency();
  const rate = reportCurr.rate > 0 ? reportCurr.rate : 1;
  const toCurr = (valUsd: number) => roundForCurrency((valUsd || 0) * rate, reportCurr.code);

  const columns: ExcelColumn[] = [
    { header: 'رقم', key: 'id', width: 10 },
    { header: 'النوع', key: 'type', width: 20 },
    { header: `المبلغ (${reportCurr.symbol})`, key: 'amount', width: 14 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'ملاحظات', key: 'notes', width: 30 },
  ];

  const totalExpenses = toCurr(expenses.reduce((sum, e) => sum + e.amount, 0));

  const totals: Record<string, number> = {
    amount: totalExpenses,
  };

  const summary = customSummary || [
    { label: `إجمالي المصاريف (${reportCurr.symbol})`, value: totalExpenses },
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
  }>,
  customSummary?: { label: string; value: string | number }[]
): Promise<void> => {
  const reportCurr = getReportCurrency();
  const rate = reportCurr.rate > 0 ? reportCurr.rate : 1;
  const toCurr = (valUsd: number) => roundForCurrency((valUsd || 0) * rate, reportCurr.code);

  const columns: ExcelColumn[] = [
    { header: 'الشريك', key: 'name', width: 20 },
    { header: 'نسبة الأرباح %', key: 'sharePercentage', width: 15 },
    { header: `رأس المال الأولي (${reportCurr.symbol})`, key: 'initialCapital', width: 16 },
    { header: `رأس المال الحالي (${reportCurr.symbol})`, key: 'currentCapital', width: 16 },
    { header: `إجمالي الأرباح (${reportCurr.symbol})`, key: 'totalProfit', width: 16 },
    { header: `المسحوبات (${reportCurr.symbol})`, key: 'totalWithdrawn', width: 16 },
    { header: `الرصيد الحالي (${reportCurr.symbol})`, key: 'currentBalance', width: 16 },
  ];

  const totalInitial = toCurr(partners.reduce((sum, p) => sum + p.initialCapital, 0));
  const totalCapital = toCurr(partners.reduce((sum, p) => sum + p.currentCapital, 0));
  const totalProfit = toCurr(partners.reduce((sum, p) => sum + p.totalProfit, 0));
  const totalWithdrawn = toCurr(partners.reduce((sum, p) => sum + p.totalWithdrawn, 0));
  const totalBalance = toCurr(partners.reduce((sum, p) => sum + p.currentBalance, 0));

  const totals: Record<string, number> = {
    initialCapital: totalInitial,
    currentCapital: totalCapital,
    totalProfit: totalProfit,
    totalWithdrawn: totalWithdrawn,
    currentBalance: totalBalance,
  };

  const summary = customSummary || [
    { label: `إجمالي رأس المال (${reportCurr.symbol})`, value: totalCapital },
    { label: `إجمالي الأرباح (${reportCurr.symbol})`, value: totalProfit },
    { label: `إجمالي المسحوبات (${reportCurr.symbol})`, value: totalWithdrawn },
    { label: `إجمالي الأرصدة (${reportCurr.symbol})`, value: totalBalance },
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
  }>,
  customSummary?: { label: string; value: string | number }[]
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

  const summary = customSummary || [
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
  const reportCurr = getReportCurrency();
  const rate = reportCurr.rate > 0 ? reportCurr.rate : 1;
  const toCurr = (valUsd: number) => roundForCurrency((valUsd || 0) * rate, reportCurr.code);

  // Summary sheet
  const summarySheet = wb.addWorksheet('الملخص');
  const summaryRows = [
    [store.name],
    store.phone ? [`هاتف: ${store.phone}`] : [],
    store.address ? [`العنوان: ${store.address}`] : [],
    [],
    [`نوع التقرير: تقرير المبيعات التفصيلي`],
    [`عملة التقرير: ${reportCurr.name} (${reportCurr.symbol}) - سعر الصرف: ${reportCurr.rate}`],
    [`تاريخ الإصدار: ${formatLocalDateTime()}`],
    [],
    ['تقرير المبيعات التفصيلي'],
    [`الفترة: من ${dateRange.start} إلى ${dateRange.end}`],
    [],
    ['البند', `القيمة (${reportCurr.symbol})`],
    ['إجمالي المبيعات', toCurr(data.summary.totalSales)],
    ['صافي الأرباح', toCurr(data.summary.totalProfit)],
    ['عدد الطلبات', data.summary.totalOrders],
    ['متوسط قيمة الطلب', toCurr(data.summary.avgOrderValue)],
  ].filter(row => row.length > 0);
  summaryRows.forEach(row => summarySheet.addRow(row));
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;

  // Daily sales sheet
  const dailySheet = wb.addWorksheet('المبيعات اليومية');
  const dailyRows = [
    ['التاريخ', `المبيعات (${reportCurr.symbol})`, `الأرباح (${reportCurr.symbol})`, 'الطلبات'],
    ...data.dailySales.map(d => [d.date, toCurr(d.sales), toCurr(d.profit), d.orders]),
    [],
    ['الإجمالي',
      toCurr(data.dailySales.reduce((s, d) => s + d.sales, 0)),
      toCurr(data.dailySales.reduce((s, d) => s + d.profit, 0)),
      data.dailySales.reduce((s, d) => s + d.orders, 0)
    ]
  ];
  dailyRows.forEach(row => dailySheet.addRow(row));
  [14, 18, 18, 10].forEach((w, i) => { dailySheet.getColumn(i + 1).width = w; });

  // Top products sheet
  const productsSheet = wb.addWorksheet('أفضل المنتجات');
  const productsRows = [
    ['المنتج', 'الكمية المباعة', `الإيرادات (${reportCurr.symbol})`],
    ...data.topProducts.map(p => [p.name, p.sales, toCurr(p.revenue)]),
  ];
  productsRows.forEach(row => productsSheet.addRow(row));
  [25, 15, 18].forEach((w, i) => { productsSheet.getColumn(i + 1).width = w; });

  // Top customers sheet
  const customersSheet = wb.addWorksheet('أفضل العملاء');
  const customersRows = [
    ['العميل', 'عدد الطلبات', `الإجمالي (${reportCurr.symbol})`],
    ...data.topCustomers.map(c => [c.name, c.orders, toCurr(c.total)]),
  ];
  customersRows.forEach(row => customersSheet.addRow(row));
  [25, 15, 18].forEach((w, i) => { customersSheet.getColumn(i + 1).width = w; });

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
  const reportCurr = getReportCurrency();
  const rate = reportCurr.rate > 0 ? reportCurr.rate : 1;
  const toCurr = (valUsd: number) => roundForCurrency((valUsd || 0) * rate, reportCurr.code);

  const columns: ExcelColumn[] = [
    { header: 'البند', key: 'item', width: 25 },
    { header: `المبلغ (${reportCurr.symbol})`, key: 'amount', width: 16 },
  ];

  const data = [
    { item: 'رصيد الافتتاح', amount: toCurr(report.openingCash) },
    { item: 'المبيعات', amount: toCurr(report.sales) },
    { item: 'الإيداعات', amount: toCurr(report.deposits) },
    { item: 'المصاريف', amount: toCurr(-report.expenses) },
    { item: 'السحوبات', amount: toCurr(-report.withdrawals) },
    { item: 'رصيد الإغلاق (متوقع)', amount: toCurr(report.openingCash + report.sales + report.deposits - report.expenses - report.withdrawals) },
    { item: 'رصيد الإغلاق (فعلي)', amount: toCurr(report.closingCash) },
    { item: 'الفارق', amount: toCurr(report.discrepancy) },
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
  const reportCurr = getReportCurrency();
  const rate = reportCurr.rate > 0 ? reportCurr.rate : 1;
  const toCurr = (valUsd: number) => roundForCurrency((valUsd || 0) * rate, reportCurr.code);

  const columns: ExcelColumn[] = [
    { header: 'الموزع', key: 'warehouseName', width: 20 },
    { header: 'عدد المنتجات', key: 'totalProducts', width: 12 },
    { header: 'إجمالي الكميات', key: 'totalQuantity', width: 12 },
    { header: `قيمة التكلفة (${reportCurr.symbol})`, key: 'totalCostValue', width: 16 },
    { header: `قيمة البيع (${reportCurr.symbol})`, key: 'totalSaleValue', width: 16 },
    { header: `الربح المتوقع (${reportCurr.symbol})`, key: 'potentialProfit', width: 16 },
  ];

  const data = distributors.map(d => ({
    warehouseName: d.warehouseName,
    totalProducts: d.totalProducts,
    totalQuantity: d.totalQuantity,
    totalCostValue: toCurr(d.totalCostValue),
    totalSaleValue: toCurr(d.totalSaleValue),
    potentialProfit: toCurr(d.potentialProfit),
  }));

  const totalProducts = distributors.reduce((sum, d) => sum + d.totalProducts, 0);
  const totalQuantity = distributors.reduce((sum, d) => sum + d.totalQuantity, 0);
  const totalCostValue = toCurr(distributors.reduce((sum, d) => sum + d.totalCostValue, 0));
  const totalSaleValue = toCurr(distributors.reduce((sum, d) => sum + d.totalSaleValue, 0));
  const totalProfit = toCurr(distributors.reduce((sum, d) => sum + d.potentialProfit, 0));

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
    { label: `قيمة التكلفة الإجمالية (${reportCurr.symbol})`, value: totalCostValue },
    { label: `قيمة البيع الإجمالية (${reportCurr.symbol})`, value: totalSaleValue },
    { label: `الربح المتوقع (${reportCurr.symbol})`, value: totalProfit },
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
