export const PRINTER_CONFIG_KEY = 'flowpos_printer_config';

export interface PrinterConfig {
  connectionType: 'bluetooth' | 'wired_system';
  deviceName?: string;
  deviceAddress?: string; // MAC Address or Device ID
  paperWidth: '58mm' | '80mm' | 'A4';
  autoPrintAfterSale?: boolean;
}

export function getStoredPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(PRINTER_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[Printer] Failed to read printer config:', e);
  }
  const isMobile = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  return {
    connectionType: isMobile ? 'bluetooth' : 'wired_system',
    paperWidth: '80mm',
    autoPrintAfterSale: true,
  };
}

export function saveStoredPrinterConfig(config: PrinterConfig): void {
  try {
    localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowpos:printer-config-changed', { detail: config }));
    }
  } catch (e) {
    console.warn('[Printer] Failed to save printer config:', e);
  }
}
