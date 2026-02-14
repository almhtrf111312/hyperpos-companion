

# إصلاح رابط النسخة الاحتياطية في تطبيق Windows (Electron)

## المشكلة
جميع الروابط الاحتياطية (fallback URLs) في ملفات Electron تشير إلى الرابط القديم `propos.lovable.app` بدلاً من الرابط الحالي `flowpospro.lovable.app`.

## التعديلات المطلوبة

### الملف 1: `electron/main.js` (3 تعديلات)

| السطر | القديم | الجديد |
|-------|--------|--------|
| 67 | `https://propos.lovable.app` | `https://flowpospro.lovable.app` |
| 77 | `propos.lovable.app` | `flowpospro.lovable.app` |
| 105 | `https://propos.lovable.app` | `https://flowpospro.lovable.app` |

### الملف 2: `electron/error.html` (تعديل واحد)

| السطر | القديم | الجديد |
|-------|--------|--------|
| 136 | `https://propos.lovable.app` | `https://flowpospro.lovable.app` |

## النتيجة
عند فشل تحميل الملفات المحلية في نسخة Windows، سيتم توجيه المستخدم إلى الرابط الصحيح `flowpospro.lovable.app` بدلاً من الرابط القديم.

