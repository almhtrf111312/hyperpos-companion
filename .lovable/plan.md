# تقرير الفحص الشامل وخطة الإصلاح (FlowPOS Pro)

## الخلاصة
فحص الأنواع (TypeScript) يُظهر **50 خطأ**. معظمها ليس شكلياً: هناك متغيرات ودوال **غير معرّفة** في الشيفرة، وهذه تعطّل النافذة عند فتحها (ReferenceError → شاشة بيضاء أو نافذة لا تفتح). هذا هو سبب أعطال نافذة المشتريات وغيرها بعد آخر التعديلات (المراحل 2–6 للعملة الموحدة `money-engine`).

لا يلزم أي SQL في هذه الخطة؛ كل الأعطال في الواجهة. لا تُلمس الحسابات المالية ولا الخادم.

## الأعطال مرتبة حسب الخطورة

| # | الملف | المشكلة | الأثر على المستخدم |
|---|---|---|---|
| 1 | `src/components/purchases/PurchaseInvoiceViewDialog.tsx` سطر 1 | `useMemo` مستخدم وغير مستورد | نافذة تفاصيل فاتورة الشراء تنهار عند الفتح |
| 2 | `src/lib/cashbox-store.ts` سطر 228–271 | `primaryCurrency` و`exchangeRate` غير معرّفين داخل `closeShift` | إغلاق الوردية ينهار |
| 3 | `src/pages/CashShifts.tsx` سطر 267 و761 | يمرر 5 وسائط لـ`closeShift` (تقبل 3)، و`cn` غير مستورد | إغلاق الوردية + عرض الصفحة |
| 4 | `src/pages/Customers.tsx` 821–887 | `expandedInvoices`, `toggleInvoiceExpand`, `currencyCode`, `exchangeRate`, `isNonUsd`, `cn` غير معرّفة | كشف حساب العميل ينهار (الصفحة المفتوحة لديك الآن) |
| 5 | `src/lib/invoice-canvas-generator.ts` 652/659 و`src/lib/native-print.ts` 373/379 | `isEnabled` بدل `enabled` | العملات المفعلة لا تظهر في صورة/طباعة الفاتورة (قيمة دائماً undefined) |
| 6 | `Invoices.tsx` 395–430، `InvoiceTracking.tsx` 135–138، `CartPanel.tsx` 805/1203 | استخدام `currency_code/currency_symbol/exchange_rate/total_in_currency` بينما نوع `Invoice` يستخدم `currencyCode/currencySymbol/exchangeRate/totalInCurrency` | عملة الفاتورة قد تظهر خاطئة أو تعود للدولار |
| 7 | `src/pages/POS.tsx` 600 | `updateProducts(prev => …)` بينما الدالة تقبل مصفوفة فقط | تحديث المخزون الجزئي بعد الاسترداد يكتب دالة بدل قائمة → شبكة المنتجات تفرغ/تنهار بعد استرداد |
| 8 | `Debts.tsx` 105/317، `Invoices.tsx` 1383 | نوع العملة `string` مقابل `'USD'|'TRY'|'SYP'` | أخطاء أنواع فقط؛ العملات المخصصة غير مدعومة في الديون |

## المرحلة 1 — إيقاف الانهيارات (أولوية قصوى)

**1. نافذة المشتريات** — `PurchaseInvoiceViewDialog.tsx` سطر 1:
```ts
import { useState, useEffect, useMemo } from 'react';
```

**2. إغلاق الوردية** — `src/lib/cashbox-store.ts` سطر 228:
```ts
export const closeShift = (
  closingCash: number,
  notes?: string,
  currencyCounts?: { USD?: number; TRY?: number; SYP?: number },
  primaryCurrency?: string,
  exchangeRate?: number
): { shift: Shift; discrepancy: number } | null => {
```
(السطران 270–271 يبقيان كما هما؛ التخزين يبقى بالدولار، العملة وسعر الصرف للمرجع فقط.) تأكد أن نوع `Shift` يحتوي `currency?: string; exchange_rate?: number;` وأضفهما إن لم يكونا موجودين.

**3. صفحة الورديات** — `src/pages/CashShifts.tsx` أضف إلى الاستيرادات:
```ts
import { cn } from '@/lib/utils';
```
وتحقق أن الدالة المستدعاة `closeShiftFn` في سطر 262 تشير لـ`closeShift` الجديدة (خمسة وسائط) — إن كانت تمر عبر hook وسيط فأضف الوسيطين له بنفس الترتيب.

**4. صفحة العملاء** — `src/pages/Customers.tsx` داخل المكوّن (بجانب باقي `useState`):
```ts
import { cn } from '@/lib/utils';
import { useMoney } from '@/hooks/use-money';
// داخل المكوّن:
const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
const toggleInvoiceExpand = (id: string) =>
  setExpandedInvoices(prev => ({ ...prev, [id]: !prev[id] }));
const money = useMoney();
const currencyCode = money.activeCode;
const exchangeRate = money.activeRate || 1;
const isNonUsd = currencyCode !== 'USD';
```
ملاحظة: الفواتير القديمة يجب أن تعرض بسعر صرفها المحفوظ؛ إن كان `item` يحمل `exchangeRate` فاستخدم `item.exchangeRate ?? exchangeRate` في سطور 852–887.

**5. صورة وطباعة الفاتورة** — في `invoice-canvas-generator.ts` (652، 659) و`native-print.ts` (373، 379): استبدل `.isEnabled` بـ`.enabled`.

## المرحلة 2 — توحيد حقول عملة الفاتورة

النوع المعتمد هو camelCase في `src/lib/cloud/invoices-cloud.ts` (سطر 90–178). في كل من:
- `Invoices.tsx` 395–430: `inv.currency_code` → `inv.currencyCode`، `currency_symbol` → `currencySymbol`، `exchange_rate` → `exchangeRate`.
- `InvoiceTracking.tsx` 118–138: نفس الاستبدال، و`total_in_currency` → `totalInCurrency`؛ سطر 118 حوّل القيمة `String(x ?? '')`.
- `CartPanel.tsx` 805 و1203: احذف `currency_code: …` من كائن الفاتورة واستعمل `currencyCode: …` (إن كان موجوداً مسبقاً فاحذف المكرر فقط).

التحويل من/إلى قاعدة البيانات (snake_case) يتم فقط داخل `invoices-cloud.ts` (سطر 585 مثلاً) — لا تغيّره.

## المرحلة 3 — المخزون بعد الاسترداد في POS

`src/pages/POS.tsx` سطر 600: `updateProducts` تقبل مصفوفة. الحل الأدق: اجعلها تقبل الشكلين في سطر 437:
```ts
const updateProducts = useCallback(
  (next: POSProduct[] | ((prev: POSProduct[]) => POSProduct[])) => {
    setProducts(prev => (typeof next === 'function' ? next(prev) : next));
    // أبقِ أي منطق إضافي موجود داخل الدالة الحالية (كاش/مرجع) مطبقاً على القيمة الناتجة
  }, []);
```
اقرأ جسم الدالة الحالي أولاً وحافظ على كل ما فيه (مثل تحديث `useRef`).

## المرحلة 4 — أنواع العملة في الديون والفواتير
- `Debts.tsx` 105: `useState<string>(() => …)` بدل النوع الضيق؛ وكذلك 317.
- `Invoices.tsx` 1383: مرر `code as 'USD' | 'TRY' | 'SYP'` أو وسّع توقيع الدالة المستقبِلة إلى `string` (الأفضل التوسيع لدعم العملات المخصصة).

## المرحلة 5 — التحقق (إلزامي)
1. `npx tsgo --noEmit -p tsconfig.app.json` → يجب 0 أخطاء (حالياً 50).
2. `npm run build` → exit 0.
3. اختبار يدوي بعرض 390px و1280px:
   - المشتريات: فتح تفاصيل فاتورة، شراء سريع، إضافة فاتورة.
   - POS: بيع نقدي، بيع دين، دفع ناقص، ثم استرداد الفاتورة والتأكد أن المنتجات لا تختفي والمخزون يرجع.
   - الفواتير: فاتورة بالتركي تبقى بالتركي بعد تغيير العملة الافتراضية.
   - الورديات: فتح وإغلاق بعملة غير الدولار.
   - العملاء: فتح كشف حساب وتوسيع فاتورة.
   - مشاركة صورة الفاتورة وطباعتها.
4. تحديث `version.json` و`public/changelog.json` (v1.0.73).

## المرحلة 6 (اختيارية) — ميزة ذكاء اصطناعي
لديك مساعد المدير (`boss-assistant`) يعمل عبر بوابة Lovable AI وكان متوقفاً بخطأ 403 بسبب تعطيل الذكاء الاصطناعي في مساحة العمل. بعد استقرار المراحل 1–5 يمكن إضافة "تحليل يومي ذكي" (ملخص المبيعات، المنتجات الراكدة، تنبيه نقص المخزون) فوق نفس الدالة. Claude غير متاح كنموذج داخل التطبيق عبر البوابة؛ البديل الجاهز Gemini/GPT دون مفتاح. هذه مرحلة منفصلة تحتاج موافقتك.

## ملاحظات فنية
- لا SQL مطلوب: كل الأعطال واجهة فقط.
- الدولار يبقى أساس التخزين؛ لا تعديل على RPCs أو حسابات الربح.
- السبب الجذري: تعديلات المراحل 2–6 الخارجية أُضيفت دون تشغيل فحص الأنواع، لأن Vite يبني رغم أخطاء TypeScript. يُنصح بإضافة `tsgo --noEmit` إلى خطوة CI قبل الرفع.
