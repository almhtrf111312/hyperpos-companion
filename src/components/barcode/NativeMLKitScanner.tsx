// Native ML Kit Barcode Scanner - uses Google ML Kit for fast, accurate scanning on mobile
import { useEffect, useCallback, useState } from 'react';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Camera, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { playBeep } from '@/lib/sound-utils';
import { Capacitor } from '@capacitor/core';

interface NativeMLKitScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function NativeMLKitScanner({ isOpen, onClose, onScan }: NativeMLKitScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Open app settings for manual permission grant
  const openSettings = useCallback(async () => {
    try {
      await BarcodeScanner.openSettings();
    } catch (err) {
      console.error('[MLKit] Failed to open settings:', err);
      // Fallback: show instructions
      setError('افتح إعدادات التطبيق يدوياً وامنح إذن الكاميرا');
    }
  }, []);

  // Check and request camera permission
  const checkPermission = useCallback(async () => {
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
        // Prompt for permission
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
  }, []);

  // Start scanning
  const startScanning = useCallback(async () => {
    if (isScanning) return;
    
    try {
      setIsScanning(true);
      setError(null);

      const hasPerms = await checkPermission();
      if (!hasPerms) {
        setIsScanning(false);
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

      setIsScanning(false);

      if (result.barcodes.length > 0) {
        const barcode = result.barcodes[0];
        const value = barcode.rawValue || barcode.displayValue;
        
        if (value) {
          console.log('[MLKit] Scanned:', value);
          
          // Play beep sound
          playBeep();
          
          // Vibrate
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          onScan(value);
          onClose();
        }
      } else {
        // User cancelled or no barcode found
        onClose();
      }
    } catch (err: any) {
      console.error('[MLKit] Scan error:', err);
      setIsScanning(false);
      
      // Handle user cancellation gracefully
      if (err?.message?.includes('canceled') || err?.code === 'CANCELED') {
        onClose();
        return;
      }
      
      setError('فشل في مسح الباركود. حاول مرة أخرى.');
    }
  }, [isScanning, checkPermission, onScan, onClose]);

  // Stop scanning when dialog closes
  const stopScanning = useCallback(async () => {
    try {
      await BarcodeScanner.stopScan();
    } catch (err) {
      // Ignore errors when stopping
    }
    setIsScanning(false);
  }, []);

  // Handle dialog open/close
  useEffect(() => {
    if (isOpen) {
      startScanning();
    } else {
      stopScanning();
    }
    
    return () => {
      stopScanning();
    };
  }, [isOpen, startScanning, stopScanning]);

  // Show loading/error dialog while native scanner is active
  return (
    <Dialog open={isOpen && (isScanning || error !== null)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-center">مسح الباركود</DialogTitle>
        
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          {isScanning && !error && (
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
                {/* Show "Open Settings" button when permission is denied */}
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
                  <Button onClick={startScanning} className="flex-1">
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
