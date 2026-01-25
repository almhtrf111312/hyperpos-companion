/**
 * Html5Qrcode Barcode Scanner
 * ============================
 * Reliable barcode scanner using html5-qrcode library
 * Works on both web and mobile (via Capacitor WebView)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Loader2, RefreshCw, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { playBeep } from '@/lib/sound-utils';

interface Html5QrcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

export function Html5QrcodeScanner({ isOpen, onClose, onScan }: Html5QrcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScannedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);

  const SCANNER_ID = 'html5-qrcode-scanner';

  // Cleanup scanner instance
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
          console.log('[Html5Qrcode] Scanner stopped');
        }
      } catch (err) {
        console.warn('[Html5Qrcode] Error stopping scanner:', err);
      }
      
      try {
        scannerRef.current.clear();
      } catch (err) {
        // Ignore clear errors
      }
      
      scannerRef.current = null;
    }
    isStartingRef.current = false;
  }, []);

  // Start scanner with specific camera
  const startScanner = useCallback(async (cameraId?: string) => {
    if (!isMountedRef.current || isStartingRef.current) return;
    
    isStartingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    console.log('[Html5Qrcode] Starting scanner...');
    
    try {
      // Stop any existing scanner
      await stopScanner();
      
      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      console.log('[Html5Qrcode] Available cameras:', devices.length);
      
      if (!isMountedRef.current) return;
      
      if (devices.length === 0) {
        setError('لم يتم العثور على كاميرا');
        setIsLoading(false);
        isStartingRef.current = false;
        return;
      }
      
      setCameras(devices);
      
      // Find back camera (prefer environment-facing)
      let selectedIndex = 0;
      const backCameraIndex = devices.findIndex(
        d => d.label.toLowerCase().includes('back') || 
             d.label.toLowerCase().includes('rear') ||
             d.label.toLowerCase().includes('environment') ||
             d.label.toLowerCase().includes('خلفي')
      );
      
      if (backCameraIndex >= 0) {
        selectedIndex = backCameraIndex;
      }
      
      if (cameraId) {
        const camIndex = devices.findIndex(d => d.id === cameraId);
        if (camIndex >= 0) selectedIndex = camIndex;
      }
      
      setCurrentCameraIndex(selectedIndex);
      const selectedCamera = devices[selectedIndex];
      
      // Create scanner instance
      scannerRef.current = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      
      // Calculate optimal dimensions
      const containerWidth = containerRef.current?.clientWidth || 300;
      const qrboxSize = Math.min(containerWidth - 40, 280);
      
      // Start scanning
      await scannerRef.current.start(
        selectedCamera.id,
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: Math.floor(qrboxSize * 0.6) },
          aspectRatio: 1.333, // 4:3 aspect ratio
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          
          const text = decodedText.trim();
          
          // Basic validation
          if (text.length < 3 || text.length > 50) return;
          
          hasScannedRef.current = true;
          console.log('[Html5Qrcode] ✅ Scanned:', text);
          
          // Play beep sound
          playBeep();
          
          // Vibrate
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          // Call onScan immediately
          onScan(text);
          
          // Close after small delay to ensure data is captured
          setTimeout(() => {
            onClose();
          }, 100);
        },
        (_errorMessage) => {
          // Ignore decode errors (normal when no barcode in view)
        }
      );
      
      console.log('[Html5Qrcode] Scanner started successfully');
      
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[Html5Qrcode] Start error:', err);
      
      if (isMountedRef.current) {
        // Handle specific error cases
        if (err.message?.includes('Permission')) {
          setError('يرجى السماح بالوصول للكاميرا');
        } else if (err.message?.includes('NotAllowed')) {
          setError('تم رفض صلاحية الكاميرا');
        } else if (err.message?.includes('NotFound')) {
          setError('لم يتم العثور على كاميرا');
        } else if (err.message?.includes('NotReadable') || err.message?.includes('in use')) {
          setError('الكاميرا قيد الاستخدام من تطبيق آخر');
        } else {
          setError('فشل في فتح الكاميرا. حاول مرة أخرى.');
        }
        setIsLoading(false);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [onScan, onClose, stopScanner]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    
    setIsLoading(true);
    await stopScanner();
    await startScanner(nextCamera.id);
  }, [cameras, currentCameraIndex, stopScanner, startScanner]);

  // Toggle zoom (CSS-based for simplicity)
  const toggleZoom = useCallback(() => {
    setIsZoomed(prev => !prev);
  }, []);

  // Handle retry
  const handleRetry = useCallback(async () => {
    hasScannedRef.current = false;
    await startScanner();
  }, [startScanner]);

  // Handle close
  const handleClose = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  // Start scanner when dialog opens
  useEffect(() => {
    isMountedRef.current = true;
    
    if (isOpen) {
      hasScannedRef.current = false;
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
    
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-black [&>button]:hidden">
        <DialogTitle className="sr-only">مسح الباركود</DialogTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-black/80 absolute top-0 left-0 right-0 z-20">
          <h3 className="text-white font-semibold text-sm">مسح الباركود</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20 h-8 w-8"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scanner Container */}
        <div 
          ref={containerRef}
          className="relative pt-12 pb-20 min-h-[350px] overflow-hidden"
        >
          {/* Scanner viewport */}
          <div 
            id={SCANNER_ID}
            className="w-full transition-transform duration-200"
            style={{
              transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
              transformOrigin: 'center center',
            }}
          />
          
          {/* Loading overlay */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 pt-12 pb-20 z-10">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-3" />
                <p className="text-white text-sm">جاري فتح الكاميرا...</p>
              </div>
            </div>
          )}
          
          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 pt-12 pb-20 z-10">
              <div className="text-center p-6 max-w-xs">
                <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-white mb-4 text-sm">{error}</p>
                <Button 
                  onClick={handleRetry}
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 ml-2" />
                  إعادة المحاولة
                </Button>
              </div>
            </div>
          )}
          
          {/* Zoom indicator */}
          {!isLoading && !error && (
            <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1 rounded-full font-medium transition-colors z-10 ${
              isZoomed ? 'bg-primary' : 'bg-black/60'
            }`}>
              {isZoomed ? '2x' : '1x'}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/80 flex items-center justify-between gap-2 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4 ml-1" />
            إغلاق
          </Button>
          
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleZoom}
              disabled={isLoading || !!error}
              className={`rounded-full border-2 transition-all h-9 w-9 ${
                isZoomed 
                  ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/80' 
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </Button>
            
            {cameras.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={switchCamera}
                disabled={isLoading || !!error}
                className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 h-9 w-9"
              >
                <SwitchCamera className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
