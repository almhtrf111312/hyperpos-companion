# خطة تطوير FlowPOS Pro – المحاسبة والمزامنة

## نظرة عامة

تنفيذ المتطلبات الواردة في مستند "تعليمات تطوير نظام FlowPOS Pro" مع التركيز على:

1. الفصل الواضح بين رأس المال ورصيد الخزنة.
2. الفصل بين الأرباح النقدية والمعلقة للشركاء.
3. سلامة المرتجعات (مخزون + خزنة + أرباح + ديون + شركاء).
4. مطابقة الورديات الإلزامية ونقل سجلاتها للسحابة.
5. نقل `profits-store` و `cashbox-store` من localStorage إلى Supabase.
6. ترقيم فواتير مركزي وآمن.
7. إتلاف الديون (Write-off) كعملية محاسبية كاملة.

---

## المرحلة 1 – تعديلات قاعدة البيانات (Supabase)

### جداول جديدة

- `**profit_records**`: `id, user_id, invoice_id, gross_profit, cogs, revenue, currency, recorded_at, is_reversed, reversed_at`.
- `**cash_shifts**`: `id, user_id, cashier_id, opened_at, closed_at, opening_balance, expected_balance, actual_balance, variance, variance_reason, reconciled (bool), reconciliation_status ('pending'|'matched'|'unmatched'), notes`.
- `**shift_transactions**`: `id, shift_id, type ('sale'|'deposit_capital'|'deposit_revenue'|'deposit_purchase_cover'|'debt_payment'|'expense'|'refund'|'writeoff'), amount, reference_id, created_at`.
- `**debt_writeoffs**`: `id, user_id, debt_id, amount, reason, written_off_at, capital_impact, partner_impact jsonb`.

### تعديل جداول قائمة

- `invoices`: إضافة عمود `invoice_sequence bigint` (تسلسل مركزي).
- `expenses`: إضافة قيمة `'debt_writeoff'` ضمن `expense_type`.

### دوال SQL

- `get_next_invoice_number(_user_id uuid)`: SECURITY DEFINER، تستخدم `SELECT ... FOR UPDATE` على جدول تسلسل لكل مالك لضمان التفرد.
- `reconcile_shift(_shift_id uuid, _actual numeric, _reason text)`: تتحقق وتغلق الوردية.

### RLS

نسخ نمط `(user_id = get_owner_id(auth.uid()))` لكل الجداول الجديدة.

---

## المرحلة 2 – طبقات السحابة (src/lib/cloud)

### `profits-cloud.ts` (جديد)

- `addGrossProfitCloud(invoiceId, profit, cogs, revenue)`
- `reverseProfitCloud(invoiceId)` (للاسترداد/الحذف)
- `getProfitsCloud(filters)`
- استبدال جميع استدعاءات `addGrossProfit` المحلية بنسخ سحابية مع fallback لـ sync-queue offline.

### `cashbox-cloud.ts` (جديد)

- `openShiftCloud`, `closeShiftCloud`, `addShiftTransactionCloud`, `getShiftsCloud`.
- ترحيل بيانات `cashbox-store` المحلية مرة واحدة عند أول تشغيل سحابي.

### `partners-cloud.ts`

- توضيح الفصل في `distributeDetailedProfitCloud`: حقل `pending_profit` للديون، `confirmed_profit` للنقدية.
- `confirmPendingProfitCloud(debtId)`: ينقل من pending → confirmed عند سداد الدين.
- `reversePartnerProfitsCloud(invoiceId, isPending)`: للاستخدام في المرتجعات والإتلاف، يعدّل بيانات Supabase مباشرة (لا اعتماد على `partners-store` المحلي).

### `invoices-cloud.ts`

- `getNextInvoiceNumber()` يستدعي RPC `get_next_invoice_number`.
- `refundInvoiceCloud()` يصبح متكاملاً:
  1. إعادة كميات المخزون (موجود).
  2. خصم القيمة من الوردية الحالية عبر `addShiftTransactionCloud(type='refund')`.
  3. `reverseProfitCloud(invoiceId)`.
  4. `reversePartnerProfitsCloud(invoiceId)` (نقدي ومعلق).
  5. حذف/تعديل سجل الدين المرتبط عبر `debts-cloud`.
  6. تحديث إحصائيات العميل.

### `debts-cloud.ts`

- `deleteDebtCloud()`: يخصم من `customers.total_debt`، يعكس `partners.pending_profit` المرتبطة.
- `writeOffDebtCloud(debtId, reason)` (جديد):
  - إدراج في `debt_writeoffs`.
  - إدراج مصروف من نوع `debt_writeoff` في `expenses`.
  - خصم من `capital-store`/سحابة رأس المال.
  - عكس الأرباح المعلقة للشركاء.
  - إزالة الدين.

---

## المرحلة 3 – طبقة الصندوق ورأس المال

### فصل المفاهيم

- `cashbox-store` (يصبح cache فوق `cashbox-cloud`): التدفقات اليومية للوردية فقط.
- `capital-store` (يصبح cache سحابي): القيمة الإجمالية للمشروع، يتأثر فقط بـ:
  - رأس مال جديد، شراء بضاعة، خسائر/إتلاف ديون، توزيع أرباح للشركاء.
- منع أي تأثير متبادل غير معلَن في الكود؛ توثيق صريح في رأس كل ملف.

### `unified-transactions.ts`

- `addDepositToShift(amount, kind)` حيث `kind ∈ {'capital','revenue','purchase_cover'}`:
  - واجهة `CashShifts.tsx` تعرض حواراً يطلب اختيار النوع.
  - `capital`: يضاف لرأس المال + الوردية.
  - `revenue`: يضاف للوردية فقط.
  - `purchase_cover`: يربط بفاتورة شراء (اختياري) ولا يؤثر على تكلفة المنتجات (التكلفة سُجّلت وقت الشراء)، يضاف للوردية كحركة مفسَّرة.
- `processDebtPayment()`: يسجل النوع `'debt_payment'` بدل `'deposit'`.

---

## المرحلة 4 – واجهة المستخدم

### `CashShifts.tsx`

- حوار "إضافة رصيد" بثلاث خيارات (رأس مال / إيراد آخر / تغطية شراء).
- إغلاق الوردية:
  - عرض الفرق (نقص/زيادة).
  - منع الإغلاق دون تبرير: زر "إضافة مصروف للنقص" أو "إضافة إيراد للزيادة".
  - حالة المطابقة في القائمة: مطابق / غير مطابق / معلق + إمكانية المطابقة لاحقاً.

### `Partners.tsx`

- عرض بطاقتين منفصلتين لكل شريك: **أرباح نقدية** و **أرباح معلقة** مع منع سحب المعلق.

### `Debts.tsx`

- زر "إتلاف دين" (Admin/Boss فقط) مع حوار تأكيد + حقل سبب.

---

## المرحلة 5 – طابور المزامنة Offline

- إضافة أنواع جديدة في `sync-queue`:
  - `profit_record`, `profit_reverse`, `shift_open`, `shift_close`, `shift_transaction`, `debt_writeoff`.
- معالجات في `purchase-queue-processor` المقابلة (أو ملف معالجات موحد).
- ضمان أن جميع العمليات الجديدة تعمل offline ثم تُزامَن.

---

## التفاصيل التقنية

### الملفات المعدّلة

```
src/lib/cashbox-store.ts          (cache فقط فوق السحابة)
src/lib/capital-store.ts          (تنظيف، فصل تام)
src/lib/profits-store.ts          (تحويل لـ cache)
src/lib/unified-transactions.ts   (kind للإيداع، نوع debt_payment)
src/lib/cloud/invoices-cloud.ts   (refund متكامل + RPC ترقيم)
src/lib/cloud/partners-cloud.ts   (فصل pending/confirmed، عكس سحابي)
src/lib/cloud/debts-cloud.ts      (deleteDebtCloud، writeOffDebtCloud)
src/lib/sync-queue.ts             (أنواع جديدة)
src/pages/CashShifts.tsx          (حوار الإيداع، المطابقة الإلزامية)
src/pages/Debts.tsx               (زر الإتلاف)
src/pages/Partners.tsx            (عرض pending/confirmed)
```

### الملفات الجديدة

```
src/lib/cloud/profits-cloud.ts
src/lib/cloud/cashbox-cloud.ts
supabase migrations: profit_records, cash_shifts, shift_transactions,
                     debt_writeoffs, RPC get_next_invoice_number
```

### تنبيهات

- جميع التعديلات تحترم RLS عبر `get_owner_id(auth.uid())`.
- `Math.round(val*100)/100` لكل المبالغ المالية.
- لا كسر للتوافق Offline: كل استدعاء سحابي له fallback في `sync-queue`.
- الترقيم المركزي لا يتعارض مع الفواتير المحلية: عند المزامنة يُستبدل الرقم المؤقت برقم RPC.

---

## التحقق بعد التنفيذ

1. سيناريو offline → online: بيع نقدي + دين + مرتجع → تحقق من profits/partners/debts/cashbox.
2. إغلاق وردية بفرق نقص → إجبار إدخال مصروف.
3. إتلاف دين عميل → تحقق من خصم رأس المال + عكس ربح الشريك المعلق + ظهور مصروف.
4. فاتورتان متزامنتان من جهازين مختلفين → أرقام فواتير فريدة.

ملاحظات إضافية لضمان أفضل نتيجة من Lovable:المزامنة (Sync Conflict): بما أنك طلبت الحفاظ على العمل دون اتصال، يجب التأكيد على Lovable أن تكون آلية المزامنة "ذكية". مثلاً، إذا تم تعديل سعر منتج في جهازين مختلفين أثناء انقطاع الإنترنت، كيف سيقرر النظام السعر النهائي؟ (يفضل دائماً اعتماد "آخر تعديل").1.الأداء: نقل كل شيء للسحابة قد يبطئ التطبيق قليلاً إذا لم يتم استخدام "التخزين المؤقت" (Caching) بشكل صحيح. يجب أن يظل التطبيق يقرأ من البيانات المحلية ويعرضها فوراً، بينما تتم المزامنة مع السحابة في الخلفية.2.سهولة الاستخدام: مع كل هذه القواعد المحاسبية الصارمة، يجب التأكد من أن واجهة المستخدم تظل بسيطة. مثلاً، عند طلب "تبرير فرق الصندوق"، يجب أن تظهر نافذة منبثقة سريعة وسهلة بدلاً من إجبار المستخدم على الذهاب لصفحة أخرى.3.