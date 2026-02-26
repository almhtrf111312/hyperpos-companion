// Native Scanner using @capacitor-mlkit/barcode-scanning (Google ML Kit)
// ALWAYS uses startScan() (in-app camera behind WebView) to avoid Activity Recreation on Android
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
  const lastScannedRef = useRef<string>(''); // dedupe guard
  const lastScannedTimeRef = useRef<number>(0);

  const setScannerTransparency = useCallback((active: boolean) => {
    document.documentElement.classList.toggle('barcode-scanner-active', active);
    document.body.classList.toggle('barcode-scanner-active', active);
    document.getElementById('root')?.classList.toggle('barcode-scanner-active', active);
  }, []);

  const cleanup = useCallback(async () => {
    try {
      if (listenerRef.current) {
        await listenerRef.current.remove();
        listenerRef.current = null;
      }
      await BarcodeScanner.stopScan();
      setScannerTransparency(false);
    } catch (e) {
      console.warn('[MLKit Scanner] Cleanup error:', e);
    }
    scanningRef.current = false;
  }, [setScannerTransparency]);

  const handleBarcode = useCallback((barcode: string) => {
    // Dedupe: ignore same barcode within 2 seconds
    const now = Date.now();
    if (barcode === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) {
      console.log('[MLKit Scanner] Dedupe: ignoring repeat scan:', barcode);
      return;
    }
    lastScannedRef.current = barcode;
    lastScannedTimeRef.current = now;

    console.log('[MLKit Scanner] Scanned:', barcode);

    // ✅ Save to localStorage FIRST — survives Activity Recreation
    try {
      localStorage.setItem(PENDING_BARCODE_KEY, barcode);
    } catch (e) {
      console.warn('[MLKit Scanner] Could not save pending barcode:', e);
    }

    try { playBeep(); } catch {}
    try { if (navigator.vibrate) navigator.vibrate(200); } catch {}

    cleanup();

    if (mountedRef.current) {
      try {
        onScan(barcode);
        onClose();
      } catch (e) {
        console.warn('[MLKit Scanner] Error in onScan/onClose:', e);
      }
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

      // ✅ ALWAYS use startScan() (in-app camera behind WebView)
      // This avoids launching an external Activity which causes WebView restart on Android
      setScannerTransparency(true);

      // Listen for barcode events (both event names for compatibility)
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
  }, [onClose, handleBarcode, cleanup, setScannerTransparency]);

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

  // The native plugin handles its own UI (camera behind WebView), so we render nothing
  return null;
}
