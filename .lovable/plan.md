
# خطة تحديث مكتبات المشروع وإصلاح التوافق

## المشكلة الحالية
يوجد **عدم توافق خطير** في إصدارات Capacitor:
- `@capacitor/core` = v6.2.1 (قديم)
- `@capacitor/android` + `@capacitor/cli` = v8.0.2 (محدّث)
- جميع إضافات Capacitor (app, camera, filesystem, etc.) = v6.x (قديمة)
- `@capacitor-community/barcode-scanner` = v4.0.1 ← **مكتبة مؤرشفة ومتوقفة منذ أكتوبر 2024**، لا تدعم Cap 8

بالإضافة لمكتبة `xlsx` v0.18.5 التي بها ثغرات أمنية معروفة.

---

## التحديثات المطلوبة

### 1. ترقية Capacitor Core والإضافات إلى v8

| المكتبة | الحالي | الجديد |
|---------|--------|--------|
| `@capacitor/core` | ^6.2.1 | ^8.0.2 |
| `@capacitor/app` | ^6.0.0 | ^8.0.0 |
| `@capacitor/camera` | ^6.1.3 | ^8.0.0 |
| `@capacitor/device` | ^6.0.0 | ^8.0.0 |
| `@capacitor/filesystem` | ^6.0.4 | ^8.0.0 |
| `@capacitor/network` | ^6.0.4 | ^8.0.0 |
| `@capacitor/share` | ^6.0.4 | ^8.0.0 |

### 2. استبدال ماسح الباركود (تغيير جذري)
المكتبة القديمة `@capacitor-community/barcode-scanner` **مؤرشفة ومتوقفة**. البديل الرسمي هو `@capacitor/barcode-scanner` v3.0.0 من فريق Ionic، والذي يدعم Cap 8.

**الفرق في الـ API:**

```text
القديم (@capacitor-community/barcode-scanner):
  BarcodeScanner.checkPermission({ force: true })
  BarcodeScanner.hideBackground()
  BarcodeScanner.startScan() → يرجع { hasContent, content }
  BarcodeScanner.stopScan()
  BarcodeScanner.enableTorch() / disableTorch()

الجديد (@capacitor/barcode-scanner):
  CapacitorBarcodeScanner.scanBarcode(options) → يرجع { ScanResult }
  - يفتح واجهة مسح أصلية كاملة (لا حاجة لـ hideBackground)
  - لا حاجة لإدارة الصلاحيات يدوياً
  - واجهة أبسط بكثير
```

### 3. إزالة مكتبة xlsx الأمنية
حذف `xlsx` v0.18.5 (بها ثغرات Prototype Pollution و ReDoS). المشروع يستخدم `xlsx-js-style` كبديل آمن بالفعل.

### 4. تحديث مكتبات أخرى للأمان

| المكتبة | الحالي | الجديد |
|---------|--------|--------|
| `@supabase/supabase-js` | ^2.90.1 | ^2.49.4 (أحدث v2) |
| `date-fns` | ^3.6.0 | ^4.1.0 |
| `lucide-react` | ^0.462.0 | ^0.475.0 |
| `zod` | ^3.25.76 | ^3.25.76 (محدّث) |

---

## التعديلات البرمجية المطلوبة

### ملف `package.json`
- تحديث جميع إصدارات Capacitor إلى v8
- استبدال `@capacitor-community/barcode-scanner` بـ `@capacitor/barcode-scanner`
- حذف `xlsx` من dependencies

### ملف `src/components/barcode/NativeMLKitScanner.tsx` (إعادة كتابة)
استبدال كامل لاستخدام الـ API الجديد:
- استيراد `CapacitorBarcodeScanner` بدل `BarcodeScanner`
- استخدام `scanBarcode()` بدل `startScan()`
- إزالة إدارة الخلفية والصلاحيات اليدوية (المكتبة الجديدة تتعامل معها تلقائياً)
- الاحتفاظ بنفس واجهة Props (isOpen, onClose, onScan)

### ملف `android/app/capacitor.build.gradle`
- إزالة `capacitor-community-barcode-scanner`
- إضافة `capacitor-barcode-scanner` (الحزمة الرسمية)

### ملف `android/capacitor.settings.gradle`
- تحديث المسارات لتشير للمكتبة الجديدة

### ملف `capacitor.config.json`
- تحديث إعدادات BarcodeScanner للمكتبة الجديدة

### ملف `android/app/build.gradle`
- التأكد من توافق `minSdkVersion` مع Cap 8 (الحد الأدنى 26)

### ملف `android/variables.gradle`
- تحديث `minSdkVersion` من 24 إلى 26 (متطلب Cap 8 وماسح الباركود الجديد)

---

## الملفات المتأثرة
1. `package.json` - تحديث الإصدارات
2. `src/components/barcode/NativeMLKitScanner.tsx` - إعادة كتابة لـ API الجديد
3. `capacitor.config.json` - تحديث إعدادات الماسح
4. `android/variables.gradle` - رفع minSdkVersion إلى 26
5. `android/app/capacitor.build.gradle` - تحديث المكتبة
6. `android/capacitor.settings.gradle` - تحديث المسارات

## ملاحظة مهمة
بعد التحديث، يجب تنفيذ `npx cap sync` لمزامنة التغييرات مع مشروع Android.
