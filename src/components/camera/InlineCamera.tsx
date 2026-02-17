import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InlineCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string) => void;
  maxSize?: number;
  quality?: number;
}

/**
 * Inline Camera component using navigator.mediaDevices.getUserMedia().
 * Works inside WebView without leaving the app (no Activity Recreation).
 * Used as a fallback when native Capacitor Camera fails.
 */
export function InlineCamera({
  isOpen,
  onClose,
  onCapture,
  maxSize = 640,
  quality = 70,
}: InlineCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);

  const startStream = useCallback(async (facing: 'environment' | 'user') => {
    stopStream();
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      console.error('[InlineCamera] getUserMedia failed:', err);
      // Try the other camera if the requested one fails
      if (facing === 'environment') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsReady(true);
            setFacingMode('user');
            return;
          }
        } catch {
          // both failed
        }
      }
      setError('تعذّر الوصول إلى الكاميرا. تأكد من منح الإذن.');
    }
  }, [stopStream]);

  useEffect(() => {
    if (isOpen) {
      startStream(facingMode);
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchCamera = useCallback(() => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startStream(newFacing);
  }, [facingMode, startStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    let width = video.videoWidth;
    let height = video.videoHeight;

    // Scale down
    if (width > height) {
      if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
    } else {
      if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const base64 = canvas.toDataURL('image/jpeg', quality / 100);

    stopStream();
    onCapture(base64);
  }, [maxSize, quality, stopStream, onCapture]);

  const handleClose = useCallback(() => {
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20 rounded-full"
        >
          <X className="h-6 w-6" />
        </Button>
        <span className="text-white text-sm font-medium">
          {'الكاميرا'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwitchCamera}
          className="text-white hover:bg-white/20 rounded-full"
        >
          <SwitchCamera className="h-5 w-5" />
        </Button>
      </div>

      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
      />

      {/* Loading / Error overlay */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <p className="text-white text-lg mb-4">{error}</p>
          <Button variant="outline" onClick={handleClose} className="text-white border-white hover:bg-white/20">
            {'إغلاق'}
          </Button>
        </div>
      )}

      {/* Capture Button */}
      {isReady && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <button
            onClick={handleCapture}
            className="w-18 h-18 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: 72, height: 72 }}
          >
            <Camera className="h-8 w-8 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
