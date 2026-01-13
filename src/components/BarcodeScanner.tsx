import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, SwitchCamera, Flashlight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; ts: number; count: number } | null>(null);
  const acceptedRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const containerId = 'barcode-scanner-container';

  // Barcode-first (QR disabled intentionally to reduce false positives)
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.ITF,
  ];

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    const initScanner = async () => {
      try {
        setError(null);
        
        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          
          // Prefer back camera
          const backCameraIndex = devices.findIndex(
            d => d.label.toLowerCase().includes('back') || 
                 d.label.toLowerCase().includes('rear') ||
                 d.label.toLowerCase().includes('خلفي')
          );
          const preferredIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
          setCurrentCameraIndex(preferredIndex);
          
          await startScanner(devices[preferredIndex].id);
        } else {
          setError('لم يتم العثور على كاميرا');
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
          setError('يرجى السماح بالوصول إلى الكاميرا');
        } else {
          setError('خطأ في تشغيل الكاميرا');
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 100);
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId: string) => {
    try {
      // Stop existing scanner if any
      await stopScanner();
      
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false,
      });
      
      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 25,
          disableFlip: true,
          // Wide scan box fits common product barcodes
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(360, Math.floor(viewfinderWidth * 0.9));
            const height = Math.min(220, Math.floor(viewfinderHeight * 0.35));
            return { width, height };
          },
          aspectRatio: 16 / 9,
          experimentalFeatures: {
            // Uses native BarcodeDetector when available (much faster + more accurate)
            useBarCodeDetectorIfSupported: true,
          },
        },
        (decodedText) => {
          if (acceptedRef.current) return;

          const text = decodedText.trim();

          // Basic sanity filter to avoid noisy false-positives
          if (text.length < 6 || text.length > 32) return;
          if (!/^[0-9A-Za-z._-]+$/.test(text)) return;

          const now = Date.now();
          const prev = lastScanRef.current;

          // Confirm the same value twice within a short window to avoid random reads
          if (prev && prev.text === text && now - prev.ts < 1400) {
            lastScanRef.current = { text, ts: now, count: prev.count + 1 };
          } else {
            lastScanRef.current = { text, ts: now, count: 1 };
          }

          if ((lastScanRef.current?.count ?? 0) < 2) return;

          acceptedRef.current = true;

          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScan(text);
          handleClose();
        },
        () => {
          // Ignore scan failures (continuous scanning)
        }
      );
      
      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('Scanner start error:', err);
      setError('خطأ في بدء الماسح');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-black">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/80 absolute top-0 left-0 right-0 z-10">
          <h3 className="text-white font-semibold">مسح الباركود</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scanner Container */}
        <div className="relative pt-14 pb-20">
          <div 
            id={containerId} 
            className="w-full min-h-[300px] bg-black"
          />
          
          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center pt-14 pb-20">
              <div className="relative">
                <div className="w-72 h-40 border-2 border-primary rounded-lg relative">
                  {/* Corner decorations */}
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 pt-14 pb-20">
              <div className="text-center p-6">
                <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-white mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  إعادة المحاولة
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 flex items-center justify-center gap-4">
          {cameras.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={switchCamera}
              className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          )}
          <p className="text-white/70 text-sm">
            وجّه الكاميرا نحو الباركود
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
