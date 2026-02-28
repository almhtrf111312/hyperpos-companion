/**
 * WebBarcodeScanner – Browser-based barcode scanner for non-native platforms.
 * Same useRef pattern as OfflineBarcodeScanner to prevent re-render loops.
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playBeep } from '@/lib/sound-utils';
import { PENDING_BARCODE_KEY } from './OfflineBarcodeScanner';

interface WebBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

const WEB_FORMATS = [
  'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39',
  'data_matrix', 'upc_a', 'upc_e',
];

export function WebBarcodeScanner({ isOpen, onClose, onScan }: WebBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const detectingRef = useRef(false);
  const scannedRef = useRef(false);
  const mountedRef = useRef(true);
  const isStartingRef = useRef(false);
  const cameraActiveRef = useRef(false);

  // ✅ Store callbacks in refs
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = () => {
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
    isStartingRef.current = false;
    cameraActiveRef.current = false;
  };

  const handleDetected = (barcode: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    try {
      localStorage.setItem(PENDING_BARCODE_KEY, barcode);
    } catch (e) {
      console.warn('[Web Scanner] Could not save pending barcode:', e);
    }

    try { playBeep(); } catch { }
    if (navigator.vibrate) navigator.vibrate(120);

    stopCamera();

    setTimeout(() => {
      onScanRef.current(barcode);
      onCloseRef.current();
    }, 50);
  };

  const startCamera = async () => {
    if (isStartingRef.current || cameraActiveRef.current) return;
    isStartingRef.current = true;

    setErrorMessage(null);
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('CAMERA_API_NOT_SUPPORTED');
      }

      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (!BarcodeDetectorClass) {
        throw new Error('BARCODE_DETECTOR_NOT_SUPPORTED');
      }

      detectorRef.current = new BarcodeDetectorClass({ formats: WEB_FORMATS });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      if (!mountedRef.current || !isStartingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('VIDEO_ELEMENT_MISSING');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      cameraActiveRef.current = true;

      intervalRef.current = window.setInterval(async () => {
        if (detectingRef.current || !detectorRef.current || !videoRef.current || scannedRef.current) return;

        detectingRef.current = true;
        try {
          const detected = await detectorRef.current.detect(videoRef.current);
          const rawValue = detected?.[0]?.rawValue;
          if (rawValue) {
            handleDetected(rawValue);
          }
        } catch {
          // Silently ignore
        } finally {
          detectingRef.current = false;
        }
      }, 180);
    } catch (error: any) {
      console.warn('[Web Scanner] start failed:', error);

      if (error?.message === 'BARCODE_DETECTOR_NOT_SUPPORTED') {
        setErrorMessage('المتصفح لا يدعم قارئ الباركود المباشر. استخدم Chrome حديث أو نسخة APK.');
      } else if (error?.name === 'NotAllowedError') {
        setErrorMessage('تم رفض إذن الكاميرا. اسمح بالإذن ثم أعد المحاولة.');
      } else {
        setErrorMessage('تعذر تشغيل الكاميرا الآن. حاول مرة أخرى.');
      }
      stopCamera();
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  };

  // ✅ Only depends on isOpen — no function deps
  useEffect(() => {
    mountedRef.current = true;

    if (!isOpen) {
      setErrorMessage(null);
      stopCamera();
      return;
    }

    const timer = setTimeout(() => {
      if (mountedRef.current) startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-ui-overlay fixed inset-0 z-[120] bg-black flex flex-col">
      {/* Header — floating over camera */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 pt-[calc(max(env(safe-area-inset-top),1.5rem)+0.5rem)] z-[9999]">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="w-5 h-5" />
          <span className="text-sm font-semibold">مسح الباركود</span>
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onCloseRef.current();
          }}
          className="h-11 w-11 rounded-full flex items-center justify-center bg-white/10 border border-white/30 text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View — full screen */}
      <div className="flex-1 relative">
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[75%] h-[35%] rounded-xl border-2 border-white/70 relative">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-white/80 animate-pulse" />
          </div>
        </div>
        {isStarting && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <div className="flex items-center gap-2 text-sm text-white">
              <Camera className="w-5 h-5 animate-pulse" />
              جارٍ فتح الكاميرا...
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
            <p>{errorMessage}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={() => startCamera()}>
                إعادة المحاولة
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onCloseRef.current()}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
