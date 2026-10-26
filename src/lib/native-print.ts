/**
 * Native Print Utility for Capacitor/Android
 * ============================================
 * حل مشكلة الطباعة في WebView الأندرويد
 * يستخدم تحويل HTML إلى صورة/PDF ثم المشاركة
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { formatNumber, formatCurrency } from './utils';
import { resolveInvoiceCurrencySymbol, getActiveCurrencyCode } from './currencies';
import { getEnabledCurrencies, formatAmount, fromUsd, toUsd } from './money-engine';
import { isGuestDemoMode } from './demo-data';
import { toast } from '@/lib/sonner-bridge';
import { isNativeAndroid } from './printer/flowpos-printer';
import {
  PRINTER_CONFIG_KEY,
  getStoredPrinterConfig,
  saveStoredPrinterConfig,
  type PrinterConfig,
} from './printer/printer-config';
import {
  buildReceiptParts,
  type PaperWidth,
  type ReceiptLine,
} from './printer/receipt-escpos';
import {
  printParts,
  printTestPage,
  describePrinterError,
} from './printer/bluetooth-printer';
import { FlowPosPrinter } from './printer/flowpos-printer';

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
export interface PrintableInvoice {
  id: string;
  invoiceNumber?: string;
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
  currency?: string;
  currency_code?: string;
  currency_symbol?: string;
  exchangeRate?: number;
  exchange_rate?: number;
  totalUSD?: number;
  paymentType: 'cash' | 'debt' | 'split';
  notes?: string;
}

export function generateReceiptHTML(invoice: PrintableInvoice): string {
  const store = getStoreSettings();
  const printSettings = getPrintSettings();

  const rawSymbol = (invoice.currencySymbol || '').trim();
  const rawCurrency = (invoice.currency || '').toUpperCase();
  const effectiveSymbol = resolveInvoiceCurrencySymbol(rawCurrency, rawSymbol);

  const itemsHTML = invoice.items.map(item => `
    <tr>
      <td style="text-align: right; padding: 4px 0; font-size: 12px;">${item.name}</td>
      <td style="text-align: center; padding: 4px 0; font-size: 12px;">${item.quantity}</td>
      <td style="text-align: left; padding: 4px 0; font-size: 12px;">${formatCurrency(item.total, effectiveSymbol)}</td>
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
    ${isGuestDemoMode() ? `
      .receipt { position: relative; overflow: hidden; }
      .receipt::before {
        content: "نسخة تجريبية - Flow POS Pro";
        position: absolute;
        top: 35%;
        left: -10%;
        right: -10%;
        transform: rotate(-25deg);
        font-size: 24px;
        font-weight: 900;
        color: rgba(225, 29, 72, 0.12);
        text-align: center;
        pointer-events: none;
        z-index: 999;
        white-space: nowrap;
      }
    ` : ''}
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
          <span>${formatCurrency(invoice.subtotal, effectiveSymbol)}</span>
        </div>
      ` : ''}
      
      ${invoice.discountAmount && invoice.discountAmount > 0 ? `
        <div class="total-row">
          <span>الخصم${invoice.discount ? ` (${invoice.discount}%)` : ''}:</span>
          <span>-${formatCurrency(invoice.discountAmount!, effectiveSymbol)}</span>
        </div>
      ` : ''}

      ${invoice.tax && invoice.tax > 0 ? `
        <div class="total-row">
          <span>الضريبة:</span>
          <span>${formatCurrency(invoice.tax!, effectiveSymbol)}</span>
        </div>
      ` : ''}

      <div class="total-row grand-total">
        <span>الإجمالي:</span>
        <span>${formatCurrency(invoice.total, effectiveSymbol)}</span>
      </div>

      ${(() => {
        if (!printSettings.showAlternativeCurrencies) return '';
        try {
          const enabledList = getEnabledCurrencies();
          const rawCode = invoice.currency_code || invoice.currency;
          const invCode = (rawCode || (effectiveSymbol === '$' ? 'USD' : getActiveCurrencyCode())).toUpperCase();
          const invRate = Number(invoice.exchange_rate || invoice.exchangeRate) || 1;

          let baseUSD = invoice.totalUSD;
          if (baseUSD === undefined || baseUSD === null || isNaN(baseUSD) || baseUSD <= 0) {
            if (invRate > 0 && invCode !== 'USD') {
              baseUSD = invoice.total / invRate;
            } else {
              baseUSD = toUsd(invoice.total, invCode);
            }
          }

          const parts: string[] = [];
          if (invCode !== 'USD') {
            const usdDef = enabledList.find(c => c.code === 'USD');
            if (usdDef && usdDef.enabled) {
              parts.push(`المعادل بالدولار: ${usdDef.symbol}${formatNumber(baseUSD, 2)}`);
            }
          }

          for (const curr of enabledList) {
            if (curr.code === invCode || !curr.enabled || curr.code === 'USD') continue;
            const altAmount = fromUsd(baseUSD, curr.code);
            parts.push(`${curr.name}: ${formatAmount(altAmount, curr.code)} ${curr.symbol}`);
          }

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
      ${isGuestDemoMode() ? `
        <div style="margin-top: 10px; padding: 6px; border: 2px dashed #e11d48; color: #e11d48; font-weight: bold; font-size: 13px; text-align: center; border-radius: 4px; background: #fff1f2;">
          ⚠️ نسخة تجريبية - Flow POS Pro ⚠️
          <div style="font-size: 10px; font-weight: normal; color: #be123c; margin-top: 2px;">غير معتمدة كفاتورة رسمية أو محاسبية</div>
        </div>
      ` : ''}
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

export {
  PRINTER_CONFIG_KEY,
  getStoredPrinterConfig,
  saveStoredPrinterConfig,
  type PrinterConfig,
};

export interface BluetoothDevice {
  name: string;
  address: string;
}

/**
 * Check if Bluetooth hardware or platform bridge is actually supported in current runtime
 */
export function isBluetoothSupported(): boolean {
  if (isNativeAndroid()) return true;
  if (typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth)) return true;
  return false;
}

/**
 * Search paired / available Bluetooth printers
 */
export async function searchBluetoothPrinters(): Promise<BluetoothDevice[]> {
  if (isNativeAndroid()) {
    try {
      const paired = await FlowPosPrinter.listPaired();
      return (paired?.devices || []).map(d => ({ name: d.name, address: d.address }));
    } catch (e) {
      console.warn('[NativePrint] listPaired error:', e);
      return [];
    }
  }

  // Web Bluetooth API fallback
  if (typeof navigator !== 'undefined' && (navigator as any).bluetooth?.getDevices) {
    try {
      const webDevices = await (navigator as any).bluetooth.getDevices();
      if (webDevices && Array.isArray(webDevices)) {
        return webDevices.map((d: any) => ({ name: d.name || 'Bluetooth Printer', address: d.id || '' }));
      }
    } catch (e) {
      console.warn('[Printer] Web Bluetooth getDevices:', e);
    }
  }

  return [];
}

/**
 * Connect to thermal printer & verify connection / save as default.
 */
export async function connectAndTestBluetoothPrinter(
  address: string,
  name?: string
): Promise<{ success: boolean; message: string }> {
  if (!address) {
    return {
      success: false,
      message: 'عنوان الطابعة غير محدد أو غير صالح',
    };
  }

  if (isNativeAndroid()) {
    try {
      const config = getStoredPrinterConfig();
      const paper = (config.paperWidth === '58mm' ? '58mm' : '80mm') as PaperWidth;
      await printTestPage(address, paper);
      config.connectionType = 'bluetooth';
      config.deviceAddress = address;
      if (name) config.deviceName = name;
      saveStoredPrinterConfig(config);

      return {
        success: true,
        message: `تم الاتصال بنجاح بالطابعة ${name || address} وطباعة صفحة الاختبار`,
      };
    } catch (err) {
      return {
        success: false,
        message: describePrinterError(err),
      };
    }
  }

  return {
    success: false,
    message: 'طباعة البلوتوث المباشرة تعمل على نظام أندرويد عبر البلوتوث الكلاسيكي (SPP)',
  };
}

/**
 * Compatibility helper for existing callers
 */
export async function htmlToEscPosRaster(htmlContent: string, paperWidth: '58mm' | '80mm' | 'A4'): Promise<Uint8Array> {
  const lines: ReceiptLine[] = [{ text: 'FlowPOS Pro Print', align: 'center', bold: true }];
  const parts = await buildReceiptParts(lines, paperWidth === '58mm' ? '58mm' : '80mm');
  return parts[0] || new Uint8Array([0x1b, 0x40]);
}

/**
 * Compatibility helper for existing callers
 */
export async function sendEscPosToBluetooth(rasterData: Uint8Array, address: string): Promise<boolean> {
  try {
    await printParts(address, [rasterData]);
    return true;
  } catch (e) {
    console.warn('[Printer] sendEscPosToBluetooth error:', e);
    return false;
  }
}

/**
 * Convert PrintableInvoice to structured ReceiptLine items for ESC/POS canvas rendering
 */
export function invoiceToReceiptLines(invoice: PrintableInvoice): ReceiptLine[] {
  const store = getStoreSettings();
  const printSettings = getPrintSettings();
  const rawSymbol = (invoice.currencySymbol || '').trim();
  const rawCurrency = (invoice.currency || '').toUpperCase();
  const effectiveSymbol = resolveInvoiceCurrencySymbol(rawCurrency, rawSymbol);

  const lines: ReceiptLine[] = [];

  // 1. Store Header
  if (printSettings.showStoreName !== false && store.name) {
    lines.push({ text: store.name, align: 'center', bold: true, size: 1.3 });
  }
  if (store.phone) {
    lines.push({ text: store.phone, align: 'center', size: 0.9 });
  }
  if (store.address) {
    lines.push({ text: store.address, align: 'center', size: 0.9 });
  }

  lines.push({ text: '--------------------------------', align: 'center' });

  // 2. Invoice Details
  lines.push({ text: `فاتورة رقم: ${invoice.invoiceNumber || invoice.id}`, align: 'right', bold: true });
  lines.push({ text: `التاريخ: ${invoice.date} ${invoice.time || ''}`, align: 'right', size: 0.9 });

  if (invoice.customerName && invoice.customerName !== 'زبون عام' && invoice.customerName !== 'General Customer') {
    lines.push({ text: `العميل: ${invoice.customerName}`, align: 'right' });
  }
  if (invoice.cashierName) {
    lines.push({ text: `الكاشير: ${invoice.cashierName}`, align: 'right', size: 0.9 });
  }

  lines.push({ text: '--------------------------------', align: 'center' });

  // 3. Items Header
  lines.push({ text: 'الصنف           الكمية      المجموع', align: 'right', bold: true, size: 0.9 });
  lines.push({ text: '--------------------------------', align: 'center' });

  // 4. Items List
  for (const item of invoice.items) {
    const formattedPrice = formatCurrency(item.total, effectiveSymbol);
    lines.push({
      text: `${item.name.slice(0, 16)}  ×${item.quantity}  ${formattedPrice}`,
      align: 'right',
    });
  }

  lines.push({ text: '--------------------------------', align: 'center' });

  // 5. Totals
  lines.push({ text: `المجموع الفرعي: ${formatCurrency(invoice.subtotal, effectiveSymbol)}`, align: 'right' });

  if (invoice.discount && invoice.discount > 0) {
    const discountVal = invoice.discountAmount ?? invoice.discount;
    lines.push({ text: `الخصم: -${formatCurrency(discountVal, effectiveSymbol)}`, align: 'right' });
  }

  if (invoice.tax && invoice.tax > 0) {
    lines.push({ text: `الضريبة: ${formatCurrency(invoice.tax, effectiveSymbol)}`, align: 'right' });
  }

  lines.push({
    text: `الإجمالي النهائي: ${formatCurrency(invoice.total, effectiveSymbol)}`,
    align: 'right',
    bold: true,
    size: 1.2,
  });

  // 6. Payment & Footer
  const paymentText = invoice.paymentType === 'debt' ? 'آجل (ذمة)' : invoice.paymentType === 'split' ? 'مركب' : 'نقداً';
  lines.push({ text: `طريقة الدفع: ${paymentText}`, align: 'right' });

  if (printSettings.footer) {
    lines.push({ text: '--------------------------------', align: 'center' });
    lines.push({ text: printSettings.footer, align: 'center', size: 0.9 });
  }

  return lines;
}

export async function printHTML(htmlContent: string): Promise<boolean> {
  const printerConfig = getStoredPrinterConfig();

  // على أندرويد بلوتوث: لا نسقط بصمت على طابعة النظام، وننبه المستخدم
  if (printerConfig.connectionType === 'bluetooth' && isNativeAndroid()) {
    toast.error('طباعة البلوتوث تتطلب طباعة الفاتورة المنظمة عبر printInvoice');
    return false;
  }

  // المسار الثاني: الطباعة السلكية / طابعة النظام على الكمبيوتر PC/Electron أو المتصفح Web
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

  const printed = printOnWeb(htmlContent);
  if (printed) return true;

  return false;
}

/**
 * طباعة على المتصفح والـ PC عبر iframe
 */
function printOnWeb(htmlContent: string): boolean {
  try {
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
 * طباعة فاتورة بيع
 */
export async function printInvoice(invoice: PrintableInvoice): Promise<boolean> {
  const printerConfig = getStoredPrinterConfig();

  if (printerConfig.connectionType === 'bluetooth' && isNativeAndroid()) {
    if (!printerConfig.deviceAddress) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flowpos:request-printer-pairing'));
      }
      toast.warning('يرجى اختيار وإعداد طابعة البلوتوث أولاً من الإعدادات');
      return false;
    }

    try {
      const lines = invoiceToReceiptLines(invoice);
      const paper = (printerConfig.paperWidth === '58mm' ? '58mm' : '80mm') as PaperWidth;
      const parts = await buildReceiptParts(lines, paper);
      await printParts(printerConfig.deviceAddress, parts);
      toast.success('تمت الطباعة بنجاح');
      return true;
    } catch (err) {
      const errorMsg = describePrinterError(err);
      toast.error(errorMsg);
      return false;
    }
  }

  // مسار الطباعة العادية HTML لـ PC/Electron/Web
  const html = generateReceiptHTML(invoice);
  return printHTML(html);
}

export { getStoreSettings as getStoreSettingsLegacy, getPrintSettings as getPrintSettingsLegacy };
