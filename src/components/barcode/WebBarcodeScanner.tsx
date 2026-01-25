// Web Barcode Scanner - uses react-zxing for browser-based scanning
import { useEffect, useRef, useState, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { X, Camera, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { playBeep } from '@/lib/sound-utils';

interface WebBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function WebBarcodeScanner({ isOpen, onClose, onScan }: WebBarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<'1x' | '2x'>('1x');
  const [useCssZoom, setUseCssZoom] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const acceptedRef = useRef(false);
  const lastScanRef = useRef<{ text: string; ts: number } | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      acceptedRef.current = false;
      lastScanRef.current = null;
      setIsZoomed(false);
      setZoomLevel('1x');
      setUseCssZoom(false);
      setError(null);
    }
  }, [isOpen]);

  // Get available cameras
  useEffect(() => {
    if (!isOpen) return;
    
    navigator.mediaDevices.enumerateDevices()
      .then(allDevices => {
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        
        // Prefer back camera
        const backIndex = videoDevices.findIndex(
          d => d.label.toLowerCase().includes('back') || 
               d.label.toLowerCase().includes('rear') ||
               d.label.toLowerCase().includes('خلفي')
        );
        if (backIndex >= 0) {
          setDeviceIndex(backIndex);
        }
      })
      .catch(() => {
        setError('لم يتم العثور على كاميرا');
      });
  }, [isOpen]);

  interface DecodeResult {
    getText: () => string;
  }

  const handleDecode = useCallback((result: DecodeResult) => {
    if (acceptedRef.current) return;
    
    const text = result.getText().trim();
    
    // Basic sanity filter
    if (text.length < 4 || text.length > 48) return;
    if (!/^[0-9A-Za-z._-]+$/.test(text)) return;

    const now = Date.now();
    const prev = lastScanRef.current;

    // Debounce: prevent same barcode within 300ms
    if (prev && prev.text === text && now - prev.ts < 300) return;
    
    lastScanRef.current = { text, ts: now };
    acceptedRef.current = true;

    // Play beep sound
    playBeep();

    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    onScan(text);
    onClose();
  }, [onScan, onClose]);

  const { ref } = useZxing({
    paused: !isOpen,
    deviceId: devices[deviceIndex]?.deviceId,
    onDecodeResult: handleDecode,
    onError: (err) => {
      console.error('Scanner error:', err);
    },
    timeBetweenDecodingAttempts: 100,
    constraints: {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        // @ts-ignore - focusMode is supported on some devices
        focusMode: 'continuous',
      }
    }
  });

  const handleClose = () => {
    onClose();
  };

  const switchCamera = () => {
    if (devices.length <= 1) return;
    setDeviceIndex((prev) => (prev + 1) % devices.length);
    setIsZoomed(false);
    setZoomLevel('1x');
    setUseCssZoom(false);
  };

  const toggleZoom = useCallback(async () => {
    const newZoomed = !isZoomed;
    
    try {
      const videoElement = ref.current as HTMLVideoElement;
      if (!videoElement || !videoElement.srcObject) {
        setIsZoomed(newZoomed);
        setZoomLevel(newZoomed ? '2x' : '1x');
        setUseCssZoom(true);
        return;
      }
      
      const stream = videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track && 'getCapabilities' in track) {
        interface ZoomCapabilities {
          zoom?: { min: number; max: number };
        }
        
        const capabilities = track.getCapabilities() as ZoomCapabilities;
        
        if (capabilities.zoom && capabilities.zoom.max > 1) {
          const maxZoom = capabilities.zoom.max || 2;
          const targetZoom = newZoomed ? Math.min(2, maxZoom) : 1;
          
          try {
            await track.applyConstraints({
              advanced: [{ zoom: targetZoom } as MediaTrackConstraintSet]
            });
            
            setIsZoomed(newZoomed);
            setZoomLevel(newZoomed ? '2x' : '1x');
            setUseCssZoom(false);
            return;
          } catch (constraintError) {
            console.log('applyConstraints failed, using CSS zoom fallback');
          }
        }
      }
      
      // Fallback to CSS zoom
      setIsZoomed(newZoomed);
      setZoomLevel(newZoomed ? '2x' : '1x');
      setUseCssZoom(true);
    } catch (e) {
      console.log('Zoom error, using CSS fallback:', e);
      setIsZoomed(newZoomed);
      setZoomLevel(newZoomed ? '2x' : '1x');
      setUseCssZoom(true);
    }
  }, [isZoomed, ref]);

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
        <div className="relative pt-14 pb-24 overflow-hidden">
          <video 
            ref={ref} 
            className="w-full min-h-[300px] bg-black object-cover transition-transform duration-200"
            style={{
              transform: useCssZoom && isZoomed ? 'scale(2)' : 'scale(1)',
              transformOrigin: 'center center',
            }}
            playsInline
            muted
          />
          
          {/* Scanning overlay */}
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
              <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                isZoomed ? 'bg-primary' : 'bg-black/60'
              }`}>
                {zoomLevel} {useCssZoom && isZoomed && '(رقمي)'}
              </div>
            </div>
          </div>

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

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 flex items-center justify-between gap-2 z-20">
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4 ml-2" />
            إغلاق
          </Button>
          
          <div className="flex gap-2 items-center">
            {/* Zoom level badge */}
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              isZoomed ? 'bg-primary text-primary-foreground' : 'bg-white/20 text-white'
            }`}>
              {zoomLevel}
            </span>
            
            <Button
              variant="outline"
              size="icon"
              onClick={toggleZoom}
              className={`rounded-full border-2 transition-all ${
                isZoomed 
                  ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/80' 
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
            </Button>
            
            {devices.length > 1 && (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
