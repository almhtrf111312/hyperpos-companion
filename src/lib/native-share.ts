/**
 * Native Share Utility for Capacitor/Android
 * ============================================
 * يستخدم @capacitor/share للمشاركة الأصلية على الأندرويد
 * مع fallback للمتصفح (Web Share API أو window.open)
 */

import { Capacitor } from '@capacitor/core';
import { Share as CapacitorShare } from '@capacitor/share';
import { formatNumber } from './utils';

interface ShareOptions {
  title?: string;
  text: string;
  url?: string;
  dialogTitle?: string;
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
 * مشاركة فاتورة بتنسيق جاهز للطباعة
 */
export interface InvoiceShareData {
  id: string;
  storeName: string;
  storePhone?: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount?: number;
  total: number;
  currencySymbol: string;
  paymentType: 'cash' | 'debt';
  serviceDescription?: string;
  type: 'sale' | 'maintenance';
  taxAmount?: number;
  taxRate?: number;
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
    serviceDescription,
    type,
  } = data;

  const itemsList = type === 'sale'
    ? items.map(item =>
      `• ${item.name} × ${item.quantity} = ${currencySymbol}${formatNumber(item.total)}`
    ).join('\n')
    : `🔧 ${serviceDescription || 'خدمة صيانة'}`;

  const paymentLabel = paymentType === 'cash' ? '💵 نقدي' : '📋 آجل';

  return `────────────────
${storeName}
────────────────

📄 فاتورة رقم: ${id}
📅 التاريخ: ${date}

────────────────
👤 العميل: ${customerName}
${customerPhone ? `📱 الهاتف: ${customerPhone}` : ''}
────────────────

${type === 'sale' ? '🛒 المشتريات:' : '🔧 الخدمة:'}
${itemsList}

────────────────
${type === 'sale' && items.length > 1 ? `📊 المجموع الفرعي: ${currencySymbol}${formatNumber(subtotal)}\n` : ''}${discount && discount > 0 ? `✂️ الخصم: ${currencySymbol}${formatNumber(discount)}\n` : ''}${data.taxAmount && data.taxAmount > 0 ? `🧾 الضريبة${data.taxRate ? ` (${data.taxRate}%)` : ''}: ${currencySymbol}${formatNumber(data.taxAmount)}\n` : ''}💰 الإجمالي: ${currencySymbol}${formatNumber(total)}
💳 طريقة الدفع: ${paymentLabel}

────────────────
${storePhone ? `📞 للتواصل: ${storePhone}` : ''}

شكراً لتعاملكم معنا! 🙏`;
}

/**
 * مشاركة فاتورة كاملة
 */
export async function shareInvoice(data: InvoiceShareData): Promise<boolean> {
  const text = generateInvoiceShareText(data);

  return nativeShare({
    title: `فاتورة رقم ${data.id}`,
    text: text,
    dialogTitle: 'مشاركة الفاتورة',
  });
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
  const text = generateDebtShareText(data);

  // إذا كان هناك رقم هاتف، اقترح إرساله مباشرة
  if (data.customerPhone) {
    return shareViaWhatsApp(text, data.customerPhone);
  }

  return nativeShare({
    title: `تذكير بالدين - ${data.customerName}`,
    text: text,
    dialogTitle: 'مشاركة تذكير الدين',
  });
}
