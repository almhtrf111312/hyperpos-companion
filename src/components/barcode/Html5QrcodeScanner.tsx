/**
 * Html5Qrcode Barcode Scanner - Improved Compatibility
 * =====================================================
 * Reliable barcode scanner using html5-qrcode library
 * Optimized for wide Android device compatibility (Samsung, Tecno, Infinix, etc.)
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
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScannedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const SCANNER_ID = 'html5-qrcode-scanner';

  // Cleanup scanner instance - force release camera
  const stopScanner = useCallback(async () => {
    console.log('[Html5Qrcode] Stopping scanner...');
    
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
    
    // Force release any lingering media streams
    try {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('[Html5Qrcode] Force stopped track:', track.label);
          });
          video.srcObject = null;
        }
      });
    } catch (err) {
      console.warn('[Html5Qrcode] Error releasing media streams:', err);
    }
    
    videoTrackRef.current = null;
    isStartingRef.current = false;
  }, []);

  // Start scanner using facingMode (more compatible than camera ID)
  const startScanner = useCallback(async (useBack = true) => {
    if (!isMountedRef.current || isStartingRef.current) return;
    
    isStartingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    const facingMode = useBack ? 'environment' : 'user';
    console.log('[Html5Qrcode] Starting scanner with facingMode:', facingMode);
    
    try {
      // Stop any existing scanner
      await stopScanner();
      
      // Wait a bit for camera release on some devices
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!isMountedRef.current) return;
      
      // Create scanner instance with minimal config
      scannerRef.current = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      
      // Calculate optimal dimensions - square qrbox for QR compatibility
      const containerWidth = containerRef.current?.clientWidth || 280;
      // استخدام qrbox مربع أكبر لدعم QR والباركود معاً
      const qrboxSize = Math.min(containerWidth - 40, 250);
      
      // Use facingMode constraint (most compatible method)
      await scannerRef.current.start(
        { facingMode },
        {
          fps: 10, // Balanced FPS for better detection
          qrbox: { width: qrboxSize, height: qrboxSize }, // مربع لدعم QR
          aspectRatio: 1.0, // نسبة 1:1 للتوافق مع QR
          disableFlip: false,
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
          }, 150);
        },
        (_errorMessage) => {
          // Ignore decode errors (normal when no barcode in view)
        }
      );
      
      console.log('[Html5Qrcode] ✅ Scanner started successfully');
      setRetryCount(0);
      
      // Get video track for zoom control
      try {
        const videoElement = document.querySelector(`#${SCANNER_ID} video`) as HTMLVideoElement;
        if (videoElement?.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            videoTrackRef.current = track;
            const capabilities = track.getCapabilities() as any;
            if (capabilities?.zoom) {
              setMaxZoom(Math.min(capabilities.zoom.max || 4, 4));
              console.log('[Html5Qrcode] Zoom capability:', capabilities.zoom);
            }
          }
        }
      } catch (zoomErr) {
        console.warn('[Html5Qrcode] Could not get zoom capability:', zoomErr);
      }
      
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[Html5Qrcode] Start error:', err);
      
      if (!isMountedRef.current) return;
      
      // If back camera fails, try front camera automatically
      if (useBack && retryCount === 0) {
        console.log('[Html5Qrcode] Back camera failed, trying front camera...');
        setRetryCount(1);
        isStartingRef.current = false;
        await startScanner(false);
        return;
      }
      
      // If facingMode fails, try with camera ID as last resort
      if (retryCount < 2) {
        console.log('[Html5Qrcode] FacingMode failed, trying camera ID method...');
        setRetryCount(2);
        isStartingRef.current = false;
        await startWithCameraId();
        return;
      }
      
      // All methods failed - show error
      if (err.message?.includes('Permission') || err.message?.includes('NotAllowed')) {
        setError('يرجى السماح بالوصول للكاميرا من إعدادات التطبيق');
      } else if (err.message?.includes('NotFound') || err.message?.includes('Requested device not found')) {
        setError('لم يتم العثور على كاميرا في هذا الجهاز');
      } else if (err.message?.includes('NotReadable') || err.message?.includes('in use') || err.message?.includes('Could not start')) {
        setError('الكاميرا قيد الاستخدام. أغلق التطبيقات الأخرى التي تستخدم الكاميرا');
      } else if (err.message?.includes('OverconstrainedError')) {
        setError('الكاميرا لا تدعم الإعدادات المطلوبة');
      } else {
        setError('فشل في فتح الكاميرا. تأكد من إعطاء صلاحية الكاميرا للتطبيق');
      }
      setIsLoading(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [onScan, onClose, stopScanner, retryCount]);

  // Fallback: Start scanner with specific camera ID
  const startWithCameraId = useCallback(async () => {
    if (!isMountedRef.current || isStartingRef.current) return;
    
    isStartingRef.current = true;
    console.log('[Html5Qrcode] Trying camera ID method...');
    
    try {
      await stopScanner();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!isMountedRef.current) return;
      
      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      console.log('[Html5Qrcode] Found cameras:', devices.length, devices.map(d => d.label));
      
      if (devices.length === 0) {
        setError('لم يتم العثور على كاميرا');
        setIsLoading(false);
        isStartingRef.current = false;
        return;
      }
      
      // Find back camera
      let selectedCamera = devices[0];
      const backCamera = devices.find(
        d => d.label.toLowerCase().includes('back') || 
             d.label.toLowerCase().includes('rear') ||
             d.label.toLowerCase().includes('environment') ||
             d.label.toLowerCase().includes('0') ||
             d.label.toLowerCase().includes('خلفي')
      );
      
      if (backCamera) {
        selectedCamera = backCamera;
      }
      
      console.log('[Html5Qrcode] Selected camera:', selectedCamera.label);
      
      // Create scanner instance
      scannerRef.current = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      
      const containerWidth = containerRef.current?.clientWidth || 280;
      const qrboxSize = Math.min(containerWidth - 40, 250);
      
      // Start with camera ID
      await scannerRef.current.start(
        selectedCamera.id,
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize }, // مربع لدعم QR
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          
          const text = decodedText.trim();
          if (text.length < 3 || text.length > 50) return;
          
          hasScannedRef.current = true;
          console.log('[Html5Qrcode] ✅ Scanned:', text);
          
          playBeep();
          if (navigator.vibrate) navigator.vibrate(100);
          
          onScan(text);
          setTimeout(() => onClose(), 150);
        },
        () => {}
      );
      
      console.log('[Html5Qrcode] ✅ Scanner started with camera ID');
      setIsLoading(false);
    } catch (err: any) {
      console.error('[Html5Qrcode] Camera ID method failed:', err);
      setError('فشل في فتح الكاميرا. تأكد من إعطاء صلاحية الكاميرا');
      setIsLoading(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [onScan, onClose, stopScanner]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    setUseFrontCamera(prev => !prev);
    setRetryCount(0);
    setZoomLevel(1);
    setMaxZoom(1);
    hasScannedRef.current = false;
    videoTrackRef.current = null;
    await startScanner(!useFrontCamera);
  }, [useFrontCamera, startScanner]);

  // Toggle zoom using camera's native zoom capability
  const toggleZoom = useCallback(async () => {
    if (!videoTrackRef.current) return;
    
    try {
      const capabilities = videoTrackRef.current.getCapabilities() as any;
      if (capabilities?.zoom) {
        const newZoom = zoomLevel >= maxZoom ? 1 : Math.min(zoomLevel + 1, maxZoom);
        await videoTrackRef.current.applyConstraints({ advanced: [{ zoom: newZoom } as any] });
        setZoomLevel(newZoom);
        console.log('[Html5Qrcode] Zoom set to:', newZoom);
      }
    } catch (err) {
      console.warn('[Html5Qrcode] Zoom not supported:', err);
    }
  }, [zoomLevel, maxZoom]);

  // Handle retry
  const handleRetry = useCallback(async () => {
    hasScannedRef.current = false;
    setRetryCount(0);
    setZoomLevel(1);
    setMaxZoom(1);
    videoTrackRef.current = null;
    await startScanner(true);
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
      setRetryCount(0);
      setUseFrontCamera(false);
      setZoomLevel(1);
      setMaxZoom(1);
      videoTrackRef.current = null;
      // Longer delay for some Android devices
      const timer = setTimeout(() => {
        startScanner(true);
      }, 500);
      
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
          {/* Scanner viewport - no CSS zoom, using native camera zoom */}
          <div 
            id={SCANNER_ID}
            className="w-full"
          />
          
          {/* Loading overlay */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 pt-12 pb-20 z-10">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-3" />
                <p className="text-white text-sm">جاري فتح الكاميرا...</p>
                <p className="text-white/50 text-xs mt-2">قد يستغرق بضع ثوانٍ</p>
              </div>
            </div>
          )}
          
          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 pt-12 pb-20 z-10">
              <div className="text-center p-6 max-w-xs">
                <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-white mb-4 text-sm leading-relaxed">{error}</p>
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
          
          {/* Camera indicator */}
          {!isLoading && !error && (
            <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1 rounded-full font-medium transition-colors z-10 ${
              zoomLevel > 1 ? 'bg-primary' : 'bg-black/60'
            }`}>
              {useFrontCamera ? 'الكاميرا الأمامية' : 'الكاميرا الخلفية'} • {zoomLevel}x
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
              disabled={isLoading || !!error || maxZoom <= 1}
              className={`rounded-full border-2 transition-all h-9 w-9 ${
                zoomLevel > 1 
                  ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/80' 
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
              title={maxZoom > 1 ? `زوم (الحد الأقصى: ${maxZoom}x)` : 'الزوم غير مدعوم'}
            >
              {zoomLevel > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={switchCamera}
              disabled={isLoading || !!error}
              className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 h-9 w-9"
            >
              <SwitchCamera className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
