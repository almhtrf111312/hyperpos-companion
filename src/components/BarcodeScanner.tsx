import { OfflineBarcodeScanner } from './barcode/OfflineBarcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/**
 * BarcodeScanner – Unified entry point.
 * Uses a single in-app scanner path on all platforms for consistency.
 */
export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  return <OfflineBarcodeScanner isOpen={isOpen} onClose={onClose} onScan={onScan} />;
}
