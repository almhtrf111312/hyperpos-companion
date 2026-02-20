// Native Scanner using @capacitor/barcode-scanner (Official Capacitor 8 plugin)
// Uses native scanning UI - no custom overlay needed
import { useEffect, useRef, useCallback } from 'react';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { playBeep } from '@/lib/sound-utils';

// Key used to persist the scanned barcode across potential app restarts
export const PENDING_BARCODE_KEY = 'hyperpos_pending_scan';

interface NativeMLKitScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onFallback?: () => void;
}

export function NativeMLKitScanner({ isOpen, onClose, onScan }: NativeMLKitScannerProps) {
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);

  const startScanning = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    try {
      // The new plugin opens a native full-screen scanner UI automatically
      // No need for permission management, background hiding, or custom overlays
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
      });

      if (result.ScanResult && mountedRef.current) {
        console.log('[Scanner] Scanned:', result.ScanResult);
        // ✅ حفظ الباركود في localStorage كنسخة احتياطية
        // (في حال أعاد الأندرويد بناء WebView بعد إغلاق الماسح)
        try {
          localStorage.setItem(PENDING_BARCODE_KEY, result.ScanResult);
        } catch (e) {
          console.warn('[Scanner] Could not save pending barcode:', e);
        }
        playBeep();
        if (navigator.vibrate) navigator.vibrate(200);
        onScan(result.ScanResult);
        // مسح النسخة الاحتياطية بعد المعالجة الناجحة
        setTimeout(() => {
          try { localStorage.removeItem(PENDING_BARCODE_KEY); } catch {}
        }, 3000);
      }
    } catch (err: any) {
      // User cancelled or error occurred
      console.warn('[Scanner] Scan cancelled or error:', err);
    } finally {
      scanningRef.current = false;
      if (mountedRef.current) onClose();
    }
  }, [onScan, onClose]);

  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      startScanning();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [isOpen, startScanning]);

  // The native plugin handles its own UI, so we render nothing
  return null;
}
