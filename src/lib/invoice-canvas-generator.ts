/**
 * Offline HTML5 Canvas Invoice & Debt Statement Generator
 * =======================================================
 * مولد صور الفواتير وكشوفات الحسابات بتقنية Canvas عالية الدقة
 * يعمل 100% بدون إنترنت بتصميم كحلي وأبيض احترافي
 */

import { formatNumber } from './utils';
import { getStoreSettings, getPrintSettings } from './print-utils';

export interface InvoiceCanvasItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  expiryDate?: string;
  batchNumber?: string;
}

export interface InvoiceCanvasData {
  id: string;
  type?: 'sale' | 'purchase' | 'maintenance' | 'return';
  title?: string;
  date: string;
  time?: string;
  customerName?: string;
  customerPhone?: string;
  supplierName?: string;
  supplierPhone?: string;
  items: InvoiceCanvasItem[];
  subtotal: number;
  discount?: number;
  taxAmount?: number;
  taxRate?: number;
  total: number;
  currencySymbol: string;
  paymentType: 'cash' | 'debt' | 'split' | string;
  downPayment?: number;
  debtRemaining?: number;
  notes?: string;
  serviceDescription?: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeLogo?: string;
  footerNote?: string;
}

export interface DebtStatementCanvasItem {
  id: string;
  date: string;
  type: string;
  total: number;
  paid: number;
  remaining: number;
  status?: string;
}

export interface DebtStatementCanvasData {
  customerName: string;
  customerPhone?: string;
  date: string;
  totalPurchases: number;
  totalPaid: number;
  totalDebt: number;
  currencySymbol: string;
  transactions: DebtStatementCanvasItem[];
  dueDate?: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeLogo?: string;
  footerNote?: string;
}

const FONT_FAMILY = 'Cairo, Tajawal, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * دالة مساعدة لرسم مستطيل بحواف دائرية متوافقة مع جميع المتصفحات
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | [number, number, number, number],
  fill?: string,
  stroke?: string,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();
  let rTopLeft = 0;
  let rTopRight = 0;
  let rBottomRight = 0;
  let rBottomLeft = 0;

  if (typeof radius === 'number') {
    rTopLeft = rTopRight = rBottomRight = rBottomLeft = radius;
  } else if (Array.isArray(radius)) {
    [rTopLeft, rTopRight, rBottomRight, rBottomLeft] = radius;
  }

  ctx.moveTo(x + rTopLeft, y);
  ctx.lineTo(x + width - rTopRight, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + rTopRight);
  ctx.lineTo(x + width, y + height - rBottomRight);
  ctx.quadraticCurveTo(x + width, y + height, x + width - rBottomRight, y + height);
  ctx.lineTo(x + rBottomLeft, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - rBottomLeft);
  ctx.lineTo(x, y + rTopLeft);
  ctx.quadraticCurveTo(x, y, x + rTopLeft, y);
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * تحميل صورة بأمان مع مهلة سريعة لتجنب حظر التوليد الأوفلاين
 */
function loadImageWithTimeout(src: string, timeoutMs = 250): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * تقصير النصوص إذا تجاوزت عرض معين
 */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

/**
 * إنشاء صورة فاتورة متكاملة عالية الدقة عبر HTML5 Canvas
 * العرض ثابت 720px والارتفاع يتمدد ديناميكياً مع عدد المواد
 */
export async function generateInvoiceCanvas(data: InvoiceCanvasData): Promise<HTMLCanvasElement> {
  const storeSettings = getStoreSettings();
  const printSettings = getPrintSettings();

  const storeName = data.storeName || storeSettings.name || 'FlowPOS Pro';
  const storePhone = data.storePhone || storeSettings.phone || '';
  const storeAddress = data.storeAddress || storeSettings.address || '';
  const storeLogoUrl = data.storeLogo || storeSettings.logo || '';
  const footerNote = data.footerNote || printSettings.footer || 'شكراً لتعاملكم معنا!';

  // حساب الارتفاع الديناميكي
  const LOGICAL_WIDTH = 720;
  const HEADER_HEIGHT = 140;
  const META_CARD_HEIGHT = 80;
  const TABLE_HEADER_HEIGHT = 38;
  const ROW_HEIGHT = 38;
  const itemCount = Math.max(data.items.length, 1);
  const TABLE_HEIGHT = TABLE_HEADER_HEIGHT + (itemCount * ROW_HEIGHT);
  const SUMMARY_HEIGHT = 160;
  const FOOTER_BAR_HEIGHT = 45;
  const PADDING = 20;

  const LOGICAL_HEIGHT = HEADER_HEIGHT + META_CARD_HEIGHT + TABLE_HEIGHT + SUMMARY_HEIGHT + FOOTER_BAR_HEIGHT + (PADDING * 3);

  // دقة عالية 2x لشاشات Retina
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_WIDTH * SCALE;
  canvas.height = LOGICAL_HEIGHT * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.scale(SCALE, SCALE);

  // خلفية كاملة بيضاء
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // 1. الترويسة العلوية الكحلية الراقية
  const headerGradient = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, HEADER_HEIGHT);
  headerGradient.addColorStop(0, '#0f2537');
  headerGradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = headerGradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, HEADER_HEIGHT);

  // خط زخرفي سفلي للترويسة
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, HEADER_HEIGHT - 3, LOGICAL_WIDTH, 3);

  // تحميل الشعار إذا توفر
  let logoImg: HTMLImageElement | null = null;
  if (storeLogoUrl) {
    logoImg = await loadImageWithTimeout(storeLogoUrl, 300);
  }

  // رسم الشعار أو أيقونة المتجر في اليمين
  const logoX = LOGICAL_WIDTH - 30 - 64;
  const logoY = 28;
  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, 64, 64, 12, '#ffffff');
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, 64, 64);
    ctx.restore();
  } else {
    // أيقونة متجر افتراضية راقية
    drawRoundedRect(ctx, logoX, logoY, 64, 64, 12, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.25)');
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 26px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(storeName.charAt(0) || '🏪', logoX + 32, logoY + 32);
  }

  // اسم المتجر ومعلومات التواصل
  const storeTextRight = logoX - 16;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, storeName, 320), storeTextRight, 30);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `13px ${FONT_FAMILY}`;
  if (storePhone) {
    ctx.fillText(`هاتف: ${storePhone}`, storeTextRight, 62);
  }
  if (storeAddress) {
    ctx.fillText(truncateText(ctx, storeAddress, 320), storeTextRight, storePhone ? 84 : 62);
  }

  // عنوان الفاتورة ورقمها في اليسار
  const invoiceTypeTitle = data.title || (
    data.type === 'purchase'
      ? 'فاتورة مشتريات'
      : data.type === 'maintenance'
        ? 'فاتورة صيانة'
        : data.type === 'return'
          ? 'فاتورة مرتجع'
          : 'فاتورة مبيعات'
  );

  // شارة العنوان
  const badgeWidth = 160;
  const badgeHeight = 36;
  const badgeX = 30;
  const badgeY = 32;
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.25)', 1);

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(invoiceTypeTitle, badgeX + (badgeWidth / 2), badgeY + (badgeHeight / 2));

  // رقم الفاتورة
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.fillText(`#${data.id}`, badgeX + (badgeWidth / 2), badgeY + badgeHeight + 18);

  // 2. بطاقة بيانات الفاتورة والعميل
  const metaY = HEADER_HEIGHT + 14;
  const metaWidth = LOGICAL_WIDTH - 60;
  drawRoundedRect(ctx, 30, metaY, metaWidth, META_CARD_HEIGHT, 10, '#f8fafc', '#e2e8f0', 1);

  // بيانات العميل (اليمين)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const clientName = data.customerName || data.supplierName || 'عميل نقدي';
  const clientPhone = data.customerPhone || data.supplierPhone || '';

  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText(data.type === 'purchase' ? 'المورد:' : 'العميل:', metaWidth + 10, metaY + 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, clientName, 260), metaWidth - 45, metaY + 26);

  if (clientPhone) {
    ctx.fillStyle = '#64748b';
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText('الهاتف:', metaWidth + 10, metaY + 54);

    ctx.fillStyle = '#334155';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.fillText(clientPhone, metaWidth - 45, metaY + 54);
  }

  // بيانات التاريخ وطريقة الدفع (اليسار)
  const metaLeftX = 45;
  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.fillText('التاريخ:', metaLeftX + 240, metaY + 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(`${data.date} ${data.time || ''}`.trim(), metaLeftX + 190, metaY + 26);

  const paymentLabel = data.paymentType === 'cash'
    ? 'نقدي 💵'
    : data.paymentType === 'split'
      ? 'مركب (نقدي + دين) 🔀'
      : data.paymentType === 'debt'
        ? 'آجل (دين) 📋'
        : data.paymentType;

  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('طريقة الدفع:', metaLeftX + 240, metaY + 54);

  ctx.fillStyle = data.paymentType === 'debt' ? '#dc2626' : '#0f172a';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(paymentLabel, metaLeftX + 165, metaY + 54);

  // 3. جدول المواد
  const tableY = metaY + META_CARD_HEIGHT + 14;
  const tableWidth = metaWidth;

  // شريط العناوين
  drawRoundedRect(ctx, 30, tableY, tableWidth, TABLE_HEADER_HEIGHT, [8, 8, 0, 0], '#0f2537');

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  // مراكز وأعمدة الجدول (RTL)
  // Col 1: # (م) -> width 45
  // Col 2: بيان المادة -> width 315
  // Col 3: السعر -> width 100
  // Col 4: الكمية -> width 75
  // Col 5: الإجمالي -> width 125
  const colIndexX = LOGICAL_WIDTH - 30 - 22;
  const colNameX = LOGICAL_WIDTH - 30 - 55;
  const colPriceX = 30 + 125 + 75 + 50;
  const colQtyX = 30 + 125 + 38;
  const colTotalX = 30 + 62;

  ctx.textAlign = 'center';
  ctx.fillText('#', colIndexX, tableY + (TABLE_HEADER_HEIGHT / 2));

  ctx.textAlign = 'right';
  ctx.fillText('بيان المادة', colNameX, tableY + (TABLE_HEADER_HEIGHT / 2));

  ctx.textAlign = 'center';
  ctx.fillText('السعر', colPriceX, tableY + (TABLE_HEADER_HEIGHT / 2));

  ctx.textAlign = 'center';
  ctx.fillText('الكمية', colQtyX, tableY + (TABLE_HEADER_HEIGHT / 2));

  ctx.textAlign = 'center';
  ctx.fillText('الإجمالي', colTotalX, tableY + (TABLE_HEADER_HEIGHT / 2));

  // أسطر المواد
  let currentY = tableY + TABLE_HEADER_HEIGHT;

  if (data.items.length === 0) {
    // سطر خدمة صيانة أو فارغ
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, currentY, tableWidth, ROW_HEIGHT);

    ctx.fillStyle = '#475569';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(data.serviceDescription || 'خدمة صيانة', LOGICAL_WIDTH / 2, currentY + (ROW_HEIGHT / 2));

    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(30, currentY + ROW_HEIGHT);
    ctx.lineTo(30 + tableWidth, currentY + ROW_HEIGHT);
    ctx.stroke();

    currentY += ROW_HEIGHT;
  } else {
    data.items.forEach((item, idx) => {
      // تظليل تبادلي ناعم
      const isEven = idx % 2 === 0;
      ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc';
      ctx.fillRect(30, currentY, tableWidth, ROW_HEIGHT);

      // رسم خط فاصل سفلي
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, currentY + ROW_HEIGHT);
      ctx.lineTo(30 + tableWidth, currentY + ROW_HEIGHT);
      ctx.stroke();

      const centerY = currentY + (ROW_HEIGHT / 2);

      // #
      ctx.fillStyle = '#64748b';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), colIndexX, centerY);

      // اسم المادة
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 13px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(truncateText(ctx, item.name, 300), colNameX, centerY);

      // السعر
      ctx.fillStyle = '#334155';
      ctx.font = `12.5px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${data.currencySymbol}${formatNumber(item.unitPrice)}`, colPriceX, centerY);

      // الكمية
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 13px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(item.quantity), colQtyX, centerY);

      // الإجمالي
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 13px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${data.currencySymbol}${formatNumber(item.total)}`, colTotalX, centerY);

      currentY += ROW_HEIGHT;
    });
  }

  // 4. التذييل والملخص المالي
  const summaryY = currentY + 16;
  const boxWidth = (tableWidth - 16) / 2;

  // أ) الصندوق المالي في اليسار
  const financeBoxX = 30;
  drawRoundedRect(ctx, financeBoxX, summaryY, boxWidth, SUMMARY_HEIGHT, 10, '#ffffff', '#e2e8f0', 1);

  // سطور الحساب
  let lineY = summaryY + 24;
  const financeRightX = financeBoxX + boxWidth - 16;
  const financeLeftX = financeBoxX + 16;

  // المجموع الفرعي
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText('المجموع الفرعي:', financeRightX, lineY);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(`${data.currencySymbol}${formatNumber(data.subtotal)}`, financeLeftX, lineY);

  // الخصم (بارز بلون أخضر زمردي مع علامة سالب)
  if (data.discount && data.discount > 0) {
    lineY += 28;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#059669';
    ctx.font = `bold 13px ${FONT_FAMILY}`;
    ctx.fillText('الخصم:', financeRightX, lineY);

    ctx.textAlign = 'left';
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.fillText(`-${data.currencySymbol}${formatNumber(data.discount)}`, financeLeftX, lineY);
  }

  // الضريبة (إن وجدت)
  if (data.taxAmount && data.taxAmount > 0) {
    lineY += 28;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.fillText(`الضريبة (${data.taxRate || 0}%):`, financeRightX, lineY);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.fillText(`+${data.currencySymbol}${formatNumber(data.taxAmount)}`, financeLeftX, lineY);
  }

  // شريط الإجمالي النهائي الكحلي العريض في الأسفل
  const totalRibbonHeight = 44;
  const totalRibbonY = summaryY + SUMMARY_HEIGHT - totalRibbonHeight;
  drawRoundedRect(ctx, financeBoxX, totalRibbonY, boxWidth, totalRibbonHeight, [0, 0, 10, 10], '#0f2537');

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('الإجمالي النهائي:', financeRightX, totalRibbonY + (totalRibbonHeight / 2));

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 20px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${data.currencySymbol}${formatNumber(data.total)}`, financeLeftX, totalRibbonY + (totalRibbonHeight / 2));

  // ب) صندوق تفاصيل الدفع وبيانات المتجر في اليمين
  const detailsBoxX = 30 + boxWidth + 16;
  drawRoundedRect(ctx, detailsBoxX, summaryY, boxWidth, SUMMARY_HEIGHT, 10, '#f8fafc', '#e2e8f0', 1);

  let detailsY = summaryY + 22;
  const detailsRightX = detailsBoxX + boxWidth - 16;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // حالة الدفع
  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('حالة السداد:', detailsRightX, detailsY);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(paymentLabel, detailsRightX - 70, detailsY);

  // إذا كان بيع مركب
  if (data.paymentType === 'split' && data.downPayment !== undefined) {
    detailsY += 24;
    ctx.fillStyle = '#16a34a';
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText(`المدفوع نقداً: ${data.currencySymbol}${formatNumber(data.downPayment)}`, detailsRightX, detailsY);

    detailsY += 20;
    ctx.fillStyle = '#dc2626';
    ctx.font = `bold 12px ${FONT_FAMILY}`;
    ctx.fillText(`المتبقي كدين: ${data.currencySymbol}${formatNumber(data.debtRemaining || 0)}`, detailsRightX, detailsY);
  } else if (data.paymentType === 'debt') {
    detailsY += 24;
    ctx.fillStyle = '#dc2626';
    ctx.font = `bold 12px ${FONT_FAMILY}`;
    ctx.fillText(`مستحق كدين: ${data.currencySymbol}${formatNumber(data.total)}`, detailsRightX, detailsY);
  }

  // هاتف المتجر
  if (storePhone) {
    detailsY += 26;
    ctx.fillStyle = '#475569';
    ctx.font = `12.5px ${FONT_FAMILY}`;
    ctx.fillText(`📞 للتواصل: ${storePhone}`, detailsRightX, detailsY);
  }

  // عبارة شكر
  const thankYouY = summaryY + SUMMARY_HEIGHT - 22;
  ctx.fillStyle = '#0284c7';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(footerNote, detailsBoxX + (boxWidth / 2), thankYouY);

  // 5. شريط النظام والعلامة المائية السفلية
  const bottomBarY = summaryY + SUMMARY_HEIGHT + 14;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, bottomBarY);
  ctx.lineTo(LOGICAL_WIDTH - 30, bottomBarY);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = `11px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FlowPOS Pro • نظام إدارة نقاط البيع والمبيعات', LOGICAL_WIDTH / 2, bottomBarY + 16);

  return canvas;
}

/**
 * تحويل الكانفاس إلى كائن Blob بصيغة PNG
 */
export async function generateInvoiceBlob(data: InvoiceCanvasData): Promise<Blob> {
  const canvas = await generateInvoiceCanvas(data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create Blob from canvas'));
    }, 'image/png');
  });
}

/**
 * توليد كشف حساب عميل / تذكير دين كصورة Canvas راقية
 */
export async function generateDebtStatementCanvas(data: DebtStatementCanvasData): Promise<HTMLCanvasElement> {
  const storeSettings = getStoreSettings();
  const printSettings = getPrintSettings();

  const storeName = data.storeName || storeSettings.name || 'FlowPOS Pro';
  const storePhone = data.storePhone || storeSettings.phone || '';
  const storeAddress = data.storeAddress || storeSettings.address || '';
  const storeLogoUrl = data.storeLogo || storeSettings.logo || '';
  const footerNote = data.footerNote || printSettings.footer || 'نرجو التواصل لتسوية المبلغ المطلوب. شاكرين تعاونكم معنا 🙏';

  const LOGICAL_WIDTH = 720;
  const HEADER_HEIGHT = 135;
  const META_CARD_HEIGHT = 75;
  const SUMMARY_CARDS_HEIGHT = 80;
  const TABLE_HEADER_HEIGHT = 38;
  const ROW_HEIGHT = 36;
  const txCount = Math.max(data.transactions.length, 1);
  const TABLE_HEIGHT = TABLE_HEADER_HEIGHT + (txCount * ROW_HEIGHT);
  const FOOTER_SECTION_HEIGHT = 100;
  const PADDING = 20;

  const LOGICAL_HEIGHT = HEADER_HEIGHT + META_CARD_HEIGHT + SUMMARY_CARDS_HEIGHT + TABLE_HEIGHT + FOOTER_SECTION_HEIGHT + (PADDING * 3);

  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_WIDTH * SCALE;
  canvas.height = LOGICAL_HEIGHT * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.scale(SCALE, SCALE);

  // خلفية بيضاء
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // 1. الترويسة العلوية الكحلية
  const headerGradient = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, HEADER_HEIGHT);
  headerGradient.addColorStop(0, '#0f2537');
  headerGradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = headerGradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, HEADER_HEIGHT);

  // خط كحلي فاتح زخرفي
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, HEADER_HEIGHT - 3, LOGICAL_WIDTH, 3);

  // الشعار
  let logoImg: HTMLImageElement | null = null;
  if (storeLogoUrl) {
    logoImg = await loadImageWithTimeout(storeLogoUrl, 300);
  }

  const logoX = LOGICAL_WIDTH - 30 - 64;
  const logoY = 26;
  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, 64, 64, 12, '#ffffff');
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, 64, 64);
    ctx.restore();
  } else {
    drawRoundedRect(ctx, logoX, logoY, 64, 64, 12, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.25)');
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 26px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(storeName.charAt(0) || '🏪', logoX + 32, logoY + 32);
  }

  // اسم المتجر
  const storeTextRight = logoX - 16;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, storeName, 320), storeTextRight, 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `13px ${FONT_FAMILY}`;
  if (storePhone) {
    ctx.fillText(`هاتف: ${storePhone}`, storeTextRight, 58);
  }
  if (storeAddress) {
    ctx.fillText(truncateText(ctx, storeAddress, 320), storeTextRight, storePhone ? 80 : 58);
  }

  // عنوان المستند في اليسار
  const badgeWidth = 170;
  const badgeHeight = 36;
  const badgeX = 30;
  const badgeY = 32;
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.25)', 1);

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText('كشف حساب / ديون', badgeX + (badgeWidth / 2), badgeY + (badgeHeight / 2));

  // 2. بطاقة معلومات العميل وتاريخ الإصدار
  const metaY = HEADER_HEIGHT + 14;
  const metaWidth = LOGICAL_WIDTH - 60;
  drawRoundedRect(ctx, 30, metaY, metaWidth, META_CARD_HEIGHT, 10, '#f8fafc', '#e2e8f0', 1);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('اسم العميل:', metaWidth + 10, metaY + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 15px ${FONT_FAMILY}`;
  ctx.fillText(data.customerName, metaWidth - 55, metaY + 24);

  if (data.customerPhone) {
    ctx.fillStyle = '#64748b';
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText('رقم الهاتف:', metaWidth + 10, metaY + 50);

    ctx.fillStyle = '#334155';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.fillText(data.customerPhone, metaWidth - 55, metaY + 50);
  }

  // اليسار: تاريخ الإصدار وعدد الحركات
  const metaLeftX = 45;
  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('تاريخ الإصدار:', metaLeftX + 220, metaY + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(data.date, metaLeftX + 130, metaY + 24);

  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('عدد العمليات:', metaLeftX + 220, metaY + 50);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(String(data.transactions.length), metaLeftX + 130, metaY + 50);

  // 3. بطاقات الملخص المالي الثلاثية
  const summaryCardsY = metaY + META_CARD_HEIGHT + 12;
  const cardW = (metaWidth - 20) / 3;

  // بطاقة 1: إجمالي التعاملات
  const card1X = 30 + (cardW * 2) + 20;
  drawRoundedRect(ctx, card1X, summaryCardsY, cardW, SUMMARY_CARDS_HEIGHT, 8, '#f8fafc', '#cbd5e1', 1);
  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText('إجمالي التعاملات', card1X + (cardW / 2), summaryCardsY + 24);
  ctx.fillStyle = '#0284c7';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillText(`${data.currencySymbol}${formatNumber(data.totalPurchases)}`, card1X + (cardW / 2), summaryCardsY + 52);

  // بطاقة 2: إجمالي المسدد
  const card2X = 30 + cardW + 10;
  drawRoundedRect(ctx, card2X, summaryCardsY, cardW, SUMMARY_CARDS_HEIGHT, 8, '#f8fafc', '#cbd5e1', 1);
  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('إجمالي المسدد', card2X + (cardW / 2), summaryCardsY + 24);
  ctx.fillStyle = '#16a34a';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillText(`${data.currencySymbol}${formatNumber(data.totalPaid)}`, card2X + (cardW / 2), summaryCardsY + 52);

  // بطاقة 3: الرصيد المتبقي (الديون)
  const card3X = 30;
  drawRoundedRect(ctx, card3X, summaryCardsY, cardW, SUMMARY_CARDS_HEIGHT, 8, data.totalDebt > 0 ? '#fef2f2' : '#f0fdf4', data.totalDebt > 0 ? '#fecaca' : '#bbf7d0', 1);
  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText('الرصيد المتبقي (الديون)', card3X + (cardW / 2), summaryCardsY + 24);
  ctx.fillStyle = data.totalDebt > 0 ? '#dc2626' : '#16a34a';
  ctx.font = `bold 19px ${FONT_FAMILY}`;
  ctx.fillText(`${data.currencySymbol}${formatNumber(data.totalDebt)}`, card3X + (cardW / 2), summaryCardsY + 52);

  // 4. جدول حركات الحساب
  const tableY = summaryCardsY + SUMMARY_CARDS_HEIGHT + 14;
  drawRoundedRect(ctx, 30, tableY, metaWidth, TABLE_HEADER_HEIGHT, [8, 8, 0, 0], '#0f2537');

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // الأعمدة: (#، رقم المستند، التاريخ، النوع، الإجمالي، المسدد، المتبقي)
  const col1 = LOGICAL_WIDTH - 30 - 25; // #
  const col2 = LOGICAL_WIDTH - 30 - 100; // المستند
  const col3 = LOGICAL_WIDTH - 30 - 220; // التاريخ
  const col4 = LOGICAL_WIDTH - 30 - 325; // النوع
  const col5 = 30 + 175; // الإجمالي
  const col6 = 30 + 105; // المسدد
  const col7 = 30 + 38; // المتبقي

  ctx.fillText('#', col1, tableY + (TABLE_HEADER_HEIGHT / 2));
  ctx.fillText('رقم المستند', col2, tableY + (TABLE_HEADER_HEIGHT / 2));
  ctx.fillText('التاريخ', col3, tableY + (TABLE_HEADER_HEIGHT / 2));
  ctx.fillText('النوع', col4, tableY + (TABLE_HEADER_HEIGHT / 2));
  ctx.fillText('الإجمالي', col5, tableY + (TABLE_HEADER_HEIGHT / 2));
  ctx.fillText('المدفوع', col6, tableY + (TABLE_HEADER_HEIGHT / 2));
  ctx.fillText('المتبقي', col7, tableY + (TABLE_HEADER_HEIGHT / 2));

  let currentY = tableY + TABLE_HEADER_HEIGHT;

  if (data.transactions.length === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, currentY, metaWidth, ROW_HEIGHT);
    ctx.fillStyle = '#64748b';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.fillText('لا توجد حركات مسجلة لهذا العميل', LOGICAL_WIDTH / 2, currentY + (ROW_HEIGHT / 2));
    currentY += ROW_HEIGHT;
  } else {
    data.transactions.forEach((tx, idx) => {
      const isEven = idx % 2 === 0;
      ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc';
      ctx.fillRect(30, currentY, metaWidth, ROW_HEIGHT);

      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(30, currentY + ROW_HEIGHT);
      ctx.lineTo(30 + metaWidth, currentY + ROW_HEIGHT);
      ctx.stroke();

      const centerY = currentY + (ROW_HEIGHT / 2);

      ctx.fillStyle = '#64748b';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.fillText(String(idx + 1), col1, centerY);

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 12.5px ${FONT_FAMILY}`;
      ctx.fillText(tx.id, col2, centerY);

      ctx.fillStyle = '#475569';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.fillText(tx.date, col3, centerY);

      ctx.fillStyle = '#0f172a';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.fillText(tx.type, col4, centerY);

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillText(`${data.currencySymbol}${formatNumber(tx.total)}`, col5, centerY);

      ctx.fillStyle = '#16a34a';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.fillText(`${data.currencySymbol}${formatNumber(tx.paid)}`, col6, centerY);

      ctx.fillStyle = tx.remaining > 0 ? '#dc2626' : '#16a34a';
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillText(`${data.currencySymbol}${formatNumber(tx.remaining)}`, col7, centerY);

      currentY += ROW_HEIGHT;
    });
  }

  // 5. التذييل وملاحظة التواصل
  const footerY = currentY + 16;
  drawRoundedRect(ctx, 30, footerY, metaWidth, 60, 10, '#f8fafc', '#e2e8f0', 1);

  ctx.fillStyle = '#0f2537';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerNote, LOGICAL_WIDTH / 2, footerY + 22);

  ctx.fillStyle = '#64748b';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillText(storePhone ? `📞 للتواصل والاستفسار: ${storePhone}` : 'شكراً لتعاملكم معنا!', LOGICAL_WIDTH / 2, footerY + 44);

  // العلامة المائية
  const bottomBarY = footerY + 70;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `11px ${FONT_FAMILY}`;
  ctx.fillText('FlowPOS Pro • نظام إدارة نقاط البيع والمبيعات', LOGICAL_WIDTH / 2, bottomBarY + 12);

  return canvas;
}

/**
 * تحويل كشف الحساب إلى كائن Blob بصيغة PNG
 */
export async function generateDebtStatementBlob(data: DebtStatementCanvasData): Promise<Blob> {
  const canvas = await generateDebtStatementCanvas(data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create Blob from canvas'));
    }, 'image/png');
  });
}
