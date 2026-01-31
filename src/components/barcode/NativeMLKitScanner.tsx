// Native ML Kit Barcode Scanner - uses Google ML Kit for fast, accurate scanning on mobile
// Optimized for Tecno, Infinix, Samsung with auto-zoom 2.5x
import { useEffect, useState, useRef } from 'react';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Camera, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { playBeep } from '@/lib/sound-utils';

interface NativeMLKitScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  /** Optional callback to allow parent to switch to a fallback scanner on problematic devices */
  onFallback?: () => void;
}

// All supported barcode formats for maximum compatibility
const ALL_BARCODE_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Code128,
  BarcodeFormat.Code39,
  BarcodeFormat.Code93,
  BarcodeFormat.Codabar,
  BarcodeFormat.Itf,
  BarcodeFormat.QrCode,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.Pdf417,
  BarcodeFormat.Aztec,
];

export function NativeMLKitScanner({ isOpen, onClose, onScan, onFallback }: NativeMLKitScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInstallingModule, setIsInstallingModule] = useState(false);

  // ✅ Use refs for synchronous locks to prevent multiple camera opens
  const scanningRef = useRef(false);
  const hasScannedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(true);

  // Open app settings for manual permission grant
  const openSettings = async () => {
    try {
      await BarcodeScanner.openSettings();
    } catch (err) {
      console.error('[MLKit] Failed to open settings:', err);
      setError('افتح إعدادات التطبيق يدوياً وامنح إذن الكاميرا');
    }
  };

  // Check and request camera permission
  const checkPermission = async (): Promise<boolean> => {
    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      console.log('[MLKit] Current permission status:', camera);

      if (camera === 'granted') {
        setHasPermission(true);
        return true;
      } else if (camera === 'denied') {
        setHasPermission(false);
        setError('تم رفض صلاحية الكاميرا. اضغط على "فتح الإعدادات" للسماح بالوصول.');
        return false;
      } else {
        console.log('[MLKit] Requesting camera permission...');
        const result = await BarcodeScanner.requestPermissions();
        const granted = result.camera === 'granted';
        setHasPermission(granted);

        if (!granted) {
          setError('يرجى السماح بالوصول للكاميرا لمسح الباركود');
        }
        return granted;
      }
    } catch (err) {
      console.error('[MLKit] Permission check failed:', err);
      setError('فشل في التحقق من صلاحيات الكاميرا. حاول فتح الإعدادات يدوياً.');
      return false;
    }
  };

  // Start scanning - with synchronous lock
  const startScanning = async () => {
    // ✅ Check ref synchronously to prevent multiple opens
    if (scanningRef.current || hasScannedRef.current || isProcessingRef.current) {
      console.log('[MLKit] Already scanning, scanned, or processing, skipping...');
      return;
    }

    // ✅ Set lock immediately (synchronous)
    scanningRef.current = true;
    setIsLoading(true);
    setError(null);

    console.log('[MLKit] Starting scan with ML Kit...');

    try {
      const hasPerms = await checkPermission();
      if (!hasPerms || !mountedRef.current) {
        scanningRef.current = false;
        setIsLoading(false);
        return;
      }

      // Check if Google Barcode Scanner module is available (for Android)
      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();

        if (!available) {
          console.log('[MLKit] Installing Google Barcode Scanner module...');
          setIsInstallingModule(true);
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          setIsInstallingModule(false);
          console.log('[MLKit] ✅ Module installed successfully');
        }
      } catch (moduleErr) {
        console.warn('[MLKit] Module check/install skipped:', moduleErr);
        setIsInstallingModule(false);
        // Continue anyway - might work on some devices
      }

      // Start scanning with ML Kit - all formats supported
      console.log('[MLKit] Opening camera with all barcode formats...');
      const result = await BarcodeScanner.scan({
        formats: ALL_BARCODE_FORMATS,
      });

      // Check if still mounted
      if (!mountedRef.current) return;

      if (result.barcodes.length > 0) {
        // Validation: Ignore if already processing to preventing double-fire
        if (isProcessingRef.current) {
          console.log('[MLKit] Scan ignored - already processing');
          return;
        }

        const barcode = result.barcodes[0];
        // ✅ Try all possible value properties
        const value = barcode.rawValue || barcode.displayValue || (barcode as any).value || '';

        console.log('[MLKit] ✅ Full barcode object:', JSON.stringify(barcode));
        console.log('[MLKit] ✅ Extracted value:', value);

        if (value && value.trim() !== '') {
          // ✅ Mark as processing immediately
          isProcessingRef.current = true;
          hasScannedRef.current = true;

          // CRITICAL: Stop generic listeners and stop scan to prevent native crash
          try {
            await BarcodeScanner.removeAllListeners();
            await BarcodeScanner.stopScan();
          } catch (stopErr) {
            console.warn('[MLKit] Stop scan warning:', stopErr);
          }

          // Play beep sound - FORCE AUDIO
          const audio = new Audio('/assets/beep.mp3'); // Try standard path or fallback
          audio.play().catch(e => console.warn('Audio play failed', e));
          playBeep(); // Try util as well

          // Vibrate - 200ms as requested
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }

          // ✅ Store the value before any async operation
          const scannedValue = value.trim();

          console.log('Scanned:', scannedValue);

          // ✅ Call onScan FIRST with the value synchronously
          onScan(scannedValue);

          // Debug check
          console.log('[MLKit] Passed value to parent:', scannedValue);

          // ✅ Delay Close to allow native view to detach gracefully (bypassing crash)
          setTimeout(() => {
            if (mountedRef.current) {
              onClose();
            }
          }, 500);

        } else {
          console.warn('[MLKit] ⚠️ Barcode scanned but value is empty');
          onClose();
        }
      } else {
        // User cancelled or no barcode found
        console.log('[MLKit] No barcode found or cancelled');
        onClose();
      }
    } catch (err: any) {
      // ... error handling ...
      console.error('[MLKit] Scan error:', err);

      // Handle user cancellation gracefully
      if (err?.message?.includes('canceled') || err?.code === 'CANCELED') {
        onClose();
        return;
      }
      // ...
    } finally {
      // ...
      scanningRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
        setIsInstallingModule(false);
      }
    }
  };

  // Zoom Control
  const [zoomRatio, setZoomRatio] = useState(1.0);

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoomRatio(newZoom);
    try {
      await BarcodeScanner.setZoomRatio({ zoomRatio: newZoom });
    } catch (err) {
      console.error('[MLKit] Zoom failed:', err);
    }
  };

  // ... useEffect ...

  // Show loading/error dialog while native scanner is active
  return (
    <>
      {/* Zoom Control Overlay - Only show when scanning (scanningRef or isOpen?) */}
      {isOpen && !error && !isLoading && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-64 bg-black/50 backdrop-blur-sm p-4 rounded-xl border border-white/20">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-medium">1x</span>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={zoomRatio}
              onChange={handleZoomChange}
              className="flex-1 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-white text-xs font-medium">5x</span>
          </div>
          <p className="text-center text-white/80 text-[10px] mt-1">Zoom: {zoomRatio.toFixed(1)}x</p>
        </div>
      )}

      <Dialog open={isOpen && (isLoading || error !== null)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm">
          {/* ... dialog content ... */}
          <DialogTitle className="text-center">مسح الباركود</DialogTitle>

          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {isLoading && !error && (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-muted-foreground text-center">
                  {isInstallingModule
                    ? 'جاري تثبيت وحدة الماسح...'
                    : 'جاري فتح الكاميرا...'
                  }
                </p>
              </>
            )}

            {error && (
              <>
                <Camera className="w-12 h-12 text-muted-foreground" />
                <p className="text-destructive text-center">{error}</p>
                {/* ... error buttons ... */}
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
