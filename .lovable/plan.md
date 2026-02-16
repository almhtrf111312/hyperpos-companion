

## خطة: استبدال النسخ الاحتياطي على Google Drive بنسخ احتياطي سحابي على قاعدة البيانات

### المشكلة
Google Drive لا يعمل بشكل صحيح بعد تثبيت التطبيق كـ APK لأن OAuth يحتاج متصفح خارجي.

### البديل المقترح: النسخ الاحتياطي عبر Supabase Storage
بما أن المستخدم مسجل دخول أصلاً بالبريد وكلمة المرور، يمكن حفظ النسخ الاحتياطية المشفرة مباشرة في **تخزين سحابي مدمج** بدون أي تسجيل دخول إضافي.

**المميزات:**
- لا يحتاج تسجيل دخول إضافي (يستخدم نفس حساب المستخدم)
- يعمل على الهاتف والويب بدون مشاكل
- مشفر (باستخدام نظام التشفير الموجود أصلاً)
- نسخ احتياطي تلقائي كل 6 ساعات
- مجاني ضمن حدود التخزين

### الملفات المطلوب تعديلها/إنشاؤها

| الملف | النوع | الوصف |
|-------|-------|-------|
| SQL Migration | إنشاء | إنشاء Storage bucket باسم `backups` مع RLS policies |
| `src/lib/cloud-backup.ts` | إنشاء | مكتبة النسخ الاحتياطي السحابي الجديدة (رفع، تنزيل، حذف، قائمة) |
| `src/components/settings/CloudBackupSection.tsx` | إنشاء | واجهة النسخ الاحتياطي السحابي (بديل GoogleDriveSection) |
| `src/lib/auto-backup.ts` | تعديل | استبدال Google Drive بالنسخ السحابي الجديد |
| `src/pages/Settings.tsx` | تعديل | إضافة CloudBackupSection (إذا لزم) |
| `src/components/settings/GoogleDriveSection.tsx` | حذف | لم يعد مطلوباً |
| `src/lib/google-drive.ts` | حذف | لم يعد مطلوباً |

### التفاصيل التقنية

#### 1. إنشاء Storage Bucket
```text
-- إنشاء bucket للنسخ الاحتياطية
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false);

-- RLS: المستخدم يرى فقط ملفاته
CREATE POLICY "Users can upload own backups"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own backups"
ON storage.objects FOR SELECT
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own backups"
ON storage.objects FOR DELETE
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);
```

بنية الملفات: `backups/{user_id}/backup_2025-01-15.hpbk`

#### 2. مكتبة cloud-backup.ts
- `uploadCloudBackup(data)` — تشفير + رفع إلى Storage
- `listCloudBackups()` — قائمة النسخ الاحتياطية
- `downloadCloudBackup(path)` — تنزيل + فك تشفير
- `deleteCloudBackup(path)` — حذف نسخة
- الاحتفاظ بآخر 10 نسخ فقط (حذف الأقدم تلقائياً)

#### 3. واجهة CloudBackupSection.tsx
تصميم مشابه لـ GoogleDriveSection لكن أبسط:
- لا يحتاج تسجيل دخول (متصل تلقائياً)
- زر "نسخ احتياطي الآن"
- تفعيل/تعطيل النسخ التلقائي
- قائمة النسخ الاحتياطية مع أزرار استعادة وحذف

#### 4. تعديل auto-backup.ts
- إزالة استيرادات Google Drive
- إزالة `autoGoogleDrive` من `BackupConfig`
- استبدال `saveBackupToGoogleDrive` بـ `uploadCloudBackup`
- إزالة `saveBackupToGoogleDrive` function

#### 5. حذف ملفات Google Drive
- `src/lib/google-drive.ts`
- `src/components/settings/GoogleDriveSection.tsx`

### النتيجة
- نسخ احتياطي سحابي يعمل بدون أي تسجيل دخول إضافي
- يعمل على الهاتف (APK) والويب بدون مشاكل
- مشفر بنظام التشفير الموجود (XOR + Base64)
- نسخ تلقائي دوري كل 6 ساعات
- واجهة بسيطة لإدارة النسخ الاحتياطية
