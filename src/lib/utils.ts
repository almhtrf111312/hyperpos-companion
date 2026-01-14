import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number with Western numerals (123) - always uses en-US locale
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// Format currency with Western numerals
export function formatCurrency(amount: number, symbol: string = '$', decimals: number = 2): string {
  return `${symbol}${amount.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })}`;
}
