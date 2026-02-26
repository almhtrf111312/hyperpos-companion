import { Capacitor } from '@capacitor/core';
import { NativeMLKitScanner } from './barcode/NativeMLKitScanner';
import { WebBarcodeScanner } from './barcode/WebBarcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  if (Capacitor.isNativePlatform()) {
    return <NativeMLKitScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
  }

  return <WebBarcodeScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
}

