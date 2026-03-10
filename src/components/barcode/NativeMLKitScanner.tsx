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
import { useState } from 'react';
import { ScanLine, X, Flashlight, Loader2 } from 'lucide-react';

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
  const [torchOn, setTorchOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

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
      setTorchOn(false);
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

    try { playBeep(); } catch { }
    try { if (navigator.vibrate) navigator.vibrate(200); } catch { }

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
    setIsStarting(true);

    try {
      // Check & request camera permission
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        console.warn('[MLKit Scanner] Camera permission not granted:', camera);
        if (mountedRef.current) {
          setIsStarting(false);
          onClose();
        }
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

      if (mountedRef.current) {
        setIsStarting(false);
      }
    } catch (err: any) {
      console.warn('[MLKit Scanner] Failed to start scanner:', err);
      await cleanup();
      if (mountedRef.current) {
        setIsStarting(false);
        onClose();
      }
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

  const toggleTorch = async () => {
    try {
      const newState = !torchOn;
      await BarcodeScanner.toggleTorch();
      setTorchOn(newState);
    } catch (e) {
      console.warn('[MLKit Scanner] Toggle torch failed:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-transparent flex flex-col pointer-events-auto">
      {/* Header — floating over transparent camera area */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 pt-[calc(max(env(safe-area-inset-top),1.5rem)+0.5rem)] z-[9999] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="w-5 h-5" />
          <span className="text-sm font-semibold">مسح الباركود</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTorch}
            className={`h-11 w-11 rounded-full flex items-center justify-center border ${torchOn ? 'bg-yellow-400/80 border-yellow-300 text-black' : 'bg-black/40 border-white/30 text-white backdrop-blur-md'}`}
          >
            <Flashlight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              cleanup();
              onClose();
            }}
            className="h-11 w-11 rounded-full flex items-center justify-center bg-black/40 border border-white/30 text-white backdrop-blur-md"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Transparent middle area where the native camera shows through */}
      <div className="flex-1 relative">
        {/* Scan guide frame */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[75%] h-[35%] rounded-xl border-2 border-white/70 relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-white/80 animate-pulse" />
          </div>
        </div>

        {isStarting && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 z-[100]">
            <div className="flex items-center gap-2 text-sm text-white">
              <Loader2 className="w-6 h-6 animate-spin" />
              جارٍ تشغيل الماسح...
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-6 text-center bg-black/80 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <p className="text-sm font-medium text-white">وجّه الكاميرا نحو الباركود</p>
      </div>
    </div>
  );
}

