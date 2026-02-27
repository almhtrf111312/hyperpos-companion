import { Capacitor } from '@capacitor/core';
import { OfflineBarcodeScanner } from './barcode/OfflineBarcodeScanner';
import { WebBarcodeScanner } from './barcode/WebBarcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/**
 * BarcodeScanner – Unified entry point.
 * On native (APK): uses OfflineBarcodeScanner (in-app camera + BarcodeDetector API).
 *   This avoids external activities and prevents WebView restart/Activity Recreation.
 * On web: uses WebBarcodeScanner (same BarcodeDetector API but different UI context).
 * 
 * Both are fully offline — no cloud dependency during scanning.
 */
export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  // On native platforms, use the offline scanner to avoid activity restart
  if (Capacitor.isNativePlatform()) {
    return <OfflineBarcodeScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
  }

  return <WebBarcodeScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
}
