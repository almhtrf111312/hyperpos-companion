import { useState, useCallback } from 'react';
import { toast } from 'sonner';

type UploadStatus = 'idle' | 'syncing' | 'done' | 'error';

interface UseImageUploadReturn {
  /** The value to store in formData / DB: base64 locally, cloud path after sync */
  imageValue: string;
  /** Always a base64 or signed URL — used for <img src={...}> display */
  imagePreview: string;
  uploadStatus: UploadStatus;
  /** Call this with a base64 string from camera / gallery / file input */
  handleBase64Image: (base64: string) => void;
  /** Convenience handler for <input type="file"> */
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Clear the image */
  clearImage: () => void;
  /** Initialise from an existing saved value (path or base64) */
  setInitialImage: (value: string) => void;
}

/**
 * Offline-First image upload hook.
 *
 * Flow:
 *  1. User picks/captures an image → immediately shown in UI via base64.
 *  2. Cloud upload runs in the background (no blocking toast/spinner).
 *  3. Once uploaded, imageValue silently switches to the storage path.
 *  4. A small syncing indicator (uploadStatus) is available for optional UI feedback.
 */
export function useImageUpload(onValueChange?: (value: string) => void): UseImageUploadReturn {
  const [imageValue, setImageValue] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');

  const uploadInBackground = useCallback(async (base64: string) => {
    setUploadStatus('syncing');
    try {
      // Compress locally first — guaranteed offline
      const { compressImageOffline } = await import('@/lib/image-upload');
      const compressed = await compressImageOffline(base64);
      setImageValue(compressed);
      onValueChange?.(compressed);
      setUploadStatus('done');
      
      // Then attempt cloud upload silently in background
      const { uploadProductImage } = await import('@/lib/image-upload');
      const cloudPath = await uploadProductImage(compressed);
      if (cloudPath && !cloudPath.startsWith('data:')) {
        setImageValue(cloudPath);
        onValueChange?.(cloudPath);
      }
    } catch {
      setUploadStatus('error');
    }
  }, [onValueChange]);

  const handleBase64Image = useCallback((base64: string) => {
    if (!base64) return;
    // 1. Show immediately — no waiting
    setImagePreview(base64);
    setImageValue(base64);
    onValueChange?.(base64);
    // 2. Upload quietly in background
    uploadInBackground(base64);
  }, [uploadInBackground, onValueChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleBase64Image(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [handleBase64Image]);

  const clearImage = useCallback(() => {
    setImageValue('');
    setImagePreview('');
    setUploadStatus('idle');
    onValueChange?.('');
  }, [onValueChange]);

  const setInitialImage = useCallback((value: string) => {
    if (!value) return;
    setImageValue(value);
    // For display: if it's already a full URL/base64, use directly
    // Otherwise ProductImage component will resolve the signed URL
    setImagePreview(value);
    setUploadStatus('done');
  }, []);

  return {
    imageValue,
    imagePreview,
    uploadStatus,
    handleBase64Image,
    handleFileInput,
    clearImage,
    setInitialImage,
  };
}

