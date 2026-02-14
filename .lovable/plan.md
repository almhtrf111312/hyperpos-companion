

# خطة إصلاح أخطاء البناء + تحسين الوضع الليلي مع الشفافية

## المشكلة 1: أخطاء البناء (TS2345)

السبب: مفاتيح ترجمة مستخدمة في الكود موجودة في بلوك `en` و `tr` لكنها **غير موجودة في بلوك `ar`** (الذي يُعرّف النوع `TranslationKey`).

### المفاتيح المفقودة من بلوك `ar`:

**مفاتيح setup (مستخدمة في SetupWizard.tsx):**
- `setup.storeInfoDesc`, `setup.capitalDesc`, `setup.partnersDesc`, `setup.currenciesDesc`
- `setup.partnerNum`, `setup.totalCapitalLabel`, `setup.initialCapitalNote`
- `setup.retail`, `setup.wholesale`, `setup.phones`, `setup.grocery`
- `setup.pharmacy`, `setup.restaurant`, `setup.bakery`, `setup.services`, `setup.other`

**مفاتيح license (مستخدمة في NotificationBell.tsx):**
- `license.licenseStatus`, `license.currentStatus`, `license.activated`
- `license.expiresAt`, `license.remainingDays`, `license.enterCodeLabel`

### الحل:
اضافة هذه المفاتيح الـ 22 في بلوك `ar` بعد مفاتيح setup الموجودة (بعد سطر 1912) ومفاتيح license الموجودة.

---

## المشكلة 2: تصميم سيء في الوضع الليلي + الشفافية

### السبب الجذري:
في الوضع الليلي مع تفعيل الشفافية، `--glass-bg` يكون `hsla(222, 47%, 9%, 0.31)` (شفافية عالية جدا). هذا يجعل:
- الكروت شبه شفافة بالكامل - النصوص تصبح غير مقروءة
- القوائم المنسدلة والحوارات شبه مختفية
- التباين بين النص والخلفية ضعيف جدا

### الحل:
تعديل دالة `applyBlurTheme` في `src/hooks/use-theme.tsx` لجعل الوضع الليلي اكثر كثافة:

1. **رفع الحد الأدنى لشفافية الخلفية في الوضع الليلي**: تغيير `bgAlpha` من `0.75 - 0.45t` الى `0.85 - 0.35t` بحيث لا تقل الشفافية عن 50%
2. **تقوية حدود الزجاج**: زيادة `borderAlpha` لتكون أوضح في الوضع الليلي
3. **زيادة تشبع الألوان**: رفع `saturate` في CSS من 1.4 الى 1.6 للوضع الليلي

### التفاصيل التقنية:

**ملف `src/hooks/use-theme.tsx` - دالة `applyBlurTheme`:**
```text
// قبل (dark mode):
const bgAlpha = 0.75 - easedT * 0.45; // 0.75 -> 0.30

// بعد:
const bgAlpha = 0.88 - easedT * 0.33; // 0.88 -> 0.55
```

**ملف `src/index.css` - تحسين قواعد `.blur-theme` للوضع الليلي:**
- اضافة قاعدة `.dark.blur-theme` لزيادة كثافة الزجاج في الوضع الليلي
- رفع `saturate` الى 1.8 للكروت في الوضع الليلي
- اضافة `background-color` احتياطي اكثر كثافة

---

## ملخص الملفات المتأثرة:

| الملف | التغيير |
|-------|---------|
| `src/lib/i18n.ts` | اضافة ~22 مفتاح مفقود في بلوك `ar` |
| `src/hooks/use-theme.tsx` | تعديل `applyBlurTheme` - رفع كثافة الوضع الليلي |
| `src/index.css` | اضافة قواعد `.dark.blur-theme` محسّنة |

