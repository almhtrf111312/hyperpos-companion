// Native Scanner using @capacitor-community/barcode-scanner
// SIMPLIFIED VERSION - Clean camera, always-visible controls
import { useEffect, useState, useRef } from 'react';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
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

  const checkPermission = async (): Promise<boolean> => {
    try {
      const status = await BarcodeScanner.checkPermission({ force: true });
      if (status.granted) return true;
      if (status.denied) {
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

    try {
      // 1. Check Permission
      const hasPerm = await checkPermission();
      if (!hasPerm) {
        setIsInitializing(false);
        scanningRef.current = false;
        return;
      }

      // 2. Prepare (Important for restarting)
      await BarcodeScanner.prepare();

      // 3. Hide Background & Add Class (target html tag directly)
      await BarcodeScanner.hideBackground();
      document.documentElement.classList.add('barcode-scanner-active');

      // 4. Camera is ready, hide loading spinner
      setIsInitializing(false);

      // 5. Start simple single scan (no complex loops)
      const result = await BarcodeScanner.startScan();

      // 6. Process result
      if (result.hasContent && !hasScannedRef.current) {
        hasScannedRef.current = true;

        console.log('[Scanner] Scanned:', result.content);

        // Feedback
        playBeep();
        if (navigator.vibrate) navigator.vibrate(200);

        // Cleanup immediately but keep overlay for a moment
        await stopScanning();

        // Send value
        onScan(result.content);

        // Auto-close after brief delay
        setTimeout(() => {
          if (mountedRef.current) onClose();
        }, 300);
      } else {
        // User cancelled by system back button
        await stopScanning();
        onClose();
      }

    } catch (err: any) {
      console.error('[Scanner] Scan error:', err);
      // Ensure we clean up if startScan throws
      await stopScanning();
      // Only show error if we are still mounted and it wasn't a clean exit
      if (mountedRef.current) {
        setPermissionError('حدث خطأ أثناء تشغيل الماسح');
      }
    } finally {
      scanningRef.current = false;
    }
  };

  const stopScanning = async () => {
    try {
      // Force disable torch first
      await BarcodeScanner.disableTorch();
      setIsTorchOn(false);

      // Stop scan AND show background to restore UI
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
    } catch (e) {
      console.warn('Stop scanning failed (might already be stopped):', e);
    } finally {
      // Cleanup (target html tag directly)
      document.documentElement.classList.remove('barcode-scanner-active');
      scanningRef.current = false;
    }
  };

  const handleClose = async () => {
    hasScannedRef.current = false;
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
    if (isOpen) {
      startScanning();
    }
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-ui-overlay fixed inset-0 z-[9999] flex flex-col">

      {/* Top Controls Bar */}
      <div className="flex justify-between items-center p-4 pointer-events-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        {/* Close Button (Left) */}
        <Button
          variant="destructive"
          size="lg"
          onClick={handleClose}
          className="rounded-full shadow-2xl flex items-center gap-2 px-4"
        >
          <X className="w-6 h-6" />
          <span className="font-bold text-lg">خروج</span>
        </Button>

        {/* Flash Toggle (Right) */}
        {!isInitializing && !permissionError && (
          <Button
            variant={isTorchOn ? "default" : "outline"}
            size="lg"
            onClick={toggleTorch}
            className={`rounded-full shadow-2xl ${isTorchOn
              ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500'
              : 'bg-white/20 text-white border-white/50 hover:bg-white/30'
              }`}
          >
            {isTorchOn ? <Zap className="w-6 h-6 fill-current" /> : <ZapOff className="w-6 h-6" />}
          </Button>
        )}
      </div>

      {/* Center: Scan Guide */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        {!isInitializing && !permissionError && (
          <div className="relative">
            {/* Border Frame */}
            <div className="w-64 h-64 border-4 border-primary/70 rounded-2xl relative">
              {/* Corner Markers */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary"></div>

              {/* Scanning Line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-red-500 animate-pulse shadow-[0_0_10px_red]"></div>
            </div>

            {/* Instruction Text */}
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <p className="text-white text-center font-medium drop-shadow-lg">
                وجّه الكاميرا نحو الباركود
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isInitializing && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-black/60 backdrop-blur-md p-6 rounded-full shadow-2xl">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
            <p className="text-white font-medium drop-shadow-lg">جاري فتح الكاميرا...</p>
          </div>
        )}

        {/* Permission Error State */}
        {permissionError && (
          <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-sm mx-4 pointer-events-auto">
            <p className="text-red-400 text-center mb-4">{permissionError}</p>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full"
            >
              إغلاق
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
