

# خطة إصلاح شاملة — خطأ البناء + المشاكل الحرجة من تدقيق النظام

---

## 1. إصلاح خطأ البناء (فوري)

**ملف:** `src/components/ui/sonner.tsx` سطر 17

**المشكلة:** `swipeDirections={['up', 'down', 'left', 'right']}` — النوع `'up'` و `'down'` غير مقبول في النسخة الحالية من sonner.

**الحل:** إزالة سطر `swipeDirections` بالكامل (السلوك الافتراضي كافٍ).

---

## 2. إصلاح #2: عكس أرباح الشركاء سحابياً عند المرتجع

**المشكلة المؤكدة:** `refundInvoiceCloud` في `invoices-cloud.ts` سطر 628 يستدعي `revertProfitDistribution` المحلية فقط — لا يوجد `revertProfitDistributionCloud`.

**الحل:**
- إنشاء دالة `revertProfitDistributionCloud` في `partners-cloud.ts`
- تعكس الأرباح المؤكدة والمعلقة من جدول `partners` في السحابة
- استدعاؤها في `refundInvoiceCloud` بدلاً من/بالإضافة إلى النسخة المحلية

**المنطق:**
```text
لكل شريك:
  1. البحث في pendingProfitDetails عن invoiceId → خصم من pendingProfit
  2. البحث في profitHistory عن invoiceId → خصم من confirmedProfit + currentBalance + totalProfitEarned
  3. حذف السجلات المطابقة
  4. updatePartnerCloud بالقيم الجديدة
```

---

## 3. إصلاح #3: حذف الدين يعيد الحالات المرتبطة

**المشكلة المؤكدة:** `deleteDebtCloud` يحذف السجل فقط بدون:
- تحديث حالة الفاتورة المرتبطة
- خفض `totalDebt` للعميل
- عكس `pendingProfit` للشركاء

**الحل:** تحديث `deleteDebtCloud` في `debts-cloud.ts` ليقوم بـ:
1. قراءة الدين قبل الحذف (للحصول على `invoice_id`, `remaining_debt`, `customer_name`)
2. تحديث الفاتورة المرتبطة: `status = 'completed'`, `debt_remaining = 0`
3. خفض `total_debt` للعميل عبر `updateCustomerStatsCloud`
4. عكس `pendingProfit` للشركاء عبر `revertProfitDistributionCloud` الجديدة
5. حذف الدين

**تحديث `Debts.tsx`:** تمرير بيانات الدين المحدد لـ `deleteDebtCloud` المحسّنة.

---

## 4. ملخص الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/components/ui/sonner.tsx` | إزالة `swipeDirections` لإصلاح خطأ البناء |
| `src/lib/cloud/partners-cloud.ts` | إضافة `revertProfitDistributionCloud` |
| `src/lib/cloud/invoices-cloud.ts` | استدعاء `revertProfitDistributionCloud` في `refundInvoiceCloud` |
| `src/lib/cloud/debts-cloud.ts` | تحسين `deleteDebtCloud` لعكس الفاتورة + العميل + الشركاء |
| `src/pages/Debts.tsx` | تمرير بيانات الدين الكاملة عند الحذف |

---

## ملاحظة بخصوص باقي المشاكل

المشاكل #1 (نقل profits-store للسحابة)، #4 (ترقيم الفواتير)، #8 (audit log) ستُعالج في مراحل لاحقة لأنها تتطلب إنشاء جداول جديدة في قاعدة البيانات وتغييرات هيكلية أكبر.

