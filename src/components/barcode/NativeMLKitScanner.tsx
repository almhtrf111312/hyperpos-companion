import React, { useEffect, useRef, useState } from 'react';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import type { PluginListenerHandle } from '@capacitor/core';
import { playBeep } from '@/lib/sound-utils';
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

function setScannerTransparency(active: boolean) {
  document.documentElement.classList.toggle('barcode-scanner-active', active);
  document.body.classList.toggle('barcode-scanner-active', active);
}

export function NativeMLKitScanner({ isOpen, onClose, onScan, onFallback }: NativeMLKitScannerProps) {
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const [torchOn, setTorchOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Store callbacks in refs to avoid effect re-triggers
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const onFallbackRef = useRef<(() => void) | undefined>(onFallback);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;
  onFallbackRef.current = onFallback;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (scanningRef.current) return;

    let cancelled = false;
    let scanListener: PluginListenerHandle | null = null;
    let errorListener: PluginListenerHandle | null = null;
    scanningRef.current = true;
    setIsStarting(true);

    const cleanup = async () => {
      try {
        await scanListener?.remove();
        await errorListener?.remove();
        await BarcodeScanner.stopScan();
      } catch (e) {
        console.warn('[MLKit Scanner] Cleanup error:', e);
      }
      setScannerTransparency(false);
      setTorchOn(false);
      scanningRef.current = false;
    };

    (async () => {
      try {
        const supported = await BarcodeScanner.isSupported();
        if (!supported.supported) throw new Error('Barcode scanning is not supported');

        let status = await BarcodeScanner.checkPermissions();
        if (status.camera === 'prompt' || status.camera === 'prompt-with-rationale') {
          status = await BarcodeScanner.requestPermissions();
        }
        if (status.camera !== 'granted' || cancelled) {
          console.warn('[MLKit Scanner] Camera permission not granted:', status);
          await cleanup();
          if (mountedRef.current && !cancelled) {
            setIsStarting(false);
            onCloseRef.current();
          }
          return;
        }

        const torch = await BarcodeScanner.isTorchAvailable().catch(() => ({ available: false }));
        setHasTorch(torch.available);
        setScannerTransparency(true);

        scanListener = await BarcodeScanner.addListener('barcodesScanned', async ({ barcodes }) => {
          const barcode = barcodes.find(item => item.rawValue || item.displayValue)?.rawValue
            || barcodes.find(item => item.displayValue)?.displayValue;
          if (!barcode || cancelled) return;
          const now = Date.now();
          if (barcode === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) {
            return;
          }
          lastScannedRef.current = barcode;
          lastScannedTimeRef.current = now;

          console.log('[MLKit Scanner] Scanned:', barcode);
          try { localStorage.setItem(PENDING_BARCODE_KEY, barcode); } catch (e) { console.warn(e); }
          try { playBeep(); } catch {}
          try { if (navigator.vibrate) navigator.vibrate(200); } catch {}

          await cleanup();
          if (mountedRef.current) {
            onScanRef.current(barcode);
            onCloseRef.current();
          }
        });
        errorListener = await BarcodeScanner.addListener('scanError', async ({ message }) => {
          console.warn('[MLKit Scanner] Scan error:', message);
          await cleanup();
          if (mountedRef.current && !cancelled) onFallbackRef.current?.();
        });

        await BarcodeScanner.startScan({ formats: SCAN_FORMATS });
        if (mountedRef.current) setIsStarting(false);
      } catch (err) {
        console.warn('[MLKit Scanner] Failed to start scanner:', err);
        await cleanup();
        if (mountedRef.current && !cancelled) {
          setIsStarting(false);
          onFallbackRef.current?.();
          onCloseRef.current();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scanningRef.current) {
        scanListener?.remove().catch(() => {});
        errorListener?.remove().catch(() => {});
        BarcodeScanner.stopScan().catch(() => {});
        setScannerTransparency(false);
        scanningRef.current = false;
      }
    };
  }, [isOpen]); // Only depend on isOpen — callbacks via refs

  const toggleTorch = async () => {
    try {
      if (torchOn) {
        await BarcodeScanner.disableTorch();
        setTorchOn(false);
      } else {
        await BarcodeScanner.enableTorch();
        setTorchOn(true);
      }
    } catch (e) {
      console.warn('[MLKit Scanner] Toggle torch failed:', e);
    }
  };

  const handleClose = () => {
    BarcodeScanner.stopScan().catch(() => {});
    setScannerTransparency(false);
    setTorchOn(false);
    scanningRef.current = false;
    onCloseRef.current();
  };

  if (!isOpen) return null;

  return (
    <div className="barcode-scanner-modal fixed inset-0 z-[120] bg-transparent flex flex-col pointer-events-auto">
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 pt-[calc(max(env(safe-area-inset-top),1.5rem)+0.5rem)] z-[9999] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="w-5 h-5" />
          <span className="text-sm font-semibold">مسح الباركود</span>
        </div>
        <div className="flex items-center gap-3">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`h-11 w-11 rounded-full flex items-center justify-center border ${torchOn ? 'bg-yellow-400/80 border-yellow-300 text-black' : 'bg-black/40 border-white/30 text-white backdrop-blur-md'}`}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="h-11 w-11 rounded-full flex items-center justify-center bg-black/40 border border-white/30 text-white backdrop-blur-md"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
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
