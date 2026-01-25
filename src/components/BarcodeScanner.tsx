/**
 * Barcode Scanner - Unified component
 * ====================================
 * Uses html5-qrcode for reliable scanning on both web and mobile
 * 
 * Previous implementation used:
 * - @capacitor-mlkit/barcode-scanning for native (had reliability issues)
 * - react-zxing for web
 * 
 * New implementation uses html5-qrcode which works reliably on:
 * - All browsers (Chrome, Safari, Firefox)
 * - Capacitor WebView (Android/iOS)
 */

import { Html5QrcodeScanner } from './barcode/Html5QrcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  return (
    <Html5QrcodeScanner 
      isOpen={isOpen} 
      onClose={onClose} 
      onScan={onScan} 
    />
  );
}
