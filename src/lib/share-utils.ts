// Enhanced Share Utility - Uses Web Share API with rich text formatting
import { formatCurrency } from './utils';
import { resolveInvoiceCurrencySymbol } from './currencies';

export interface ShareInvoiceData {
  id: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
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
  currencyName?: string;
  currency?: string;
  paymentType: 'cash' | 'debt';
  serviceDescription?: string;
  type: 'sale' | 'maintenance';
}

// Generate rich text for sharing
export const generateInvoiceShareText = (data: ShareInvoiceData): string => {
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
    currencySymbol: rawCurrencySymbol,
    paymentType,
    serviceDescription,
    type,
  } = data;

  const currencySymbol = resolveInvoiceCurrencySymbol(data.currency, rawCurrencySymbol);
  const formatInvoiceAmount = (amount: number) =>
    formatCurrency(amount, currencySymbol, undefined, data.currency, data.currencyName);

  const itemsList = type === 'sale'
    ? items.map(item =>
      `• ${item.name} × ${item.quantity} = ${formatInvoiceAmount(item.total)}`
    ).join('\n')
    : `🔧 ${serviceDescription || 'خدمة صيانة'}`;

  const paymentLabel = paymentType === 'cash' ? '💵 نقدي' : '📋 آجل';

  const message = `╔══════════════════════╗
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
${type === 'sale' && items.length > 1 ? `📊 *المجموع الفرعي:* ${formatInvoiceAmount(subtotal)}\n` : ''}${discount && discount > 0 ? `✂️ *الخصم:* ${formatInvoiceAmount(discount)}\n` : ''}💰 *الإجمالي:* ${formatInvoiceAmount(total)}
💳 *طريقة الدفع:* ${paymentLabel}

━━━━━━━━━━━━━━━━━━━━━
${storePhone ? `📞 للتواصل: ${storePhone}` : ''}

شكراً لتعاملكم معنا! 🙏`;

  return message;
};

// Share using Web Share API with fallback to WhatsApp
export const shareInvoice = async (data: ShareInvoiceData): Promise<boolean> => {
  const text = generateInvoiceShareText(data);

  // Check if Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share({
        title: `فاتورة رقم ${data.id}`,
        text: text,
      });
      return true;
    } catch (error) {
      // User cancelled or share failed, fallback to WhatsApp
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }

  // Fallback to WhatsApp - always open without phone number to let user choose contact
  const encodedMessage = encodeURIComponent(text);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

  window.open(whatsappUrl, '_blank');
  return true;
};

// Share general report via Web Share API
export const shareReport = async (title: string, text: string): Promise<boolean> => {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Generate expense report text for sharing
export const generateExpenseReportText = (
  storeName: string,
  partnerName: string,
  dateRange: { start: string; end: string },
  expenses: Array<{
    type: string;
    amount: number;
    date: string;
    notes?: string;
  }>,
  total: number,
  currencySymbol: string = '$'
): string => {
  const expensesList = expenses.map(e =>
    `• ${e.type}: ${currencySymbol}${formatNumber(e.amount)} (${e.date})`
  ).join('\n');

  return `📊 *تقرير المصاريف*
━━━━━━━━━━━━━━━━━━

🏪 *المحل:* ${storeName}
👤 *الشريك:* ${partnerName}
📅 *الفترة:* ${dateRange.start} إلى ${dateRange.end}

━━━━━━━━━━━━━━━━━━
📋 *تفاصيل المصاريف:*
${expensesList}

━━━━━━━━━━━━━━━━━━
💰 *إجمالي المصاريف:* ${currencySymbol}${formatNumber(total)}`;
};
