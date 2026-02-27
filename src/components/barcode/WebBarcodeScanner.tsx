import { useCallback, useEffect, useRef, useState } from 'react';
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
  'qr_code',
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'data_matrix',
  'upc_a',
  'upc_e',
];

export function WebBarcodeScanner({ isOpen, onClose, onScan }: WebBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const detectingRef = useRef(false);
  const scannedRef = useRef(false);

  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  }, []);

  const handleDetected = useCallback((barcode: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    try {
      localStorage.setItem(PENDING_BARCODE_KEY, barcode);
    } catch (e) {
      console.warn('[Web Scanner] Could not save pending barcode:', e);
    }

    playBeep();
    if (navigator.vibrate) navigator.vibrate(120);

    onScan(barcode);
    onClose();
    stopCamera();
  }, [onClose, onScan, stopCamera]);

  const startCamera = useCallback(async () => {
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
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('VIDEO_ELEMENT_MISSING');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      intervalRef.current = window.setInterval(async () => {
        if (detectingRef.current || !detectorRef.current || !videoRef.current || scannedRef.current) return;

        detectingRef.current = true;
        try {
          const detected = await detectorRef.current.detect(videoRef.current);
          const rawValue = detected?.[0]?.rawValue;
          if (rawValue) {
            handleDetected(rawValue);
          }
        } catch (error) {
          console.warn('[Web Scanner] detect failed:', error);
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
      setIsStarting(false);
    }
  }, [handleDetected, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      stopCamera();
      return;
    }

    void startCamera();
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="scanner-ui-overlay fixed inset-0 z-[120] bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2 text-foreground">
          <ScanLine className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">مسح الباركود</span>
        </div>
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

      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="w-full max-w-xl aspect-[3/4] md:aspect-video rounded-2xl border border-border overflow-hidden bg-card relative">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

          <div className="pointer-events-none absolute inset-0 bg-background/50" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] h-[42%] rounded-xl border-2 border-primary/80" />
          </div>

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

      {errorMessage && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
            <p>{errorMessage}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={() => void startCamera()}>
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
