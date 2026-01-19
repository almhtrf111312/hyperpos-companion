import { supabase } from '@/integrations/supabase/client';

/**
 * رفع صورة منتج إلى Supabase Storage
 * @param base64Image صورة بصيغة base64
 * @returns URL العام للصورة أو null في حالة الفشل
 */
export async function uploadProductImage(base64Image: string): Promise<string | null> {
  try {
    // تحويل base64 إلى Blob
    const response = await fetch(base64Image);
    const blob = await response.blob();
    
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
    
    // الحصول على URL العام
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
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
