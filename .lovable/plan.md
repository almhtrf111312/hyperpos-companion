
## ملخص سريع (غير تقني)

تم تحديد سبب مشكلة الـ Restart بعد قراءة الباركود في نسخة APK:  
القارئ الحالي يدخل غالبًا في نمط يفتح شاشة مسح خارج التطبيق (External Activity)، وهذا على بعض الأجهزة يؤدي لإعادة إنشاء التطبيق (Reload/Restart).  
كما أن آلية استعادة نتيجة المسح بعد الرجوع فيها ثغرة (اسم plugin غير مطابق)، لذلك أحيانًا الباركود لا يُستعاد بشكل موثوق.

سأعالجها بحيث:
1) نتجنب نمط المسح الذي يسبب Restart قدر الإمكان على Android.  
2) حتى لو حصل Restart من النظام، يتم استرجاع الباركود وإدخاله مباشرة في خانة البحث بدون ضياع.  
3) يتم تثبيت السلوك نفسه في POS وصفحة المنتجات.

---

## ما تم تحليله بالفعل

- راجعت ملفات الباركود الأساسية:
  - `src/components/barcode/NativeMLKitScanner.tsx`
  - `src/pages/POS.tsx`
  - `src/pages/Products.tsx`
  - `src/App.tsx`
- راجعت إعدادات Android:
  - `android/app/src/main/AndroidManifest.xml`
  - `android/app/src/main/java/com/flowpos/pro/MainActivity.java`
- راجعت توثيق مكتبة ML Kit المستخدمة حاليًا (وهي فعلاً مكتبة Google ML Kit).
- راجعت كود المكتبة داخل `node_modules` وتأكدت أن `pluginId` الصحيح هو: `BarcodeScanner`.

---

## نتيجة فحص قاعدة البيانات (Lovable Cloud)

تم تنفيذ فحص مباشر على البيانات والسجلات للتحقق إن كانت المشكلة من الخلفية:

1) لا توجد أخطاء قاعدة بيانات حديثة مرتبطة بموضوع الباركود/الجهاز في سجلات التحليلات.  
2) لا يوجد في الجداول ما يشير إلى أن مشكلة Restart ناتجة عن DB؛ المشكلة جهة Android Activity + استعادة نتيجة plugin.  
3) تم التأكد أن أدوار البوس/أدمن موجودة، وأن تقييد الجهاز ليس سبب مشكلة Restart الحالية.

الاستنتاج: **المشكلة ليست من قاعدة البيانات**، بل من تدفق المسح في تطبيق APK.

---

## Do I know what the issue is?

**نعم.**

السبب التقني مركّب من 3 نقاط:

1) `NativeMLKitScanner` يستخدم مسار `scan()` عند توفر Google module، وهذا يفتح Activity خارجي قد يسبب إعادة إنشاء WebView على بعض أجهزة Android.  
2) في `App.tsx` الاستماع لـ `appRestoredResult` يتحقق من `pluginId === 'CapacitorBarcodeScanner'` بينما المكتبة الحالية تعيد `pluginId === 'BarcodeScanner'`، فنتيجة المسح لا تُلتقط بعد Restart.  
3) في `POS.tsx` يتم مسح `PENDING_BARCODE_KEY` مبكرًا في بعض المسارات، ما قد يؤدي لفقدان النتيجة عند سباق التحميل.

---

## خطة التنفيذ (التطبيق الفعلي)

### 1) تثبيت سلوك الماسح على Android لتقليل/منع Restart
**ملف:** `src/components/barcode/NativeMLKitScanner.tsx`

- إلغاء المسار الخارجي `scan()` على Android، والاعتماد على `startScan()` داخل نفس الـ Activity (camera behind WebView).
- إضافة حماية ضد التكرار (dedupe) حتى لا يتكرر onScan عدة مرات لنفس القراءة.
- الاستماع لـ `barcodeScanned` + `barcodesScanned` للتوافق.
- جعل حفظ `PENDING_BARCODE_KEY` أول خطوة دائمًا قبل أي onClose/onScan.

النتيجة: عدم الخروج إلى Activity خارجي = تقليل كبير جدًا لمشكلة Restart.

---

### 2) تصحيح استعادة نتيجة المسح بعد Activity Recreation
**ملف:** `src/App.tsx`

- تصحيح `appRestoredResult` ليتعامل مع:
  - `pluginId === 'BarcodeScanner'` (الاسم الصحيح للمكتبة الحالية)
  - مع الإبقاء على fallback لـ `CapacitorBarcodeScanner` للتوافق.
- استخراج الباركود من كل الأشكال المحتملة للنتيجة:
  - `data.data.barcodes[0].rawValue`
  - `data.data.rawValue`
  - fallback strings القديمة
- تخزين القيمة مباشرة في `hyperpos_pending_scan` وإطلاق event داخلي `barcode-restored`.

---

### 3) تحسين استرجاع الباركود المعلق داخل POS (بدون فقدان)
**ملف:** `src/pages/POS.tsx`

- منع حذف `PENDING_BARCODE_KEY` بشكل مبكر عند `appStateChange`.
- معالجة pending scan عبر وظيفة موحدة مع retry قصير حتى تصبح المنتجات/الحالة جاهزة.
- حذف المفتاح فقط بعد نجاح إدخال الباركود فعليًا في البحث.
- الاستماع لحدث `barcode-restored` بجانب الاسترجاع من localStorage.

---

### 4) توحيد نفس المنطق في صفحة المنتجات
**ملف:** `src/pages/Products.tsx`

- تطبيق نفس مبدأ الاسترجاع الموثوق (خصوصًا مع `scanTarget`).
- ضمان أن إعادة التشغيل لا تضيع target (barcode1/barcode2/barcode3/search).

---

### 5) (اختياري لكن موصى به) تنظيف تضارب المكتبات
**ملفات:** `package.json` (+ lockfile)

- إزالة مكتبات باركود القديمة غير المستخدمة حاليًا:
  - `@capacitor-community/barcode-scanner`
  - `@capacitor/barcode-scanner`
- الإبقاء على `@capacitor-mlkit/barcode-scanning` فقط.

هذا يقلل الالتباس في plugin IDs ويمنع تعارضات مستقبلية.

---

## تفاصيل تقنية (مخصصة)

```text
الوضع الحالي:
Scan (external Activity) --> Android قد يقتل/يعيد Activity --> App reload
                                           |
                                           +--> appRestoredResult arrives
                                                لكن App.tsx لا يلتقطه بسبب pluginId خاطئ
                                                => ضياع/تأخر إدخال الباركود

الوضع بعد الإصلاح:
startScan (same Activity) --> no external activity in normal flow --> no restart
      |
      +--> if OS still recreates activity:
            appRestoredResult (BarcodeScanner) captured
            --> save hyperpos_pending_scan
            --> POS/Products consume + inject into search/form reliably
```

---

## خطة التحقق (End-to-End على APK)

1) فتح POS في APK ثم تشغيل القارئ ومسح 10 باركود متتالية:
   - المطلوب: لا Restart أثناء المسح الطبيعي.
   - المطلوب: كل قراءة تدخل مباشرة في خانة البحث.

2) اختبار سيناريو ضغط (الخروج والعودة/تبديل تطبيق سريع أثناء المسح):
   - المطلوب: حتى لو حصل Reload، الباركود يُستعاد ويُطبق تلقائيًا.

3) اختبار من صفحات مختلفة:
   - POS search
   - Products search
   - Products barcode1/barcode2/barcode3

4) اختبار عدم التكرار:
   - لا يتم إدخال نفس الباركود مرتين من نفس القراءة.

---

## خطة التحديث وGitHub

بعد تنفيذ الخطوات أعلاه:
- سيتم تحديث الكود بالكامل داخل المشروع.
- التحديثات ستتزامن مع GitHub تلقائيًا عبر التكامل الحالي.
- سأتحقق من نجاح البناء بعد التحديث (خصوصًا إذا تم تنظيف dependencies).

