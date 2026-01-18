import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ====== Fix #11: Precise Financial Calculations ======
// Round currency values to exactly 2 decimal places to avoid floating-point errors
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// Safe addition for currency values
export function addCurrency(...amounts: number[]): number {
  const sum = amounts.reduce((acc, val) => acc + (val || 0), 0);
  return roundCurrency(sum);
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

// Format number with Western numerals (123) - always uses en-US locale
export function formatNumber(num: number, decimals: number = 0): string {
  return roundCurrency(num).toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// Format currency with Western numerals - always rounds to 2 decimals
export function formatCurrency(amount: number, symbol: string = '$', decimals: number = 2): string {
  const rounded = roundCurrency(amount);
  return `${symbol}${rounded.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })}`;
}

// Format date and time
export function formatDateTime(dateString: string, locale: string = 'ar-SA'): string {
  const date = new Date(dateString);
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
