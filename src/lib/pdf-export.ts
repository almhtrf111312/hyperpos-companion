// Professional PDF Export using jsPDF
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  columns: { header: string; key: string }[];
  data: Record<string, unknown>[];
  totals?: Record<string, number | string>;
  fileName?: string;
}

// Helper to reverse Arabic text for PDF (since jsPDF doesn't support RTL natively)
const reverseArabicText = (text: string): string => {
  // Split by spaces to preserve word order in Arabic
  return text.split('').reverse().join('');
};

// Check if text contains Arabic characters
const containsArabic = (text: string): boolean => {
  return /[\u0600-\u06FF]/.test(text);
};

// Process text for RTL display
const processRTL = (text: string): string => {
  if (containsArabic(text)) {
    return reverseArabicText(text);
  }
  return text;
};

// Create and download PDF file
export const exportToPDF = (options: PDFExportOptions): void => {
  const {
    title,
    subtitle,
    storeName,
    storePhone,
    storeAddress,
    columns,
    data,
    totals,
    fileName = 'export.pdf',
  } = options;
  
  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Set font for Arabic support (using built-in fonts)
  doc.setFont('helvetica');
  
  let yPosition = 15;
  
  // Add store name (header)
  if (storeName) {
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    const storeNameText = processRTL(storeName);
    doc.text(storeNameText, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }
  
  // Add store contact info
  if (storePhone || storeAddress) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    if (storePhone) {
      doc.text(storePhone, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    if (storeAddress) {
      const addressText = processRTL(storeAddress);
      doc.text(addressText, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
  }
  
  yPosition += 5;
  
  // Add horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, doc.internal.pageSize.width - 15, yPosition);
  yPosition += 10;
  
  // Add title
  doc.setFontSize(16);
  doc.setTextColor(44, 62, 80);
  const titleText = processRTL(title);
  doc.text(titleText, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Add subtitle
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const subtitleText = processRTL(subtitle);
    doc.text(subtitleText, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
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
  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    // Style for totals row (last row if totals provided)
    didParseCell: (data) => {
      if (totals && data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [230, 230, 230];
      }
    },
  });
  
  // Add footer with date and page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    
    const dateText = new Date().toLocaleDateString('ar-SA');
    doc.text(dateText, 15, doc.internal.pageSize.height - 10);
    
    const pageText = `${i} / ${pageCount}`;
    doc.text(pageText, doc.internal.pageSize.width - 15, doc.internal.pageSize.height - 10, { align: 'right' });
  }
  
  // Save the PDF
  doc.save(fileName);
};

// Export invoices to PDF
export const exportInvoicesToPDF = (
  invoices: Array<{
    id: string;
    customerName: string;
    total: number;
    profit?: number;
    paymentType: string;
    type: string;
    createdAt: string;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string },
  dateRange?: { start: string; end: string }
): void => {
  const columns = [
    { header: 'رقم الفاتورة', key: 'id' },
    { header: 'العميل', key: 'customerName' },
    { header: 'النوع', key: 'type' },
    { header: 'الدفع', key: 'paymentType' },
    { header: 'الإجمالي', key: 'total' },
    { header: 'الربح', key: 'profit' },
  ];
  
  const data = invoices.map(inv => ({
    id: inv.id,
    customerName: inv.customerName,
    type: inv.type === 'maintenance' ? 'صيانة' : 'مبيعات',
    paymentType: inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
    total: inv.total,
    profit: inv.profit || 0,
  }));
  
  const totals: Record<string, number | string> = {
    total: invoices.reduce((sum, inv) => sum + inv.total, 0),
    profit: invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0),
  };
  
  const subtitle = dateRange 
    ? `من ${dateRange.start} إلى ${dateRange.end}`
    : `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`;
  
  exportToPDF({
    title: 'تقرير الفواتير',
    subtitle,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data,
    totals,
    fileName: `فواتير_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};

// Export products to PDF
export const exportProductsToPDF = (
  products: Array<{
    name: string;
    barcode: string;
    category: string;
    salePrice: number;
    quantity: number;
  }>,
  storeInfo?: { name: string; phone?: string; address?: string }
): void => {
  const columns = [
    { header: 'المنتج', key: 'name' },
    { header: 'الباركود', key: 'barcode' },
    { header: 'التصنيف', key: 'category' },
    { header: 'السعر', key: 'salePrice' },
    { header: 'الكمية', key: 'quantity' },
  ];
  
  const totals: Record<string, number | string> = {
    quantity: products.reduce((sum, p) => sum + p.quantity, 0),
  };
  
  exportToPDF({
    title: 'قائمة المنتجات',
    subtitle: `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
    storeName: storeInfo?.name,
    storePhone: storeInfo?.phone,
    storeAddress: storeInfo?.address,
    columns,
    data: products,
    totals,
    fileName: `منتجات_${new Date().toISOString().split('T')[0]}.pdf`,
  });
};

// Export single invoice to PDF (receipt style)
export const exportInvoiceReceiptToPDF = (
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
): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // Receipt size
  });
  
  let yPosition = 10;
  const pageWidth = 80;
  const margin = 5;
  
  // Store name
  if (storeInfo?.name) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const storeNameText = processRTL(storeInfo.name);
    doc.text(storeNameText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }
  
  // Store contact
  if (storeInfo?.phone) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
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
  doc.setFont('helvetica', 'bold');
  doc.text(processRTL('الإجمالي:'), pageWidth - margin - 25, yPosition, { align: 'right' });
  doc.text(invoice.total.toFixed(2), pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  
  // Payment type
  doc.setFont('helvetica', 'normal');
  const paymentText = processRTL(invoice.paymentType === 'cash' ? 'نقدي' : 'آجل');
  doc.text(paymentText, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Thank you message
  doc.setFontSize(10);
  const thanksText = processRTL('شكراً لزيارتكم');
  doc.text(thanksText, pageWidth / 2, yPosition, { align: 'center' });
  
  // Save
  doc.save(`فاتورة_${invoice.id}.pdf`);
};
