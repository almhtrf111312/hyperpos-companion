

# خطة شاملة: إصلاح تحديث APK + تشخيص النظام + البيانات الوهمية

---

## 1. إصلاح مشكلة تثبيت النسخة الجديدة فوق القديمة (APK Update)

### السبب الجذري
الـ workflow يستخدم `rm -rf android` ثم `npx cap add android` في كل بناء، مما يعني أن ملف `build.gradle` يتم إنشاؤه من الصفر كل مرة **بدون signingConfig**. عند البناء بـ `-Pandroid.injected.signing.*` يتم التوقيع مرة واحدة فقط على مستوى الأمر، لكن المشكلة الحقيقية هي أن `build.gradle` لا يحتوي على `signingConfigs` مُعرّف رسمياً.

بالإضافة لذلك، يجب التأكد من أن `applicationId` ثابت دائماً = `com.flowpos.pro` وأن `versionCode` يتزايد بشكل صحيح.

### الحل
**الملف: `.github/workflows/build-apk.yml`**

بعد `npx cap add android`، يتم حقن `signingConfigs` في `android/app/build.gradle` برمجياً:

```groovy
android {
    signingConfigs {
        release {
            storeFile file("flowpos-release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias System.getenv("KEY_ALIAS") ?: ""
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles ...
        }
    }
}
```

هذا يضمن أن كل APK يُوقّع بنفس المفتاح، مما يسمح لنظام Android بالتثبيت فوق النسخة القديمة.

سيتم أيضاً تمرير المتغيرات كـ environment variables بدلاً من `-P` flags:

```yaml
env:
  KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
  KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
  KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
```

---

## 2. تشخيص النظام - إضافة أزرار الإجراءات

### المشكلة الحالية
- صفحة التشخيص تعرض مشاكل بدون أي أزرار لحلها
- حسابات محذوفة من إدارة التراخيص تظهر في التشخيص
- لا يوجد خيار حذف حساب أو إصلاح مشكلة

### الحل
**الملف: `src/components/settings/SystemDiagnostics.tsx`**

لكل مستخدم لديه مشاكل، يتم إضافة أزرار إجراءات حسب نوع المشكلة:

| المشكلة | الإجراء |
|---------|---------|
| ملف شخصي مفقود | زر "إنشاء ملف شخصي" |
| دور مفقود | زر "حذف الحساب نهائياً" (يستدعي delete-user edge function) |
| ترخيص مفقود | زر "تفعيل الترخيص" (ينقل لإدارة التراخيص) |
| ترخيص منتهي/ملغى | زر "تجديد الترخيص" |
| بدون دور وبدون ملف | زر "حذف الحساب اليتيم" (تنظيف كامل) |

سيتم إضافة عمود "إجراءات" في جدول المستخدمين الذين لديهم مشاكل، مع:
- زر حذف (أحمر) لحذف الحساب كاملاً عبر `delete-user` edge function
- زر تفعيل (أزرق) لفتح نافذة تفعيل الترخيص
- حوار تأكيد قبل أي عملية حذف

---

## 3. إدارة التراخيص - صلاحيات كاملة

### المشكلة الحالية
- إدارة التراخيص تعرض التراخيص فقط بدون إمكانية التحكم الكامل
- لا يوجد زر حذف ترخيص أو حذف حساب مستخدم
- لا يوجد ربط بين إدارة التراخيص وتشخيص النظام

### الحل
**الملف: `src/components/settings/LicenseManagement.tsx`**

إضافة الميزات التالية:

1. **عرض أكواد التفعيل** (الموجودة حالياً) مع إضافة أزرار:
   - نسخ الكود
   - حذف الكود
   - عرض عدد الاستخدامات / أقصى استخدام

2. **التراخيص النشطة** - لكل ترخيص:
   - زر "تعديل" (فتح نافذة تعديل المدة)
   - زر "إلغاء الترخيص" (revoke)
   - زر "حذف المستخدم بالكامل" (يستدعي delete-user)
   - عرض البريد الإلكتروني عبر edge function

3. **قسم أكواد التفعيل** - عرض كل الأكواد مع:
   - الحالة (نشط/مستخدم/منتهي)
   - عدد الاستخدامات
   - زر نسخ + حذف

---

## 4. إزالة البيانات الوهمية من عمليات البيع

### المشكلة
ملف `src/lib/demo-data.ts` يحتوي على بيانات تجريبية يتم تحميلها في `localStorage`. رغم أن `clearDemoDataOnce()` يتم استدعاؤها عند تشغيل التطبيق، إلا أن المسح يعتمد على `CURRENT_CLEAR_VERSION = '3'` ولا يُحدّث عند كل تشغيل.

### الحل
1. **الملف: `src/lib/clear-demo-data.ts`** - زيادة `CURRENT_CLEAR_VERSION` إلى `'4'` لضمان مسح أي بيانات وهمية متبقية في الأجهزة الحالية

2. **الملف: `src/App.tsx`** - التأكد من عدم تحميل أي بيانات وهمية (الكود الحالي لا يحملها فعلاً، لكن المسح لم يتم)

3. **الملف: `src/lib/demo-data.ts`** - لن يتم حذفه (قد يُستخدم مستقبلاً للعرض التوضيحي) لكن لن يتم استدعاؤه

---

## ملخص الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `.github/workflows/build-apk.yml` | إضافة signingConfigs في build.gradle المولّد + env vars |
| `src/components/settings/SystemDiagnostics.tsx` | إضافة أزرار حذف/إصلاح لكل مشكلة مع حوار تأكيد |
| `src/components/settings/LicenseManagement.tsx` | إضافة أزرار حذف/إلغاء/تعديل + عرض أكواد التفعيل + عرض البريد |
| `src/lib/clear-demo-data.ts` | زيادة CLEAR_VERSION لمسح البيانات الوهمية المتبقية |

