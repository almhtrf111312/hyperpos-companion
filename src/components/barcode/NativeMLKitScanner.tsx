import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarcodeFormat, BarcodeScanner, Resolution } from '@capacitor-mlkit/barcode-scanning';
import type { PluginListenerHandle } from '@capacitor/core';
import { playBeep } from '@/lib/sound-utils';
import { ScanLine, X, Flashlight, Loader2, ZoomIn, ZoomOut, AlertTriangle, Keyboard, RotateCcw, Check } from 'lucide-react';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
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

  const handleClose = useCallback(() => {
    if (autoZoomTimerRef.current) {
      clearTimeout(autoZoomTimerRef.current);
      autoZoomTimerRef.current = null;
    }
    safeStopScan();
    setScannerTransparency(false);
    setTorchOn(false);
    scanningRef.current = false;
    setErrorMessage(null);
    setShowManualInput(false);
    onCloseRef.current();
  }, [safeStopScan]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setShowManualInput(false);
    setIsStarting(true);
    setRetryTrigger(c => c + 1);
  }, []);

  const handleManualSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualBarcode.trim();
    if (!code) return;
    try { localStorage.setItem(PENDING_BARCODE_KEY, code); } catch (e) {}
    try { playBeep(); } catch {}
    handleClose();
    onScanRef.current(code);
  }, [manualBarcode, handleClose]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setShowManualInput(false);
      setScannerTransparency(false);
      return;
    }
    if (scanningRef.current) return;

    let cancelled = false;
    let scanListener: PluginListenerHandle | null = null;
    let errorListener: PluginListenerHandle | null = null;
    scanningRef.current = true;
    setIsStarting(true);
    setErrorMessage(null);
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
        if (!supported.supported) {
          throw new Error('قارئ ML Kit غير مدعوم على هذا النظام.');
        }

        let status = await BarcodeScanner.checkPermissions();
        if (status.camera === 'prompt' || status.camera === 'prompt-with-rationale') {
          status = await BarcodeScanner.requestPermissions();
        }
        if (status.camera !== 'granted' || cancelled) {
          console.warn('[MLKit Scanner] Camera permission not granted:', status);
          await cleanup();
          if (mountedRef.current && !cancelled) {
            setIsStarting(false);
            setScannerTransparency(false);
            setErrorMessage('لم يتم منح إذن الكاميرا. يمكنك كتابة رقم الباركود يدوياً أدناه أو تفعيل الإذن من إعدادات الجهاز.');
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
          if (mountedRef.current && !cancelled) {
            setIsStarting(false);
            setScannerTransparency(false);
            setErrorMessage(`تعذر استمرار المسح (${message || 'خطأ غير متوقع'}). يمكنك كتابة رقم الباركود يدوياً.`);
          }
        });

        // Use 720p (default recommended by Google CameraX) for fast startup.
        await BarcodeScanner.startScan({ formats: SCAN_FORMATS, resolution: Resolution['1280x720'] });

        // Only make WebView transparent AFTER camera is confirmed started
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

      } catch (err: any) {
        console.warn('[MLKit Scanner] Failed to start scanner:', err);
        await cleanup();
        if (mountedRef.current && !cancelled) {
          setIsStarting(false);
          setScannerTransparency(false);
          setErrorMessage(err?.message || 'تعذر تشغيل ماسح الباركود (ML Kit). يمكنك إدخال رقم الباركود يدوياً أو إعادة المحاولة.');
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
  }, [isOpen, retryTrigger, safeStopScan]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!isOpen) return null;

  const zoomPresets = ZOOM_STEPS.filter(z => z >= minZoom && z <= maxZoom);

  return createPortal(
    <div
      className={`barcode-scanner-modal fixed inset-0 z-[99999] flex flex-col pointer-events-auto ${errorMessage || showManualInput ? 'bg-neutral-950/95 backdrop-blur-md' : 'bg-transparent'}`}
      onClick={handleScreenTap}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 pt-[calc(max(env(safe-area-inset-top),1.5rem)+0.5rem)] z-[9999] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="w-5 h-5" />
          <span className="text-sm font-semibold">مسح الباركود</span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setShowManualInput(prev => !prev)}
            className={`h-11 px-3 rounded-full flex items-center gap-1.5 transition-colors ${showManualInput ? 'bg-white text-black border-white' : 'bg-black/65 hover:bg-black/80 !text-white [&_svg]:!text-white border border-white/25 shadow-md'}`}
            aria-label="إدخال يدوي"
          >
            <Keyboard className="w-4 h-4" />
            <span className="text-xs font-medium">يدوي</span>
          </button>
          {hasTorch && !errorMessage && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${torchOn ? 'bg-yellow-400/80 border-yellow-300 text-black' : 'bg-black/65 hover:bg-black/80 !text-white [&_svg]:!text-white border border-white/25 shadow-md'}`}
              aria-label={torchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="h-11 w-11 rounded-full flex items-center justify-center bg-black/65 hover:bg-black/80 !text-white [&_svg]:!text-white border border-white/25 shadow-md transition-colors"
            aria-label="إغلاق الماسح"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Camera viewfinder area */}
      <div className="flex-1 relative">
        {!errorMessage && !showManualInput && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[75%] h-[35%] rounded-xl border-2 border-white/70 relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-white/80 animate-pulse" />
            </div>
          </div>
        )}

        {isStarting && !errorMessage && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 z-[100]">
            <div className="flex items-center gap-2 text-sm text-white">
              <Loader2 className="w-6 h-6 animate-spin" />
              جارٍ تشغيل الكاميرا...
            </div>
          </div>
        )}

        {/* Error message card with manual input & retry options */}
        {errorMessage && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center p-4 bg-black/90">
            <div
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-amber-400 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-semibold">تعذر تشغيل كاميرا الماسح</h3>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed mb-4">
                {errorMessage}
              </p>

              {/* Manual barcode input form */}
              <form onSubmit={handleManualSubmit} className="space-y-3 mb-5">
                <label className="block text-xs font-medium text-neutral-400">
                  إدخال الباركود يدوياً:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    autoFocus
                    value={manualBarcode}
                    onChange={e => setManualBarcode(e.target.value)}
                    placeholder="مثال: 628100123456"
                    className="flex-1 px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={!manualBarcode.trim()}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>تأكيد</span>
                  </button>
                </div>
              </form>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 [&_svg]:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:[&_svg]:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة المحاولة</span>
                  </button>
                  {onFallbackRef.current && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        onFallbackRef.current?.();
                      }}
                      className="flex-1 py-2.5 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 [&_svg]:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:[&_svg]:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>ماسح الويب</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 [&_svg]:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:[&_svg]:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-xs transition-colors"
                >
                  إلغاء وإغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual entry modal when toggled voluntarily */}
        {showManualInput && !errorMessage && (
          <div
            className="absolute inset-0 z-[150] flex items-center justify-center p-4 bg-black/80"
            onClick={() => setShowManualInput(false)}
          >
            <div
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-semibold">إدخال الباركود يدوياً</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 [&_svg]:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:[&_svg]:text-zinc-100 border border-zinc-300 dark:border-zinc-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                    رقم الباركود:
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    autoFocus
                    value={manualBarcode}
                    onChange={e => setManualBarcode(e.target.value)}
                    placeholder="مثال: 628100123456"
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!manualBarcode.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>إضافة المنتج</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualInput(false)}
                    className="px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 [&_svg]:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:[&_svg]:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm transition-colors"
                  >
                    رجوع للكاميرا
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Zoom controls overlay - positioned at bottom of viewfinder (forced LTR for logical order) */}
        {!isStarting && !errorMessage && !showManualInput && zoomPresets.length > 1 && (
          <div
            dir="ltr"
            className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2 z-[9999]"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleZoomStep('out')}
              className="h-9 w-9 rounded-full bg-black/65 hover:bg-black/80 !text-white [&_svg]:!text-white border border-white/25 shadow-md flex items-center justify-center transition-colors"
              aria-label="تصغير الزووم"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {zoomPresets.map(z => (
              <button
                key={z}
                type="button"
                onClick={() => handleZoomPreset(z)}
                className={`h-9 min-w-[2.5rem] px-2 rounded-full border text-xs font-bold transition-colors
                  ${Math.abs(currentZoom - z) < 0.2
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-black/65 hover:bg-black/80 !text-white [&_svg]:!text-white border border-white/25 shadow-md'}`}
                aria-label={`زووم ${z}x`}
              >
                {z === 1 ? '1×' : `${z}×`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleZoomStep('in')}
              className="h-9 w-9 rounded-full bg-black/65 hover:bg-black/80 !text-white [&_svg]:!text-white border border-white/25 shadow-md flex items-center justify-center transition-colors"
              aria-label="تكبير الزووم"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {!errorMessage && !showManualInput && (
        <div className="px-4 py-6 text-center bg-black/80 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <p className="text-sm font-medium text-white">وجّه الكاميرا نحو الباركود</p>
          <p className="text-xs text-white/50 mt-1">انقر مرتين للتبديل بين 1× و 2×</p>
        </div>
      )}
    </div>,
    document.body
  );
}
