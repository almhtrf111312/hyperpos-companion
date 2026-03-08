import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NativeCameraPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (base64: string) => void;
    maxSize?: number;
    quality?: number;
}

/**
 * NativeCameraPreview — Compact camera modal using getUserMedia.
 *
 * Uses createPortal to render directly into document.body, ensuring it
 * appears ABOVE Radix Dialog portals and other stacking contexts.
 *
 * Renders the camera as an HTML <video> element inside a small centered
 * modal — works on Android, iOS and Web with minimal memory usage.
 */
export function NativeCameraPreview({
    isOpen,
    onClose,
    onCapture,
    maxSize = 400,
    quality = 40,
}: NativeCameraPreviewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

    /* ─────────────────── START / STOP STREAM ─────────────────── */

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsReady(false);
    }, []);

    const startStream = useCallback(async (facing: 'environment' | 'user') => {
        stopStream();
        setError(null);
        setIsReady(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facing,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
                audio: false,
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsReady(true);
            }
        } catch (e) {
            console.error('[NativeCameraPreview] getUserMedia failed:', e);
            // Try fallback to the other camera
            if (facing === 'environment') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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
                    // both cameras failed
                }
            }
            setError('تعذّر تشغيل الكاميرا. تأكد من منح الإذن.');
        }
    }, [stopStream]);

    /* ─────────────────── CAPTURE ─────────────────── */

    const handleCapture = useCallback(() => {
        if (isCapturing || !videoRef.current) return;
        setIsCapturing(true);

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        let w = video.videoWidth;
        let h = video.videoHeight;

        // Scale down to maxSize
        if (w > h) {
            if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
        } else {
            if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
        }

        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', quality / 100);

        stopStream();
        onCapture(base64);
        setIsCapturing(false);
    }, [isCapturing, maxSize, quality, stopStream, onCapture]);

    /* ─────────────────── FLIP CAMERA ─────────────────── */

    const handleFlip = useCallback(() => {
        const newFacing = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newFacing);
        startStream(newFacing);
    }, [facingMode, startStream]);

    /* ─────────────────── LIFECYCLE ─────────────────── */

    useEffect(() => {
        if (isOpen) {
            startStream(facingMode);
        } else {
            stopStream();
        }
        return () => stopStream();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleClose = useCallback(() => {
        stopStream();
        onClose();
    }, [stopStream, onClose]);

    if (!isOpen) return null;

    /* ─────────────────── UI — Rendered via Portal ─────────────────── */

    const modalContent = (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={{
                zIndex: 99999,
                background: 'rgba(0,0,0,0.95)',
            }}
            onClick={handleClose}
        >
            {/* Modal container — بدون طبقات تمويه */}
            <div
                className="relative w-[88vw] max-w-[340px] rounded-2xl overflow-hidden bg-black shadow-2xl"
                style={{ maxHeight: '70vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — خلفية سوداء صلبة بدون gradient */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-black">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="text-white hover:bg-white/20 rounded-full h-8 w-8"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <span className="text-white text-sm font-medium">الكاميرا</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleFlip}
                        className="text-white hover:bg-white/20 rounded-full h-8 w-8"
                    >
                        <SwitchCamera className="h-4 w-4" />
                    </Button>
                </div>

                {/* Video Feed — بدون أي طبقات فوق الفيديو */}
                <div className="relative w-full bg-black" style={{ aspectRatio: '3/4' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{
                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                            display: isReady ? 'block' : 'none',
                        }}
                    />

                    {/* Loading overlay — يختفي فوراً عند جاهزية الكاميرا */}
                    {!isReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                            <span className="text-white/70 text-xs">جارٍ تشغيل الكاميرا...</span>
                        </div>
                    )}

                    {/* Error overlay */}
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black">
                            <p className="text-white text-sm mb-3">{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClose}
                                className="text-white border-white hover:bg-white/20"
                            >
                                إغلاق
                            </Button>
                        </div>
                    )}
                </div>

                {/* Capture Button — بدون backdrop-blur */}
                <div className="flex justify-center py-4 bg-black">
                    <button
                        onClick={handleCapture}
                        disabled={isCapturing || !isReady}
                        className="w-[56px] h-[56px] rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                    >
                        {isCapturing
                            ? <Loader2 className="h-6 w-6 text-white animate-spin" />
                            : <Camera className="h-6 w-6 text-white" />
                        }
                    </button>
                </div>
            </div>
        </div>
    );

    // Render via portal to document.body — guarantees we are above
    // Radix Dialog portals and any other stacking contexts.
    return createPortal(modalContent, document.body);
}
