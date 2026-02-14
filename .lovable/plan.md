

# خطة تحسين واجهة المنتجات ونقطة البيع وإعدادات الوحدات وتسجيل Google Drive

## 1. تصغير بطاقات إحصائيات المنتجات (إجمالي / متوفر / منخفض / نفذ)

**المشكلة**: البطاقات الأربع تأخذ مساحة كبيرة على الهاتف (grid-cols-2 مع padding كبير).

**الحل**:
- تغيير الشبكة على الهاتف من `grid-cols-2` إلى `grid-cols-4` لعرض الأربع بطاقات في سطر واحد
- تصغير الأيقونات والأرقام والنصوص
- تقليل الـ padding من `p-3` إلى `p-2`
- تصغير الأيقونات من `w-4 h-4` إلى `w-3.5 h-3.5`
- تصغير الأرقام من `text-lg` إلى `text-base`

**الملف**: `src/pages/Products.tsx` (سطور 734-805)

---

## 2. إزاحة عنوان "نقطة البيع" لتجنب تغطية زر القائمة

**المشكلة**: زر القائمة العائم يغطي جزءا من كلمة "نقطة" في عنوان POS.

**الحل**: زيادة الـ padding في الـ header من `rtl:pr-14` إلى `rtl:pr-16` لإعطاء مساحة أكبر.

**الملف**: `src/components/pos/POSHeader.tsx` (سطر 39)

---

## 3. إزالة الأمثلة الوصفية من حقول إدخال المنتجات

**المشكلة**: الحقول تحتوي على أمثلة مثل "مثال: iPhone 15 Pro" وهذا غير احترافي.

**الحل**: تغيير الـ placeholders في `i18n.ts` لتكون وصفية بدون أمثلة:
- `products.exampleName`: "اسم المنتج" بدلا من "مثال: iPhone 15 Pro"
- `products.exampleSerial`: "الرقم التسلسلي" بدلا من "مثال: 123456789012345"
- `products.exampleWarranty`: "مدة الضمان" بدلا من "مثال: 12 شهر"
- `products.exampleSize`: "المقاس" بدلا من "مثال: XL"
- `products.exampleColor`: "اللون" بدلا من "مثال: أسود"
- نفس التغييرات للترجمة الإنجليزية

**الملف**: `src/lib/i18n.ts`

---

## 4. تحسين واجهة إعدادات الوحدات (UnitSettingsTab)

**المشكلة**: واجهة اختيار وحدة الإدخال تستخدم Switch (تبديل) وهو غير واضح. المطلوب نقطتين (Radio buttons) بدلا منه.

**الحل**:
- استبدال الـ Switch بزرين (Radio-style buttons) واضحين
- كل زر يحتوي على اسم الوحدة (قطعة / كرتونة)
- الزر المحدد يظهر بلون أساسي (primary) والآخر بلون محايد
- تبسيط الشرح وإزالة التعقيد

**التصميم الجديد**:
```text
وحدة إدخال الكمية:
[ قطعة ]  [ كرتونة ]
   ^           
 (محدد بلون أزرق)
```

**الملف**: `src/components/products/UnitSettingsTab.tsx` (سطور 145-162)

---

## 5. تسجيل دخول Google Drive بدون تعقيد (بدون Google Console)

**المشكلة**: حاليا يتطلب النظام إدخال Google Client ID يدويا من Google Console، وهو معقد للمستخدم العادي.

**الحل**: استخدام Lovable Cloud المدمج لتسجيل الدخول بحساب Google تلقائيا بدون أي إعداد:
1. استخدام `lovable.auth.signInWithOAuth("google")` للحصول على توثيق Google
2. بعد التوثيق، استخدام الـ access token للوصول إلى Google Drive API
3. طلب صلاحية `drive.file` لإنشاء وقراءة ملفات النسخ الاحتياطي فقط
4. تبسيط واجهة Google Drive Section بحيث يكون هناك فقط زر "تسجيل الدخول بحساب Google" بدون حاجة لإدخال Client ID

**التنفيذ**:
- تعديل `GoogleDriveSection.tsx`: إزالة حقل إدخال Client ID، إضافة زر تسجيل دخول مباشر عبر Lovable Cloud
- تعديل `google-drive.ts`: إضافة دعم للحصول على token من Lovable Cloud auth بدلا من OAuth popup اليدوي
- استخدام الـ Google token من جلسة Supabase Auth للوصول إلى Google Drive

**الملف**: `src/components/settings/GoogleDriveSection.tsx`, `src/lib/google-drive.ts`

---

## الملفات المتأثرة

| الملف | التغيير |
|:---|:---|
| `src/pages/Products.tsx` | تصغير بطاقات الإحصائيات (4 في سطر واحد) |
| `src/components/pos/POSHeader.tsx` | زيادة padding لإزاحة العنوان عن زر القائمة |
| `src/lib/i18n.ts` | إزالة الأمثلة من placeholders المنتجات |
| `src/components/products/UnitSettingsTab.tsx` | استبدال Switch بأزرار Radio-style لاختيار الوحدة |
| `src/components/settings/GoogleDriveSection.tsx` | تبسيط تسجيل الدخول بحساب Google |
| `src/lib/google-drive.ts` | إضافة دعم Lovable Cloud auth للوصول لـ Google Drive |

