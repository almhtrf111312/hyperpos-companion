// Native Scanner using @capacitor-community/barcode-scanner (Better Transparency Support)
// Optimized for Tecno, Infinix, Samsung with auto-zoom
import { useEffect, useState, useRef } from 'react';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Camera, Loader2 } from 'lucide-react';
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

  // Synchronous locks
  const scanningRef = useRef(false);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);

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

    try {
      const hasPerm = await checkPermission();
      if (!hasPerm) {
        setIsLoading(false);
        scanningRef.current = false;
        return;
      }

      console.log('[Scanner] Starting scan...');

      // 1. Hide Background (Community Plugin Method)
      await BarcodeScanner.hideBackground();

      // 2. Extra Enforcement
      makeAppTransparent();
      document.body.classList.add('barcode-scanner-active');

      // 3. Start Scan
      const result = await BarcodeScanner.startScan();

      // Check if result has content
      if (result.hasContent) {
        console.log('[Scanner] Scanned content:', result.content);

        // Prevent duplicate processing
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;

        // Cleanup immediately
        await stopScanning();

        // Audio & Vibrate
        playBeep();
        if (navigator.vibrate) navigator.vibrate(200);

        // Send value
        onScan(result.content);

        // Delay close
        setTimeout(() => {
          if (mountedRef.current) onClose();
        }, 500);
      } else {
        // User cancelled or back button?
        // Usually startScan resolves on success. Back button on Android handles native cancel.
        await stopScanning();
        onClose();
      }

    } catch (err: any) {
      console.error('[Scanner] Scan error:', err);
      await stopScanning();

      // Handle known cancellation message from plugin if any
      // but usually plugin handles lifecycle well
      setError('حدث خطأ أثناء تشغيل الماسح');
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanning = async () => {
    try {
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
    } catch (e) { }
    cleanupAppTransparency();
    document.body.classList.remove('barcode-scanner-active');
    scanningRef.current = false;
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
      {/* Fallback Close Button (In case native back fails or users wants to cancel) */}
      {isOpen && !error && !isLoading && (
        <div className="fixed top-12 left-4 z-[9999]">
          <Button variant="secondary" size="sm" onClick={() => {
            hasScannedRef.current = false; // Allow retry if explicitly closed? 
            // actually onClose will unmount this, so refs reset anyway
            stopScanning();
            onClose();
          }} className="rounded-full opacity-80 backdrop-blur-md">
            إغلاق
          </Button>
        </div>
      )}

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
    </>
  );
}
