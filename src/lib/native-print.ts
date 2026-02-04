/**
 * Native Print Utility for Capacitor/Android
 * ============================================
 * حل مشكلة الطباعة في WebView الأندرويد
 * يستخدم تحويل HTML إلى صورة/PDF ثم المشاركة
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

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
      <td style="text-align: left; padding: 4px 0; font-size: 12px;">${invoice.currencySymbol}${item.total.toLocaleString()}</td>
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
          <span>${invoice.currencySymbol}${invoice.subtotal.toLocaleString()}</span>
        </div>
      ` : ''}
      
      ${invoice.discountAmount && invoice.discountAmount > 0 ? `
        <div class="total-row">
          <span>الخصم${invoice.discount ? ` (${invoice.discount}%)` : ''}:</span>
          <span>-${invoice.currencySymbol}${invoice.discountAmount.toLocaleString()}</span>
        </div>
      ` : ''}

      ${invoice.tax && invoice.tax > 0 ? `
        <div class="total-row">
          <span>الضريبة:</span>
          <span>${invoice.currencySymbol}${invoice.tax.toLocaleString()}</span>
        </div>
      ` : ''}

      <div class="total-row grand-total">
        <span>الإجمالي:</span>
        <span>${invoice.currencySymbol}${invoice.total.toLocaleString()}</span>
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
