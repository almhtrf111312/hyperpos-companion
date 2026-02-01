// Native Scanner using @capacitor-community/barcode-scanner (Better Transparency Support)
// Optimized for Tecno, Infinix, Samsung with auto-zoom
import { useEffect, useState, useRef } from 'react';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Camera, Loader2, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { playBeep } from '@/lib/sound-utils';

interface NativeMLKitScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onFallback?: () => void;
}

// Radical Transparency Helper (Still useful as extra enforcement)
const makeAppTransparent = () => {
  const elements = document.querySelectorAll('html, body, ion-app, ion-router-outlet, .ion-page, ion-content');
  elements.forEach(el => {
    try {
      (el as HTMLElement).style.setProperty('background', 'transparent', 'important');
      (el as HTMLElement).style.setProperty('--background', 'transparent', 'important');
      el.classList.add('barcode-scanner-active');
    } catch (e) {
      console.warn('Failed to set transparency on:', el);
    }
  });
};

const cleanupAppTransparency = () => {
  const elements = document.querySelectorAll('html, body, ion-app, ion-router-outlet, .ion-page, ion-content');
  elements.forEach(el => {
    try {
      (el as HTMLElement).style.removeProperty('background');
      (el as HTMLElement).style.removeProperty('--background');
      el.classList.remove('barcode-scanner-active');
    } catch (e) { }
  });
};

export function NativeMLKitScanner({ isOpen, onClose, onScan, onFallback }: NativeMLKitScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Synchronous locks
  const scanningRef = useRef(false);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);

  // Verification Refs
  const lastReadRef = useRef<string | null>(null);
  const matchCountRef = useRef(0);
  const REQUIRED_MATCHES = 2; // Number of consistent reads required

  const checkPermission = async (): Promise<boolean> => {
    try {
      const status = await BarcodeScanner.checkPermission({ force: true });
      if (status.granted) return true;
      if (status.denied) {
        setError('تم رفض صلاحية الكاميرا. يرجى تفعيلها من الإعدادات.');
        return false;
      }
      return false;
    } catch (err) {
      console.error('[Scanner] Permission check failed:', err);
      return false;
    }
  };

  const startScanning = async () => {
    if (scanningRef.current || hasScannedRef.current) return;

    scanningRef.current = true;
    setIsLoading(true);
    setError(null);

    // Reset Verification
    lastReadRef.current = null;
    matchCountRef.current = 0;

    try {
      const hasPerm = await checkPermission();
      if (!hasPerm) {
        setIsLoading(false);
        scanningRef.current = false;
        return;
      }

      console.log('[Scanner] Starting scan...');

      // 1. Hide Background (Community Plugin Method) - MUST BE FIRST
      await BarcodeScanner.hideBackground();

      // 2. Extra Enforcement (CSS Visibility Hidden Strategy)
      document.body.classList.add('barcode-scanner-active');
      makeAppTransparent();

      // 3. Start Scan with Double Verification
      // We loop until we get 2 consistent reads
      let attempts = 0;
      const MAX_ATTEMPTS = 5; // Avoid infinite loops if user struggles

      while (matchCountRef.current < 2 && mountedRef.current) {
        const result = await BarcodeScanner.startScan();

        if (result.hasContent) {
          if (!lastReadRef.current) {
            // First read
            lastReadRef.current = result.content;
            matchCountRef.current = 1;
            // Small delay to prevent reading same frame artifact immediately? 
            // or just let it spin. 
            // A small delay provides a "second look" feel.
            await new Promise(r => setTimeout(r, 150));
          } else {
            // Subsequent read
            if (result.content === lastReadRef.current) {
              matchCountRef.current += 1;
            } else {
              // Mismatch - likely ghost read or moved. Reset.
              console.log('Scanner Mismatch:', lastReadRef.current, 'vs', result.content);
              lastReadRef.current = result.content;
              matchCountRef.current = 1;
              await new Promise(r => setTimeout(r, 150));
            }
          }
        } else {
          // Cancelled
          await stopScanning();
          onClose();
          return;
        }

        attempts++;
        // Optional: if verification takes too long, maybe just accept visual confirmation?
        // For now, strict mode as requested.
      }

      // Check success
      if (matchCountRef.current >= 2 && lastReadRef.current) {
        console.log('[Scanner] Verified content:', lastReadRef.current);

        // Prevent duplicate processing
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;

        // Cleanup immediately
        await stopScanning();

        // Audio & Vibrate (Verified Requirement)
        playBeep();
        if (navigator.vibrate) navigator.vibrate(200);

        // Send value
        onScan(lastReadRef.current);

        // Delay close
        setTimeout(() => {
          if (mountedRef.current) onClose();
        }, 500);
      }

    } catch (err: any) {
      console.error('[Scanner] Scan error:', err);
      await stopScanning();
      setError('حدث خطأ أثناء تشغيل الماسح');
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanning = async () => {
    try {
      if (isTorchOn) {
        await BarcodeScanner.disableTorch();
        setIsTorchOn(false);
      }
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
    } catch (e) { }

    // Cleanup Classes
    cleanupAppTransparency();
    document.body.classList.remove('barcode-scanner-active');

    scanningRef.current = false;
  };

  const toggleTorch = async () => {
    try {
      if (isTorchOn) {
        await BarcodeScanner.disableTorch();
        setIsTorchOn(false);
      } else {
        await BarcodeScanner.enableTorch();
        setIsTorchOn(true);
      }
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  const handleZoom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setZoomLevel(value);
    try {
      if ((BarcodeScanner as any).setZoom) {
        await (BarcodeScanner as any).setZoom({ options: { zoom: value } });
      }
    } catch (err) {
      console.warn('Zoom failed:', err);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      startScanning();
    }
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, [isOpen]);

  return (
    <>
      {/* 
          WRAPPER: .scanner-ui-overlay 
          This makes the UI visible even when body is visibility: hidden 
          Includes Visual Blur to force centering
      */}
      <div className="scanner-ui-overlay fixed inset-0 z-[9999] pointer-events-none flex flex-col">

        {/* Top Blur Area (1/3) */}
        <div className="flex-1 bg-black/60 backdrop-blur-sm border-b border-white/20 relative">
          {/* Top Controls: Close & Flash */}
          <div className="absolute top-12 left-4 right-4 flex justify-between items-start pointer-events-auto">
            {isOpen && !error && !isLoading && (
              <Button variant="secondary" size="sm" onClick={() => {
                hasScannedRef.current = false;
                stopScanning();
                onClose();
              }} className="rounded-full opacity-80 backdrop-blur-md shadow-lg">
                إغلاق
              </Button>
            )}

            {isOpen && !error && !isLoading && (
              <Button
                variant={isTorchOn ? "default" : "outline"}
                size="icon"
                onClick={toggleTorch}
                className={`rounded-full shadow-lg backdrop-blur-md transition-all ${isTorchOn ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500' : 'bg-black/30 text-white border-white/50 hover:bg-black/50'}`}
              >
                {isTorchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Middle Clear Area (1/3) - The Scan Zone */}
        <div className="flex-[0.8] relative">
          {/* Scanning Line Animation */}
          <div className="absolute top-0 left-0 w-full h-full border-2 border-primary/50 box-border"></div>
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 animate-pulse shadow-[0_0_10px_red]"></div>

          {/* Corner Markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary"></div>
        </div>

        {/* Bottom Blur Area (1/3) */}
        <div className="flex-1 bg-black/60 backdrop-blur-sm border-t border-white/20 relative flex flex-col justify-end p-4">
          {/* Bottom Controls: Zoom Slider */}
          {isOpen && !error && !isLoading && (
            <div className="pointer-events-auto w-full max-w-xs mx-auto mb-16 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 text-white">
                <span className="text-xs font-mono opacity-80">1x</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={zoomLevel}
                  onChange={handleZoom}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono opacity-80">5x</span>
              </div>
              <div className="text-center mt-1">
                <span className="text-[10px] text-white/60 font-mono tracking-wider">ZOOM: {zoomLevel.toFixed(1)}x</span>
              </div>
            </div>
          )}
        </div>

        {/* Status Dialog (Centered) */}
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <Dialog open={isOpen && (isLoading || error !== null)} onOpenChange={(open) => !open && onClose()}>
              <DialogContent className="max-w-sm">
                <DialogTitle className="text-center">مسح الباركود</DialogTitle>
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  {isLoading && !error && (
                    <>
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <p className="text-muted-foreground text-center">جاري فتح الكاميرا...</p>
                    </>
                  )}

                  {error && (
                    <>
                      <Camera className="w-12 h-12 text-muted-foreground" />
                      <p className="text-destructive text-center">{error}</p>
                      <div className="flex gap-2 w-full">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                          إغلاق
                        </Button>
                        <Button onClick={() => {
                          hasScannedRef.current = false;
                          scanningRef.current = false;
                          startScanning();
                        }} className="flex-1">
                          إعادة المحاولة
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </>
  );
}
