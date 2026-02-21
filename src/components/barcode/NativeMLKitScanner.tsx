// Native Scanner using @capacitor-community/barcode-scanner
// Uses startScanning()+callback pattern which survives Android Activity Recreation
import { useEffect, useRef, useCallback } from 'react';
import { BarcodeScanner, SupportedFormat } from '@capacitor-community/barcode-scanner';
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
  const callbackIdRef = useRef<string | null>(null);

  const stopScanner = useCallback(async () => {
    try {
      await BarcodeScanner.stopScan();
      await BarcodeScanner.showBackground();
      document.body.classList.remove('scanner-active');
    } catch (e) {
      console.warn('[Scanner] Stop error:', e);
    }
    scanningRef.current = false;
    callbackIdRef.current = null;
  }, []);

  const startScanning = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    try {
      // Check camera permission
      const status = await BarcodeScanner.checkPermission({ force: true });
      if (!status.granted) {
        console.warn('[Scanner] Camera permission not granted');
        if (mountedRef.current) onClose();
        scanningRef.current = false;
        return;
      }

      // Hide WebView background to show camera feed
      document.body.classList.add('scanner-active');
      await BarcodeScanner.hideBackground();

      // Use startScanning with callback - this pattern survives Activity Recreation
      // because the callback gets called as soon as scan completes regardless of Promise state
      callbackIdRef.current = await BarcodeScanner.startScanning(
        {
          targetedFormats: [
            SupportedFormat.QR_CODE,
            SupportedFormat.EAN_13,
            SupportedFormat.EAN_8,
            SupportedFormat.CODE_128,
            SupportedFormat.CODE_39,
            SupportedFormat.DATA_MATRIX,
            SupportedFormat.UPC_A,
            SupportedFormat.UPC_E,
          ],
        },
        async (result, err) => {
          if (err) {
            console.warn('[Scanner] Scan error from callback:', err);
            await stopScanner();
            if (mountedRef.current) onClose();
            return;
          }

          if (result.hasContent && result.content) {
            const barcode = result.content;
            console.log('[Scanner] Scanned via callback:', barcode);

            // Save to localStorage as backup across potential WebView restarts
            try {
              localStorage.setItem(PENDING_BARCODE_KEY, barcode);
            } catch (e) {
              console.warn('[Scanner] Could not save pending barcode:', e);
            }

            playBeep();
            if (navigator.vibrate) navigator.vibrate(200);

            await stopScanner();

            if (mountedRef.current) {
              onScan(barcode);
              onClose();
              // Clear backup after successful processing
              setTimeout(() => {
                try { localStorage.removeItem(PENDING_BARCODE_KEY); } catch { }
              }, 3000);
            }
          }
        }
      );

    } catch (err: any) {
      console.warn('[Scanner] Failed to start scanner:', err);
      await stopScanner();
      if (mountedRef.current) onClose();
    }
  }, [onScan, onClose, stopScanner]);

  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      startScanning();
    }
    return () => {
      mountedRef.current = false;
      if (scanningRef.current) {
        stopScanner();
      }
    };
  }, [isOpen, startScanning, stopScanner]);

  // The native plugin handles its own UI, so we render nothing
  return null;
}
