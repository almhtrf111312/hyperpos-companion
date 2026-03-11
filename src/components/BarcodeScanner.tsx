import { Capacitor } from '@capacitor/core';
import { NativeMLKitScanner } from './barcode/NativeMLKitScanner';
import { WebBarcodeScanner } from './barcode/WebBarcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/**
 * BarcodeScanner – Unified entry point.
 * On native (APK): uses NativeMLKitScanner (Google ML Kit).
 * On web: uses WebBarcodeScanner (BarcodeDetector API).
 */
export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  if (Capacitor.isNativePlatform()) {
    return <NativeMLKitScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
  }

  return <WebBarcodeScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
}
