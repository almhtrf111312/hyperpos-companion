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
  autoPrint?: boolean;
  showStoreName?: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail?: boolean;
  showInvoiceNumber?: boolean;
  showDateTime?: boolean;
  showCashierName?: boolean;
  welcomeMessage?: string;
  footer: string;
  showAlternativeCurrencies?: boolean;
  paperSize?: string;
  copies?: string | number;
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
    const ps = settings.printSettings || {};
    return {
      autoPrint: ps.autoPrint ?? true,
      showStoreName: ps.showStoreName ?? true,
      showLogo: ps.showLogo ?? true,
      showAddress: ps.showAddress ?? true,
      showPhone: ps.showPhone ?? true,
      showEmail: ps.showEmail ?? true,
      showInvoiceNumber: ps.showInvoiceNumber ?? true,
      showDateTime: ps.showDateTime ?? true,
      showCashierName: ps.showCashierName ?? true,
      welcomeMessage: ps.welcomeMessage || '',
      footer: ps.footer || 'شكراً لتسوقكم معنا!',
      showAlternativeCurrencies: ps.showAlternativeCurrencies ?? false,
      paperSize: ps.paperSize || '80mm',
      copies: ps.copies || '1',
    };
  } catch {
    return {
      autoPrint: true,
      showStoreName: true,
      showLogo: true,
      showAddress: true,
      showPhone: true,
      showEmail: true,
      showInvoiceNumber: true,
      showDateTime: true,
      showCashierName: true,
      welcomeMessage: '',
      footer: 'شكراً لتسوقكم معنا!',
      showAlternativeCurrencies: false,
      paperSize: '80mm',
      copies: '1',
    };
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
  cashierName?: string;
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

  const logoHTML = printSettings.showLogo !== false && store.logo
    ? `<img src="${store.logo}" alt="Logo" style="max-width: 80px; max-height: 80px; margin-bottom: 8px;" />`
    : '';

  const storeNameHTML = printSettings.showStoreName !== false && store.name
    ? `<div class="store-name">${store.name}</div>`
    : '';

  const addressHTML = printSettings.showAddress !== false && store.address
    ? `<p style="margin: 2px 0; font-size: 11px; color: #666;">${store.address}</p>`
    : '';

  const phoneHTML = printSettings.showPhone !== false && store.phone
    ? `<p style="margin: 2px 0; font-size: 11px; color: #666;">📞 ${store.phone}</p>`
    : '';

  const emailHTML = printSettings.showEmail !== false && store.email
    ? `<p style="margin: 2px 0; font-size: 11px; color: #666;">✉️ ${store.email}</p>`
    : '';

  const welcomeHTML = printSettings.welcomeMessage
    ? `<p style="margin: 6px 0 2px; font-size: 12px; color: #334155; font-weight: 500;">${printSettings.welcomeMessage}</p>`
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
      ${storeNameHTML}
      ${addressHTML}
      ${phoneHTML}
      ${emailHTML}
      ${welcomeHTML}
    </div>

    ${(printSettings.showInvoiceNumber !== false || printSettings.showDateTime !== false) ? `
      <div class="invoice-info">
        ${printSettings.showInvoiceNumber !== false ? `<span>فاتورة: ${invoice.id}</span>` : '<span></span>'}
        ${printSettings.showDateTime !== false ? `<span>${invoice.date}${invoice.time ? ' ' + invoice.time : ''}</span>` : '<span></span>'}
      </div>
    ` : ''}

    <div class="customer-info">
      <strong>العميل:</strong> ${invoice.customerName || 'عميل نقدي'}
      ${invoice.customerPhone ? `<br/>الهاتف: ${invoice.customerPhone}` : ''}
      ${(printSettings.showCashierName !== false && invoice.cashierName) ? `<br/><span>الكاشير: ${invoice.cashierName}</span>` : ''}
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

      ${(() => {
        if (!printSettings.showAlternativeCurrencies) return '';
        try {
          const fullSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
          const rates = fullSettings.exchangeRates || {};
          const sypRate = Number(rates.SYP || 0);
          const tryRate = Number(rates.TRY || 0);
          const parts: string[] = [];
          if (sypRate > 0) parts.push(`المعادل بالسوري: ${formatNumber(invoice.total * sypRate)} ل.س`);
          if (tryRate > 0) parts.push(`المعادل بالتركي: ${formatNumber(invoice.total * tryRate)} ₺`);
          if (parts.length === 0) return '';
          return `
            <div style="margin-top: 6px; padding: 6px; background: #f8fafc; border-radius: 6px; font-size: 11px; text-align: center; border: 1px dashed #cbd5e1; color: #334155;">
              <div style="font-weight: bold; margin-bottom: 2px;">المعادل بالعملات البديلة:</div>
              <div>${parts.join(' | ')}</div>
            </div>
          `;
        } catch {
          return '';
        }
      })()}

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

/**
 * طباعة محتوى HTML
 * على الأندرويد: يحفظ كـ HTML ويشاركه للطباعة
 * على المتصفح: يستخدم iframe + window.print()
 */
export async function printHTML(htmlContent: string): Promise<boolean> {
  // 1. إذا كان التطبيق يعمل داخل أندرويد ويدعم واجهة الطباعة الأصلية المباشرة
  if (typeof window !== 'undefined' && (window as any).AndroidPrinter?.print) {
    try {
      printOnWeb(htmlContent);
      setTimeout(() => {
        try {
          (window as any).AndroidPrinter.print();
        } catch (e) {
          console.warn('[NativePrint] AndroidPrinter.print failed:', e);
        }
      }, 350);
      return true;
    } catch (e) {
      console.warn('[NativePrint] Error invoking AndroidPrinter:', e);
    }
  }

  // 2. على المتصفح / PC أو الأندرويد: جرب الطباعة المباشرة أولاً
  const printed = printOnWeb(htmlContent);
  if (printed) return true;

  // 3. Fallback للأندرويد في حال عدم توفر خدمة الطباعة
  if (Capacitor.isNativePlatform()) {
    return false;
  }

  return false;
}

/**
 * طباعة على المتصفح والـ PC عبر iframe
 */
function printOnWeb(htmlContent: string): boolean {
  try {
    // إنشاء iframe خفيف للطباعة المباشرة
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '10px';
    iframe.style.height = '10px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      const attemptPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('[NativePrint] iframe print error:', e);
        }

        // تنظيف الـ iframe بعد الطباعة
        setTimeout(() => {
          try {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          } catch {}
        }, 3000);
      };

      setTimeout(attemptPrint, 350);
      return true;
    }

    return false;
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
