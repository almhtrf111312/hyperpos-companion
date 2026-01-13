import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

// Beep sound using Web Audio API
const playBeep = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    // Fallback: ignore if audio fails
  }
};

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; ts: number } | null>(null);
  const acceptedRef = useRef(false);
  const zoomAppliedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
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

  const applyZoom = useCallback(async () => {
    if (zoomAppliedRef.current) return;
    
    try {
      const scanner = scannerRef.current;
      if (!scanner) return;
      
      // Get the video track
      const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
      if (!videoElement || !videoElement.srcObject) return;
      
      const stream = videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track && 'getCapabilities' in track) {
        const capabilities = track.getCapabilities() as any;
        
        if (capabilities.zoom) {
          const maxZoom = capabilities.zoom.max || 2;
          const targetZoom = Math.min(2, maxZoom);
          
          await track.applyConstraints({
            advanced: [{ zoom: targetZoom } as any]
          });
          
          zoomAppliedRef.current = true;
          setIsZoomed(true);
        }
      }
    } catch (e) {
      console.log('Zoom not supported on this device');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    acceptedRef.current = false;
    zoomAppliedRef.current = false;
    startTimeRef.current = Date.now();
    setIsZoomed(false);

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

  // Auto-zoom after ~1.2 seconds if no barcode detected (helps low-focus cameras)
  useEffect(() => {
    if (!isScanning || isZoomed) return;

    const zoomTimer = setTimeout(() => {
      if (!acceptedRef.current && !zoomAppliedRef.current) {
        applyZoom();
      }
    }, 1200);

    return () => clearTimeout(zoomTimer);
  }, [isScanning, isZoomed, applyZoom]);

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
          fps: 45,
          disableFlip: true,
          // Bigger scan box improves detection speed on real barcodes
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(480, Math.floor(viewfinderWidth * 0.95));
            const height = Math.min(280, Math.floor(viewfinderHeight * 0.45));
            return { width, height };
          },
          aspectRatio: 16 / 9,
        },
        (decodedText) => {
          if (acceptedRef.current) return;

          const text = decodedText.trim();

          // Basic sanity filter
          if (text.length < 4 || text.length > 48) return;
          if (!/^[0-9A-Za-z._-]+$/.test(text)) return;

          const now = Date.now();
          const prev = lastScanRef.current;

          // Debounce: prevent same barcode within 500ms
          if (prev && prev.text === text && now - prev.ts < 500) return;
          
          lastScanRef.current = { text, ts: now };
          acceptedRef.current = true;

          // Play beep sound
          playBeep();

          // Vibrate
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
    
    zoomAppliedRef.current = false;
    setIsZoomed(false);
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-black [&>button]:hidden">
        <DialogTitle className="sr-only">مسح الباركود</DialogTitle>
        
        {/* Header with visible close button */}
        <div className="flex items-center justify-between p-4 bg-black/80 absolute top-0 left-0 right-0 z-20">
          <h3 className="text-white font-semibold">مسح الباركود</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20 h-10 w-10"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Scanner Container */}
        <div className="relative pt-14 pb-24">
          <div 
            id={containerId} 
            className="w-full min-h-[300px] bg-black"
          />
          
          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center pt-14 pb-24">
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
                
                {/* Zoom indicator */}
                {isZoomed && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-primary/80 text-white text-xs px-2 py-1 rounded">
                    تكبير 2x
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 pt-14 pb-24">
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

        {/* Bottom Controls - Always visible close option */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 flex items-center justify-between gap-4 z-20">
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4 ml-2" />
            إغلاق
          </Button>
          
          <p className="text-white/70 text-sm flex-1 text-center">
            وجّه الكاميرا نحو الباركود
          </p>
          
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
