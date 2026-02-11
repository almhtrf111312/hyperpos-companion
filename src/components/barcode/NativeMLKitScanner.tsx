// Native Scanner using @capacitor-community/barcode-scanner
// SIMPLIFIED VERSION - Clean camera, always-visible controls
import { useEffect, useState, useRef } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { X, Zap, ZapOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playBeep } from '@/lib/sound-utils';

interface NativeMLKitScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onFallback?: () => void;
}

export function NativeMLKitScanner({ isOpen, onClose, onScan }: NativeMLKitScannerProps) {
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const scanningRef = useRef(false);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);
  const initAttemptRef = useRef(0);

  const checkPermission = async (): Promise<boolean> => {
    try {
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera === 'granted') return true;

      const request = await BarcodeScanner.requestPermissions();
      if (request.camera === 'granted') return true;

      if (request.camera === 'denied') {
        setPermissionError('تم رفض صلاحية الكاميرا. يرجى تفعيلها من الإعدادات.');
        return false;
      }
      return false;
    } catch (err) {
      console.error('[Scanner] Permission check failed:', err);
      setPermissionError('فشل التحقق من الصلاحيات');
      return false;
    }
  };

  const startScanning = async () => {
    if (scanningRef.current || hasScannedRef.current) return;

    scanningRef.current = true;
    setIsInitializing(true);
    setPermissionError(null);
    initAttemptRef.current += 1;
    const currentAttempt = initAttemptRef.current;

    try {
      try {
        // 1. Ensure clean state
        document.documentElement.classList.remove('barcode-scanner-active');
        await BarcodeScanner.stopScan(); // Ensure stopped first

        // Small delay
        await new Promise(r => setTimeout(r, 300));

        if (!mountedRef.current || currentAttempt !== initAttemptRef.current) return;

        // 2. Check/Request Permission
        const hasPerm = await checkPermission();
        if (!hasPerm) {
          setIsInitializing(false);
          scanningRef.current = false;
          return;
        }

        // 3. Hide Background & Add Class (MLKit handles background automatically mostly, but good to be safe)
        document.documentElement.classList.add('barcode-scanner-active');

        // 4. Camera is ready
        if (mountedRef.current) setIsInitializing(false);

        // 5. Start Scan
        // MLKit listener based approach
        const listener = await BarcodeScanner.addListener('barcodeScanned', async (result) => {
          if (result.barcode && !hasScannedRef.current) {
            hasScannedRef.current = true;
            console.log('[Scanner] Scanned:', result.barcode.rawValue);
            await stopScanning();
            playBeep();
            if (navigator.vibrate) navigator.vibrate(200);

            // Pass the value
            if (result.barcode.rawValue) {
              onScan(result.barcode.rawValue);
            }

            setTimeout(() => {
              if (mountedRef.current) onClose();
            }, 500);
          }
        });

        // Keep reference to listener to remove it later if needed (though stopScan cleanup usually suffices)
        // For simplicity in this functional component, we rely on stopScanning to clean up.

        await BarcodeScanner.startScan(); // This starts the camera feed

      } catch (err: any) {
        console.error('[Scanner] Scan error:', err);
        // clean up
        scanningRef.current = false;
        document.documentElement.classList.remove('barcode-scanner-active');
        if (mountedRef.current) setPermissionError('حدث خطأ أثناء تشغيل الماسح');
      } finally {
        scanningRef.current = false;
      }
    };

    const stopScanning = async () => {
      try {
        if (isTorchOn) {
          await BarcodeScanner.disableTorch();
          setIsTorchOn(false);
        }
        await BarcodeScanner.removeAllListeners();
        await BarcodeScanner.stopScan();
      } catch (e) {
        console.warn('Stop scanning failed:', e);
      }

      // Cleanup (target html tag directly)
      document.documentElement.classList.remove('barcode-scanner-active');
      scanningRef.current = false;
    };

    const handleClose = async () => {
      hasScannedRef.current = false;
      initAttemptRef.current += 1; // cancel any pending init
      await stopScanning();
      onClose();
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



    useEffect(() => {
      mountedRef.current = true;
      hasScannedRef.current = false;
      if (isOpen) {
        startScanning();
      }
      return () => {
        mountedRef.current = false;
        initAttemptRef.current += 1;
        stopScanning();
      };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <div className="scanner-ui-overlay fixed inset-0 z-[9999] flex flex-col pointer-events-none">

        {/* 
        Overlay & Scanning Frame Container 
        Using box-shadow to create the "cutout" effect.
        The container is centered and has the size of the scanning area.
        The huge spread radius of the shadow covers the rest of the screen.
      */}
        <div className="absolute inset-0 flex items-center justify-center">
          {!isInitializing && !permissionError && (
            <div
              className="relative w-72 h-72 rounded-3xl"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
              }}
            >
              {/* Corner Markers - White, Thick, Distinct */}
              {/* Top Left */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-xl drop-shadow-md"></div>
              {/* Top Right */}
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-xl drop-shadow-md"></div>
              {/* Bottom Left */}
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-xl drop-shadow-md"></div>
              {/* Bottom Right */}
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-xl drop-shadow-md"></div>

              {/* Optional: Subtle pulse animation for the corners or a center line */}
              <div className="absolute inset-0 opacity-50 animate-pulse bg-white/5 rounded-3xl"></div>
            </div>
          )}
        </div>

        {/* Top Controls - Explicit Exit Button */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-safe flex justify-between items-start pointer-events-auto">
          {/* Explicit Exit Button (Top-Right/Left based on RTL) 
            Since app is RTL, "Back" usually goes to the Right, but standard "Close" often is top-left or top-right.
            Let's put a clear "X" button on the top-right which is common for "Close".
        */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full w-12 h-12 bg-black/40 text-white hover:bg-black/60 backdrop-blur-md border border-white/20"
          >
            <X className="w-8 h-8" />
          </Button>

          {/* Flash Toggle */}
          {!isInitializing && !permissionError && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTorch}
              className={`rounded-full w-12 h-12 backdrop-blur-md border border-white/20 ${isTorchOn
                ? 'bg-yellow-400/80 text-black hover:bg-yellow-500'
                : 'bg-black/40 text-white hover:bg-black/60'
                }`}
            >
              {isTorchOn ? <Zap className="w-6 h-6 fill-current" /> : <ZapOff className="w-6 h-6" />}
            </Button>
          )}
        </div>

        {/* Center Messages (Loading / Error) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

          {/* Helper Text (Below Frame) */}
          {!isInitializing && !permissionError && (
            <div className="mt-80 text-center">
              <p className="text-white text-lg font-bold drop-shadow-lg tracking-wide bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">
                وجّه الكاميرا نحو الباركود
              </p>
            </div>
          )}

          {/* Loading State */}
          {isInitializing && (
            <div className="flex flex-col items-center gap-4 z-50">
              <Loader2 className="w-16 h-16 text-primary animate-spin drop-shadow-lg" />
              <p className="text-white font-bold text-lg drop-shadow-md">جاري فتح الكاميرا...</p>
            </div>
          )}

          {/* Permission Error State */}
          {permissionError && (
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm mx-4 text-center pointer-events-auto z-50">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">صلاحية الكاميرا مطلوبة</h3>
              <p className="text-gray-600 mb-6">{permissionError}</p>
              <Button onClick={handleClose} className="w-full">
                إغلاق
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
