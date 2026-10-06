// Print utilities for HyperPOS
// Uses hidden iframe approach for better Android/WebView compatibility

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
 * Used for dynamic invoice/receipt printing
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
 * طباعة محتوى HTML باستخدام iframe مخفي
 * يعمل على المتصفحات وCapacitor WebView
 */
export function printHTML(htmlContent: string): void {
  // على Capacitor/Android استخدم native-print
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    import('./native-print').then(mod => mod.printHTML(htmlContent));
    return;
  }

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
    
    // انتظار تحميل المحتوى (بما في ذلك الصور) ثم الطباعة
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
        } catch (e) {
          // تجاهل الخطأ إذا تم إزالته مسبقاً
        }
      }, 1000);
    };

    // انتظار تحميل المحتوى
    if (iframe.contentWindow) {
      iframe.contentWindow.onload = () => {
        setTimeout(attemptPrint, 250);
      };
      
      // fallback إذا لم يتم تشغيل onload
      setTimeout(attemptPrint, 500);
    } else {
      setTimeout(attemptPrint, 500);
    }
  }
}
