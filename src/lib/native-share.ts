/**
 * Native Share Utility for Capacitor/Android
 * ============================================
 * يستخدم @capacitor/share و @capacitor/filesystem للمشاركة الأصلية كصور
 * مع fallback للمتصفح (Web Share API أو التحميل التلقائي للصورة)
 */

import { Capacitor } from '@capacitor/core';
import { Share as CapacitorShare } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { formatNumber } from './utils';
import {
  InvoiceCanvasData,
  DebtStatementCanvasData,
  generateInvoiceBlob,
  generateDebtStatementBlob,
} from './invoice-canvas-generator';

interface ShareOptions {
  title?: string;
  text: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * تحويل كائن Blob إلى سلسلة base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * مشاركة ملف صورة (PNG) عبر النظام الأصلي أو المتصفح
 * على أندرويد/Capacitor: يحفظ في Cache ويشارك عبر @capacitor/share
 * على المتصفح: يشارك عبر Web Share API أو يقوم بالتنزيل المباشر كصورة
 */
export async function shareInvoiceImage(
  blob: Blob,
  fileName: string = `invoice_${Date.now()}`,
  title: string = 'مشاركة الفاتورة'
): Promise<boolean> {
  const safeName = `${fileName.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')}.png`;

  // 1. على الأندرويد/iOS (Capacitor): حفظ الملف مؤقتاً ومشاركته كملف صورة عبر @capacitor/share
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: safeName,
        data: base64Data,
        directory: Directory.Cache,
      });

      const fileUri = writeResult.uri || (await Filesystem.getUri({
        path: safeName,
        directory: Directory.Cache,
      })).uri;

      await CapacitorShare.share({
        title: title,
        files: [fileUri],
        dialogTitle: 'مشاركة الفاتورة كصورة',
      });
      return true;
    } catch (error: any) {
      if (error?.message?.includes('cancel') || error?.name === 'AbortError') {
        return false;
      }
      console.warn('[NativeShare] Capacitor file share failed, trying web fallback:', error);
    }
  }

  // 2. على المتصفح: استخدام navigator.share({ files: [...] })
  if (typeof navigator !== 'undefined') {
    try {
      const file = new File([blob], safeName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title,
          files: [file],
        });
        return true;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return false;
      }
      console.warn('[NativeShare] navigator.share with file failed, falling back to download:', error);
    }

    // 3. Fallback: تنزيل الصورة تلقائياً في المتصفح
    try {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      return true;
    } catch (e) {
      console.error('[NativeShare] Download fallback failed:', e);
      return false;
    }
  }

  return false;
}

/**
 * مشاركة نص عبر النظام الأصلي (Android/iOS) أو المتصفح
 */
export async function nativeShare(options: ShareOptions): Promise<boolean> {
  const { title, text, url, dialogTitle } = options;

  // على الأندرويد/iOS استخدم Capacitor Share
  if (Capacitor.isNativePlatform()) {
    try {
      await CapacitorShare.share({
        title: title || 'مشاركة',
        text: text,
        url: url,
        dialogTitle: dialogTitle || 'مشاركة عبر التطبيقات',
      });
      return true;
    } catch (error: any) {
      // إذا قام المستخدم بإلغاء نافذة المشاركة، لا نعتبره خطأ ولا نفتح واتساب إجبارياً
      if (error?.message?.includes('cancel') || error?.name === 'AbortError') {
        return false;
      }
      console.warn('[NativeShare] Capacitor share failed or dismissed:', error);
      return false;
    }
  }

  // على المتصفح: استخدم Web Share API إذا متاح
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text,
        url: url,
      });
      return true;
    } catch (error) {
      // User cancelled
      if ((error as Error).name === 'AbortError') {
        return false;
      }
      console.warn('[NativeShare] Web Share failed, falling back to clipboard or link:', error);
    }
  }

  // Fallback: فتح نافذة بدون تغيير مسار الـ WebView حتى لا يُعاد تحميل التطبيق
  return shareViaWhatsApp(text);
}

/**
 * مشاركة مباشرة عبر واتساب بدون إعادة تحميل الـ WebView
 */
export function shareViaWhatsApp(text: string, phoneNumber?: string): boolean {
  try {
    const encodedText = encodeURIComponent(text);
    let whatsappUrl: string;

    if (phoneNumber) {
      const cleanNumber = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
      whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;
    } else {
      whatsappUrl = `https://wa.me/?text=${encodedText}`;
    }

    // فتح الرابط كنافذة منفصلة بدون المساس بـ window.location.href
    window.open(whatsappUrl, '_blank');
    return true;
  } catch (error) {
    console.error('[NativeShare] WhatsApp share failed:', error);
    return false;
  }
}

/**
 * واجهة بيانات مشاركة الفاتورة
 */
export interface InvoiceShareData {
  id: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  storeLogo?: string;
  customerName: string;
  customerPhone?: string;
  supplierName?: string;
  supplierPhone?: string;
  date: string;
  time?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    expiryDate?: string;
    batchNumber?: string;
  }>;
  subtotal: number;
  discount?: number;
  total: number;
  currencySymbol: string;
  paymentType: 'cash' | 'debt' | 'split' | string;
  downPayment?: number;
  debtRemaining?: number;
  serviceDescription?: string;
  type?: 'sale' | 'purchase' | 'maintenance' | 'return';
  taxAmount?: number;
  taxRate?: number;
  notes?: string;
  footerNote?: string;
}

export function generateInvoiceShareText(data: InvoiceShareData): string {
  const {
    id,
    storeName,
    storePhone,
    customerName,
    customerPhone,
    date,
    items,
    subtotal,
    discount,
    total,
    currencySymbol,
    paymentType,
    downPayment,
    debtRemaining,
    serviceDescription,
    type,
  } = data;

  const itemsList = type !== 'maintenance'
    ? items.map(item =>
      `• ${item.name} × ${item.quantity} = ${currencySymbol}${formatNumber(item.total)}`
    ).join('\n')
    : `🔧 ${serviceDescription || 'خدمة صيانة'}`;

  const paymentLabel = paymentType === 'cash' 
    ? '💵 نقدي' 
    : (paymentType === 'split' || (downPayment && downPayment > 0))
      ? '📋 آجل مع دفعة نقدية'
      : '📋 آجل (دين)';

  return `────────────────
${storeName}
────────────────

📄 فاتورة رقم: ${id}
📅 التاريخ: ${date}

────────────────
👤 ${type === 'purchase' ? 'المورد' : 'العميل'}: ${customerName}
${customerPhone ? `📱 الهاتف: ${customerPhone}` : ''}
────────────────

${type !== 'maintenance' ? '🛒 المواد:' : '🔧 الخدمة:'}
${itemsList}

────────────────
${items.length > 1 ? `📊 المجموع الفرعي: ${currencySymbol}${formatNumber(subtotal)}\n` : ''}${discount && discount > 0 ? `✂️ الخصم: ${currencySymbol}${formatNumber(discount)}\n` : ''}${data.taxAmount && data.taxAmount > 0 ? `🧾 الضريبة${data.taxRate ? ` (${data.taxRate}%)` : ''}: ${currencySymbol}${formatNumber(data.taxAmount)}\n` : ''}💰 الإجمالي: ${currencySymbol}${formatNumber(total)}
💳 طريقة الدفع: ${paymentLabel}
${(paymentType === 'split' || paymentType === 'debt' || (downPayment && downPayment > 0)) ? (downPayment && downPayment > 0 ? `💵 المدفوع نقداً: ${currencySymbol}${formatNumber(downPayment)}\n📋 المتبقي كدين: ${currencySymbol}${formatNumber(debtRemaining !== undefined && debtRemaining !== null ? debtRemaining : (total - downPayment))}\n` : `📋 مستحق كدين: ${currencySymbol}${formatNumber(debtRemaining !== undefined && debtRemaining !== null ? debtRemaining : total)}\n`) : ''}

────────────────
${storePhone ? `📞 للتواصل: ${storePhone}` : ''}

شكراً لتعاملكم معنا! 🙏`;
}

/**
 * مشاركة فاتورة كاملة كصورة عالية الدقة (Invoice Image Share)
 * وتعتمد على Canvas النقي الأوفلاين
 */
export async function shareInvoice(data: InvoiceShareData): Promise<boolean> {
  try {
    const canvasData: InvoiceCanvasData = {
      id: data.id,
      type: data.type || 'sale',
      date: data.date,
      time: data.time,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      items: data.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        expiryDate: item.expiryDate,
        batchNumber: item.batchNumber,
      })),
      subtotal: data.subtotal,
      discount: data.discount,
      taxAmount: data.taxAmount,
      taxRate: data.taxRate,
      total: data.total,
      currencySymbol: data.currencySymbol,
      paymentType: data.paymentType,
      downPayment: data.downPayment,
      debtRemaining: data.debtRemaining,
      notes: data.notes,
      serviceDescription: data.serviceDescription,
      storeName: data.storeName,
      storePhone: data.storePhone,
      storeAddress: data.storeAddress,
      storeLogo: data.storeLogo,
      footerNote: data.footerNote,
    };

    const blob = await generateInvoiceBlob(canvasData);
    return await shareInvoiceImage(blob, `invoice_${data.id}`, `فاتورة رقم ${data.id}`);
  } catch (error) {
    console.warn('[NativeShare] Invoice canvas generation failed, falling back to text share:', error);
    const text = generateInvoiceShareText(data);
    return nativeShare({
      title: `فاتورة رقم ${data.id}`,
      text: text,
      dialogTitle: 'مشاركة الفاتورة',
    });
  }
}

/**
 * مشاركة كشف حساب عميل كصورة احترافية
 */
export async function shareDebtStatement(data: DebtStatementCanvasData): Promise<boolean> {
  try {
    const blob = await generateDebtStatementBlob(data);
    const safeCust = (data.customerName || 'customer').replace(/\s+/g, '_');
    return await shareInvoiceImage(blob, `statement_${safeCust}`, `كشف حساب - ${data.customerName}`);
  } catch (error) {
    console.error('[NativeShare] Debt statement image generation failed:', error);
    return false;
  }
}

/**
 * مشاركة تقرير عام
 */
export async function shareReport(title: string, text: string): Promise<boolean> {
  return nativeShare({
    title: title,
    text: text,
    dialogTitle: 'مشاركة التقرير',
  });
}

/**
 * مشاركة تفاصيل دين
 */
export interface DebtShareData {
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  remainingDebt: number;
  currencySymbol: string;
  invoiceId?: string;
  dueDate?: string;
}

export function generateDebtShareText(data: DebtShareData): string {
  const {
    customerName,
    customerPhone,
    totalDebt,
    remainingDebt,
    currencySymbol,
    invoiceId,
    dueDate,
  } = data;

  return `📋 تذكير بالدين

👤 العميل: ${customerName}
${customerPhone ? `📱 الهاتف: ${customerPhone}` : ''}
${invoiceId ? `📄 رقم الفاتورة: ${invoiceId}` : ''}

💰 إجمالي الدين: ${currencySymbol}${formatNumber(totalDebt)}
💵 المتبقي: ${currencySymbol}${formatNumber(remainingDebt)}
${dueDate ? `📅 تاريخ الاستحقاق: ${dueDate}` : ''}

────────────────
نرجو التواصل لتسوية المبلغ 🙏`;
}

export async function shareDebt(data: DebtShareData): Promise<boolean> {
  // إنشاء كشف حساب مصغر كصورة تذكير بالدين
  try {
    const statementData: DebtStatementCanvasData = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      date: new Date().toLocaleDateString('ar-SA'),
      totalPurchases: data.totalDebt,
      totalPaid: Math.max(0, data.totalDebt - data.remainingDebt),
      totalDebt: data.remainingDebt,
      currencySymbol: data.currencySymbol,
      dueDate: data.dueDate,
      transactions: data.invoiceId ? [{
        id: data.invoiceId,
        date: data.dueDate || new Date().toLocaleDateString('ar-SA'),
        type: 'فاتورة آجل',
        total: data.totalDebt,
        paid: Math.max(0, data.totalDebt - data.remainingDebt),
        remaining: data.remainingDebt,
        status: 'مستحق',
      }] : [],
    };

    const blob = await generateDebtStatementBlob(statementData);
    const safeCust = (data.customerName || 'debt').replace(/\s+/g, '_');
    return await shareInvoiceImage(blob, `debt_${safeCust}`, `تذكير بالدين - ${data.customerName}`);
  } catch (err) {
    console.warn('[NativeShare] Debt image generation failed, falling back to text:', err);
    const text = generateDebtShareText(data);
    if (data.customerPhone) {
      return shareViaWhatsApp(text, data.customerPhone);
    }
    return nativeShare({
      title: `تذكير بالدين - ${data.customerName}`,
      text: text,
      dialogTitle: 'مشاركة تذكير الدين',
    });
  }
}
