import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { loadProductsCloud } from './cloud/products-cloud';

// طلب صلاحيات التخزين
export const requestStoragePermissions = async () => {
    if (!Capacitor.isNativePlatform()) return true;

    try {
        // على Android 13+ نستخدم واجهات برمجة مختلفة
        const permission = await (Filesystem as any).requestPermissions?.();
        return permission?.publicStorage === 'granted';
    } catch (e) {
        console.log('Permission request handled by system');
        return true;
    }
};

// إنشاء نسخة احتياطية
export const createBackup = async (): Promise<{ success: boolean; path?: string; error?: string }> => {
    try {
        // جمع جميع البيانات
        const products = await loadProductsCloud();

        const backupData = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            products: products,
            // يمكن إضافة باقي البيانات هنا
        };

        const jsonData = JSON.stringify(backupData, null, 2);
        const fileName = `hyperpos-backup-${new Date().toISOString().split('T')[0]}.json`;

        if (Capacitor.isNativePlatform()) {
            // حفظ في مجلد Documents على الموبايل
            const result = await Filesystem.writeFile({
                path: `HyperPOS/Backups/${fileName}`,
                data: jsonData,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
                recursive: true
            });

            // مشاركة الملف
            await Share.share({
                title: 'نسخة احتياطية HyperPOS',
                text: 'تم إنشاء النسخة الاحتياطية بنجاح',
                url: result.uri,
                dialogTitle: 'مشاركة النسخة الاحتياطية'
            });

            return {
                success: true,
                path: result.uri
            };
        } else {
            // على الويب: تحميل الملف مباشرة
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return {
                success: true,
                path: fileName
            };
        }
    } catch (error) {
        console.error('Backup error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

// استعادة النسخة الاحتياطية
export const restoreBackup = async (fileData: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const data = JSON.parse(fileData);

        // التحقق من صحة النسخة
        if (!data.version || !data.products) {
            return { success: false, error: 'ملف النسخة الاحتياطية غير صالح' };
        }

        // استعادة المنتجات
        // يمكن إضافة المنطق هنا لاستعادة البيانات إلى Supabase

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: 'فشل في قراءة ملف النسخة الاحتياطية'
        };
    }
};
