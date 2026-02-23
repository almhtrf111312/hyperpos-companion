// Native Scanner using @capacitor-mlkit/barcode-scanning (Google ML Kit)
// Best-in-class barcode scanning for POS applications
import { useEffect, useRef, useCallback } from 'react';
import {
  BarcodeScanner,
  BarcodeFormat,
  LensFacing,
} from '@capacitor-mlkit/barcode-scanning';
import type { PluginListenerHandle } from '@capacitor/core';
import { playBeep } from '@/lib/sound-utils';

// Key used to persist the scanned barcode across potential app restarts
export const PENDING_BARCODE_KEY = 'hyperpos_pending_scan';

interface NativeMLKitScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onFallback?: () => void;
}

const SCAN_FORMATS = [
  BarcodeFormat.QrCode,
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.Code128,
  BarcodeFormat.Code39,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
];

export function NativeMLKitScanner({ isOpen, onClose, onScan }: NativeMLKitScannerProps) {
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);
  const listenerRef = useRef<PluginListenerHandle | null>(null);

  const cleanup = useCallback(async () => {
    try {
      if (listenerRef.current) {
        await listenerRef.current.remove();
        listenerRef.current = null;
      }
      await BarcodeScanner.stopScan();
      document.body.classList.remove('scanner-active');
    } catch (e) {
      console.warn('[MLKit Scanner] Cleanup error:', e);
    }
    scanningRef.current = false;
  }, []);

  const handleBarcode = useCallback((barcode: string) => {
    console.log('[MLKit Scanner] Scanned:', barcode);

    // Save to localStorage for Activity Recreation recovery
    try {
      localStorage.setItem(PENDING_BARCODE_KEY, barcode);
    } catch (e) {
      console.warn('[MLKit Scanner] Could not save pending barcode:', e);
    }

    playBeep();
    if (navigator.vibrate) navigator.vibrate(200);

    cleanup();

    if (mountedRef.current) {
      onScan(barcode);
      onClose();
    }
  }, [onScan, onClose, cleanup]);

  const startScanning = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    try {
      // Check & request camera permission
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        console.warn('[MLKit Scanner] Camera permission not granted:', camera);
        if (mountedRef.current) onClose();
        scanningRef.current = false;
        return;
      }

      // Try Google Barcode Scanner (simple full-screen native UI, no camera permission needed)
      let useGoogleScanner = false;
      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        useGoogleScanner = available;
      } catch {
        useGoogleScanner = false;
      }

      if (useGoogleScanner) {
        // scan() opens a native full-screen scanner, returns result directly
        const { barcodes } = await BarcodeScanner.scan({ formats: SCAN_FORMATS });

        if (barcodes.length > 0 && barcodes[0].rawValue) {
          handleBarcode(barcodes[0].rawValue);
        } else {
          // User cancelled
          scanningRef.current = false;
          if (mountedRef.current) onClose();
        }
        return;
      }

      // Fallback: use startScan + event listener (camera view in WebView)
      document.body.classList.add('scanner-active');

      // Listen for barcode events
      listenerRef.current = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        if (event.barcodes?.length > 0 && event.barcodes[0].rawValue) {
          handleBarcode(event.barcodes[0].rawValue);
        }
      });

      await BarcodeScanner.startScan({
        formats: SCAN_FORMATS,
        lensFacing: LensFacing.Back,
      });

    } catch (err: any) {
      console.warn('[MLKit Scanner] Failed to start scanner:', err);
      await cleanup();
      if (mountedRef.current) onClose();
    }
  }, [onClose, handleBarcode, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      startScanning();
    }
    return () => {
      mountedRef.current = false;
      if (scanningRef.current) {
        cleanup();
      }
    };
  }, [isOpen, startScanning, cleanup]);

  // The native plugin handles its own UI, so we render nothing
  return null;
}
