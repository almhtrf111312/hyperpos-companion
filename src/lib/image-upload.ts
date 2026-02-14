import { supabase } from '@/integrations/supabase/client';

/**
 * ضغط الصورة تلقائياً
 * @param base64Image صورة بصيغة base64
 * @param maxSizeKB الحجم الأقصى بالكيلوبايت (افتراضي: 30)
 * @param maxWidth العرض الأقصى بالبكسل (افتراضي: 400)
 * @param maxHeight الارتفاع الأقصى بالبكسل (افتراضي: 400)
 * @returns صورة مضغوطة بصيغة base64
 */
async function compressImage(
  base64Image: string,
  maxSizeKB: number = 30,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // حساب الأبعاد الجديدة مع الحفاظ على النسبة
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // إنشاء canvas للضغط
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('فشل إنشاء canvas context'));
        return;
      }

      // رسم الصورة بالأبعاد الجديدة
      ctx.drawImage(img, 0, 0, width, height);

      // ضغط الصورة بجودة متغيرة حتى نصل للحجم المطلوب
      let quality = 0.8;
      let compressedBase64 = canvas.toDataURL('image/jpeg', quality);

      // حساب حجم الصورة بالكيلوبايت
      const getImageSizeKB = (base64: string) => {
        const base64Length = base64.split(',')[1].length;
        return (base64Length * 0.75) / 1024;
      };

      // تقليل الجودة تدريجياً حتى نصل للحجم المطلوب
      while (getImageSizeKB(compressedBase64) > maxSizeKB && quality > 0.1) {
        quality -= 0.05;
        compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      }

      console.log(`[Image Compression] Original: ${getImageSizeKB(base64Image).toFixed(2)}KB → Compressed: ${getImageSizeKB(compressedBase64).toFixed(2)}KB (Quality: ${(quality * 100).toFixed(0)}%)`);

      resolve(compressedBase64);
    };

    img.onerror = () => {
      reject(new Error('فشل تحميل الصورة'));
    };

    img.src = base64Image;
  });
}

/**
 * رفع صورة منتج إلى Supabase Storage
 * @param base64Image صورة بصيغة base64
 * @returns URL العام للصورة أو null في حالة الفشل
 */
export async function uploadProductImage(base64Image: string): Promise<string | null> {
  try {
    // ضغط الصورة تلقائياً قبل الرفع
    console.log('[Image Upload] Compressing image...');
    const compressedImage = await compressImage(base64Image, 30, 400, 400);

    // تحويل base64 إلى Blob
    const response = await fetch(compressedImage);
    const blob = await response.blob();

    console.log(`[Image Upload] Final size: ${(blob.size / 1024).toFixed(2)}KB`);

    // إنشاء اسم فريد للملف
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const filePath = `products/${fileName}`;

    // رفع الصورة
    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (error) {
      console.error('خطأ في رفع الصورة:', error);
      throw error;
    }

    // الحصول على signed URL (لأن الـ bucket خاص)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('product-images')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // صالح لسنة

    if (signedError || !signedData?.signedUrl) {
      // fallback to public URL
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      return data.publicUrl;
    }

    return signedData.signedUrl;
  } catch (error) {
    console.error('فشل رفع الصورة:', error);
    return null;
  }
}

/**
 * حذف صورة منتج من Supabase Storage
 * @param imageUrl URL الصورة المراد حذفها
 * @returns true في حالة النجاح
 */
export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  try {
    // تجاهل الصور القديمة المخزنة كـ base64
    if (imageUrl.startsWith('data:')) {
      return true;
    }

    // استخراج مسار الملف من URL
    const urlParts = imageUrl.split('/product-images/');
    if (urlParts.length < 2) return false;

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) {
      console.error('خطأ في حذف الصورة:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('فشل حذف الصورة:', error);
    return false;
  }
}

/**
 * التحقق مما إذا كانت الصورة مخزنة في السحابة
 */
export function isCloudImage(imageUrl: string | undefined): boolean {
  if (!imageUrl) return false;
  return imageUrl.includes('supabase') && imageUrl.includes('product-images');
}
