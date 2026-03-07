import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capgo/camera-preview';
import { Camera, X, SwitchCamera, Zap, ZapOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NativeCameraPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (base64: string) => void;
    maxSize?: number;
    quality?: number;
}

/**
 * NativeCameraPreview — uses @capgo/camera-preview Plugin.
 *
 * On Android/iOS: renders the camera as a native layer INSIDE the current
 * Activity (no new Activity launched → no WebView memory kill / restart).
 *
 * On Web: falls back to getUserMedia inside a <video> element.
 */
export function NativeCameraPreview({
    isOpen,
    onClose,
    onCapture,
    maxSize = 400,
    quality = 40,
}: NativeCameraPreviewProps) {
    const isNative = Capacitor.isNativePlatform();

    const [isReady, setIsReady] = useState(false);
    const [isFront, setIsFront] = useState(false);
    const [flashOn, setFlashOn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    // Web-only
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    /* ─────────────────────────────────── NATIVE ─────────────────────────────── */

    const startNative = useCallback(async () => {
        setError(null);
        setIsReady(false);
        try {
            await CameraPreview.start({
                position: 'rear',
                width: window.screen.width,
                height: window.screen.height,
                x: 0,
                y: 0,
                toBack: true,          // render camera BEHIND the WebView layer
                disableAudio: true,
                rotateWhenOrientationChanged: true,
            });
            setIsReady(true);
        } catch (e) {
            console.error('[NativeCameraPreview] start failed:', e);
            setError('تعذّر تشغيل الكاميرا. تأكد من منح الإذن.');
        }
    }, []);

    const stopNative = useCallback(async () => {
        try {
            await CameraPreview.stop({ force: true });
        } catch {
            // ignore
        }
        setIsReady(false);
    }, []);

    const captureNative = useCallback(async () => {
        if (isCapturing) return;
        setIsCapturing(true);
        try {
            const { value } = await CameraPreview.capture({ quality });
            // value is base64 (no data: prefix) — add it
            const base64 = value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
            // Compress/resize
            const compressed = await compressBase64(base64, maxSize, quality);
            await stopNative();
            onCapture(compressed);
        } catch (e) {
            console.error('[NativeCameraPreview] capture failed:', e);
            setError('فشل في التقاط الصورة.');
        } finally {
            setIsCapturing(false);
        }
    }, [isCapturing, quality, maxSize, stopNative, onCapture]);

    const flipNative = useCallback(async () => {
        try {
            await CameraPreview.flip();
            setIsFront(prev => !prev);
        } catch (e) {
            console.error('[NativeCameraPreview] flip failed:', e);
        }
    }, []);

    const toggleFlashNative = useCallback(async () => {
        try {
            const modes = await CameraPreview.getSupportedFlashModes();
            const supported = modes.result ?? [];
            if (supported.length === 0) return;
            const next = flashOn ? 'off' : 'on';
            if (supported.includes(next as never)) {
                await CameraPreview.setFlashMode({ flashMode: next as never });
                setFlashOn(!flashOn);
            }
        } catch {
            // flash not supported — ignore
        }
    }, [flashOn]);

    /* ─────────────────────────────────── WEB ────────────────────────────────── */

    const startWeb = useCallback(async () => {
        setError(null);
        setIsReady(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsReady(true);
            }
        } catch (e) {
            console.error('[NativeCameraPreview] web getUserMedia failed:', e);
            setError('تعذّر الوصول إلى الكاميرا.');
        }
    }, []);

    const stopWeb = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsReady(false);
    }, []);

    const captureWeb = useCallback(() => {
        if (isCapturing || !videoRef.current) return;
        setIsCapturing(true);
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', quality / 100);
        stopWeb();
        onCapture(base64);
        setIsCapturing(false);
    }, [isCapturing, maxSize, quality, stopWeb, onCapture]);

    /* ─────────────────────────────────── LIFECYCLE ──────────────────────────── */

    useEffect(() => {
        if (!isOpen) return;
        if (isNative) { startNative(); }
        else { startWeb(); }

        return () => {
            if (isNative) { stopNative(); }
            else { stopWeb(); }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleClose = useCallback(async () => {
        if (isNative) await stopNative();
        else stopWeb();
        onClose();
    }, [isNative, stopNative, stopWeb, onClose]);

    if (!isOpen) return null;

    /* ─────────────────────────────────── UI ─────────────────────────────────── */

    // On native, the camera renders BEHIND WebView (toBack:true).
    // We show a transparent overlay with controls on top.
    return (
        <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: isNative ? 'transparent' : 'black' }}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/60 to-transparent">
                <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/20 rounded-full">
                    <X className="h-6 w-6" />
                </Button>
                <span className="text-white text-sm font-medium">الكاميرا</span>
                <div className="flex gap-2">
                    {/* Flash (native only) */}
                    {isNative && (
                        <Button variant="ghost" size="icon" onClick={toggleFlashNative} className="text-white hover:bg-white/20 rounded-full">
                            {flashOn ? <Zap className="h-5 w-5 text-yellow-300" /> : <ZapOff className="h-5 w-5" />}
                        </Button>
                    )}
                    {/* Flip camera */}
                    <Button variant="ghost" size="icon" onClick={isNative ? flipNative : undefined} className="text-white hover:bg-white/20 rounded-full">
                        <SwitchCamera className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Web-only video feed */}
            {!isNative && (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />
            )}

            {/* Loading */}
            {!isReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
                    <p className="text-white text-lg mb-4">{error}</p>
                    <Button variant="outline" onClick={handleClose} className="text-white border-white hover:bg-white/20">إغلاق</Button>
                </div>
            )}

            {/* Capture button + bottom gradient */}
            {isReady && (
                <div className="absolute bottom-0 left-0 right-0 pb-10 flex justify-center bg-gradient-to-t from-black/60 to-transparent pt-16">
                    <button
                        onClick={isNative ? captureNative : captureWeb}
                        disabled={isCapturing}
                        className="w-[72px] h-[72px] rounded-full border-4 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
                    >
                        {isCapturing
                            ? <Loader2 className="h-8 w-8 text-white animate-spin" />
                            : <Camera className="h-8 w-8 text-white" />
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────── UTILS ──────────────────────────────── */

function compressBase64(base64: string, maxSize: number, quality: number): Promise<string> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
            else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality / 100));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}
