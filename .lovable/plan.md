

# إصلاح فشل بناء APK في GitHub Actions

## المشاكل المكتشفة (3 مشاكل رئيسية)

### 1. إصدار Capacitor خاطئ في الـ Workflow
الـ workflow يثبّت Capacitor v6 يدوياً:
```
npm install @capacitor/cli@6 @capacitor/core@6 @capacitor/android@6
```
بينما المشروع محدّث إلى Capacitor v8.

### 2. إصدار Gradle غير متوافق
عند حذف مجلد android وإعادة إنشائه (`rm -rf android` + `npx cap add android`)، يتم إنشاء Gradle wrapper بإصدار 8.2.1 القديم. لكن Android Gradle Plugin (AGP) 8.13.0 الموجود في المشروع يتطلب **Gradle 8.11 على الأقل**.

### 3. إصدار Java غير متوافق
الـ workflow يستخدم Java 17، لكن Capacitor 8 يولّد `capacitor.build.gradle` يتطلب **Java 21**.

---

## الحل: تحديث ملف `.github/workflows/build-apk.yml`

التغييرات المطلوبة:

1. **رفع Java من 17 إلى 21** ونقل خطوة Setup Java قبل أي عملية Gradle
2. **تغيير `@capacitor/cli@6`** إلى `@capacitor/cli@latest` (وكذلك android و core)
3. **إضافة خطوة لتحديث `gradle-wrapper.properties`** بعد `npx cap add android` لاستخدام Gradle 8.14.3
4. **تحديث `variables.gradle`** داخل الـ workflow لضمان `minSdkVersion = 26` و `compileSdkVersion = 36`
5. **إصلاح أمر تحديث الإصدار** ليعمل مع `version.json` (الطريقة الحالية في `build.gradle`)

### الملف المتأثر
- `.github/workflows/build-apk.yml` - ملف واحد فقط

### التغييرات التفصيلية

**Java:** `java-version: '17'` يتحول إلى `java-version: '21'`

**Capacitor:** 
```
npm install @capacitor/cli@6 @capacitor/core@6 @capacitor/android@6
```
يتحول إلى:
```
npm install @capacitor/cli@latest @capacitor/android@latest @capacitor/assets@latest --save-dev
```

**Gradle wrapper:** إضافة خطوة بعد `npx cap add android`:
```
cat > android/gradle/wrapper/gradle-wrapper.properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-all.zip
```

**variables.gradle:** إعادة كتابته داخل الـ workflow بالقيم الصحيحة (minSdk=26, compileSdk=36, targetSdk=36)

### النتيجة المتوقعة
- بناء APK ناجح بدون أخطاء توافق
- استخدام Capacitor v8 + Gradle 8.14.3 + JDK 21 + AGP 8.13.0

