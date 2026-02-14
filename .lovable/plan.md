

# حل مشكلة الأرقام العربية (الهندية) على أندرويد

## المشكلة
عند ضبط لغة جهاز الأندرويد على العربية، يقوم WebView تلقائيا بتحويل الأرقام الإنجليزية (0-9) إلى أرقام هندية (٠-٩). الحلول الموجودة حاليا في CSS (مثل `font-variant-numeric` و `font-feature-settings`) لا تعمل في WebView الأندرويد لأن التحويل يحدث على مستوى النظام وليس الخط.

## الحل: طبقتان متكاملتان

### الطبقة 1: فرض Locale في كود الأندرويد (MainActivity.java)
تعديل `MainActivity.java` لفرض `Locale.US` على مستوى التطبيق بالكامل عند بدء التشغيل. هذا يمنع WebView من استبدال الأرقام.

```text
الملف: android/app/src/main/java/com/flowpos/pro/MainActivity.java

- Override onCreate()
- فرض Locale.US على Configuration
- تطبيقه على Resources
```

### الطبقة 2: تعطيل Digit Substitution في WebView Settings
إضافة إعداد `setTextZoom` والتحكم في خصائص WebView بعد تحميل Bridge لمنع أي تحويل تلقائي للأرقام.

---

## التفاصيل التقنية

### تعديل 1: `android/app/src/main/java/com/flowpos/pro/MainActivity.java`

إضافة كود لفرض Locale الإنجليزي عند بدء التطبيق:
- استيراد `android.os.Bundle`, `java.util.Locale`, `android.content.res.Configuration`
- في `onCreate`: إنشاء `Configuration` جديد مع `Locale.US`
- تطبيقه عبر `getResources().updateConfiguration()`
- هذا يجبر WebView على عرض الأرقام بالشكل الغربي (0-9)

### تعديل 2: `src/index.css` - تعزيز CSS الموجود

إضافة قاعدة CSS إضافية تستهدف جميع العناصر النصية:
```css
* {
  unicode-bidi: plaintext;
}
```

وإضافة `lang="en"` attribute على عناصر الأرقام عبر JavaScript.

### تعديل 3: `src/lib/utils.ts` - تعزيز دوال التنسيق

التأكد من أن جميع دوال `formatNumber` و `formatCurrency` و `formatDate` تستخدم `Intl.NumberFormat('en-US')` بدلا من `toLocaleString` لضمان عدم تدخل locale الجهاز.

---

## الملفات المتأثرة
1. `android/app/src/main/java/com/flowpos/pro/MainActivity.java` - فرض Locale.US
2. `src/index.css` - تعزيزات CSS إضافية (اختياري)
3. `src/lib/utils.ts` - التحقق من دوال التنسيق (موجود بالفعل بشكل صحيح)

## ملاحظة مهمة
بعد التعديل، يجب عمل `git pull` ثم `npx cap sync` ثم إعادة بناء التطبيق لتطبيق التغييرات على الأندرويد.

