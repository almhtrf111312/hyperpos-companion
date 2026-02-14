

# خطة إكمال الترجمة التركية - المرحلة النهائية

## ملخص المشكلة

بعد الفحص الشامل للتطبيق باللغة التركية، تم اكتشاف **مشكلتين رئيسيتين**:

### المشكلة 1: نظام المصطلحات الديناميكية (store-type-config)
الملف `store-type-config.ts` يدعم فقط `ar` و `en`. أي لغة غير العربية تعود للإنجليزية. هذا يسبب ظهور كلمة "Products" في القائمة الجانبية بدلا من "Urünler".

### المشكلة 2: نمط `isRTL ? 'عربي' : 'English'` المنتشر
يوجد **538 استخدام** لنمط `isRTL ? 'نص عربي' : 'English text'` عبر **16 ملف**. هذا النمط يتجاهل نظام الترجمة بالكامل - عند اختيار التركية (LTR)، يظهر النص الإنجليزي بدلا من التركي.

## الملفات المتأثرة (16 ملف)

| # | الملف | عدد الاستخدامات | الأولوية |
|---|-------|-----------------|----------|
| 1 | `store-type-config.ts` | بنية كاملة | عالية |
| 2 | `Settings.tsx` | ~50+ | عالية |
| 3 | `LicenseManagement.tsx` | ~40+ | عالية |
| 4 | `NotificationBell.tsx` | ~30+ | عالية |
| 5 | `SyncStatusMenu.tsx` | ~25+ | عالية |
| 6 | `SyncQueueIndicator.tsx` | ~20+ | عالية |
| 7 | `DeviceBlockedScreen.tsx` | ~15+ | متوسطة |
| 8 | `SetupWizard.tsx` | ~50+ | عالية |
| 9 | `Appearance.tsx` | ~5 | متوسطة |
| 10 | `StockTransfer.tsx` | ~30+ | متوسطة |
| 11 | `ActivationScreen.tsx` | ~10+ | متوسطة |
| 12 | `TrialBanner.tsx` | ~5 | منخفضة |
| 13 | `LicenseWarningBadge.tsx` | ~5 | منخفضة |
| 14 | `Help.tsx` | محتوى كامل | متوسطة |
| 15 | `PrivacyPolicyScreen.tsx` | محتوى كامل | متوسطة |
| 16 | `LicenseGuard.tsx` | ~10+ | متوسطة |

## خطة التنفيذ (3 مراحل)

### المرحلة 1: البنية التحتية والملفات الحرجة
**الهدف**: إصلاح الأساس وأهم الشاشات

1. **إضافة دعم `tr` لنظام المصطلحات الديناميكية** (`store-type-config.ts`)
   - إضافة `tr` بجانب `ar` و `en` في `TerminologySet`
   - ترجمة جميع مصطلحات أنواع المتاجر (phones, clothing, food, etc.)
   - تحديث دالة `getTerminology` لتدعم `tr`

2. **تحويل Settings.tsx** من `isRTL` إلى `t()`
   - إضافة مفاتيح ترجمة جديدة في `i18n.ts` للنصوص المفقودة
   - استبدال جميع أنماط `isRTL ? ... : ...` بنصوص مترجمة

3. **تحويل SyncStatusMenu.tsx و SyncQueueIndicator.tsx**
   - إضافة مفاتيح `sync.*` في `i18n.ts`
   - استبدال النصوص المباشرة

### المرحلة 2: شاشات الترخيص والإشعارات
**الهدف**: ترجمة واجهات الترخيص والإشعارات

4. **LicenseManagement.tsx** - تحويل ~40 نص
5. **NotificationBell.tsx** - تحويل ~30 نص
6. **DeviceBlockedScreen.tsx** - تحويل ~15 نص
7. **SetupWizard.tsx** - تحويل ~50 نص (معالج الإعداد الأولي)

### المرحلة 3: باقي الملفات
**الهدف**: إكمال الترجمة

8. **Appearance.tsx** - تحويل ~5 نصوص
9. **StockTransfer.tsx** - تحويل ~30 نص
10. **Help.tsx** - إضافة محتوى تعليمات بالتركية
11. **PrivacyPolicyScreen.tsx** - إضافة نص سياسة الخصوصية بالتركية

### ملاحظة: لوحة البث (BossPanel)
لن يتم ترجمة لوحة البث (`BossPanel.tsx`) حسب طلبك - ستبقى بالعربية والإنجليزية فقط.

## تفاصيل تقنية

### التغيير في `store-type-config.ts`:
```text
interface TerminologySet {
  ar: Record<TerminologyKey, string>;
  en: Record<TerminologyKey, string>;
  tr: Record<TerminologyKey, string>;  // اضافة جديدة
}
```

### نمط التحويل:
```text
// قبل (لا يدعم التركية):
{isRTL ? 'متصل ومزامن' : 'Synced'}

// بعد (يدعم جميع اللغات):
{t('sync.synced')}
```

### عدد المفاتيح الجديدة المتوقعة في i18n.ts:
- حوالي 150-200 مفتاح جديد عبر المراحل الثلاث
- تشمل: `sync.*`, `notification.*`, `setup.*`, `stockTransfer.*`, `deviceBlocked.*`

## ملخص النتائج المتوقعة
بعد إكمال المراحل الثلاث، سيكون التطبيق مترجما بالكامل للتركية مع استثناء لوحة البث فقط.

