# خطة إصلاح المنطق الحسابي والمالي

تم فحص كل منطق الحسابات (الفواتير، الأرباح، المخزون، العملات، الديون، الورديات، المشتريات، التقارير). النتيجة: **11 مشكلة** مقسّمة على 3 مستويات. الأشياء الصحيحة (Mutex، RPC sequencer، التقريب في `addInvoiceCloud`، عكس الأرباح عند الاسترجاع، استبعاد المسترجع من الإحصائيات، حساب الضريبة net/gross، تحويل الخصم الأجنبي لـ USD...) **لن تُمَس**.

---

## المرحلة 1 — إصلاحات حرجة (تُسبّب بيانات خاطئة)

### 1.1 `src/lib/utils.ts` — `roundCurrency` يقرّب لـ 3 خانات بدل 2
- تغيير `Math.round(amount * 1000) / 1000` → `Math.round(amount * 100) / 100`
- مراجعة المواضع التي تعتمد على 3 خانات (إن وُجدت) وتعديلها.

### 1.2 `src/lib/cloud/invoices-cloud.ts` (دالة الاسترجاع، ~518-528) — إرجاع المخزون لا يحوّل bulk→pieces
- جلب `unit` و `conversion_factor` من `invoice_items` (يتطلب إضافة العمودين في الإدراج لاحقاً) أو من المنتج الحالي كfallback.
- ضرب الكمية المُسترجعة بـ `conversion_factor` عندما تكون الوحدة `bulk` قبل استدعاء `add_product_quantity`.
- **بدون migration الآن**: استخدام `products.bulk_unit`/`small_unit`/`conversion_factor` الحاليّة لاستنتاج التحويل من الكمية المخزّنة في `invoice_items.unit` إن كان متاحاً، وإلا الاعتماد على القطع (نفس السلوك القديم) مع تسجيل تحذير.
- **مع migration (موصى به)**: إضافة عمودَي `unit text` و `conversion_factor numeric` على `invoice_items` ليُحفظا وقت البيع، وضبط الاسترجاع عليهما.

### 1.3 `src/lib/cloud/purchase-invoices-cloud.ts` (~295-303) — تطبيق Weighted Average Cost
```ts
const oldQty = product.quantity || 0;
const oldCost = product.cost_price || 0;
const avgCost = newQuantity > 0
  ? Math.round(((oldQty * oldCost) + (item.quantity * item.cost_price)) / newQuantity * 100) / 100
  : item.cost_price;
```
- لا يُغيَّر cost_price إلا إذا كانت الكمية المُضافة > 0.
- إضافة اختبار يدوي: شراء 10 قطعة بـ 5 ثم 10 بـ 7 ⇒ التكلفة = 6.

### 1.4 `src/lib/cloud/debts-cloud.ts:402` — `status='completed'` غير صالح
- استبدالها بـ `status: 'paid'` (القيمة المعتمدة في CloudInvoice).
- مراجعة الواجهة (`Invoices.tsx`, `Debts.tsx`) للتأكد أن لا قاعدة لاحقة تعتمد `completed`.

---

## المرحلة 2 — إصلاحات متوسطة

### 2.1 `src/components/pos/CartPanel.tsx` (`confirmDebtSale`) — إضافة الحقول الناقصة
- إضافة `discountPercentage`، `taxRate`، `taxAmount` للـ bundle المُرسَل، مطابقة لـ `confirmCashSale`.

### 2.2 `src/components/pos/CartPanel.tsx` — `addSalesToShift` بدون ربح/COGS
- تمرير `grossProfit` و `cogs` (نفس القيم المُرسَلة للسحابة) إلى `addSalesToShift(amount, grossProfit, cogs)`.

### 2.3 `src/components/pos/CartPanel.tsx:385-408` — استخدام `addCurrency`
- استبدال `totalProfit += itemProfit` و `totalCOGS += itemCOGS` بـ `addCurrency(...)` من `utils.ts`.

### 2.4 `src/components/pos/InvoiceSummaryDisplay.tsx:52` — عرض الخصم الثابت
- استقبال `discountType` كـ prop وعرض `({discount}%)` فقط عندما `discountType === 'percent'`، وإلا عرض المبلغ بالعملة الصحيحة.

---

## المرحلة 3 — تنظيف منخفض الأثر

### 3.1 `src/lib/cloud/invoices-cloud.ts` (`toInvoice` ~106-109)
- استخدام `rawDiscount` المخزّن مباشرة بدلاً من إعادة الحساب من النسبة (إزالة احتمال عدم تطابق rounding).

### 3.2 `src/lib/cloud/debt-sale-handler.ts:162`
- تقريب `total: Math.round(item.price * item.quantity * 100) / 100`.

### 3.3 `CartPanel.tsx` `wholesaleProfit` المتناقض
- إما توحيد المنطق مع `discountedProfit` المُرسَل للسحابة، أو إضافة تعليق صريح يوضح أن `wholesaleProfit` للعرض الفوري فقط (تفضيل التوحيد).

---

## ضوابط السلامة

- **بدون أي تغيير على schema قاعدة البيانات** في المرحلتين 1 و 2 (ما عدا اختياري في 1.2 — لن يُنفَّذ إلا بموافقتك الصريحة).
- **بدون تغيير على RLS، sync-queue، supabase/client.ts**.
- **بدون لمس** الأشياء المُعلَّمة "صحيحة" في التقرير (Mutex, RPC sequencer, reverseProfitCloud, getInvoiceStatsCloud, closeShift...).
- بعد كل مرحلة: التحقق من نجاح build، واختبار يدوي للسيناريوهات الحساسة (بيع نقدي/دين، استرجاع، شراء، إغلاق وردية).

## ترتيب التنفيذ المقترح
المرحلة 1 أولاً (تمنع فساد بيانات) → التحقق → المرحلة 2 → التحقق → المرحلة 3.

هل أبدأ بالمرحلة 1؟ وهل توافق على migration الاختياري في 1.2 (إضافة عمودَي `unit` و `conversion_factor` على `invoice_items`) لإصلاح كامل لمشكلة استرجاع الوحدات المزدوجة؟
