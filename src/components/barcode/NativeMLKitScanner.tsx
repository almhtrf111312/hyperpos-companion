// Native ML Kit Barcode Scanner - uses Google ML Kit for fast, accurate scanning on mobile
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
}

export function NativeMLKitScanner({ isOpen, onClose, onScan }: NativeMLKitScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ Use refs for synchronous locks to prevent multiple camera opens
  const scanningRef = useRef(false);
  const hasScannedRef = useRef(false);
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
    if (scanningRef.current || hasScannedRef.current) {
      console.log('[MLKit] Already scanning or scanned, skipping...');
      return;
    }
    
    // ✅ Set lock immediately (synchronous)
    scanningRef.current = true;
    setIsLoading(true);
    setError(null);
    
    console.log('[MLKit] Starting scan...');

    try {
      const hasPerms = await checkPermission();
      if (!hasPerms || !mountedRef.current) {
        scanningRef.current = false;
        setIsLoading(false);
        return;
      }

      // Check if Google Barcode Scanner module is available (for Android)
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      
      if (!available) {
        console.log('[MLKit] Installing Google Barcode Scanner module...');
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      // Start scanning with ML Kit
      const result = await BarcodeScanner.scan({
        formats: [
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
        ],
      });

      // Check if still mounted
      if (!mountedRef.current) return;

      if (result.barcodes.length > 0) {
        const barcode = result.barcodes[0];
        const value = barcode.rawValue || barcode.displayValue;
        
        if (value) {
          console.log('[MLKit] ✅ Scanned barcode:', value);
          
          // ✅ Mark as scanned to prevent re-opening
          hasScannedRef.current = true;
          
          // Play beep sound
          playBeep();
          
          // Vibrate
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          // ✅ Call onScan FIRST with the value
          onScan(value);
          
          // ✅ Then close with a small delay to ensure parent receives data
          setTimeout(() => {
            if (mountedRef.current) {
              onClose();
            }
          }, 50);
        }
      } else {
        // User cancelled or no barcode found
        console.log('[MLKit] No barcode found or cancelled');
        onClose();
      }
    } catch (err: any) {
      console.error('[MLKit] Scan error:', err);
      
      // Handle user cancellation gracefully
      if (err?.message?.includes('canceled') || err?.code === 'CANCELED') {
        onClose();
        return;
      }
      
      if (mountedRef.current) {
        setError('فشل في مسح الباركود. حاول مرة أخرى.');
      }
    } finally {
      scanningRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // ✅ Optimized useEffect with minimal dependencies
  useEffect(() => {
    mountedRef.current = true;
    
    if (isOpen && !scanningRef.current && !hasScannedRef.current) {
      startScanning();
    }
    
    // Reset locks when dialog closes
    if (!isOpen) {
      hasScannedRef.current = false;
      scanningRef.current = false;
      setError(null);
    }
    
    return () => {
      mountedRef.current = false;
      BarcodeScanner.stopScan().catch(() => {});
    };
  }, [isOpen]); // ✅ Only depend on isOpen to prevent multiple triggers

  // Show loading/error dialog while native scanner is active
  return (
    <Dialog open={isOpen && (isLoading || error !== null)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-center">مسح الباركود</DialogTitle>
        
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          {isLoading && !error && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground text-center">
                جاري فتح الكاميرا...
              </p>
            </>
          )}
          
          {error && (
            <>
              <Camera className="w-12 h-12 text-muted-foreground" />
              <p className="text-destructive text-center">{error}</p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {hasPermission === false && (
                  <Button 
                    onClick={openSettings}
                    className="w-full"
                  >
                    <Settings className="w-4 h-4 ml-2" />
                    فتح الإعدادات
                  </Button>
                )}
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
