# خطة تنظيف الكود والأمان — تدريجية على 3 مراحل

## نتائج الفحص الأولي

- **172 استخدام لـ `any`** موزعة على ~30 ملف. أعلى التركيزات:
  - `src/lib/cloud/invoices-cloud.ts` (20)
  - `src/lib/supabase-store.ts` (17)
  - `src/lib/cloud/library-cloud.ts` (13)
  - `src/pages/Settings.tsx` (12)
  - `src/lib/cloud/stock-counts-cloud.ts` (11)
  - `src/lib/cloud/products-cloud.ts` (10)
  - `src/lib/cloud/debts-cloud.ts` (8)
  - `src/lib/auto-backup.ts` (7)
- **`.env` متعقَّب فعلياً في Git** ولا يوجد في `.gitignore` (مشكلة أمنية حقيقية).
- `.gitignore` يحوي بالفعل `*.keystore`, `*.jks`, `keystore_base64.txt`.
- **لا توجد ملفات keystore/jks/p12 فعلياً** في المشروع حالياً (رغم إجابتك "نعم موجودة" — سأبحث مرة ثانية بدقة وأبلغك قبل أي حذف).
- لا توجد JWT/مفاتيح Supabase مكتوبة يدوياً داخل `src/` — يستخدم `import.meta.env`.

---

## المرحلة 1 — الأمان (تنفّذ أولاً، تغييرات صغيرة جداً)

1. **حماية `.env`:**
   - إضافة `.env` و `.env.local` و `.env.*.local` إلى `.gitignore`.
   - إزالة `.env` من تتبع Git مع الإبقاء عليه محلياً (`git rm --cached .env`).
   - تنبيهك بأن قيم `VITE_SUPABASE_*` الحالية publishable keys (آمنة للنشر العام) — لا حاجة لتدويرها، لكن الحفاظ على `.env` خارج Git ممارسة صحيحة.
2. **بحث نهائي عن ملفات التوقيع الحساسة:**
   - فحص شامل لكامل المستودع (ليس فقط `android/`) عن `*.keystore`, `*.jks`, `*.p12`, `keystore_base64.txt`, `*.pem`, `google-services.json` بمفاتيح حقيقية.
   - **لن أحذف شيئاً قبل عرض القائمة عليك** والحصول على موافقتك ملفاً ملفاً، مع شرح كيفية إعادة إنشاء keystore يدوياً وتخزينه آمناً (GitHub Secrets / build secret).
3. **بدون لمس** أي ملف من `src/integrations/supabase/client.ts` أو `.env` (auto-generated/managed).

**معيار النجاح:** بناء ناجح + لا تغيير في سلوك التطبيق.

---

## المرحلة 2 — إزالة `any` من ملفات الـ Cloud الحرجة

ترتيب الملفات (الأهم أولاً، دفعة واحدة لكل ملف، بناء بعد كل ملف):

1. `src/lib/supabase-store.ts` (17)
2. `src/lib/cloud/invoices-cloud.ts` (20)
3. `src/lib/cloud/products-cloud.ts` (10)
4. `src/lib/cloud/debts-cloud.ts` (8)
5. `src/lib/auto-backup.ts` (7)
6. `src/lib/cloud/library-cloud.ts` (13)
7. `src/lib/cloud/stock-counts-cloud.ts` (11)

**النهج المعتمد (حسب اختيارك "interfaces مرنة"):**
- تعريف `interface` لكل كيان (Product / Invoice / Customer / Debt …) داخل `src/types/cloud.ts` جديد، مع جعل الحقول الاختيارية `?:` لاحتواء البيانات القديمة.
- للحقول `jsonb` (مثل `custom_fields`, `metadata`, `items_snapshot`): استخدام `Record<string, unknown>` بدلاً من `any` — أقل تشدداً من `unknown` الخالص ولا يكسر `obj.foo` access.
- استخدام أنواع Supabase التلقائية من `src/integrations/supabase/types.ts` كأساس عبر `Database['public']['Tables']['products']['Row']` حيث ممكن.
- في حالات التحويل من DB row إلى نوع التطبيق: إضافة دوال `mapRowToProduct(row)` صغيرة بدل `as any`.

**قاعدة صارمة:** إذا تطلب إصلاح ملف لمساً لمنطق أعمال (POS / فواتير / مزامنة) — أتوقف وأسألك قبل أي تغيير منطقي.

**معيار النجاح بعد كل ملف:** بناء ناجح + لا warnings TypeScript جديدة.

---

## المرحلة 3 — إزالة `any` من بقية الملفات

ملفات صفحات وواجهات أقل خطورة (`Settings.tsx`, `BossPanel.tsx`, `Customers.tsx`, `Sidebar.tsx`, `ProductDetailsDialog.tsx`, …) — نفس النهج، دفعات صغيرة، بناء بعد كل دفعة.

---

## ضوابط الأمان أثناء كل المراحل

- **ممنوع:** تغيير مخطط قاعدة البيانات، RLS، سياسات، أو منطق `sync-queue` / `cash-sale-handler` / `debt-sale-handler`.
- **ممنوع:** تعديل ملفات auto-generated (`supabase/client.ts`, `types.ts`).
- **ممنوع:** المساس بحساب المال (`Math.round`, currency conversions, profit logic) — حتى لو ظهر تحذير type، نوسّع النوع لا نغير الحساب.
- **التحقق:** بناء فقط (كما طلبت) بعد كل ملف؛ لن أعتمد على فحص يدوي للصفحات.

---

## ما لن تتضمنه هذه الجولة

- إضافة Offline-First جديد (مؤجل حتى تستقر الأنواع).
- إعادة هيكلة `POS.tsx` إلى Container/Presentational.
- تحديث dependencies.
- أي تغيير في UI أو ترجمات.

---

## مخرجات المرحلة 1 (الجولة القادمة فقط)

تعديل ملفين:
- `.gitignore` (إضافة `.env*`)
- إزالة `.env` من تتبع Git (`git rm --cached`)

وتقرير لك يحتوي:
- قائمة ملفات keystore/secrets موجودة فعلياً (إن وُجدت) قبل أي حذف.
- تأكيد أن البناء نجح.

بعد موافقتك على نتيجة المرحلة 1، ننتقل للمرحلة 2.
