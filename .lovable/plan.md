# خطة نظام التقارير المتقدم — FlowPOS Pro

## الأهداف العامة
1. توحيد واجهة التقارير بين الويب و APK (نفس البطاقة الكبيرة، تبويبات أفقية بثلاثة أعمدة، فلاتر داخل صندوق، أزرار PDF/Excel كبيرة وواضحة).
2. دقة الفلترة: عند اختيار منتج/عميل/شريك/كاشير محدد → تظهر حركات هذا العنصر فقط (لا تقرير عام).
3. توحيد مصدر البيانات بين العرض والتصدير (نفس الفلاتر المُطبّقة).
4. Local-First: قراءة من IndexedDB فوراً + مزامنة في الخلفية.

---

## المرحلة 1 — البنية التحتية لقاعدة البيانات

### جداول جديدة (Migration)
- **`stock_counts`** — جلسات الجرد الفعلي
  - حقول الأعمال: warehouse_id, count_date, status (draft/completed), notes, counted_by, total_variance_value
- **`stock_count_items`** — أصناف داخل كل جرد
  - product_id, expected_qty (من النظام), actual_qty (من الجرد), variance, unit_cost, variance_value
- **`stock_damages`** — الإتلاف/التلف
  - product_id, warehouse_id, quantity, reason, cost_value, damaged_at, recorded_by, notes
- **`activity_log`** (سحابي) — سجل النشاط الموحد
  - user_id (owner), actor_id, actor_name, action_type, entity_type, entity_id, description, metadata jsonb, created_at

كل الجداول: RLS عبر `get_owner_id(auth.uid())` + فهارس على `(user_id, created_at)` و `(product_id)`.

### دوال مساعدة
- `get_product_movement(_product_id, _from, _to)` — تُرجع حركات منتج (شراء/بيع/مرتجع/إتلاف/تحويل) كـ union.
- `get_inventory_value(_owner_id, _warehouse_id)` — يحسب قيمة العهدة بسعر التكلفة.

---

## المرحلة 2 — توحيد واجهة التقارير (UI/UX)

### مكوّن `ReportShell` موحّد
```text
┌─────────────────────────────────────┐
│  [أيقونة] عنوان التقرير الكبير       │  ← بطاقة هيدر متدرجة
│  وصف موجز                            │
├─────────────────────────────────────┤
│  [اليوم][أسبوع][شهر][مخصص]          │  ← شريط فترات
│  ┌─────────────────────────────┐    │
│  │ بحث | فلتر1 | فلتر2 | مسح   │    │  ← صندوق فلاتر
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  [📄 PDF]  [📊 Excel]  [🖨 طباعة]   │  ← شريط أدوات ثابت أسفل/أعلى
├─────────────────────────────────────┤
│  3 تبويبات أفقية بأعمدة كبيرة:       │
│  [ملخص] [تفاصيل] [رسم بياني]        │
└─────────────────────────────────────┘
```

- إعادة بناء `Reports.tsx` لاستخدام `ReportShell` على جميع التقارير.
- شريط الأدوات يبقى ضمن الـ viewport (sticky على الموبايل، لا overflow أفقي).
- مكوّن `EntityPicker` جديد (منتج/عميل/شريك/كاشير) يُحقن داخل أي تقرير لتفعيل وضع "تقرير عنصر محدد".

---

## المرحلة 3 — تقارير المنتجات والمخزون (القسم 2.1)

### 3.1 تقرير حركة منتج محدد
- صفحة `ProductMovementReport.tsx` ضمن Reports.
- اختيار منتج عبر `EntityPicker` (بحث بالاسم/الباركود).
- جدول موحّد: التاريخ | النوع (🟢 شراء / 🔴 بيع / 🟡 مرتجع / ⚫ إتلاف / 🔵 تحويل) | الكمية | السعر | الرصيد بعد العملية | المرجع (رقم فاتورة).
- ملخص علوي: إجمالي داخل، إجمالي خارج، صافي الحركة، الربح المحقق.
- المصدر: `get_product_movement()` + IndexedDB كـ cache.

### 3.2 تقرير المخزون والجرد
- صفحة `InventoryStockReport.tsx`:
  - عرض الكميات لكل منتج × مستودع (Pivot table).
  - زر "بدء جرد فعلي" → ينشئ `stock_counts` بحالة draft.
  - شاشة إدخال الجرد: لكل صنف input للكمية الفعلية → فرق فوري + قيمة مالية للفرق.
  - عند الإغلاق: حفظ + خيار تسوية تلقائية (تعديل `products.quantity` + إنشاء `stock_damages` للنقص).
- تقرير الجرود السابقة: قائمة بكل عمليات الجرد مع ملخص الفروقات.

### 3.3 تقرير قيمة العهدة
- بطاقات KPI: إجمالي قيمة المخزون (تكلفة)، إجمالي قيمة بيع متوقعة، الربح الكامن، عدد الأصناف، عدد القطع.
- تجميع حسب: التصنيف / المستودع / المورّد.
- رسم دائري لتوزيع قيمة العهدة على التصنيفات.

### 3.4 تقرير الأكثر مبيعاً وربحية
- جدول مزدوج التبويب: [الأكثر كمية] [الأكثر إيراداً] [الأكثر ربحاً].
- لكل منتج: الكمية المباعة، الإيراد، التكلفة، الربح، هامش %، رسم sparkline للاتجاه.
- فلاتر: الفترة، التصنيف، الكاشير، المستودع.

---

## المرحلة 4 — توحيد التصدير

- Helper موحّد `buildReportDataset(reportType, filters)` يُرجع نفس الـ dataset المعروض.
- `exportPDF` و `exportExcel` يستقبلان dataset جاهز (لا يُعيدان جلب البيانات).
- لكل تقرير: schema أعمدة محدد + اسم ملف افتراضي يحوي اسم التقرير + الفترة.
- منع التصدير العام عند اختيار عنصر محدد → التصدير يقتصر على بيانات العنصر فقط.

---

## المرحلة 5 — الأداء (Local-First)

- توسيع IndexedDB (`indexeddb-cache.ts`) ليشمل stores: `purchase_invoices`, `stock_counts`, `stock_damages`, `activity_log`.
- تقارير المخزون تقرأ من IndexedDB أولاً، ثم refresh من السحابة في الخلفية مع badge "جاري التحديث".
- Worker خفيف لحساب التجميعات الثقيلة (top products) خارج الـ main thread.

---

## المرحلة 6 — التحقق

- اختبار على viewport 375×644: لا overflow أفقي، الأزرار كاملة، التبويبات قابلة للسحب.
- اختبار اختيار منتج محدد → التقرير + التصدير يعرضان هذا المنتج فقط.
- مطابقة الجرد الفعلي مع الرصيد الدفتري وإنشاء `stock_damages` تلقائياً للنقص.
- مقارنة PDF/Excel مع الجدول المعروض (نفس الصفوف، نفس الإجماليات).

---

## التفاصيل التقنية (مرجع)

**ملفات جديدة:**
- `supabase/migrations/<ts>_reports_infrastructure.sql`
- `src/components/reports/ReportShell.tsx`
- `src/components/reports/EntityPicker.tsx`
- `src/components/reports/ProductMovementReport.tsx`
- `src/components/reports/InventoryStockReport.tsx`
- `src/components/reports/StockCountDialog.tsx`
- `src/components/reports/InventoryValueReport.tsx`
- `src/components/reports/TopProductsReport.tsx`
- `src/lib/cloud/stock-counts-cloud.ts`
- `src/lib/cloud/stock-damages-cloud.ts`
- `src/lib/cloud/activity-log-cloud.ts`
- `src/lib/reports/dataset-builder.ts`

**ملفات معدّلة:**
- `src/pages/Reports.tsx` — تبني `ReportShell` + ربط التقارير الجديدة.
- `src/components/reports/ReportFiltersBar.tsx` — دعم EntityPicker.
- `src/lib/excel-export.ts` & `src/lib/pdf-export.ts` — APIs موحّدة تستقبل dataset.
- `src/lib/indexeddb-cache.ts` — stores جديدة.
- `src/lib/activity-log.ts` — كتابة محلية + سحابية.

**الأقسام التالية (بانتظار إرسالك):** المبيعات، الديون، المصاريف، الشركاء، الكاشير، الصيانة، المكتبة... ستُضاف كمراحل لاحقة فوق نفس البنية.

هل أبدأ التنفيذ بهذا الترتيب؟