/**
 * Barcode Scanner - Unified component with ML Kit priority
 * =========================================================
 * 
 * Priority:
 * 1. Native ML Kit (on Android/iOS Capacitor) - Fast, accurate, auto-zoom
 * 2. Html5-qrcode fallback (on web/unsupported devices)
 * 
 * ML Kit advantages:
 * - Auto-zoom 2.5x for better scanning
 * - Native performance, low latency
 * - Better compatibility with Tecno, Infinix, Samsung
 * - All barcode formats supported
 */

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeMLKitScanner } from './barcode/NativeMLKitScanner';
import { Html5QrcodeScanner } from './barcode/Html5QrcodeScanner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [useNativeScanner, setUseNativeScanner] = useState(false);
  const [scannerChecked, setScannerChecked] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);

  // Check if we should use native ML Kit scanner
  useEffect(() => {
    const checkNativeScanner = async () => {
      try {
        // Only use native scanner on native platforms (Android/iOS)
        const isNative = Capacitor.isNativePlatform();
        console.log('[BarcodeScanner] Platform check - isNative:', isNative);
        
        if (isNative && !nativeFailed) {
          // Try to import and check ML Kit availability
          try {
            const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
            // Check if supported
            const { supported } = await BarcodeScanner.isSupported();
            console.log('[BarcodeScanner] ML Kit supported:', supported);
            setUseNativeScanner(supported);
          } catch (err) {
            console.warn('[BarcodeScanner] ML Kit not available, falling back to html5-qrcode:', err);
            setUseNativeScanner(false);
          }
        } else {
          // Use html5-qrcode on web
          setUseNativeScanner(false);
        }
      } catch (err) {
        console.warn('[BarcodeScanner] Error checking native scanner:', err);
        setUseNativeScanner(false);
      } finally {
        setScannerChecked(true);
      }
    };

    checkNativeScanner();
  }, [nativeFailed]);

  // Don't render until we've checked which scanner to use
  if (!scannerChecked) {
    return null;
  }

  // Use native ML Kit scanner on native platforms for best performance
  if (useNativeScanner) {
    console.log('[BarcodeScanner] Using Native ML Kit Scanner');
    return (
      <NativeMLKitScanner 
        isOpen={isOpen} 
        onClose={onClose} 
        onScan={onScan} 
        onFallback={() => {
          console.warn('[BarcodeScanner] Falling back to Html5-qrcode due to ML Kit failure');
          setNativeFailed(true);
          setUseNativeScanner(false);
        }}
      />
    );
  }

  // Fallback to html5-qrcode for web and unsupported devices
  console.log('[BarcodeScanner] Using Html5-qrcode Scanner');
  return (
    <Html5QrcodeScanner 
      isOpen={isOpen} 
      onClose={onClose} 
      onScan={onScan} 
    />
  );
}
