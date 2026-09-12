# تحسين تنقّل الإعدادات + إصلاح ملاحظات التحليل الثابت

## 1. الإعدادات: صفحة فرعية بدل الفتح في الأسفل

اليوم شبكة أزرار الإعدادات تعرض المحتوى أسفل الشبكة في نفس الشاشة. التعديل:

- عند الضغط على أي بطاقة إعدادات، تختفي الشبكة بالكامل ويظهر قسم الإعداد وحده كأنه قائمة جديدة.
- شريط علوي في الشاشة الفرعية يحتوي: زر رجوع + أيقونة القسم + اسمه.
- زر الرجوع يعيد المستخدم لقائمة الإعدادات الرئيسية (الشبكة) مع بقاء موضع التمرير في الأعلى.
- زر الرجوع في الهاتف/تطبيق APK يتصرّف نفس الشيء: إن كنا داخل قسم، يرجع للقائمة الرئيسية بدل الخروج من الإعدادات.
- لا تغيير على محتوى أي قسم أو منطق الحفظ؛ فقط طريقة العرض والتنقّل.

### تفاصيل تقنية (القسم 1)
- في `src/pages/Settings.tsx`: القيمة الابتدائية لـ `activeTab` تصبح `null`.
- عرض شرطي: `activeTab === null` → شبكة البطاقات فقط؛ خلاف ذلك → شريط الرجوع + `renderTabContent()`.
- مزامنة مع `?tab=` في الـ URL حتى يعمل زر الرجوع الفعلي للجهاز (history) عبر `useSearchParams`.
- الحفاظ على كل أصناف Tailwind والبطاقات كما هي.

## 2. إصلاح ملاحظات SonarCloud

بدون أي تغيير في السلوك أو التنسيق:

- **الأرقام الحديثة**: استبدال `parseInt` / `parseFloat` / `isNaN` بـ `Number.parseInt` / `Number.parseFloat` / `Number.isNaN` في:
  `scripts/bump-version.js` (33, 36)، `StatCard.tsx` (66, 67)، `CartPanel.tsx` (79, 80)، `PurchaseInvoiceItemForm.tsx`، `QuickPurchaseDialog.tsx`، `UnitSettingsTab.tsx`.
  ملاحظة: `Number.isNaN` لا يحوّل النص، لذلك يتم تطبيقه فقط على قيم ناتجة عن `Number.parseX` (كما هو الحال في كل المواضع أعلاه) حتى لا يتغيّر المنطق.
- **`StatCard.tsx` L64**: تبسيط التعبير النمطي إلى نمط خطّي غير قابل للتراجع، مع الإبقاء على البادئة/اللاحقة والتنسيق الحالي للأرقام.
- **عناصر تفاعلية غير دلالية**: إضافة `role="button"`، `tabIndex={0}`، ومعالج `onKeyDown` (Enter/Space) — أو التحويل إلى `<button type="button">` عندما لا يكسر التصميم — في:
  `NativeCameraPreview.tsx` (150, 159)، `DebtAlerts.tsx` (131)، `RecentInvoices.tsx` (309)، `NotificationBell.tsx` (225)، `Sidebar.tsx` (194)، `LicenseWarningBadge.tsx` (33).
- **تسريب القيم في JSX**: تحويل شروط `&&` إلى شروط منطقية صريحة (`length > 0`, `!!value`) في:
  `Sidebar.tsx` (311)، `CartPanel.tsx` (1061)، `ProductDetailsDialog.tsx` (132, 143, 147, 153, 162).
- **ربط التسميات بالحقول**: إضافة `id` للحقل و`htmlFor` للتسمية في:
  `CartPanel.tsx` (1423, 1482, 1490, 1498)، `LoanQuickDialog.tsx` (102)، `MaintenancePanel.tsx` (511, 525).
- **الترتيب العربي**: في `PartnerProfitDetailedReport.tsx` L71 استخدام `a.name.localeCompare(b.name, 'ar')`.

## 3. التحقق والإصدار

- تشغيل فحص TypeScript وبناء المشروع للتأكد من الاستقرار.
- مراجعة سريعة لشاشة الإعدادات (دخول قسم → رجوع) في المعاينة.
- تحديث `version.json` و`public/changelog.json` إلى **v1.0.24 (versionCode 253)** مع وصف التعديلين.
