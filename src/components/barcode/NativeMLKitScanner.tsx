import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarcodeFormat, BarcodeScanner, Resolution } from '@capacitor-mlkit/barcode-scanning';
import type { PluginListenerHandle } from '@capacitor/core';
import { playBeep } from '@/lib/sound-utils';
import { ScanLine, X, Flashlight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

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
  BarcodeFormat.Code93,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.Codabar,
  BarcodeFormat.Itf,
  BarcodeFormat.Pdf417,
  BarcodeFormat.Aztec,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
];

const ZOOM_STEPS = [1, 1.5, 2, 3];

export function setScannerTransparency(active: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('barcode-scanner-active', active);
  document.body.classList.toggle('barcode-scanner-active', active);

  try {
    window.dispatchEvent(new CustomEvent('hyperpos:scanner-state', { detail: { active } }));
  } catch (e) {
    console.warn('[Scanner] Event dispatch error:', e);
  }

  // Directly hide any open dialog/overlay elements in the DOM so native camera is 100% visible
  const dialogLayers = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], .dialog-content-layer, .dialog-overlay-layer, [data-radix-portal], [data-radix-focus-guard]'
  );
  dialogLayers.forEach(el => {
    if (!el.closest('.barcode-scanner-modal') && !el.closest('.scanner-ui-overlay')) {
      if (active) {
        if (!el.dataset.scannerPrevDisplay) {
          el.dataset.scannerPrevDisplay = el.style.display || 'block';
        }
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
      } else {
        el.style.display = el.dataset.scannerPrevDisplay === 'block' ? '' : (el.dataset.scannerPrevDisplay || '');
        el.style.removeProperty('visibility');
        el.style.removeProperty('opacity');
        delete el.dataset.scannerPrevDisplay;
      }
    }
  });
}

export function NativeMLKitScanner({ isOpen, onClose, onScan, onFallback }: NativeMLKitScannerProps) {
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const autoZoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopInProgressRef = useRef(false);

  const [torchOn, setTorchOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(8);
  const [tapCount, setTapCount] = useState(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Safely stop scan (guards against double-stop race conditions)
  const safeStopScan = useCallback(async () => {
    if (stopInProgressRef.current) return;
    stopInProgressRef.current = true;
    try {
      await BarcodeScanner.stopScan();
    } catch (e) {
      console.warn('[MLKit Scanner] stopScan error:', e);
    } finally {
      stopInProgressRef.current = false;
    }
  }, []);

  const setZoom = useCallback(async (ratio: number) => {
    try {
      await BarcodeScanner.setZoomRatio({ zoomRatio: ratio });
      setCurrentZoom(ratio);
    } catch (e) {
      console.warn('[MLKit Scanner] setZoom error:', e);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setScannerTransparency(false);
      return;
    }
    if (scanningRef.current) return;

    let cancelled = false;
    let scanListener: PluginListenerHandle | null = null;
    let errorListener: PluginListenerHandle | null = null;
    scanningRef.current = true;
    setIsStarting(true);
    setCurrentZoom(1);
    setTorchOn(false);

    // Immediately hide all dialogs as soon as scan modal is triggered
    setScannerTransparency(true);

    const cleanup = async () => {
      if (autoZoomTimerRef.current) {
        clearTimeout(autoZoomTimerRef.current);
        autoZoomTimerRef.current = null;
      }
      try {
        await scanListener?.remove();
        await errorListener?.remove();
        await safeStopScan();
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

        // NOTE: We intentionally skip installGoogleBarcodeScannerModule here.
        // CameraX + bundled ML Kit does NOT require Google Play Services scanner module.
        // Installing/checking it blocks camera startup by 5–40 seconds on many devices.
        // The module check is only needed for the separate GMS `.scan()` API, not for
        // the continuous CameraX startScan flow we use here.

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

        // Fetch zoom limits for controls
        const minZ = await BarcodeScanner.getMinZoomRatio().catch(() => null);
        const maxZ = await BarcodeScanner.getMaxZoomRatio().catch(() => null);
        if (minZ) setMinZoom(minZ.zoomRatio);
        if (maxZ) setMaxZoom(maxZ.zoomRatio);

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

        // Use 720p (default recommended by Google CameraX) for fast startup.
        // 1080p adds ~300-500ms startup overhead with no real scanning benefit.
        await BarcodeScanner.startScan({ formats: SCAN_FORMATS, resolution: Resolution['1280x720'] });

        // Only make WebView transparent AFTER camera is confirmed started
        // to prevent the "black screen flash" artifact
        if (!cancelled && mountedRef.current) {
          setScannerTransparency(true);
          setIsStarting(false);
        }

        // Auto-zoom: if nothing scanned in 1.8s, bump to 2x to aid small/distant barcodes
        autoZoomTimerRef.current = setTimeout(async () => {
          if (!cancelled && scanningRef.current) {
            try {
              await BarcodeScanner.setZoomRatio({ zoomRatio: 2 });
              if (mountedRef.current) setCurrentZoom(2);
            } catch {}
          }
        }, 1800);

      } catch (err) {
        console.warn('[MLKit Scanner] Failed to start scanner:', err);
        await cleanup();
        if (mountedRef.current && !cancelled) {
          setIsStarting(false);
          onFallbackRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (autoZoomTimerRef.current) {
        clearTimeout(autoZoomTimerRef.current);
        autoZoomTimerRef.current = null;
      }
      if (scanningRef.current) {
        scanListener?.remove().catch(() => {});
        errorListener?.remove().catch(() => {});
        safeStopScan();
        setScannerTransparency(false);
        scanningRef.current = false;
      }
    };
  }, [isOpen, safeStopScan]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    if (!hasTorch) return;
    try {
      // Use toggleTorch() — single atomic API call that stays in sync with hardware state
      await BarcodeScanner.toggleTorch();
      setTorchOn(prev => !prev);
    } catch (e) {
      console.warn('[MLKit Scanner] Toggle torch failed:', e);
    }
  };

  const handleZoomStep = useCallback(async (direction: 'in' | 'out') => {
    const steps = ZOOM_STEPS.filter(z => z >= minZoom && z <= maxZoom);
    const idx = steps.findIndex(z => z >= currentZoom);
    let nextIdx = direction === 'in' ? Math.min(idx + 1, steps.length - 1) : Math.max(idx - 1, 0);
    // If current not found in steps (auto-zoom set 1.5), find closest
    if (idx === -1) nextIdx = direction === 'in' ? steps.length - 1 : 0;
    await setZoom(steps[nextIdx]);
  }, [currentZoom, minZoom, maxZoom, setZoom]);

  const handleZoomPreset = useCallback(async (ratio: number) => {
    await setZoom(Math.min(Math.max(ratio, minZoom), maxZoom));
  }, [minZoom, maxZoom, setZoom]);

  // Double-tap to toggle 1x ↔ 2x
  const handleScreenTap = useCallback(() => {
    setTapCount(prev => {
      const next = prev + 1;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => setTapCount(0), 400);
      if (next >= 2) {
        const target = currentZoom > 1.1 ? minZoom : Math.min(2, maxZoom);
        handleZoomPreset(target);
        return 0;
      }
      return next;
    });
  }, [currentZoom, minZoom, maxZoom, handleZoomPreset]);

  const handleClose = () => {
    if (autoZoomTimerRef.current) {
      clearTimeout(autoZoomTimerRef.current);
      autoZoomTimerRef.current = null;
    }
    safeStopScan();
    setScannerTransparency(false);
    setTorchOn(false);
    scanningRef.current = false;
    onCloseRef.current();
  };

  if (!isOpen) return null;

  const zoomPresets = ZOOM_STEPS.filter(z => z >= minZoom && z <= maxZoom);

  return createPortal(
    <div
      className="barcode-scanner-modal fixed inset-0 z-[99999] bg-transparent flex flex-col pointer-events-auto"
      onClick={handleScreenTap}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 pt-[calc(max(env(safe-area-inset-top),1.5rem)+0.5rem)] z-[9999] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="w-5 h-5" />
          <span className="text-sm font-semibold">مسح الباركود</span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`h-11 w-11 rounded-full flex items-center justify-center border transition-colors ${torchOn ? 'bg-yellow-400/80 border-yellow-300 text-black' : 'bg-black/40 border-white/30 text-white backdrop-blur-md'}`}
              aria-label={torchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="h-11 w-11 rounded-full flex items-center justify-center bg-black/40 border border-white/30 text-white backdrop-blur-md"
            aria-label="إغلاق الماسح"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Camera viewfinder area */}
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
              جارٍ تشغيل الكاميرا...
            </div>
          </div>
        )}

        {/* Zoom controls overlay - positioned at bottom of viewfinder (forced LTR for logical order) */}
        {!isStarting && zoomPresets.length > 1 && (
          <div
            dir="ltr"
            className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2 z-[9999]"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleZoomStep('out')}
              className="h-9 w-9 rounded-full bg-black/50 border border-white/25 text-white backdrop-blur-md flex items-center justify-center"
              aria-label="تصغير الزووم"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {zoomPresets.map(z => (
              <button
                key={z}
                type="button"
                onClick={() => handleZoomPreset(z)}
                className={`h-9 min-w-[2.5rem] px-2 rounded-full border text-xs font-bold backdrop-blur-md transition-colors
                  ${Math.abs(currentZoom - z) < 0.2
                    ? 'bg-white text-black border-white'
                    : 'bg-black/50 border-white/25 text-white'}`}
                aria-label={`زووم ${z}x`}
              >
                {z === 1 ? '1×' : `${z}×`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleZoomStep('in')}
              className="h-9 w-9 rounded-full bg-black/50 border border-white/25 text-white backdrop-blur-md flex items-center justify-center"
              aria-label="تكبير الزووم"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-6 text-center bg-black/80 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <p className="text-sm font-medium text-white">وجّه الكاميرا نحو الباركود</p>
        <p className="text-xs text-white/50 mt-1">انقر مرتين للتبديل بين 1× و 2×</p>
      </div>
    </div>,
    document.body
  );
}
