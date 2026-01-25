// Barcode Scanner - Unified component that uses ML Kit on mobile, ZXing on web
import { Capacitor } from '@capacitor/core';
import { NativeMLKitScanner } from './barcode/NativeMLKitScanner';
import { WebBarcodeScanner } from './barcode/WebBarcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/**
 * Unified Barcode Scanner component
 * - On native platforms (Android/iOS): Uses ML Kit for faster, more accurate scanning
 * - On web: Uses react-zxing as fallback
 */
export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const isNativePlatform = Capacitor.isNativePlatform();

  if (isNativePlatform) {
    return (
      <NativeMLKitScanner 
        isOpen={isOpen} 
        onClose={onClose} 
        onScan={onScan} 
      />
    );
  }

  return (
    <WebBarcodeScanner 
      isOpen={isOpen} 
      onClose={onClose} 
      onScan={onScan} 
    />
  );
}
