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
import { resolveInvoiceCurrencySymbol } from './currencies';
import { getEnabledCurrencies, formatAmount, fromUsd, toUsd } from './money-engine';
import { isGuestDemoMode } from './demo-data';

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
  currency?: string;
  currency_code?: string;
  currency_symbol?: string;
  exchangeRate?: number;
  exchange_rate?: number;
  totalUSD?: number;
  paymentType: 'cash' | 'debt';
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
          const invCode = (rawCode || (effectiveSymbol === '$' ? 'USD' : 'TRY')).toUpperCase();
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

export const PRINTER_CONFIG_KEY = 'flowpos_printer_config';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface PrinterConfig {
  connectionType: 'bluetooth' | 'wired_system';
  deviceName?: string;
  deviceAddress?: string; // MAC Address or Device ID
  paperWidth: '58mm' | '80mm' | 'A4';
  autoPrintAfterSale?: boolean;
}

export function getStoredPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(PRINTER_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[Printer] Failed to read printer config:', e);
  }
  const isMobile = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  return {
    connectionType: isMobile ? 'bluetooth' : 'wired_system',
    paperWidth: '80mm',
    autoPrintAfterSale: true,
  };
}

export function saveStoredPrinterConfig(config: PrinterConfig): void {
  try {
    localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowpos:printer-config-changed', { detail: config }));
    }
  } catch (e) {
    console.warn('[Printer] Failed to save printer config:', e);
  }
}

/**
 * Check if Bluetooth hardware or platform bridge is actually supported in current runtime
 */
export function isBluetoothSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    typeof (window as any).BluetoothSerial?.connect === 'function' ||
    typeof (window as any).Capacitor?.Plugins?.BluetoothSerial?.connect === 'function' ||
    (typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth))
  );
}

/**
 * Search paired / available Bluetooth printers
 * Returns only real hardware devices discovered via supported platform bridges.
 * If no device is discovered or supported, returns an empty list [].
 */
export async function searchBluetoothPrinters(): Promise<BluetoothDevice[]> {
  const devices: BluetoothDevice[] = [];
  const seenAddresses = new Set<string>();

  // 1. Android Capacitor / Cordova BluetoothSerial bridge if present
  if (typeof window !== 'undefined' && typeof (window as any).BluetoothSerial?.list === 'function') {
    try {
      const paired = await new Promise<any[]>((resolve) => {
        (window as any).BluetoothSerial.list(
          (list: any[]) => resolve(list || []),
          (err: any) => {
            console.warn('[Printer] BluetoothSerial.list error:', err);
            resolve([]);
          }
        );
      });
      if (paired && Array.isArray(paired)) {
        for (const d of paired) {
          const addr = d.address || d.id || '';
          if (addr && !seenAddresses.has(addr)) {
            seenAddresses.add(addr);
            devices.push({
              name: d.name || 'Bluetooth Printer',
              address: addr,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Printer] BluetoothSerial bridge failed:', e);
    }
  }

  // 2. Capacitor Bluetooth plugin if present
  if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.BluetoothSerial) {
    try {
      const res = await (window as any).Capacitor.Plugins.BluetoothSerial.list();
      if (res?.devices && Array.isArray(res.devices)) {
        for (const d of res.devices) {
          const addr = d.address || d.id || '';
          if (addr && !seenAddresses.has(addr)) {
            seenAddresses.add(addr);
            devices.push({
              name: d.name || 'Bluetooth Printer',
              address: addr,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Printer] Capacitor BluetoothSerial plugin error:', e);
    }
  }

  // 3. Web Bluetooth API (if supported in Chrome/Edge/Android WebView)
  if (typeof navigator !== 'undefined' && (navigator as any).bluetooth?.getDevices) {
    try {
      const webDevices = await (navigator as any).bluetooth.getDevices();
      if (webDevices && Array.isArray(webDevices)) {
        for (const d of webDevices) {
          const addr = d.id || '';
          if (addr && !seenAddresses.has(addr)) {
            seenAddresses.add(addr);
            devices.push({
              name: d.name || 'Bluetooth Thermal Device',
              address: addr,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Printer] Web Bluetooth getDevices:', e);
    }
  }

  // Never return fake/mock devices. Return empty list if no real hardware is found.
  return devices;
}

/**
 * Connect to thermal printer & verify connection / save as default.
 * Only saves config and reports success if connection and test print data succeed.
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

  const hasCordova = typeof window !== 'undefined' && typeof (window as any).BluetoothSerial?.connect === 'function';
  const hasCapacitor = typeof window !== 'undefined' && typeof (window as any).Capacitor?.Plugins?.BluetoothSerial?.connect === 'function';
  const hasWebBluetooth = typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth);

  if (!hasCordova && !hasCapacitor && !hasWebBluetooth) {
    return {
      success: false,
      message: 'إضافة البلوتوث غير متوفرة أو غير مدعومة في هذه البيئة. يرجى استخدام طابعة النظام/المشاركة أو تشغيل التطبيق في بيئة أندرويد مدعومة.',
    };
  }

  try {
    const testText = '\x1B\x40\x1B\x61\x01\n=== FlowPOS Pro ===\nThermal Printer Connected!\n\n\x1D\x56\x41\x00';

    if (hasCordova) {
      await new Promise<void>((resolve, reject) => {
        (window as any).BluetoothSerial.connect(
          address,
          () => {
            (window as any).BluetoothSerial.write(
              testText,
              () => resolve(),
              (writeErr: any) => reject(writeErr)
            );
          },
          (connectErr: any) => reject(connectErr)
        );
      });
    } else if (hasCapacitor) {
      await (window as any).Capacitor.Plugins.BluetoothSerial.connect({ address });
      await (window as any).Capacitor.Plugins.BluetoothSerial.write({ data: testText });
    } else if (hasWebBluetooth) {
      const webDevices = await (navigator as any).bluetooth.getDevices?.();
      const matchedDevice = webDevices?.find((d: any) => d.id === address);
      if (matchedDevice && matchedDevice.gatt) {
        if (!matchedDevice.gatt.connected) {
          await matchedDevice.gatt.connect();
        }
      } else {
        throw new Error('الجهاز غير مصرح به أو تعذر العثور على خادم GATT للبلوتوث');
      }
    }

    // Save only after genuine connection and transmission succeeded
    const config = getStoredPrinterConfig();
    config.connectionType = 'bluetooth';
    config.deviceAddress = address;
    if (name) config.deviceName = name;
    saveStoredPrinterConfig(config);

    return {
      success: true,
      message: `تم الاقتران والاتصال بنجاح بالطابعة ${name || address} وإرسال إشارة الاختبار`,
    };
  } catch (err: any) {
    console.warn('[Printer] connectAndTest error:', err);
    const detail = err?.message || (typeof err === 'string' ? err : 'تعذر إتمام الاتصال بالجهاز');
    return {
      success: false,
      message: `فشل الاتصال بالطابعة (${detail}). تأكد من تشغيل البلوتوث واقتران الطابعة بالجهاز أولاً.`,
    };
  }
}

/**
 * Convert HTML receipt to monochrome ESC/POS raster bit-image.
 * Renders Arabic text as a high-resolution bitmap to prevent disconnected or reversed Arabic characters.
 */
export async function htmlToEscPosRaster(htmlContent: string, paperWidth: '58mm' | '80mm' | 'A4'): Promise<Uint8Array> {
  const widthDots = paperWidth === '58mm' ? 384 : 576;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = `${widthDots}px`;
  container.style.maxWidth = `${widthDots}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.style.padding = '12px';
  container.style.boxSizing = 'border-box';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  await new Promise((r) => setTimeout(r, 60));

  const totalHeight = Math.max(container.scrollHeight, 100);

  const canvas = document.createElement('canvas');
  canvas.width = widthDots;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    document.body.removeChild(container);
    return new Uint8Array([0x1B, 0x40]);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthDots, totalHeight);

  const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthDots}" height="${totalHeight}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Cairo, sans-serif; color: #000; background: #fff; direction: rtl; padding: 8px;">
        ${container.innerHTML}
      </div>
    </foreignObject>
  </svg>`;

  document.body.removeChild(container);

  const img = new Image();
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

  const imgData = ctx.getImageData(0, 0, widthDots, totalHeight);
  const pixels = imgData.data;
  const bytesWidth = Math.ceil(widthDots / 8);
  const rasterBytes = new Uint8Array(bytesWidth * totalHeight);

  for (let y = 0; y < totalHeight; y++) {
    for (let x = 0; x < widthDots; x++) {
      const idx = (y * widthDots + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
      if (a > 128 && luminance < 160) {
        const byteIndex = y * bytesWidth + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        rasterBytes[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  const xL = bytesWidth & 0xFF;
  const xH = (bytesWidth >> 8) & 0xFF;
  const yL = totalHeight & 0xFF;
  const yH = (totalHeight >> 8) & 0xFF;

  const header = new Uint8Array([0x1B, 0x40, 0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const footer = new Uint8Array([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);

  const output = new Uint8Array(header.length + rasterBytes.length + footer.length);
  output.set(header, 0);
  output.set(rasterBytes, header.length);
  output.set(footer, header.length + rasterBytes.length);

  return output;
}

export async function sendEscPosToBluetooth(rasterData: Uint8Array, address: string): Promise<boolean> {
  // 1. BluetoothSerial Cordova bridge
  if (typeof window !== 'undefined' && typeof (window as any).BluetoothSerial?.write === 'function') {
    try {
      await new Promise<void>((resolve, reject) => {
        (window as any).BluetoothSerial.write(rasterData.buffer, resolve, reject);
      });
      return true;
    } catch (e) {
      console.warn('[Printer] BluetoothSerial write failed:', e);
      return false;
    }
  }

  // 2. Capacitor Bluetooth plugin
  if (typeof window !== 'undefined' && typeof (window as any).Capacitor?.Plugins?.BluetoothSerial?.write === 'function') {
    try {
      await (window as any).Capacitor.Plugins.BluetoothSerial.write({ data: rasterData });
      return true;
    } catch (e) {
      console.warn('[Printer] Capacitor BluetoothSerial write failed:', e);
      return false;
    }
  }

  return false;
}

export async function printHTML(htmlContent: string): Promise<boolean> {
  const printerConfig = getStoredPrinterConfig();

  // المسار الأول: طباعة البلوتوث الحرارية للأندرويد / الهواتف
  if (printerConfig.connectionType === 'bluetooth') {
    if (printerConfig.deviceAddress) {
      try {
        const raster = await htmlToEscPosRaster(htmlContent, printerConfig.paperWidth);
        const sent = await sendEscPosToBluetooth(raster, printerConfig.deviceAddress);
        if (sent) return true;
      } catch (err) {
        console.warn('[NativePrint] Bluetooth raster print failed, falling back to system print:', err);
      }
    } else {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flowpos:request-printer-pairing'));
      }
    }
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
