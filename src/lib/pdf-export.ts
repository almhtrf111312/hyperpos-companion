// Professional PDF Export using jsPDF with Capacitor support - FlowPOS Pro
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { loadArabicFont, ARABIC_FONT_NAME } from './fonts/cairo-font';
import { getCurrentLanguage } from './i18n';
import ArabicReshaper from 'arabic-reshaper';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeLogo?: string; // Base64 logo
  reportType?: string;
  columns: { header: string; key: string }[];
  data: Record<string, unknown>[];
  totals?: Record<string, number | string>;
  summary?: { label: string; value: string | number }[];
  fileName?: string;
}

// Check if text contains Arabic characters
const containsArabic = (text: string): boolean => {
  return /[\u0600-\u06FF]/.test(text);
};

// Process Arabic text for proper PDF display
// 1. Reshape: Convert characters to their connected forms using arabic-reshaper
// 2. NO reverse needed - jsPDF with Arabic font handles RTL properly

const processArabicText = (text: string): string => {
  if (!containsArabic(text)) return text;
  
  try {
    // Use arabic-reshaper.convertArabic() to properly connect Arabic letters
    // This converts isolated letters to their proper connected forms
    const shaped = ArabicReshaper.convertArabic(text);
    // Return shaped text without reversing - the font handles RTL display
    return shaped;
  } catch (error) {
    console.warn('Arabic reshaping failed, using original text:', error);
    // Fallback: return original text without modification
    return text;
  }
};

// Global flag to track if Arabic font is available
let arabicFontLoaded = false;

// Process text for RTL display - wrapper function
const processRTL = (text: string): string => {
  if (!arabicFontLoaded) {
    // Without Arabic font, just return text as-is (will show squares)
    return String(text || '');
  }
  return processArabicText(String(text || ''));
};

// Format date in local timezone
const formatLocalDate = (date?: Date): string => {
  const d = date || new Date();
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
};

// Format datetime in local timezone
const formatLocalDateTime = (date?: Date): string => {
  const d = date || new Date();
  return d.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
};

// Save PDF on native platforms using Filesystem and Share APIs
const savePDFNative = async (doc: jsPDF, fileName: string): Promise<void> => {
  try {
    // Convert PDF to base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    // Save file to cache directory
    const result = await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64,
      directory: Directory.Cache,
    });
    
    // Share the file
    await Share.share({
      title: fileName,
      url: result.uri,
      dialogTitle: 'حفظ ملف PDF',
    });
  } catch (error) {
    console.error('Error saving PDF on native:', error);
    throw error;
  }
};

// Get store logo from settings
const getStoreLogo = (): string | null => {
  try {
    const stored = localStorage.getItem('hyperpos_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.storeSettings?.logo || null;
    }
  } catch {
    // ignore
  }
  return null;
};

// Create and download PDF file
export const exportToPDF = async (options: PDFExportOptions): Promise<void> => {
  const {
    title,
    subtitle,
    storeName,
    storePhone,
    storeAddress,
    storeLogo,
    reportType,
    columns,
    data,
    totals,
    summary,
    fileName = 'export.pdf',
  } = options;
  
  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // ✅ Try to load Arabic font (Noto Sans Arabic)
  const currentLang = getCurrentLanguage();
  if (currentLang === 'ar') {
    try {
      await loadArabicFont(doc);
      arabicFontLoaded = true;
      doc.setFont(ARABIC_FONT_NAME, 'normal');
    } catch {
      arabicFontLoaded = false;
      doc.setFont('helvetica');
    }
  } else {
    doc.setFont('helvetica');
    arabicFontLoaded = false;
  }
  
  let yPosition = 15;
  const pageWidth = doc.internal.pageSize.width;
  
  // Add store logo if available
  const logo = storeLogo || getStoreLogo();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', pageWidth / 2 - 15, yPosition, 30, 30);
      yPosition += 35;
    } catch {
      // Logo failed to load, skip
    }
  }
  
  // Add store name (header)
  if (storeName) {
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    const storeNameText = processRTL(storeName);
    doc.text(storeNameText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }
  
  // Add store contact info
  if (storePhone || storeAddress) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    if (storePhone) {
      doc.text(storePhone, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    if (storeAddress) {
      const addressText = processRTL(storeAddress);
      doc.text(addressText, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
  }
  
  yPosition += 3;
  
  // Add horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 8;
  
  // Add report type and date header
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  
  // Report type on right
  if (reportType) {
    const reportTypeText = processRTL(reportType);
    doc.text(reportTypeText, pageWidth - 15, yPosition, { align: 'right' });
  }
  
  // Date on left
  const dateText = `${processRTL('تاريخ الإصدار:')} ${formatLocalDateTime()}`;
  doc.text(dateText, 15, yPosition);
  yPosition += 10;
  
  // Add title
  doc.setFontSize(18);
  doc.setTextColor(44, 62, 80);
  const titleText = processRTL(title);
  doc.text(titleText, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Add subtitle
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const subtitleText = processRTL(subtitle);
    doc.text(subtitleText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }
  
  // Prepare table data
  const headers = columns.map(col => processRTL(col.header));
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      if (typeof value === 'number') {
        return value.toLocaleString('en-US');
      }
      return processRTL(String(value ?? ''));
    })
  );
  
  // Add totals row if provided
  if (totals) {
    const totalsRow = columns.map(col => {
      if (totals[col.key] !== undefined) {
        const value = totals[col.key];
        if (typeof value === 'number') {
          return value.toLocaleString('en-US');
        }
        return processRTL(String(value));
      }
      if (col.key === columns[0].key) {
        return processRTL('الإجمالي');
      }
      return '';
    });
    rows.push(totalsRow);
  }
  
  // Add table using autoTable
  const fontName = arabicFontLoaded ? ARABIC_FONT_NAME : 'helvetica';
  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      font: fontName,
      fontSize: 10,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      // Avoid bold with Arabic custom fonts in jsPDF/autotable (may fallback to Latin font)
      fontStyle: arabicFontLoaded ? 'normal' : 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    // Style for totals row (last row if totals provided)
    didParseCell: (data) => {
      if (totals && data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = arabicFontLoaded ? 'normal' : 'bold';
        data.cell.styles.fillColor = [230, 230, 230];
      }
    },
  });
  
  // Get final Y position after table
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || yPosition + 50;
  
  // Add summary section if provided
  if (summary && summary.length > 0) {
    let summaryY = finalY + 15;
    
    // Summary header
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text(processRTL('خلاصة حسابية'), pageWidth / 2, summaryY, { align: 'center' });
    summaryY += 8;
    
    // Summary line
    doc.setDrawColor(41, 128, 185);
    doc.line(pageWidth / 2 - 40, summaryY, pageWidth / 2 + 40, summaryY);
    summaryY += 8;
    
    // Summary items
    const summaryFontName = arabicFontLoaded ? ARABIC_FONT_NAME : 'helvetica';
    doc.setFontSize(11);
    summary.forEach(item => {
      doc.setTextColor(100, 100, 100);
      doc.setFont(summaryFontName, 'normal');
      doc.text(processRTL(item.label + ':'), pageWidth / 2 + 30, summaryY, { align: 'right' });
      doc.setTextColor(44, 62, 80);
      doc.setFont(summaryFontName, arabicFontLoaded ? 'normal' : 'bold');
      const valueText = typeof item.value === 'number' 
        ? item.value.toLocaleString('en-US') 
        : String(item.value);
      doc.text(valueText, pageWidth / 2 - 30, summaryY, { align: 'left' });
      doc.setFont(summaryFontName, 'normal');
      summaryY += 6;
    });
  }
  
  // Add footer with date and page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    
    const footerDateText = formatLocalDate();
    doc.text(footerDateText, 15, doc.internal.pageSize.height - 10);
    
    const pageText = `${i} / ${pageCount}`;
    doc.text(pageText, pageWidth - 15, doc.internal.pageSize.height - 10, { align: 'right' });
    
    // App name in center
    doc.text('HyperPOS', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  // Save the PDF based on platform
  if (Capacitor.isNativePlatform()) {
    await savePDFNative(doc, fileName);
  } else {
    doc.save(fileName);
  }
};

// Export invoices to PDF with enhanced details
export const exportInvoicesToPDF = async (
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
  storeInfo?: { name: string; phone?: string; address?: string },
  dateRange?: { start: string; end: string }
): Promise<void> => {
  const columns = [
    { header: 'رقم الفاتورة', key: 'id' },
    { header: 'التاريخ', key: 'date' },
    { header: 'العميل', key: 'customerName' },
    { header: 'الإجمالي', key: 'total' },
    { header: 'الخصم', key: 'discount' },
    { header: 'صافي الربح', key: 'profit' },
    { header: 'نوع الدفع', key: 'paymentType' },
  ];
  
  const data = invoices.map(inv => ({
    id: inv.id.substring(0, 8),
    date: new Date(inv.createdAt).toLocaleDateString('ar-SA'),
    customerName: inv.customerName || 'عميل نقدي',
    total: inv.total,
    discount: inv.discount || 0,
    profit: inv.profit || 0,
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
  }));
  
  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalProfit = invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
  const totalDiscount = invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
  
  const totals: Record<string, number | string> = {
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
  
  await exportToPDF({
    title: 'تقرير الفواتير',
    reportType: 'تقرير المبيعات',
    subtitle,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data,
    totals,
    summary,
    fileName: `فواتير_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};

// Export products to PDF with full details
export const exportProductsToPDF = async (
  products: Array<{
    name: string;
    barcode: string;
    category: string;
    costPrice?: number;
    salePrice: number;
    quantity: number;
    minStockLevel?: number;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string }
): Promise<void> => {
  const columns = [
    { header: 'المنتج', key: 'name' },
    { header: 'الباركود', key: 'barcode' },
    { header: 'التكلفة', key: 'costPrice' },
    { header: 'السعر', key: 'salePrice' },
    { header: 'الربح', key: 'profit' },
    { header: 'الكمية', key: 'quantity' },
    { header: 'الحد الأدنى', key: 'minStockLevel' },
    { header: 'القسم', key: 'category' },
  ];
  
  const data = products.map(p => ({
    name: p.name,
    barcode: p.barcode || '-',
    costPrice: p.costPrice || 0,
    salePrice: p.salePrice,
    profit: (p.salePrice - (p.costPrice || 0)),
    quantity: p.quantity,
    minStockLevel: p.minStockLevel || 0,
    category: p.category || 'بدون تصنيف',
  }));
  
  const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);
  const totalCostValue = products.reduce((sum, p) => sum + ((p.costPrice || 0) * p.quantity), 0);
  const totalPotentialProfit = totalValue - totalCostValue;
  
  const totals: Record<string, number | string> = {
    quantity: totalStock,
  };
  
  const summary = [
    { label: 'عدد المنتجات', value: products.length },
    { label: 'إجمالي المخزون', value: totalStock },
    { label: 'قيمة المخزون (بالتكلفة)', value: totalCostValue },
    { label: 'قيمة المخزون (بالبيع)', value: totalValue },
    { label: 'الربح المتوقع', value: totalPotentialProfit },
  ];
  
  await exportToPDF({
    title: 'قائمة المنتجات',
    reportType: 'تقرير المخزون',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data,
    totals,
    summary,
    fileName: `منتجات_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};

// Export single invoice to PDF (receipt style)
export const exportInvoiceReceiptToPDF = async (
  invoice: {
    id: string;
    customerName: string;
    customerPhone?: string;
    items: Array<{ name: string; quantity: number; price: number; total: number }>;
    subtotal: number;
    discount: number;
    total: number;
    paymentType: string;
    createdAt: string;
  },
  storeInfo?: { name: string; phone?: string; address?: string }
): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // Receipt size
  });
  
  // ✅ Try to load Arabic font for receipt
  const currentLang = getCurrentLanguage();
  if (currentLang === 'ar') {
    try {
      await loadArabicFont(doc);
      arabicFontLoaded = true;
    } catch {
      arabicFontLoaded = false;
    }
  }
  
  let yPosition = 10;
  const pageWidth = 80;
  const margin = 5;
  
  // Store name
  if (storeInfo?.name) {
    doc.setFontSize(12);
    doc.setFont(arabicFontLoaded ? 'Cairo' : 'helvetica', 'bold');
    const storeNameText = processRTL(storeInfo.name);
    doc.text(storeNameText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }
  
  // Store contact
  if (storeInfo?.phone) {
    doc.setFontSize(8);
    doc.setFont(arabicFontLoaded ? 'Cairo' : 'helvetica', 'normal');
    doc.text(storeInfo.phone, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
  }
  
  // Divider
  doc.setDrawColor(150);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;
  
  // Invoice number and date
  doc.setFontSize(8);
  doc.text(`#${invoice.id}`, pageWidth - margin, yPosition, { align: 'right' });
  doc.text(new Date(invoice.createdAt).toLocaleDateString('ar-SA'), margin, yPosition);
  yPosition += 6;
  
  // Customer
  if (invoice.customerName) {
    const customerText = processRTL(`العميل: ${invoice.customerName}`);
    doc.text(customerText, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  }
  
  // Divider
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;
  
  // Items
  invoice.items.forEach(item => {
    const itemName = processRTL(item.name);
    doc.text(itemName, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 4;
    doc.text(`${item.quantity} x ${item.price.toFixed(2)}`, margin, yPosition);
    doc.text(item.total.toFixed(2), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  });
  
  // Divider
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;
  
  // Subtotal
  doc.text(processRTL('المجموع:'), pageWidth - margin - 25, yPosition, { align: 'right' });
  doc.text(invoice.subtotal.toFixed(2), pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 4;
  
  // Discount if any
  if (invoice.discount > 0) {
    doc.text(processRTL('الخصم:'), pageWidth - margin - 25, yPosition, { align: 'right' });
    doc.text(`-${invoice.discount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 4;
  }
  
  // Total
  doc.setFont(arabicFontLoaded ? 'Cairo' : 'helvetica', 'bold');
  doc.text(processRTL('الإجمالي:'), pageWidth - margin - 25, yPosition, { align: 'right' });
  doc.text(invoice.total.toFixed(2), pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  
  // Payment type
  doc.setFont(arabicFontLoaded ? 'Cairo' : 'helvetica', 'normal');
  const paymentText = processRTL(invoice.paymentType === 'cash' ? 'نقدي' : 'آجل');
  doc.text(paymentText, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Thank you message
  doc.setFontSize(10);
  const thanksText = processRTL('شكراً لزيارتكم');
  doc.text(thanksText, pageWidth / 2, yPosition, { align: 'center' });
  
  // Save based on platform
  const fileName = `فاتورة_${invoice.id}.pdf`;
  if (Capacitor.isNativePlatform()) {
    await savePDFNative(doc, fileName);
  } else {
    doc.save(fileName);
  }
};

// Export expenses to PDF
export const exportExpensesToPDF = async (
  expenses: Array<{
    id: string;
    type: string;
    typeLabel: string;
    amount: number;
    date: string;
    notes?: string;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string },
  dateRange?: { start: string; end: string }
): Promise<void> => {
  const columns = [
    { header: 'رقم', key: 'id' },
    { header: 'النوع', key: 'typeLabel' },
    { header: 'المبلغ', key: 'amount' },
    { header: 'التاريخ', key: 'date' },
    { header: 'ملاحظات', key: 'notes' },
  ];
  
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  const totals: Record<string, number | string> = {
    amount: totalExpenses,
  };
  
  const summary = [
    { label: 'إجمالي المصاريف', value: totalExpenses },
    { label: 'عدد المصاريف', value: expenses.length },
  ];
  
  const subtitle = dateRange 
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${formatLocalDate()}`;
  
  await exportToPDF({
    title: 'تقرير المصاريف',
    reportType: 'تقرير المصروفات',
    subtitle,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data: expenses.map(e => ({ ...e, notes: e.notes || '' })),
    totals,
    summary,
    fileName: `مصاريف_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};

// Export partners to PDF
export const exportPartnersToPDF = async (
  partners: Array<{
    name: string;
    sharePercentage: number;
    currentCapital: number;
    totalProfit: number;
    totalWithdrawn: number;
    currentBalance: number;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string }
): Promise<void> => {
  const columns = [
    { header: 'الشريك', key: 'name' },
    { header: 'نسبة الأرباح %', key: 'sharePercentage' },
    { header: 'رأس المال', key: 'currentCapital' },
    { header: 'الأرباح', key: 'totalProfit' },
    { header: 'المسحوب', key: 'totalWithdrawn' },
    { header: 'الرصيد', key: 'currentBalance' },
  ];
  
  const totalCapital = partners.reduce((sum, p) => sum + p.currentCapital, 0);
  const totalProfit = partners.reduce((sum, p) => sum + p.totalProfit, 0);
  const totalWithdrawn = partners.reduce((sum, p) => sum + p.totalWithdrawn, 0);
  const totalBalance = partners.reduce((sum, p) => sum + p.currentBalance, 0);
  
  const totals: Record<string, number | string> = {
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
  
  await exportToPDF({
    title: 'تقرير الشركاء',
    reportType: 'تقرير الشراكة',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data: partners,
    totals,
    summary,
    fileName: `شركاء_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};

// Export customers to PDF
export const exportCustomersToPDF = async (
  customers: Array<{
    name: string;
    phone?: string;
    totalPurchases: number;
    ordersCount: number;
    balance: number;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string }
): Promise<void> => {
  const columns = [
    { header: 'العميل', key: 'name' },
    { header: 'الهاتف', key: 'phone' },
    { header: 'المشتريات', key: 'totalPurchases' },
    { header: 'الطلبات', key: 'ordersCount' },
    { header: 'الرصيد', key: 'balance' },
  ];
  
  const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.ordersCount, 0);
  const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
  
  const totals: Record<string, number | string> = {
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
  
  await exportToPDF({
    title: 'قائمة العملاء',
    reportType: 'تقرير العملاء',
    subtitle: `التاريخ: ${formatLocalDate()}`,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data: customers,
    totals,
    summary,
    fileName: `عملاء_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};
