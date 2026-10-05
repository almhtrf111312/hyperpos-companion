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
  columnStyles?: Record<number | string, any>;
  orientation?: 'portrait' | 'landscape';
}

// Global flag to track if Arabic font is available
let arabicFontLoaded = false;

// Check if text contains Arabic characters (standard, Presentation Forms, or extended Arabic)
export const containsArabic = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

/**
 * Process Arabic text for proper PDF display:
 * 1. Reshape: Convert characters to their connected forms using arabic-reshaper.
 * 2. NO reverse: jsPDF with Arabic TTF font displays connected Arabic text in natural reading order.
 * 3. Non-Arabic text (numbers, dates, Latin words) returned as-is.
 */
export const processArabicText = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  if (!containsArabic(text)) return text;

  try {
    return ArabicReshaper.convertArabic(text);
  } catch (error) {
    console.warn('Arabic reshaping failed, using original text:', error);
    return text;
  }
};

// Process text for RTL display
const processRTL = (text: string): string => {
  if (!text) return '';
  return processArabicText(String(text));
};

// Format date in local timezone with standard numerals (YYYY/MM/DD)
const formatLocalDate = (date?: Date): string => {
  const d = date || new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${year}/${month}/${day}`;
};

// Format datetime in local timezone with standard numerals (YYYY/MM/DD HH:mm)
const formatLocalDateTime = (date?: Date): string => {
  const d = date || new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${year}/${month}/${day} ${hour}:${minute}`;
};

// Format invoice date for display in tables
const formatInvoiceDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}/${month}/${day}`;
  } catch {
    return dateStr;
  }
};

// Save PDF on native platforms using Filesystem and Share APIs
const savePDFNative = async (doc: jsPDF, fileName: string): Promise<void> => {
  try {
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const result = await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64,
      directory: Directory.Cache,
    });

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
    const stored = localStorage.getItem('hyperpos_settings_v1') || localStorage.getItem('hyperpos_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.storeSettings?.logo || null;
    }
  } catch {
    // ignore
  }
  return null;
};

// Create and export PDF document with full Arabic RTL and responsive styling
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
    columnStyles,
    orientation = 'portrait',
  } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Try to load Arabic font (Noto Sans Arabic) with offline fallback
  const currentLang = getCurrentLanguage();
  const isRTL = currentLang === 'ar';

  if (isRTL) {
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

  // Set line height factor to comfortably accommodate Arabic ascenders/descenders
  if (typeof doc.setLineHeightFactor === 'function') {
    doc.setLineHeightFactor(1.35);
  }

  const pageWidth = doc.internal.pageSize.width;
  const pageMargin = 12;
  const bannerWidth = pageWidth - (pageMargin * 2);
  let yPosition = 12;

  const fontName = arabicFontLoaded ? ARABIC_FONT_NAME : 'helvetica';
  doc.setFont(fontName, 'normal');

  // ==========================================
  // 1. PROFESSIONAL REPORT HEADER CARD
  // ==========================================
  const logo = storeLogo || getStoreLogo();
  const headerCardHeight = logo ? 26 : 22;

  // Header Card Background (#1E293B Dark Slate Navy)
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageMargin, yPosition, bannerWidth, headerCardHeight, 3, 3, 'F');

  if (isRTL) {
    // --- RTL Header Layout ---
    let storeX = pageWidth - pageMargin - 8;
    if (logo) {
      try {
        const logoSize = 18;
        doc.addImage(logo, 'PNG', pageWidth - pageMargin - logoSize - 4, yPosition + 4, logoSize, logoSize);
        storeX = pageWidth - pageMargin - logoSize - 8;
      } catch {
        // Logo skipped if invalid
      }
    }

    // Store Name
    if (storeName) {
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(processRTL(storeName), storeX, yPosition + 8.5, { align: 'right' });
    }

    // Store Phone & Address
    const storeDetails: string[] = [];
    if (storePhone) storeDetails.push(storePhone);
    if (storeAddress) storeDetails.push(storeAddress);
    if (storeDetails.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // #94A3B8
      doc.text(processRTL(storeDetails.join(' | ')), storeX, yPosition + 15.5, { align: 'right' });
    }

    // Left side of Header: Report Type & Generation Date
    const leftX = pageMargin + 8;
    if (reportType) {
      doc.setFontSize(9.5);
      doc.setTextColor(56, 189, 248); // #38BDF8 Sky Blue
      doc.text(processRTL(reportType), leftX, yPosition + 8.5, { align: 'left' });
    }
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225); // #CBD5E1
    doc.text(processRTL(`تاريخ الإصدار: ${formatLocalDateTime()}`), leftX, yPosition + 15.5, { align: 'left' });
  } else {
    // --- LTR Header Layout ---
    let storeX = pageMargin + 8;
    if (logo) {
      try {
        const logoSize = 18;
        doc.addImage(logo, 'PNG', pageMargin + 4, yPosition + 4, logoSize, logoSize);
        storeX = pageMargin + logoSize + 8;
      } catch {
        // Skip
      }
    }

    if (storeName) {
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(storeName, storeX, yPosition + 8.5, { align: 'left' });
    }

    const storeDetails: string[] = [];
    if (storePhone) storeDetails.push(storePhone);
    if (storeAddress) storeDetails.push(storeAddress);
    if (storeDetails.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(storeDetails.join(' | '), storeX, yPosition + 15.5, { align: 'left' });
    }

    const rightX = pageWidth - pageMargin - 8;
    if (reportType) {
      doc.setFontSize(9.5);
      doc.setTextColor(56, 189, 248);
      doc.text(reportType, rightX, yPosition + 8.5, { align: 'right' });
    }
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Issued: ${formatLocalDateTime()}`, rightX, yPosition + 15.5, { align: 'right' });
  }

  yPosition += headerCardHeight + 7;

  // Report Title
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // #0F172A
  doc.text(processRTL(title), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5.5;

  // Report Subtitle
  if (subtitle) {
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139); // #64748B
    doc.text(processRTL(subtitle), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5.5;
  }

  // Accent divider line
  doc.setDrawColor(2, 132, 199); // #0284C7 Sky Blue
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 25, yPosition, pageWidth / 2 + 25, yPosition);
  yPosition += 6;

  // ==========================================
  // 2. TOP KPI SUMMARY CARDS
  // ==========================================
  if (summary && summary.length > 0) {
    const availableWidth = pageWidth - (pageMargin * 2);
    const numCards = Math.min(summary.length, 4);
    const cardGap = 3.5;
    const cardWidth = (availableWidth - (cardGap * (numCards - 1))) / numCards;
    const cardHeight = 16;

    summary.slice(0, 4).forEach((item, index) => {
      // In RTL (Arabic), place card 0 at rightmost position
      const colIndex = isRTL ? (numCards - 1 - index) : index;
      const cardX = pageMargin + colIndex * (cardWidth + cardGap);

      // Card Background & Border
      doc.setFillColor(248, 250, 252); // #F8FAFC
      doc.setDrawColor(226, 232, 240); // #E2E8F0
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX, yPosition, cardWidth, cardHeight, 2, 2, 'FD');

      // Top color accent strip on card
      doc.setFillColor(2, 132, 199); // #0284C7
      doc.roundedRect(cardX + 2, yPosition, cardWidth - 4, 0.8, 0.4, 0.4, 'F');

      // Metric Label
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // #64748B
      doc.setFont(fontName, 'normal');
      const labelStr = processRTL(String(item.label));
      doc.text(labelStr, cardX + cardWidth / 2, yPosition + 5.5, { align: 'center' });

      // Metric Value
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42); // #0F172A
      doc.setFont(fontName, 'normal');
      const valRaw = typeof item.value === 'number' ? item.value.toLocaleString('en-US') : String(item.value);
      const valStr = processRTL(valRaw);
      doc.text(valStr, cardX + cardWidth / 2, yPosition + 12, { align: 'center' });
    });

    yPosition += cardHeight + 6;
  }

  // ==========================================
  // 3. TABLE DATA WITH RTL COLUMNS REVERSAL
  // ==========================================
  // For Arabic, reverse column order so column 0 appears on the far right and column N-1 on the far left
  const effectiveColumns = isRTL ? [...columns].reverse() : [...columns];

  const headers = effectiveColumns.map(col => processRTL(col.header));
  const rows = data.map(item =>
    effectiveColumns.map(col => {
      const value = item[col.key];
      if (typeof value === 'number') {
        return value.toLocaleString('en-US');
      }
      return processRTL(String(value ?? ''));
    })
  );

  // Add totals row if provided
  if (totals) {
    const totalsRow = effectiveColumns.map(col => {
      if (totals[col.key] !== undefined) {
        const value = totals[col.key];
        if (typeof value === 'number') {
          return value.toLocaleString('en-US');
        }
        return processRTL(String(value));
      }
      // Put label in the first logical column (columns[0])
      if (col.key === columns[0].key) {
        return processRTL('الإجمالي');
      }
      return '';
    });
    rows.push(totalsRow);
  }

  // Adjust columnStyles for reversed columns
  const effectiveColumnStyles: Record<number | string, any> = {};
  if (columnStyles) {
    Object.keys(columnStyles).forEach(key => {
      const num = Number(key);
      if (!isNaN(num)) {
        const targetIdx = isRTL ? (columns.length - 1 - num) : num;
        effectiveColumnStyles[targetIdx] = columnStyles[key];
      } else {
        const originalIdx = columns.findIndex(c => c.key === key);
        if (originalIdx !== -1) {
          const targetIdx = isRTL ? (columns.length - 1 - originalIdx) : originalIdx;
          effectiveColumnStyles[targetIdx] = columnStyles[key];
        } else {
          effectiveColumnStyles[key] = columnStyles[key];
        }
      }
    });
  }

  // Render Table using autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      font: fontName,
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      halign: isRTL ? 'right' : 'left',
      valign: 'middle',
      textColor: [30, 41, 59], // #1E293B
      lineColor: [226, 232, 240], // #E2E8F0 Soft border
      lineWidth: 0.15,
      minCellHeight: 8.5,
    },
    headStyles: {
      fillColor: [30, 41, 59], // #1E293B Dark Slate Navy
      textColor: [255, 255, 255],
      fontStyle: 'normal', // Regular weight avoids Arabic glyph distortion
      fontSize: 9.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      halign: 'center',
      lineColor: [51, 65, 85], // #334155
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #F8FAFC Ultra-soft zebra striping
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    didParseCell: (cellData) => {
      // Style totals row (last row if totals provided)
      if (totals && cellData.row.index === rows.length - 1) {
        cellData.cell.styles.fillColor = [241, 245, 249]; // #F1F5F9 Soft Slate
        cellData.cell.styles.textColor = [15, 23, 42]; // #0F172A
        cellData.cell.styles.fontStyle = arabicFontLoaded ? 'normal' : 'bold';
      }

      if (isRTL) {
        const rawVal = cellData.cell.raw;
        const textVal = String(rawVal ?? '').trim();

        if (cellData.section === 'head') {
          // Check if corresponding column is predominantly textual
          const col = effectiveColumns[cellData.column.index];
          const isTextCol = col && data.some(row => {
            const v = row[col.key];
            return typeof v === 'string' && containsArabic(v);
          });
          cellData.cell.styles.halign = isTextCol ? 'right' : 'center';
        } else if (cellData.section === 'body') {
          // Texts containing Arabic align right, numbers/dates/prices/codes align center
          if (containsArabic(textVal)) {
            cellData.cell.styles.halign = 'right';
          } else {
            cellData.cell.styles.halign = 'center';
          }
        }
      }
    },
    columnStyles: effectiveColumnStyles,
  });

  // Get final Y position after table
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || yPosition + 50;

  // ==========================================
  // 4. EXTENDED SUMMARY SECTION (IF > 4 ITEMS)
  // ==========================================
  if (summary && summary.length > 4) {
    let summaryY = finalY + 10;

    // Check if new page needed
    if (summaryY + 35 > doc.internal.pageSize.height) {
      doc.addPage();
      summaryY = 18;
    }

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont(fontName, 'normal');
    doc.text(processRTL('خلاصة حسابية إضافية'), pageWidth / 2, summaryY, { align: 'center' });
    summaryY += 4;

    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(0.4);
    doc.line(pageWidth / 2 - 25, summaryY, pageWidth / 2 + 25, summaryY);
    summaryY += 6;

    const summaryBoxWidth = Math.min(pageWidth - (pageMargin * 2), 140);
    const summaryBoxX = (pageWidth - summaryBoxWidth) / 2;

    summary.slice(4).forEach(item => {
      // Background strip
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(241, 245, 249);
      doc.roundedRect(summaryBoxX, summaryY - 3.5, summaryBoxWidth, 7, 1.5, 1.5, 'FD');

      doc.setFontSize(8.5);
      if (isRTL) {
        doc.setTextColor(100, 116, 139);
        doc.text(processRTL(item.label + ':'), summaryBoxX + summaryBoxWidth - 6, summaryY + 1, { align: 'right' });

        doc.setTextColor(15, 23, 42);
        const valueText = typeof item.value === 'number'
          ? item.value.toLocaleString('en-US')
          : String(item.value);
        doc.text(processRTL(valueText), summaryBoxX + 6, summaryY + 1, { align: 'left' });
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(item.label + ':', summaryBoxX + 6, summaryY + 1, { align: 'left' });

        doc.setTextColor(15, 23, 42);
        const valueText = typeof item.value === 'number'
          ? item.value.toLocaleString('en-US')
          : String(item.value);
        doc.text(valueText, summaryBoxX + summaryBoxWidth - 6, summaryY + 1, { align: 'right' });
      }

      summaryY += 8.5;
    });
  }

  // ==========================================
  // 5. FOOTER
  // ==========================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.height - 8;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(pageMargin, footerY - 4, pageWidth - pageMargin, footerY - 4);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // #94A3B8
    doc.setFont(fontName, 'normal');

    if (isRTL) {
      const footerDateText = processRTL(`التاريخ: ${formatLocalDate()}`);
      doc.text(footerDateText, pageWidth - pageMargin, footerY, { align: 'right' });
      const pageText = `${pageCount} / ${i}`;
      doc.text(pageText, pageMargin, footerY, { align: 'left' });
    } else {
      const footerDateText = `Date: ${formatLocalDate()}`;
      doc.text(footerDateText, pageMargin, footerY, { align: 'left' });
      const pageText = `${i} / ${pageCount}`;
      doc.text(pageText, pageWidth - pageMargin, footerY, { align: 'right' });
    }

    doc.text('FlowPOS Pro', pageWidth / 2, footerY, { align: 'center' });
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
    cashierName?: string;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string },
  dateRange?: { start: string; end: string },
  customSummary?: { label: string; value: string | number }[]
): Promise<void> => {
  const columns = [
    { header: 'رقم الفاتورة', key: 'id' },
    { header: 'التاريخ', key: 'date' },
    { header: 'العميل', key: 'customerName' },
    { header: 'الإجمالي', key: 'total' },
    { header: 'الخصم', key: 'discount' },
    { header: 'صافي الربح', key: 'profit' },
    { header: 'نسبة الربح %', key: 'profitMargin' },
    { header: 'نوع الدفع', key: 'paymentType' },
    { header: 'الكاشير', key: 'cashierName' },
  ];

  const data = invoices.map(inv => ({
    id: inv.id.substring(0, 8).toUpperCase(),
    date: formatInvoiceDate(inv.createdAt),
    customerName: (inv.customerName && inv.customerName.trim() && inv.customerName.trim() !== 'عميل')
      ? inv.customerName.trim()
      : (inv.paymentType === 'debt' ? 'عميل دين' : 'عميل نقدي'),
    total: inv.total,
    discount: inv.discount || 0,
    profit: inv.profit || 0,
    profitMargin: inv.total > 0 ? `${Math.round(((inv.profit || 0) / inv.total) * 100)}%` : '0%',
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
    cashierName: inv.cashierName || '-',
  }));

  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalProfit = invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
  const totalDiscount = invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
  const avgProfitMargin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  const totals: Record<string, number | string> = {
    total: totalSales,
    discount: totalDiscount,
    profit: totalProfit,
    profitMargin: `${avgProfitMargin}%`,
  };

  const summary = customSummary || [
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
    fileName: `فواتير_${fileDate}.pdf`,
    orientation: 'landscape',
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
  storeInfo?: { name: string; phone?: string; address?: string },
  customSummary?: { label: string; value: string | number }[]
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

  const summary = customSummary || [
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
    orientation: 'landscape',
    fileName: `منتجات_${new Date().toISOString().split('T')[0]}.pdf`,
    columnStyles: {
      0: { cellWidth: 80 }, // Name
      1: { cellWidth: 35 }, // Barcode
      7: { cellWidth: 30 }, // Category
    },
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

  if (typeof doc.setLineHeightFactor === 'function') {
    doc.setLineHeightFactor(1.35);
  }

  let yPosition = 10;
  const pageWidth = 80;
  const margin = 5;
  const font = arabicFontLoaded ? ARABIC_FONT_NAME : 'helvetica';

  // Store name
  if (storeInfo?.name) {
    doc.setFontSize(12);
    doc.setFont(font, 'normal');
    const storeNameText = processRTL(storeInfo.name);
    doc.text(storeNameText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }

  // Store contact
  if (storeInfo?.phone) {
    doc.setFontSize(8);
    doc.setFont(font, 'normal');
    doc.text(storeInfo.phone, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
  }

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;

  // Invoice number and date
  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.text(`#${invoice.id}`, pageWidth - margin, yPosition, { align: 'right' });
  doc.text(formatInvoiceDate(invoice.createdAt), margin, yPosition);
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
  doc.setFont(font, 'normal');
  doc.text(processRTL('الإجمالي:'), pageWidth - margin - 25, yPosition, { align: 'right' });
  doc.text(invoice.total.toFixed(2), pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Payment type
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
  dateRange?: { start: string; end: string },
  customSummary?: { label: string; value: string | number }[]
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

  const summary = customSummary || [
    { label: 'إجمالي المصاريف', value: totalExpenses },
    { label: 'عدد المصاريف', value: expenses.length },
  ];

  const subtitle = dateRange
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${formatLocalDate()}`;

  const fileDate = dateRange
    ? `${dateRange.start}_${dateRange.end}`
    : new Date().toISOString().split('T')[0];

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
    fileName: `مصاريف_${fileDate}.pdf`,
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
  storeInfo?: { name: string; phone?: string; address?: string },
  customSummary?: { label: string; value: string | number }[]
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

  const summary = customSummary || [
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
  storeInfo?: { name: string; phone?: string; address?: string },
  customSummary?: { label: string; value: string | number }[]
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

  const summary = customSummary || [
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
