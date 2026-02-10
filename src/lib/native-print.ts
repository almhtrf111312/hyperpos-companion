/**
 * Native Print Utility for Capacitor/Android
 * ============================================
 * حل مشكلة الطباعة في WebView الأندرويد
 * يستخدم تحويل HTML إلى صورة/PDF ثم المشاركة
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { formatNumber } from './utils';

const SETTINGS_KEY = 'hyperpos_settings_v1';

export interface StoreSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  logo: string;
}

export interface PrintSettings {
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  footer: string;
}

/**
 * Get store settings from localStorage
 */
export function getStoreSettings(): StoreSettings {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      name: settings.storeSettings?.name || 'HyperPOS Store',
      phone: settings.storeSettings?.phone || '',
      email: settings.storeSettings?.email || '',
      address: settings.storeSettings?.address || '',
      logo: settings.storeSettings?.logo || '',
    };
  } catch {
    return { name: 'HyperPOS Store', phone: '', email: '', address: '', logo: '' };
  }
}

/**
 * Get print settings from localStorage
 */
export function getPrintSettings(): PrintSettings {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      showLogo: settings.printSettings?.showLogo ?? true,
      showAddress: settings.printSettings?.showAddress ?? true,
      showPhone: settings.printSettings?.showPhone ?? true,
      footer: settings.printSettings?.footer || 'شكراً لتسوقكم معنا!',
    };
  } catch {
    return { showLogo: true, showAddress: true, showPhone: true, footer: 'شكراً لتسوقكم معنا!' };
  }
}

/**
 * إنشاء محتوى HTML للفاتورة
 */
interface PrintableInvoice {
  id: string;
  date: string;
  time?: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount?: number;
  discountAmount?: number;
  tax?: number;
  total: number;
  currencySymbol: string;
  paymentType: 'cash' | 'debt';
}

export function generateReceiptHTML(invoice: PrintableInvoice): string {
  const store = getStoreSettings();
  const printSettings = getPrintSettings();

  const itemsHTML = invoice.items.map(item => `
    <tr>
      <td style="text-align: right; padding: 4px 0; font-size: 12px;">${item.name}</td>
      <td style="text-align: center; padding: 4px 0; font-size: 12px;">${item.quantity}</td>
      <td style="text-align: left; padding: 4px 0; font-size: 12px;">${invoice.currencySymbol}${formatNumber(item.total)}</td>
    </tr>
  `).join('');

  const logoHTML = printSettings.showLogo && store.logo
    ? `<img src="${store.logo}" alt="Logo" style="max-width: 80px; max-height: 80px; margin-bottom: 8px;" />`
    : '';

  const addressHTML = printSettings.showAddress && store.address
    ? `<p style="margin: 2px 0; font-size: 11px; color: #666;">${store.address}</p>`
    : '';

  const phoneHTML = printSettings.showPhone && store.phone
    ? `<p style="margin: 2px 0; font-size: 11px; color: #666;">📞 ${store.phone}</p>`
    : '';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=80mm, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      width: 80mm;
      padding: 8px;
      background: white;
      color: #000;
    }
    .receipt {
      width: 100%;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .store-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .invoice-info {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
    }
    .customer-info {
      font-size: 12px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .items-table th {
      font-size: 11px;
      font-weight: bold;
      padding: 4px 0;
      border-bottom: 1px solid #000;
    }
    .totals {
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin: 4px 0;
    }
    .grand-total {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 8px;
      margin-top: 8px;
    }
    .footer {
      text-align: center;
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      font-size: 11px;
      color: #666;
    }
    .payment-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      margin-top: 4px;
    }
    .cash { background: #d4edda; color: #155724; }
    .debt { background: #fff3cd; color: #856404; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      ${logoHTML}
      <div class="store-name">${store.name}</div>
      ${addressHTML}
      ${phoneHTML}
    </div>

    <div class="invoice-info">
      <span>فاتورة: ${invoice.id}</span>
      <span>${invoice.date}${invoice.time ? ' ' + invoice.time : ''}</span>
    </div>

    <div class="customer-info">
      <strong>العميل:</strong> ${invoice.customerName || 'عميل نقدي'}
      ${invoice.customerPhone ? `<br/>الهاتف: ${invoice.customerPhone}` : ''}
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align: right;">الصنف</th>
          <th style="text-align: center;">الكمية</th>
          <th style="text-align: left;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="totals">
      ${invoice.items.length > 1 ? `
        <div class="total-row">
          <span>المجموع الفرعي:</span>
          <span>${invoice.currencySymbol}${formatNumber(invoice.subtotal)}</span>
        </div>
      ` : ''}
      
      ${invoice.discountAmount && invoice.discountAmount > 0 ? `
        <div class="total-row">
          <span>الخصم${invoice.discount ? ` (${invoice.discount}%)` : ''}:</span>
          <span>-${invoice.currencySymbol}${formatNumber(invoice.discountAmount!)}</span>
        </div>
      ` : ''}

      ${invoice.tax && invoice.tax > 0 ? `
        <div class="total-row">
          <span>الضريبة:</span>
          <span>${invoice.currencySymbol}${formatNumber(invoice.tax!)}</span>
        </div>
      ` : ''}

      <div class="total-row grand-total">
        <span>الإجمالي:</span>
        <span>${invoice.currencySymbol}${formatNumber(invoice.total)}</span>
      </div>

      <div style="text-align: center; margin-top: 8px;">
        <span class="payment-badge ${invoice.paymentType}">
          ${invoice.paymentType === 'cash' ? '💵 نقدي' : '📋 آجل'}
        </span>
      </div>
    </div>

    <div class="footer">
      ${printSettings.footer}
      <br/>
      <small style="color: #999;">FlowPOS Pro</small>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export interface ClientInvoiceData {
  id: string;
  date: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  currencySymbol: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeLogo?: string;
  footer?: string;
  notes?: string;
  paymentType?: string;
}

export const generateClientInvoiceHTML = (invoice: ClientInvoiceData): string => {
  const {
    id,
    date,
    customerName,
    items,
    subtotal,
    discount,
    total,
    currencySymbol,
    storeName,
    storePhone,
    storeAddress,
    storeLogo,
    footer,
    notes
  } = invoice;

  const itemsHtml = items.map((item, index) => `
    <tr class="${index % 2 === 0 ? 'bg-gray-50' : ''}">
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${currencySymbol}${formatNumber(item.unitPrice)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold;">${currencySymbol}${formatNumber(item.total)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة مبيعات #${id}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; margin: 0; color: #333; line-height: 1.5; }
        .invoice-container { max-width: 800px; margin: 20px auto; background: #fff; padding: 40px; box-shadow: 0 0 20px rgba(0,0,0,0.05); border-radius: 8px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; }
        .company-info { text-align: right; }
        .company-name { font-size: 28px; font-weight: bold; color: #1a1a1a; margin: 0 0 5px; }
        .company-details { font-size: 14px; color: #666; margin: 2px 0; }
        .logo { max-width: 120px; max-height: 80px; object-fit: contain; }
        .invoice-title { text-align: left; }
        .invoice-heading { font-size: 32px; font-weight: bold; color: #e0e0e0; text-transform: uppercase; margin: 0; letter-spacing: 2px; }
        .invoice-meta { margin-top: 10px; text-align: left; font-size: 14px; }
        .invoice-meta div { margin-bottom: 4px; }
        .customer-section { margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 6px; border: 1px solid #eee; }
        .section-title { font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .customer-name { font-size: 18px; font-weight: bold; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #1a1a1a; color: #fff; padding: 12px 10px; text-align: center; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        th:first-child { text-align: right; border-top-right-radius: 4px; }
        th:last-child { text-align: left; border-top-left-radius: 4px; }
        td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px; }
        .summary-section { display: flex; justify-content: flex-end; }
        .summary-table { width: 300px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
        .summary-row.total { font-weight: bold; font-size: 20px; color: #1a1a1a; border-top: 2px solid #1a1a1a; border-bottom: none; padding-top: 15px; margin-top: 5px; }
        .notes-section { margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ddd; font-size: 13px; color: #666; }
        .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #aaa; padding-top: 20px; border-top: 1px solid #eee; }
        .bg-gray-50 { background-color: #f9f9f9; }
        
        @media print {
          body { background: #fff; }
          .invoice-container { box-shadow: none; margin: 0; padding: 20px; width: 100%; max-width: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-info">
            ${storeLogo ? `<img src="${storeLogo}" alt="Logo" class="logo" />` : ''}
            <h1 class="company-name">${storeName}</h1>
            ${storeAddress ? `<div class="company-details">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="company-details">${storePhone}</div>` : ''}
          </div>
          <div class="invoice-title">
            <h2 class="invoice-heading">فاتورة</h2>
            <div class="invoice-meta">
              <div><strong>رقم الفاتورة:</strong> ${id.slice(-6).toUpperCase()}</div>
              <div><strong>التاريخ:</strong> ${date}</div>
            </div>
          </div>
        </div>

        <div class="customer-section">
          <div class="section-title">فاتورة إلى</div>
          <h3 class="customer-name">${customerName || 'عميل نقدي'}</h3>
        </div>

        <table>
          <thead>
            <tr>
              <th>المنتج / الخدمة</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary-section">
          <div class="summary-table">
            <div class="summary-row">
              <span>المجموع الفرعي:</span>
              <span>${currencySymbol}${formatNumber(subtotal)}</span>
            </div>
            ${discount > 0 ? `
            <div class="summary-row" style="color: #dc2626;">
              <span>الخصم</span>
              <span>-${currencySymbol}${formatNumber(discount)}</span>
            </div>
            ` : ''}
            <div class="summary-row total">
              <span>الإجمالي:</span>
              <span>${currencySymbol}${formatNumber(total)}</span>
            </div>
          </div>
        </div>

        ${notes ? `
        <div class="notes-section">
          <strong>ملاحظات:</strong><br/>
          ${notes}
        </div>
        ` : ''}

        <div class="footer">
          <p>${footer || 'شكراً لتعاملكم معنا!'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * طباعة محتوى HTML
 * على الأندرويد: يحفظ كـ HTML ويشاركه للطباعة
 * على المتصفح: يستخدم iframe + window.print()
 */
export async function printHTML(htmlContent: string): Promise<boolean> {
  // على الأندرويد: استخدم الطريقة الأصلية
  if (Capacitor.isNativePlatform()) {
    return printOnNative(htmlContent);
  }

  // على المتصفح: استخدم iframe
  return printOnWeb(htmlContent);
}

/**
 * طباعة على الأندرويد عبر حفظ HTML ومشاركته
 */
async function printOnNative(htmlContent: string): Promise<boolean> {
  try {
    const fileName = `receipt_${Date.now()}.html`;

    // حفظ الملف مؤقتاً
    const result = await Filesystem.writeFile({
      path: fileName,
      data: htmlContent,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    // مشاركة الملف للطباعة
    await Share.share({
      title: 'طباعة الفاتورة',
      text: 'فاتورة جاهزة للطباعة',
      url: result.uri,
      dialogTitle: 'طباعة عبر',
    });

    // حذف الملف بعد المشاركة
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
      } catch {
        // تجاهل أخطاء الحذف
      }
    }, 5000);

    return true;
  } catch (error) {
    console.error('[NativePrint] Native print failed:', error);

    // Fallback: حاول فتح الطباعة مباشرة
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
        return true;
      }
    } catch {
      // تجاهل
    }

    return false;
  }
}

/**
 * طباعة على المتصفح عبر iframe
 */
function printOnWeb(htmlContent: string): boolean {
  try {
    // إنشاء iframe مخفي للطباعة
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '80mm';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // انتظار تحميل المحتوى ثم الطباعة
      const attemptPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print error:', e);
        }

        // إزالة الـ iframe بعد الطباعة
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            // تجاهل
          }
        }, 1000);
      };

      // انتظار تحميل المحتوى
      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => {
          setTimeout(attemptPrint, 250);
        };

        // fallback
        setTimeout(attemptPrint, 500);
      } else {
        setTimeout(attemptPrint, 500);
      }
    }

    return true;
  } catch (error) {
    console.error('[NativePrint] Web print failed:', error);
    return false;
  }
}

/**
 * طباعة فاتورة مباشرة
 */
export async function printInvoice(invoice: PrintableInvoice): Promise<boolean> {
  const html = generateReceiptHTML(invoice);
  return printHTML(html);
}

/**
 * Re-export للتوافق مع الكود القديم
 */
export { getStoreSettings as getStoreSettingsLegacy, getPrintSettings as getPrintSettingsLegacy };
