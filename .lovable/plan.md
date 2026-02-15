

## خطة: تشفير البيانات المحلية بعد 30 يوم من عدم الاتصال بالسيرفر

### الفكرة

عند نجاح أي فحص ترخيص من السيرفر، يتم تسجيل الوقت محلياً. إذا مر 5 أيام بدون اتصال ناجح بالسيرفر، يظهر تنبيه تحذيري. إذا وصل عدم الاتصال إلى 30 يوم، يتم تشفير البيانات المحلية (localStorage + IndexedDB) ويُقفل التطبيق حتى يتصل بالإنترنت ويتحقق من الترخيص.

### كيف لا تتأثر تجربة المستخدم العادي؟

- المستخدم المتصل بالإنترنت: لن يرى أي شيء مختلف. كل اتصال ناجح يعيد ضبط العداد.
- المستخدم بدون إنترنت لأقل من 5 أيام: لا يتأثر إطلاقاً.
- بعد 5 أيام: يرى تنبيه أصفر بسيط "يرجى الاتصال بالإنترنت خلال X يوم لتجنب تشفير البيانات".
- بعد 30 يوم: تُشفّر البيانات ويظهر شاشة قفل. عند عودة الإنترنت والتحقق الناجح من الترخيص، تُفك التشفير تلقائياً.

---

### التغييرات المطلوبة

#### 1. ملف جديد: `src/lib/offline-protection.ts`

المسؤول عن:
- تسجيل آخر وقت اتصال ناجح بالسيرفر (`hp_last_server_contact`)
- حساب عدد الأيام بدون اتصال
- تشفير جميع بيانات localStorage الحساسة (المنتجات، الفواتير، العملاء، الديون) باستخدام دوال `backup-encryption.ts` الموجودة
- تشفير بيانات IndexedDB (`hyperpos_cache`)
- فك التشفير عند عودة الاتصال والتحقق الناجح

**الثوابت:**
- `WARNING_DAYS = 5` -- بدء التحذير
- `ENCRYPT_DAYS = 30` -- تشفير البيانات
- `CONTACT_TIMESTAMP_KEY = 'hp_last_server_contact'`
- `DATA_ENCRYPTED_KEY = 'hp_data_encrypted'`
- `ENCRYPTED_BACKUP_KEY = 'hp_encrypted_backup'`

**الدوال:**
- `recordServerContact()` -- يُستدعى عند كل فحص ترخيص ناجح
- `getDaysWithoutContact(): number` -- يحسب الأيام منذ آخر اتصال
- `getOfflineStatus(): { daysOffline, shouldWarn, shouldEncrypt }`
- `encryptLocalData(): Promise<boolean>` -- يجمع كل بيانات localStorage الحساسة + IndexedDB ويشفرها في كتلة واحدة
- `decryptLocalData(): Promise<boolean>` -- يفك التشفير ويعيد البيانات
- `isDataEncrypted(): boolean`

#### 2. تعديل: `src/hooks/use-license.tsx`

- عند نجاح فحص الترخيص (سطر 149-152)، استدعاء `recordServerContact()`
- عند نجاح الفحص وكانت البيانات مشفرة (`isDataEncrypted()`)، استدعاء `decryptLocalData()` لفك التشفير تلقائياً
- إضافة حقول جديدة للحالة:
  - `offlineDays: number` -- عدد أيام عدم الاتصال
  - `offlineWarning: boolean` -- هل يجب إظهار تحذير (5+ أيام)
  - `dataEncrypted: boolean` -- هل البيانات مشفرة حالياً

#### 3. مكون جديد: `src/components/license/OfflineProtectionBanner.tsx`

- بانر تحذيري يظهر بعد 5 أيام من عدم الاتصال
- يعرض: "لم يتم التحقق من الترخيص منذ X يوم. يرجى الاتصال بالإنترنت خلال Y يوم لتجنب تشفير البيانات."
- يظهر باللون الأصفر (5-20 يوم)، البرتقالي (20-25 يوم)، الأحمر (25-30 يوم)

#### 4. مكون جديد: `src/components/license/DataEncryptedScreen.tsx`

- شاشة قفل كاملة تظهر عندما تكون البيانات مشفرة
- تعرض: "بياناتك مشفرة مؤقتاً بسبب عدم الاتصال بالسيرفر لمدة 30 يوم"
- زر "اتصل بالإنترنت وأعد المحاولة" يحاول فحص الترخيص وفك التشفير
- رسالة "تأكد من اتصالك بالإنترنت ثم اضغط إعادة المحاولة"

#### 5. تعديل: `src/components/license/LicenseGuard.tsx`

- إضافة فحص `dataEncrypted` من `useLicense()`
- إذا كانت البيانات مشفرة، عرض `DataEncryptedScreen` بدلاً من المحتوى
- إضافة `OfflineProtectionBanner` فوق المحتوى عند وجود تحذير

#### 6. تعديل: `src/App.tsx`

- إضافة `OfflineProtectionBanner` بجانب `LicenseWarningBadge` (خارج LicenseGuard)

#### 7. تعديل: `src/lib/i18n.ts`

- إضافة نصوص الترجمة للتحذيرات وشاشة التشفير بالعربية والإنجليزية والتركية والفارسية والكردية

---

### التفاصيل التقنية

**آلية التشفير:**
- عند الوصول لـ 30 يوم، يتم جمع مفاتيح localStorage التالية: `hyperpos_products`, `hyperpos_invoices`, `hyperpos_customers`, `hyperpos_debts`, `hyperpos_expenses`
- يتم تشفيرها باستخدام `encryptBackup()` الموجودة في `backup-encryption.ts`
- تُخزن النسخة المشفرة في `hp_encrypted_backup`
- تُحذف المفاتيح الأصلية
- يُعلّم `hp_data_encrypted = true`
- بيانات IndexedDB (`hyperpos_cache`) تُقرأ وتُشفر أيضاً

**آلية فك التشفير:**
- عند نجاح فحص الترخيص + `isDataEncrypted() === true`:
  - تُقرأ `hp_encrypted_backup` وتُفك باستخدام `decryptBackup()`
  - تُعاد البيانات لأماكنها الأصلية
  - يُزال علم التشفير

**لا تغييرات في قاعدة البيانات السحابية** -- هذه الميزة محلية بالكامل تحمي البيانات المخبأة على الجهاز فقط. بيانات السيرفر محمية بالفعل عبر RLS.

---

### ملخص الملفات

| الملف | النوع |
|-------|-------|
| `src/lib/offline-protection.ts` | جديد |
| `src/components/license/OfflineProtectionBanner.tsx` | جديد |
| `src/components/license/DataEncryptedScreen.tsx` | جديد |
| `src/hooks/use-license.tsx` | تعديل |
| `src/components/license/LicenseGuard.tsx` | تعديل |
| `src/App.tsx` | تعديل |
| `src/lib/i18n.ts` | تعديل |

