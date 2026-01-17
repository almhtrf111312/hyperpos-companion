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
