
# خطة شاملة: إصلاح القائمة الجانبية + النسخ الاحتياطي التلقائي + سياسة الخصوصية

---

## 1. إصلاح القائمة الجانبية (Safe Area + توحيد الحركة)

### المشاكل:
- كلمة "FlowPOS Pro" وأزرار الجرس والمزامنة تُحجب بواسطة نوتش الكاميرا
- صفحة POS تستخدم Sidebar مباشرة بينما باقي الصفحات تستخدم MainLayout، مما يسبب اختلاف في حركة الإغلاق
- زر القائمة (MobileMenuTrigger) في POS يظهر بشكل مختلف عن باقي الصفحات

### الحل:
**الملف: `src/components/layout/Sidebar.tsx`**
- إضافة `pt-[env(safe-area-inset-top)]` لعنصر `<aside>` لدفع المحتوى تحت النوتش
- تطبيق نفس الشيء على `MobileMenuTrigger` بإضافة `top-[calc(1rem+env(safe-area-inset-top))]`

**الملف: `src/components/pos/POSHeader.tsx`**
- إضافة `pt-[env(safe-area-inset-top)]` للهيدر لضمان ظهور المحتوى تحت النوتش

**الملف: `src/pages/POS.tsx`**
- توحيد حركة إغلاق القائمة الجانبية مع باقي الصفحات: عند النقر على أي عنصر في القائمة (بما فيه POS)، تنزلق القائمة للخارج بنفس الحركة الانسيابية
- التأكد من أن sidebar في POS يستخدم نفس `onToggle` بشكل متسق

**الملف: `index.html`**
- إضافة `<meta name="viewport" content="..., viewport-fit=cover">` لتفعيل safe area على iOS

---

## 2. إزالة Google Drive وتفعيل النسخ الاحتياطي التلقائي المحلي

### المشكلة:
- إعدادات Google Drive موجودة في تبويب المزامنة
- لا يوجد نسخ احتياطي تلقائي عند كل عملية

### الحل:

**الملف: `src/pages/Settings.tsx`**
- إزالة `GoogleDriveSection` من تبويب `sync`
- استبداله بقسم "النسخ الاحتياطي المحلي" يعرض:
  - آخر 5 نسخ احتياطية محلية
  - لكل نسخة: السبب (مثلاً "فاتورة #123")، التاريخ، الحجم، زر استعادة
  - تفاصيل النسخة عند النقر عليها

**الملف الجديد: `src/lib/local-auto-backup.ts`**
- دالة `triggerAutoBackup(reason: string)` تُستدعى بعد كل عملية كتابة
- حفظ النسخة في `Directory.Documents/HyperPOS/backups/` على الأجهزة الأصلية
- على الويب: حفظ في `localStorage` (آخر 5 نسخ فقط)
- كل نسخة تحتوي على: `reason`, `timestamp`, `data`
- دالة `loadRecentBackups()` لجلب آخر 5 نسخ
- دالة `restoreFromBackup(backupId)` للاستعادة

**تعديل ملفات العمليات لاستدعاء النسخ الاحتياطي:**
- `src/lib/cloud/invoices-cloud.ts` - بعد حفظ فاتورة
- `src/lib/cloud/products-cloud.ts` - بعد إضافة/تعديل منتج
- `src/lib/cloud/debts-cloud.ts` - بعد إضافة دين
- `src/lib/cloud/customers-cloud.ts` - بعد إضافة عميل
- `src/lib/cloud/expenses-cloud.ts` - بعد إضافة مصروف

استدعاء `triggerAutoBackup("فاتورة جديدة #XXX")` بعد نجاح كل عملية.

---

## 3. طلب إذن التخزين عند أول تشغيل

### الحل:
**الملف: `src/hooks/use-app-permissions.tsx`**
- موجود بالفعل ويطلب أذونات الكاميرا والتخزين
- التأكد من أنه يعمل بشكل صحيح مع Filesystem permissions

---

## 4. شاشة سياسة الخصوصية عند أول تشغيل

### الحل:

**الملف الجديد: `src/components/PrivacyPolicyScreen.tsx`**
- شاشة كاملة تظهر مرة واحدة فقط (يتم تتبعها بـ `localStorage.getItem('hyperpos_privacy_accepted')`)
- نص سياسة الخصوصية باللغتين العربية والإنجليزية
- زر "أوافق" يحفظ الموافقة ويمرر المستخدم للتطبيق
- تتضمن: جمع البيانات، التخزين المحلي، المزامنة السحابية، الأذونات المطلوبة

**الملف: `src/App.tsx`**
- إضافة فحص `privacy_accepted` قبل عرض المحتوى الرئيسي
- إذا لم يتم القبول: عرض `PrivacyPolicyScreen`
- بعد القبول: عرض التطبيق بشكل طبيعي

---

## 5. عرض النسخ الاحتياطية في قائمة المزامنة (SyncStatusMenu)

### الملف: `src/components/layout/SyncStatusMenu.tsx`
- إضافة قسم "النسخ المحلية" أسفل قائمة العمليات الحالية
- عرض آخر 5 نسخ مع السبب والتوقيت
- عند النقر: عرض تفاصيل + زر استعادة

---

## ملخص الملفات

| الملف | التغيير |
|-------|---------|
| `src/components/layout/Sidebar.tsx` | إضافة safe-area-inset-top للنوتش |
| `src/components/pos/POSHeader.tsx` | إضافة safe-area padding |
| `src/pages/POS.tsx` | توحيد حركة إغلاق القائمة |
| `index.html` | إضافة viewport-fit=cover |
| `src/pages/Settings.tsx` | إزالة GoogleDriveSection، إضافة عرض النسخ المحلية |
| `src/lib/local-auto-backup.ts` | ملف جديد - نظام النسخ الاحتياطي التلقائي |
| `src/lib/cloud/invoices-cloud.ts` | استدعاء triggerAutoBackup بعد الحفظ |
| `src/lib/cloud/products-cloud.ts` | استدعاء triggerAutoBackup بعد الحفظ |
| `src/lib/cloud/debts-cloud.ts` | استدعاء triggerAutoBackup بعد الحفظ |
| `src/lib/cloud/customers-cloud.ts` | استدعاء triggerAutoBackup بعد الحفظ |
| `src/lib/cloud/expenses-cloud.ts` | استدعاء triggerAutoBackup بعد الحفظ |
| `src/components/PrivacyPolicyScreen.tsx` | ملف جديد - شاشة سياسة الخصوصية |
| `src/App.tsx` | إضافة فحص سياسة الخصوصية |
| `src/components/layout/SyncStatusMenu.tsx` | إضافة قسم النسخ المحلية |
