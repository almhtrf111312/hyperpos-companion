

# ميزة "روابط التواصل الديناميكية"

## الملخص
توسيع نظام التواصل الحالي (واتساب فقط) إلى 8 قنوات تواصل يديرها البوس وتظهر للمستخدمين كأزرار تفاعلية ملونة.

---

## التعديلات المطلوبة

### 1. لوحة البوس (`src/pages/BossPanel.tsx`)
- استبدال حقل "رقم واتساب المطور" الحالي بزر "إعدادات التواصل"
- عند النقر يفتح Dialog يحتوي على الحقول الثمانية:
  - واتساب (مع رمز الدولة)
  - فيسبوك، تيك توك، تليجرام، يوتيوب، تويتر/X، بريد إلكتروني، OLX
- الحفظ في `app_settings` بمفتاح `contact_links` كـ JSON
- الحفاظ على التوافق مع `developer_phone` الحالي (قراءة القيمة القديمة كـ fallback)

### 2. مكون جديد: `src/components/settings/ContactLinksSection.tsx`
- مكون يعرض أزرار التواصل الملونة بأيقونات مخصصة
- يقرأ من `app_settings` مفتاح `contact_links`
- يعرض فقط القنوات التي لها قيمة
- ألوان الأزرار:
  - واتساب: اخضر
  - فيسبوك: ازرق
  - تيك توك: اسود
  - تليجرام: ازرق فاتح
  - يوتيوب: احمر
  - تويتر/X: رمادي غامق
  - بريد: برتقالي
  - OLX: اصفر/ذهبي

### 3. صفحة الإعدادات (`src/pages/Settings.tsx`)
- اضافة قسم "التواصل مع المطور" بعد قسم "تصفير البيانات"
- يستخدم المكون `ContactLinksSection` لعرض الأزرار

### 4. تحديث شاشات التفعيل
- تحديث `LicenseGuard.tsx` و `ActivationCodeInput.tsx` لقراءة الروابط الجديدة مع fallback للنظام القديم (`developer_phone`)

---

## التفاصيل التقنية

### هيكلية البيانات
لن يتم إنشاء جدول جديد. سيتم استخدام `app_settings` الموجود:

```text
key: "contact_links"
value: JSON string {
  "whatsapp": "+970599000000",
  "facebook": "https://facebook.com/...",
  "tiktok": "https://tiktok.com/@...",
  "telegram": "https://t.me/...",
  "youtube": "https://youtube.com/@...",
  "twitter": "https://x.com/...",
  "email": "support@example.com",
  "olx": "https://olx.com/..."
}
```

### منطق فتح الروابط
- واتساب: `https://wa.me/{phone}`
- بريد إلكتروني: `mailto:{email}`
- باقي الروابط: فتح مباشر بـ `window.open(url, '_blank')`

### التوافق العكسي
- عند القراءة: إذا لم يوجد `contact_links`، يتم قراءة `developer_phone` القديم واستخدامه للواتساب
- عند الحفظ من البوس: يتم حفظ كلا المفتاحين (`contact_links` + `developer_phone` للتوافق)

