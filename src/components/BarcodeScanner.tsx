import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { OfflineBarcodeScanner } from './barcode/OfflineBarcodeScanner';
import { NativeMLKitScanner } from './barcode/NativeMLKitScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/**
 * BarcodeScanner – Unified entry point.
 * Uses native ML Kit scanner on Capacitor apps, otherwise falls back to offline web scanner.
 */
export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const isNative = Capacitor.isNativePlatform();
  const [forceWebScanner, setForceWebScanner] = useState(false);

  if (isNative && !forceWebScanner) {
    return (
      <NativeMLKitScanner
        isOpen={isOpen}
        onClose={onClose}
        onScan={onScan}
        onFallback={() => setForceWebScanner(true)}
      />
    );
  }

  return <OfflineBarcodeScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
}
