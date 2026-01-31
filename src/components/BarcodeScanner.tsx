import { NativeMLKitScanner } from './barcode/NativeMLKitScanner';

/**
 * Barcode Scanner - Strictly Native ML Kit
 * =========================================================
 * 
 * As per strict audit requirements, purely using ML Kit.
 * No HTML5/Web fallback libraries allowed (Html5Qrcode/Zxing Removed).
 */

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  // Directly render NativeMLKitScanner
  // It handles its own permissions and logic.
  // If running on Web, this might error or do nothing depending on ML Kit web support (which is limited/none).
  // But we removed the fallbacks as requested.

  return (
    <NativeMLKitScanner
      isOpen={isOpen}
      onClose={onClose}
      onScan={onScan}
    // No fallback prop provided as we removed fallback libs
    />
  );
}
