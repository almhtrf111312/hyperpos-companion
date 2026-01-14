import { useEffect, useRef, useState, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { X, Camera, SwitchCamera, ZoomIn } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
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

  const handleDecode = useCallback((result: any) => {
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
  };

  const toggleZoom = useCallback(async () => {
    try {
      const videoElement = ref.current as HTMLVideoElement;
      if (!videoElement || !videoElement.srcObject) return;
      
      const stream = videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track && 'getCapabilities' in track) {
        const capabilities = track.getCapabilities() as any;
        
        if (capabilities.zoom) {
          const maxZoom = capabilities.zoom.max || 2;
          const targetZoom = isZoomed ? 1 : Math.min(2, maxZoom);
          
          await track.applyConstraints({
            advanced: [{ zoom: targetZoom } as any]
          });
          
          setIsZoomed(!isZoomed);
        }
      }
    } catch (e) {
      console.log('Zoom not supported on this device');
    }
  }, [isZoomed, ref]);

  // Apply default zoom x2 immediately when camera starts
  useEffect(() => {
    if (!isOpen) return;
    
    const applyDefaultZoom = async () => {
      // Wait for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const videoElement = ref.current as HTMLVideoElement;
      if (!videoElement?.srcObject) return;
      
      const stream = videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track && 'getCapabilities' in track) {
        const capabilities = track.getCapabilities() as any;
        
        if (capabilities.zoom) {
          const targetZoom = Math.min(2, capabilities.zoom.max || 2);
          try {
            await track.applyConstraints({
              advanced: [{ zoom: targetZoom } as any]
            });
            setIsZoomed(true);
          } catch (e) {
            console.log('Could not apply default zoom');
          }
        }
      }
    };
    
    applyDefaultZoom();
  }, [isOpen, deviceIndex, ref]);

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
          <video 
            ref={ref} 
            className="w-full min-h-[300px] bg-black object-cover"
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
              {isZoomed && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-primary/80 text-white text-xs px-2 py-1 rounded">
                  تكبير 2x
                </div>
              )}
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
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleZoom}
              className={`rounded-full border-white/20 text-white hover:bg-white/20 ${isZoomed ? 'bg-primary/50' : 'bg-white/10'}`}
            >
              <ZoomIn className="w-5 h-5" />
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
