/**
 * Native Share Utility for Capacitor/Android
 * ============================================
 * يستخدم @capacitor/share للمشاركة الأصلية على الأندرويد
 * مع fallback للمتصفح (Web Share API أو window.open)
 */

import { Capacitor } from '@capacitor/core';
import { Share as CapacitorShare } from '@capacitor/share';

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
        dialogTitle: dialogTitle || 'مشاركة عبر',
      });
      return true;
    } catch (error) {
      console.error('[NativeShare] Capacitor share failed:', error);
      // Fallback to WhatsApp direct link
      return shareViaWhatsApp(text);
    }
  }

  // على المتصفح: استخدم Web Share API إذا متاح
  if (navigator.share) {
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
      console.warn('[NativeShare] Web Share failed, trying WhatsApp:', error);
    }
  }

  // Fallback: فتح واتساب
  return shareViaWhatsApp(text);
}

/**
 * مشاركة مباشرة عبر واتساب
 */
export function shareViaWhatsApp(text: string, phoneNumber?: string): boolean {
  try {
    const encodedText = encodeURIComponent(text);
    let whatsappUrl: string;

    if (phoneNumber) {
      // إزالة + من الرقم
      const cleanNumber = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
      whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;
    } else {
      whatsappUrl = `https://wa.me/?text=${encodedText}`;
    }

    // على الأندرويد، استخدم intent URL للفتح المباشر
    if (Capacitor.isNativePlatform()) {
      // استخدم whatsapp:// protocol للأندرويد
      const intentUrl = phoneNumber 
        ? `whatsapp://send?phone=${phoneNumber.replace(/\+/g, '')}&text=${encodedText}`
        : `whatsapp://send?text=${encodedText}`;
      
      // جرب intent أولاً
      window.location.href = intentUrl;
      
      // إذا لم يعمل، استخدم https
      setTimeout(() => {
        window.open(whatsappUrl, '_system');
      }, 500);
    } else {
      window.open(whatsappUrl, '_blank');
    }

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
        `• ${item.name} × ${item.quantity} = ${currencySymbol}${item.total.toLocaleString()}`
      ).join('\n')
    : `🔧 ${serviceDescription || 'خدمة صيانة'}`;

  const paymentLabel = paymentType === 'cash' ? '💵 نقدي' : '📋 آجل';

  return `╔══════════════════════╗
      *${storeName}*
╚══════════════════════╝

📄 *فاتورة رقم:* ${id}
📅 *التاريخ:* ${date}

━━━━━━━━━━━━━━━━━━━━━
👤 *العميل:* ${customerName}
${customerPhone ? `📱 *الهاتف:* ${customerPhone}` : ''}
━━━━━━━━━━━━━━━━━━━━━

${type === 'sale' ? '🛒 *المشتريات:*' : '🔧 *الخدمة:*'}
${itemsList}

━━━━━━━━━━━━━━━━━━━━━
${type === 'sale' && items.length > 1 ? `📊 *المجموع الفرعي:* ${currencySymbol}${subtotal.toLocaleString()}\n` : ''}${discount && discount > 0 ? `✂️ *الخصم:* ${currencySymbol}${discount.toLocaleString()}\n` : ''}💰 *الإجمالي:* ${currencySymbol}${total.toLocaleString()}
💳 *طريقة الدفع:* ${paymentLabel}

━━━━━━━━━━━━━━━━━━━━━
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

  return `📋 *تذكير بالدين*

👤 *العميل:* ${customerName}
${customerPhone ? `📱 *الهاتف:* ${customerPhone}` : ''}
${invoiceId ? `📄 *رقم الفاتورة:* ${invoiceId}` : ''}

💰 *إجمالي الدين:* ${currencySymbol}${totalDebt.toLocaleString()}
💵 *المتبقي:* ${currencySymbol}${remainingDebt.toLocaleString()}
${dueDate ? `📅 *تاريخ الاستحقاق:* ${dueDate}` : ''}

━━━━━━━━━━━━━━━━━━━━━
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
