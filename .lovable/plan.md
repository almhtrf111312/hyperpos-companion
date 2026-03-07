# خطة إصلاح الكاميرا: نظام التقاط صور محلي طبعا هذه المشكله فقط على تطبيق الاي بي كي اما على الموقع الويب هي تعمل بشكل صحيح لاحظ تعليقي الذي قمت باضافته الى الخطه وقم بتطبيق الاصلاحات اعتمادا على معلومات بالكامل بدون أي اعتماد على الشبكة

## تحليل المشكلة الجذرية

المشكلة الحالية: رغم استخدام `@capgo/camera-preview` (الذي يعمل داخل نفس الـ Activity)، لا يزال التطبيق يعيد التشغيل أحياناً. الأسباب المحتملة:

1. `**pickFromGallery` لا يزال يستخدم `@capacitor/camera` القديم** (سطر 113 في `use-camera.tsx`) — هذا يفتح Activity خارجي ويسبب Process Death
2. `**handleGallerySelect` يحاول رفع الصورة للسحابة فوراً** (سطر 557-561) — هذا يبطئ العملية ويفشل بدون إنترنت
3. **الدقة عالية جداً** (`maxSize: 1200`) — تستهلك ذاكرة كبيرة على أجهزة أندرويد الضعيفة
4. **الضغط خفيف** (`quality: 70` في NativeCameraPreview) — ينتج صوراً كبيرة

## الحل الشامل

### التغيير 1: تخفيض الدقة والجودة بشكل جذري

**ملفات:** `NativeCameraPreview.tsx`, `use-camera.tsx`, `Products.tsx`

- تقليل `maxSize` من `1200` إلى `400` (كافي لصورة منتج)
- تقليل `quality` من `70` إلى `40`
- هذا يضمن صورة ≤ 15-25KB — لا تسبب ضغط ذاكرة

### التغيير 2: إلغاء استخدام `@capacitor/camera` نهائياً من Gallery

**ملف:** `use-camera.tsx`

- تعديل `pickFromGallery` لاستخدام `<input type="file" accept="image/*">` على جميع المنصات (بما فيها Native)
- هذا يفتح file picker داخل الـ WebView بدون Activity خارجي — لا restart

### التغيير 3: إلغاء أي محاولة رفع سحابي عند الحفظ

**ملف:** `Products.tsx`

- تعديل `handleGallerySelect` لإزالة استدعاء `uploadProductImage` الفوري
- الاعتماد فقط على `ensureImageCompressed` → حفظ base64 مضغوط محلياً
- `syncImageToCloud` يعمل فقط بعد حفظ المنتج بنجاح في الخلفية

### التغيير 4: ضمان استمرار عمل الكاميرا بدون إنترنت

**ملف:** `NativeCameraPreview.tsx`

- تقليل الحد الأقصى للصورة إلى 400px مع quality 40
- إضافة `try-catch` مشدد حول كل عملية capture

### ملخص التعديلات


| الملف                     | التغيير                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `use-camera.tsx`          | Gallery → file input فقط (لا Activity خارجي) + خفض maxSize/quality        |
| `NativeCameraPreview.tsx` | maxSize=400, quality=40                                                   |
| `Products.tsx`            | إزالة رفع سحابي من handleGallerySelect + خفض maxSize/quality في useCamera |
