/**
 * OfflineBarcodeScanner – Fully offline, in-app barcode scanner.
 * Uses the device camera via getUserMedia + BarcodeDetector API (native in Android WebView).
 * No external activities, no cloud dependency, no ML Kit plugin.
 * This prevents the Android Activity Recreation / WebView restart issue entirely.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X, RotateCcw, Flashlight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playBeep } from '@/lib/sound-utils';

export const PENDING_BARCODE_KEY = 'hyperpos_pending_scan';

interface OfflineBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

const SUPPORTED_FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'data_matrix',
  'upc_a',
  'upc_e',
  'codabar',
  'itf',
];

export function OfflineBarcodeScanner({ isOpen, onClose, onScan }: OfflineBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const detectingRef = useRef(false);
  const scannedRef = useRef(false);
  const mountedRef = useRef(true);

  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Dedupe: prevent same barcode within 2s
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    detectingRef.current = false;
    scannedRef.current = false;
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleDetected = useCallback((barcode: string) => {
    if (scannedRef.current) return;

    // Dedupe guard
    const now = Date.now();
    if (barcode === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) {
      return;
    }
    lastScannedRef.current = barcode;
    lastScannedTimeRef.current = now;
    scannedRef.current = true;

    console.log('[Offline Scanner] Scanned:', barcode);

    // ✅ Save to localStorage FIRST — survives any restart
    try {
      localStorage.setItem(PENDING_BARCODE_KEY, barcode);
    } catch (e) {
      console.warn('[Offline Scanner] Could not save pending barcode:', e);
    }

    try { playBeep(); } catch {}
    try { if (navigator.vibrate) navigator.vibrate(150); } catch {}

    stopCamera();

    if (mountedRef.current) {
      onScan(barcode);
      onClose();
    }
  }, [onClose, onScan, stopCamera]);

  const toggleTorch = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const newState = !torchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: newState }] });
      setTorchOn(newState);
    } catch (e) {
      console.warn('[Offline Scanner] Torch toggle failed:', e);
    }
  }, [torchOn]);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setIsStarting(true);
    scannedRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('CAMERA_API_NOT_SUPPORTED');
      }

      // Check for BarcodeDetector support
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (!BarcodeDetectorClass) {
        throw new Error('BARCODE_DETECTOR_NOT_SUPPORTED');
      }

      // Filter to only supported formats
      let supportedFormats = SUPPORTED_FORMATS;
      try {
        const available = await BarcodeDetectorClass.getSupportedFormats();
        supportedFormats = SUPPORTED_FORMATS.filter(f => available.includes(f));
      } catch {}

      if (supportedFormats.length === 0) {
        throw new Error('NO_SUPPORTED_FORMATS');
      }

      detectorRef.current = new BarcodeDetectorClass({ formats: supportedFormats });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Check torch support
      try {
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as any;
        if (caps?.torch) {
          setHasTorch(true);
        }
      } catch {}

      if (!videoRef.current) {
        throw new Error('VIDEO_ELEMENT_MISSING');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Start detection loop — every 150ms for responsive scanning
      intervalRef.current = window.setInterval(async () => {
        if (detectingRef.current || !detectorRef.current || !videoRef.current || scannedRef.current) return;
        if (videoRef.current.readyState < 2) return; // Wait for video to have data

        detectingRef.current = true;
        try {
          const detected = await detectorRef.current.detect(videoRef.current);
          if (detected?.length > 0) {
            const rawValue = detected[0]?.rawValue;
            if (rawValue && rawValue.trim()) {
              handleDetected(rawValue.trim());
            }
          }
        } catch (error) {
          // Silently ignore detection errors (frame not ready, etc.)
        } finally {
          detectingRef.current = false;
        }
      }, 150);

    } catch (error: any) {
      console.warn('[Offline Scanner] start failed:', error);

      if (error?.message === 'BARCODE_DETECTOR_NOT_SUPPORTED' || error?.message === 'NO_SUPPORTED_FORMATS') {
        setErrorMessage('هذا الجهاز لا يدعم قارئ الباركود المدمج. جرب تحديث نظام WebView أو استخدم نسخة أحدث.');
      } else if (error?.name === 'NotAllowedError') {
        setErrorMessage('تم رفض إذن الكاميرا. اسمح بالإذن من الإعدادات ثم أعد المحاولة.');
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setErrorMessage('لم يتم العثور على كاميرا. تأكد من توصيل كاميرا بالجهاز.');
      } else {
        setErrorMessage('تعذر تشغيل الكاميرا. حاول مرة أخرى.');
      }

      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }, [handleDetected, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;

    if (!isOpen) {
      setErrorMessage(null);
      stopCamera();
      return;
    }

    void startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="scanner-ui-overlay fixed inset-0 z-[120] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2 text-foreground">
          <ScanLine className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">مسح الباركود</span>
        </div>
        <div className="flex items-center gap-1">
          {hasTorch && (
            <Button
              type="button"
              variant={torchOn ? "default" : "ghost"}
              size="icon"
              onClick={toggleTorch}
              className="h-8 w-8"
            >
              <Flashlight className="w-4 h-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="w-full max-w-xl aspect-[3/4] md:aspect-video rounded-2xl border border-border overflow-hidden bg-card relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Scanning overlay */}
          <div className="pointer-events-none absolute inset-0 bg-background/40" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] h-[42%] rounded-xl border-2 border-primary/80 relative">
              {/* Animated scan line */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/60 animate-pulse" />
            </div>
          </div>

          {/* Loading state */}
          {isStarting && (
            <div className="absolute inset-0 grid place-items-center bg-background/70">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Camera className="w-4 h-4 animate-pulse text-primary" />
                جارٍ فتح الكاميرا...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 pb-2 text-center">
        <p className="text-xs text-muted-foreground">وجّه الكاميرا نحو الباركود</p>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
            <p>{errorMessage}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={() => void startCamera()}>
                <RotateCcw className="w-3 h-3 ml-1" />
                إعادة المحاولة
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onClose}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
