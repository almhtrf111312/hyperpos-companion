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
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  footer: string;
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
 * طباعة محتوى HTML باستخدام iframe مخفي
 * يعمل على المتصفحات وCapacitor WebView
 */
export function printHTML(htmlContent: string): void {
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
