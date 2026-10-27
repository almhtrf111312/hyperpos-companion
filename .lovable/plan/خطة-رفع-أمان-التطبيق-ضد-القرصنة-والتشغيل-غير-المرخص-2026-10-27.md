# خطة رفع أمان التطبيق ضد القرصنة والتشغيل غير المرخص
# Anti-Piracy & Offline Hardening Plan

## الحقيقة الأساسية / Core Truth
لا يمكن منع قراءة كود يعمل على جهاز المستخدم بشكل كامل. الهدف: جعل النسخة المكسورة **عديمة القيمة** (لا بيانات سحابية، لا مزامنة، تتوقف بعد أيام) وجعل الكسر **مكلفاً** (فحوصات موزعة، تشفير مربوط بالخادم، تعتيم).
Client code can always be read. Goal: a cracked copy must be useless (no cloud, no sync, expires in days) and expensive to produce.

---

## المرحلة 1: ربط البيانات المحلية بمفتاح من الخادم / Server-bound local encryption
- الخادم يصدر مفتاح تشفير لكل جهاز (`device_key`) ضمن تذكرة الأوفلاين، ويحفظ داخل IndexedDB كمفتاح WebCrypto غير قابل للتصدير (`extractable: false`).
- تشفير المنتجات والعملاء والسلة المحلية بـ AES-GCM بهذا المفتاح.
- النتيجة: حذف صفحة الدخول لا يكفي؛ بدون تذكرة صالحة لا تُفك البيانات، والتطبيق يفتح فارغاً.
- ترحيل تدريجي: البيانات القديمة غير المشفرة تُقرأ مرة واحدة ثم تُعاد كتابتها مشفرة (لا كسر للأجهزة الحالية).

## المرحلة 2: تذكرة موقعة بتوقيع غير متماثل / Asymmetric signed lease
- استبدال التحقق الحالي بتوقيع **Ed25519** من Edge Function `issue-offline-lease` بمفتاح خاص سري على الخادم؛ التطبيق يحمل المفتاح العام فقط.
- محتوى التذكرة: user_id، device_id، plan، expires_at (حد أقصى 7 أيام)، max_offline_invoices، nonce، device_key المغلف.
- لا يمكن لأي مطور تزوير تذكرة دون المفتاح الخاص.

## المرحلة 3: فحوصات موزعة ومتشابكة / Distributed integrity checks
- بدل فحص واحد في `LicenseGuard`: إدخال التحقق داخل مسارات حرجة (حساب إجمالي السلة، حفظ الفاتورة، التصدير، الطباعة، المزامنة) عبر دوال بأسماء غير دالة.
- كل فحص يستخدم ناتج التذكرة كمدخل حسابي (مثلاً مفتاح فك التشفير) وليس كشرط if فقط، فحذف الشرط يعطل الوظيفة.
- فحص تأخيري عشوائي: اكتشاف التلاعب لا يعطل فوراً بل بعد عدد عشوائي من العمليات (يصعّب تحديد مكان الفحص).
- كشف تراجع الوقت (موجود) + مقارنة بآخر وقت خادم + عداد عمليات أحادي.

## المرحلة 4: الخادم هو المرجع / Server authority
- المزامنة ترفض أي فاتورة بدون `lease_id` صالح وتسلسل عداد سليم → النسخ المكسورة لا تصل للسحابة.
- تسجيل أحداث التلاعب في `security_events` وحظر الجهاز تلقائياً عند التكرار.
- ربط الحساب بجهاز واحد (موجود) + إلغاء التذاكر عن بعد (`revoked_leases`).

## المرحلة 5: حماية الحزم / Build hardening
- `vite-plugin-javascript-obfuscator` لملفات الترخيص والتشفير فقط (لتفادي بطء التطبيق): control-flow flattening، string array encoding، self-defending.
- Android: R8/ProGuard، فحص توقيع الـ APK داخلياً (Capacitor plugin) ورفض العمل إن تغيّر التوقيع، Play Integrity API عند الاتصال.
- Electron: `asar` + `electron-builder` code signing، تعطيل DevTools في الإنتاج، فحص hash لملف `app.asar` يُرسل للخادم عند المزامنة.
- إزالة source maps من الإنتاج.

## المرحلة 6: التحقق والاختبار / Verification
- اختبارات وحدة: تذكرة مزورة تُرفض، تذكرة منتهية تقفل البيع، تراجع الوقت يُكتشف، تجاوز حد الفواتير يقفل.
- اختبار يدوي: حذف `LicenseGuard` في نسخة تجريبية → التطبيق يفتح بلا بيانات ولا بيع.
- التأكد أن تسجيل دخول المالك والجهاز الحالي يعمل دون انقطاع.
- رفع الإصدار وتحديث changelog.

---

## SQL المقترح (يُنفذ يدوياً بموافقتك فقط)
```sql
CREATE TABLE IF NOT EXISTS public.revoked_leases (
  lease_id uuid PRIMARY KEY,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
ALTER TABLE public.revoked_leases ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.revoked_leases TO authenticated;
CREATE POLICY "read own revoked" ON public.revoked_leases
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS lease_id uuid,
  ADD COLUMN IF NOT EXISTS offline_seq integer;

CREATE OR REPLACE FUNCTION public.validate_invoice_lease()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lease_id IS NOT NULL AND EXISTS
     (SELECT 1 FROM public.revoked_leases WHERE lease_id = NEW.lease_id) THEN
    RAISE EXCEPTION 'LEASE_REVOKED';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_invoice_lease ON public.invoices;
CREATE TRIGGER trg_validate_invoice_lease
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_lease();
```
ملاحظة: الإلزام الكامل بـ lease_id يُفعّل بعد تحديث كل الأجهزة، لتجنب رفض فواتير قديمة.

## تفاصيل تقنية / Technical notes
- ملفات: `src/lib/offline-lease.ts`، `src/lib/secure-store.ts` (جديد)، `src/lib/backup-encryption.ts` (بعد ضمان التوافق)، `CartPanel.tsx`، `CloudSyncProvider.tsx`، `LicenseGuard.tsx`، `vite.config.ts`، Edge Function جديدة `issue-offline-lease`.
- سر جديد: `LEASE_SIGNING_PRIVATE_KEY` (Ed25519).
- لا مساس بملفات المستودعات المجمدة. USD يبقى الأساس المحاسبي.
- الرفع إلى GitHub بعد نجاح البناء.
