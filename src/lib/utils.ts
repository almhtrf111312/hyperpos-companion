import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getDisplayCurrency, getCurrencySymbolByCode, getActiveStoreCurrency, formatReportAmount } from "./currencies";
import { toUsd, fromUsd, round8, getActiveCurrencyDef, roundForCurrency, preciseAdd, preciseSubtract, preciseMultiply, preciseDivide } from "./money-engine";
export { getActiveStoreCurrency, formatReportAmount, toUsd, fromUsd, round8, roundForCurrency, preciseAdd, preciseSubtract, preciseMultiply, preciseDivide };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ====== Precise Financial Calculations ======
// Round currency values to exactly 2 decimal places (cents)
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// Safe addition for currency values
export function addCurrency(...amounts: number[]): number {
  const sum = amounts.reduce((acc, val) => acc + (val || 0), 0);
  return roundCurrency(sum);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// Safe subtraction for currency values
export function subtractCurrency(a: number, b: number): number {
  return roundCurrency((a || 0) - (b || 0));
}

// Safe multiplication for currency (e.g., price * quantity)
export function multiplyCurrency(amount: number, multiplier: number): number {
  return roundCurrency((amount || 0) * (multiplier || 0));
}

// Safe division for currency (e.g., calculating percentages)
export function divideCurrency(amount: number, divisor: number): number {
  if (divisor === 0) return 0;
  return roundCurrency((amount || 0) / divisor);
}

// Calculate percentage of an amount
export function percentageOf(amount: number, percentage: number): number {
  return roundCurrency(((amount || 0) * (percentage || 0)) / 100);
}

// Format number with Western numerals (123) - uses Intl.NumberFormat for Android WebView compatibility
export function formatNumber(num: number, decimals: number = 3): string {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((Number(num || 0) + Number.EPSILON) * factor) / factor;
  return formatter.format(rounded);
}

// Format currency with Western numerals - uses Intl.NumberFormat for Android WebView compatibility
export function formatCurrency(amount: number, symbol?: string, decimals: number = 2): string {
  let effectiveSymbol = symbol;
  if (!effectiveSymbol) {
    effectiveSymbol = getActiveStoreCurrency().symbol;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((Number(amount || 0) + Number.EPSILON) * factor) / factor;
  const formatted = formatter.format(rounded);
  const cleanSymbol = (effectiveSymbol || '').trim();

  // علامات العملات الغربية تسبق الرقم ($46, €46, £46)
  if (cleanSymbol === '$' || cleanSymbol === '€' || cleanSymbol === '£') {
    return `${cleanSymbol}${formatted}`;
  }

  // كافة الرموز الأخرى (العملات العربية مثل ل.ل، د.أ، د.ك، ل.س أو ₺ أو أي كود/رمز) توضع بعد الرقم بفاصل غير منكسر
  return `${formatted}\u00A0${cleanSymbol}`;
}

// Format money with correct symbol from currencyCode or default display currency
export function formatMoney(amount: number, currencyCode?: string, decimals?: number): string {
  if (currencyCode) {
    const sym = getCurrencySymbolByCode(currencyCode);
    return formatCurrency(amount, sym, decimals ?? 2);
  }
  return formatUsdAsActive(amount, decimals);
}

/**
 * Format base USD amount into the active store currency using the active exchange rate.
 */
export function formatUsdAsActive(usdAmount: number, decimals?: number): string {
  const active = getActiveCurrencyDef();
  const converted = fromUsd(usdAmount, active.code, active.rate);
  const dec = typeof decimals === 'number' ? decimals : active.decimals;
  return formatCurrency(converted, active.symbol, dec);
}

// Convert Arabic numerals (٠١٢٣٤٥٦٧٨٩) to Western numerals (0123456789)
export function toWesternNumerals(str: string): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = str;
  arabicNumerals.forEach((arabic, index) => {
    result = result.replace(new RegExp(arabic, 'g'), index.toString());
  });
  return result;
}

// Format date and time - ALWAYS with Western numerals
export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format date only - ALWAYS with Western numerals (MM/DD/YYYY or DD/MM/YYYY based on preference, using default en-US for consistency)
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// Format time only - ALWAYS with Western numerals
export function formatTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
