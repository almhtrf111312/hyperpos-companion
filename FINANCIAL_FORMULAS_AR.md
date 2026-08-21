# الصيغ الحسابية والعمليات المالية
## Financial Formulas & Calculations Reference Guide

---

## 1. حسابات البيع الأساسية

### 1.1 البيع البسيط (بدون خصم / ضريبة)

```
المتغيرات:
  price = سعر الوحدة (Price per Unit)
  quantity = الكمية (Quantity)
  cost = سعر التكلفة (Cost Price)

الصيغ:
  line_total = price × quantity
  line_profit = (price - cost) × quantity
  profit_margin = (line_profit / line_total) × 100%

مثال:
  سلعة: قميص
  السعر: $50 (للوحدة)
  الكمية: 10
  التكلفة: $30 (للوحدة)
  
  line_total = 50 × 10 = $500
  line_profit = (50 - 30) × 10 = $200
  profit_margin = (200 / 500) × 100% = 40%
```

### 1.2 البيع مع خصم مطلق (قيمة)

```
المتغيرات:
  subtotal = إجمالي المبيعات (Total Before Discount)
  discount_amount = قيمة الخصم (Discount Value) - بالدولار

الصيغ:
  discounted_total = subtotal - discount_amount
  discount_percentage = (discount_amount / subtotal) × 100%

مثال:
  subtotal = $500
  discount_amount = $50
  
  discounted_total = 500 - 50 = $450
  discount_percentage = (50 / 500) × 100% = 10%
```

### 1.3 البيع مع خصم نسبي (نسبة مئوية)

```
المتغيرات:
  subtotal = إجمالي المبيعات
  discount_percentage = نسبة الخصم (كنسبة مئوية)

الصيغ:
  discount_amount = subtotal × (discount_percentage / 100)
  discounted_total = subtotal - discount_amount

مثال:
  subtotal = $500
  discount_percentage = 10%
  
  discount_amount = 500 × (10 / 100) = $50
  discounted_total = 500 - 50 = $450
```

### 1.4 البيع مع ضريبة

```
المتغيرات:
  discounted_total = الإجمالي بعد الخصم
  tax_rate = نسبة الضريبة (كنسبة مئوية)

الصيغ:
  tax_amount = discounted_total × (tax_rate / 100)
  taxable_base = discounted_total
  final_total = discounted_total + tax_amount

مثال:
  discounted_total = $450
  tax_rate = 5%
  
  tax_amount = 450 × (5 / 100) = $22.50
  final_total = 450 + 22.50 = $472.50
```

### 1.5 البيع الكامل (خصم + ضريبة)

```
خطوات الحساب:

الخطوة 1: حساب الخصم
  discount_amount = subtotal × (discount_percentage / 100)
  OR
  discount_amount = [قيمة مدخلة مباشرة]

الخطوة 2: الإجمالي بعد الخصم
  after_discount = subtotal - discount_amount

الخطوة 3: حساب الضريبة على المبلغ بعد الخصم
  tax_amount = after_discount × (tax_rate / 100)

الخطوة 4: الإجمالي النهائي
  final_total = after_discount + tax_amount

مثال شامل:
  ┌─────────────────────────────────────────┐
  │ الفاتورة الشاملة                        │
  ├─────────────────────────────────────────┤
  │ منتج 1: 10 × $50 = $500                │
  │ منتج 2: 5 × $20 = $100                 │
  │ ─────────────────────────────────────   │
  │ الإجمالي الأولي (Subtotal)   = $600    │
  │ الخصم (10%)                  = -$60    │
  │ ─────────────────────────────────────   │
  │ بعد الخصم                    = $540    │
  │ الضريبة (5% على $540)       = +$27    │
  │ ─────────────────────────────────────   │
  │ المجموع النهائي              = $567    │
  │ ═════════════════════════════════════   │
  │ الدفع المطلوب                = $567    │
  └─────────────────────────────────────────┘
```

---

## 2. حسابات الأرباح والخسائر

### 2.1 الربح للمنتج الواحد

```
الصيغة الأساسية:
  item_profit = (sale_price - cost_price) × quantity

أنواع الربح:

1. الربح المطلق (Absolute Profit)
   profit = $100
   
2. نسبة الربح (Profit Margin)
   margin = (profit / sale_price) × 100%
   = (100 / 500) × 100% = 20%
   
3. العائد على التكلفة (Markup)
   markup = (profit / cost_price) × 100%
   = (100 / 400) × 100% = 25%

العلاقة:
  profit = sale_price - cost_price
  profit_percentage = profit / sale_price
  markup_percentage = profit / cost_price

مثال:
  منتج: حاسوب محمول
  سعر البيع: $1000
  سعر التكلفة: $600
  الكمية: 2
  
  profit_per_unit = 1000 - 600 = $400
  total_profit = 400 × 2 = $800
  profit_margin = (400 / 1000) × 100% = 40%
  markup = (400 / 600) × 100% = 66.67%
```

### 2.2 الربح للفاتورة الكاملة (بدون تأثيرات)

```
الصيغة البسيطة:
  total_profit = Σ(sale_price - cost_price) × quantity
                لكل منتج

تفصيل:
  لفاتورة بـ:
    ├─ منتج 1: qty=2, sale=$50, cost=$30
    │  profit = (50-30) × 2 = $40
    │
    ├─ منتج 2: qty=1, sale=$100, cost=$60
    │  profit = (100-60) × 1 = $40
    │
    └─ منتج 3: qty=5, sale=$20, cost=$12
       profit = (20-12) × 5 = $40

  total_profit = $40 + $40 + $40 = $120

دون تأثر من:
  ✓ الخصم لم يؤثر (الأرباح الكاملة = $120)
  ✓ الضريبة لا تؤثر على الربح (الضريبة للحكومة)
```

### 2.3 الربح مع تأثير الخصم (النموذج الأول)

```
الفلسفة:
  الخصم يقلل الإيرادات والهامش، لكن الربح الأساسي يبقى

الصيغة:
  gross_profit_items = Σ(sale_price - cost_price) × quantity
  
  profit_impact_ratio = (discounted_total / subtotal)
  
  net_profit = gross_profit_items × profit_impact_ratio

مثال:
  subtotal = $500
  discount = $50
  discounted total = $450
  profit_impact_ratio = 450 / 500 = 0.9 (90%)
  
  gross_profit_items = $120
  net_profit = $120 × 0.9 = $108
  
  التفسير: خسرنا $12 من الأرباح بسبب الخصم
```

### 2.4 الربح مع تأثير الخصم (النموذج الثاني)

```
الفلسفة:
  الخصم يؤثر على كل منتج بنسبة متساوية

الخطوات:

1. حساب الربح الإجمالي للمنتجات
   total_profit = Σ(sale - cost) × qty = $120

2. حساب نسبة الخصم من الإجمالي
   discount_ratio = discount / subtotal
   = 50 / 500 = 0.1 (10%)

3. حساب تقليل الربح
   profit_reduction = total_profit × discount_ratio
   = 120 × 0.1 = $12

4. الربح النهائي
   net_profit = total_profit - profit_reduction
   = 120 - 12 = $108

النتيجة نفسها من النموذج الأول!
لكن الطريقة أفضل للفهم والتطبيق
```

### 2.5 التكلفة الإجمالية للبضاعة المباعة (COGS)

```
المتغيرات:
  COGS = Cost of Goods Sold

الصيغة:
  COGS = Σ(cost_price × quantity) لكل منتج

مثال:
  منتج 1: cost=$30, qty=2 → COGS=$60
  منتج 2: cost=$60, qty=1 → COGS=$60
  منتج 3: cost=$12, qty=5 → COGS=$60
  
  total_COGS = $60 + $60 + $60 = $180

ثم:
  gross_profit = sale_price - COGS
  = (منتج1+منتج2+منتج3) - COGS
  = $300 - $180 = $120
```

---

## 3. حسابات الديون والسداد

### 3.1 سجل الدين المبدئي

```
عند البيع بالدين:
  total_debt = final_total (المبلغ النهائي)
  total_paid = 0
  remaining_debt = total_debt
  status = 'due'
  due_date = today + 30 days

مثال:
  البيع: $500 (بدون خصم)
  ضريبة: $25 (5%)
  المجموع: $525
  
  → الدين المبدئي = $525
  → المبلغ المسدد = $0
  → المتبقي = $525
  → تاريخ الاستحقاق = 2026-09-22
```

### 3.2 عملية السداد الجزئي

```
الصيغ:
  new_total_paid = total_paid + payment_amount
  new_remaining = total_debt - new_total_paid

حالة السداد:
  if new_remaining <= 0 → status = 'fully_paid'
  else if new_total_paid > 0 → status = 'partially_paid'
  else → status = 'due'

مثال (تسلسل):
  الدين الأصلي: $1000
  
  السداد 1: $300
    new_paid = 0 + 300 = $300
    new_remaining = 1000 - 300 = $700
    status = 'partially_paid'
  
  السداد 2: $400
    new_paid = 300 + 400 = $700
    new_remaining = 1000 - 700 = $300
    status = 'partially_paid'
  
  السداد 3: $300
    new_paid = 700 + 300 = $1000
    new_remaining = 1000 - 1000 = $0
    status = 'fully_paid'
```

### 3.3 نسبة السداد (للأرباح المعلقة)

```
عند سداد ديْن جزئي:
  
النسبة المحققة:
  payment_ratio = payment_amount / total_debt

مثال:
  الدين الأصلي: $1000
  الربح المسجل: $200 (معلق)
  
  السداد: $500
  payment_ratio = 500 / 1000 = 0.5 (50%)
  
  الربح المؤكد = $200 × 0.5 = $100
  الربح المتبقي = $200 × 0.5 = $100

طريقة التطبيق:
  for each pending_profit_entry:
    confirmed_amount = entry.amount × payment_ratio
    update partner:
      pending_profit -= confirmed_amount
      confirmed_profit += confirmed_amount
      current_balance += confirmed_amount
```

---

## 4. توزيع الأرباح على الشركاء

### 4.1 التوزيع البسيط (شريك واحد)

```
الصيغة:
  partner_share = total_profit × (partner_percentage / 100)

مثال:
  الربح الإجمالي: $1000
  نسبة الشريك: 30%
  
  partner_share = 1000 × (30 / 100) = $300
```

### 4.2 التوزيع المتعدد (عدة شركاء)

```
الحالة: عدة شركاء، كل واحد يأخذ نسبة

total_profit = $1000

الشريك 1: 30% → $300
الشريك 2: 40% → $400
الشريك 3: 30% → $300
────────────────────
المجموع: 100% → $1000

الصيغة:
  partner_i_share = total_profit × (partner_i_percentage / 100)
  
validation:
  Σ(partner_percentage) must = 100%
```

### 4.3 التوزيع حسب الفئات (متقدم)

```
السيناريो:
  شريك 1: متخصص في ال electronics (30%)
  شريك 2: عام (يأخذ من كل شيء) (50%)
  شريك 3: عام (50%)

الفاتورة:
  electronics: $500 profit
  clothing: $300 profit
  ─────────────────
  total: $800 profit

الخطوات:

Step 1: توزيع على المتخصصين
  الربح من electronics = $500
  الشريك 1 (متخصص): $500 × 30% = $150
  
  remaining_profit = $800 - $150 = $650

Step 2: توزيع على العام من المتبقي
  total_general_share = 50% + 50% = 100%
  
  الشريك 2: $650 × (50/100) = $325
  الشريك 3: $650 × (50/100) = $325

النتيجة:
  الشريك 1: $150
  الشريك 2: $325
  الشريك 3: $325
  ────────────
  المجموع: $800 ✓
```

### 4.4 معاملة الأرباح المعلقة مقابل المؤكدة

```
شراء نقدي:
  immediate_profit = ✅ مؤكد فوراً
  added_to: confirmed_profit + current_balance
  
شراء بالدين:
  pending_profit = ⏳ معلق حتى السداد الكامل
  added_to: pending_profit + pending_profit_details

التحويل عند السداد الكامل:
  pending_profit → confirmed_profit
  confirmed_profit + current_balance
```

---

## 5. حسابات المرتجعات

### 5.1 المرتجع الكامل

```
الفاتورة الأصلية:
  subtotal: $500
  discount: $50
  tax: $22.50
  total: $472.50
  profit: $100

عند المرتجع الكامل:
  ✓ استعادة المخزون: +2 units
  ✓ من الصندوق: -$472.50
  ✓ من الأرباح: -$100
  ✓ من ديون العميل: -$472.50
  
الإلغاء الكامل للفاتورة
```

### 5.2 المرتجع الجزئي (غير مدعوم حالياً)

```
الفاتورة الأصلية:
  منتج 1: qty=2, price=$100 → $200
  منتج 2: qty=1, price=$300 → $300
  ─────────────────────────
  subtotal: $500

المرتجع الجزئي:
  منتج 1: qty=1 (نصف الكمية)
  المبلغ المسترجع: $100
  
النتيجة:
  الفاتورة المتبقية: $400
  المخزون المستعاد: +1 unit
  من الصندوق: -$100
  من الأرباح: -$40 (نسبي)
```

---

## 6. المشاكل الحسابية المعروفة

### ⚠️ مشكلة التقريب (Rounding)

```
المشكلة:
  القسمة قد تعطي أرقام عشرية غير دقيقة
  
مثال:
  subtotal = $100
  discount = 33.33%
  discount_amount = 100 × (33.33 / 100) = $33.33
  
  لكن بعد الخصم: $100 - $33.33 = $66.67
  
  إذا كان هناك 3 منتجات:
    منتج 1: $33.33 - $11.11 = $22.22 ← 1 سنت مفقود!
    منتج 2: $33.33 - $11.11 = $22.22 ← 1 سنت مفقود!
    منتج 3: $33.34 - $11.12 = $22.22 ← تصحيح

☑️ الحل:
  استخدام banker's rounding
  أو تطبيق الخصم على آخر منتج
```

### ⚠️ مشكلة الضريبة على الخصم

```
السؤال: على من تُحسب الضريبة؟

❌ الطريقة الخاطئة:
  tax = (subtotal) × tax_rate
  = $500 × 5% = $25
  
  total = $500 - $50 + $25 = $475
  (الضريبة على المبلغ الأصلي)

✅ الطريقة الصحيحة:
  tax = (subtotal - discount) × tax_rate
  = $450 × 5% = $22.50
  
  total = $500 - $50 + $22.50 = $472.50
  (الضريبة على المبلغ المخفّض)

التطبيق الحالي: ✅ الطريقة الصحيحة
```

### ⚠️ مشكلة الربح والضريبة

```
السؤال: هل الضريبة تزيد الربح؟

❌ الإجابة الخاطئة:
  sale_price = $100
  cost_price = $60
  tax = $5
  
  total = $105
  profit = $105 - $60 = $45 ❌ (خطأ!)

✅ الإجابة الصحيحة:
  sale_price = $100
  cost_price = $60
  profit = $100 - $60 = $40 ✓
  
  (الضريبة ليست ربح الشركة، تُودع للحكومة)
  
الربح النوعي = (profit / sale_price) × 100%
             = (40 / 100) × 100% = 40%
             (لا تتأثر بالضريبة)

التطبيق الحالي: ✅ صحيح (لا يضيف الضريبة للربح)
```

---

## 7. أمثلة عملية كاملة

### مثال 1: فاتورة بسيطة (نقدي)

```
البيانات:
  ├─ منتج 1: حذاء رياضي
  │  ├─ السعر: $80
  │  ├─ التكلفة: $45
  │  └─ الكمية: 1
  │
  ├─ منتج 2: جوارب
  │  ├─ السعر: $10
  │  ├─ التكلفة: $4
  │  └─ الكمية: 3
  │
  ├─ الخصم: $5
  └─ الضريبة: 5%

الحسابات:

Step 1: الإجماليات للمنتجات
  منتج 1: $80 × 1 = $80
  منتج 2: $10 × 3 = $30
  subtotal = $80 + $30 = $110

Step 2: الخصم
  discount = $5
  after_discount = $110 - $5 = $105

Step 3: الضريبة
  tax = $105 × 5% = $5.25
  final_total = $105 + $5.25 = $110.25

Step 4: الأرباح
  profit_1 = ($80 - $45) × 1 = $35
  profit_2 = ($10 - $4) × 3 = $18
  total_profit_before = $35 + $18 = $53
  
  profit_impact = discount / subtotal = 5 / 110 = 0.0455 (4.55%)
  profit_loss = $53 × 0.0455 = $2.41
  net_profit = $53 - $2.41 = $50.59

النتيجة:
  ┌────────────────────────────────┐
  │ الفاتورة النهائية             │
  ├────────────────────────────────┤
  │ المجموع الأول        = $110.00 │
  │ الخصم               = -$5.00   │
  │ بعد الخصم           = $105.00  │
  │ الضريبة (5%)        = +$5.25   │
  ├────────────────────────────────┤
  │ الإجمالي النهائي     = $110.25  │
  │ الربح الفعلي        = $50.59   │
  │ نسبة الربح           = 45.9%    │
  └────────────────────────────────┘
```

### مثال 2: فاتورة بالدين مع سداد

```
اليوم الأول (2026-08-22):

البيع:
  ├─ منتج: هاتف ذكي
  ├─ السعر: $500
  ├─ التكلفة: $300
  ├─ الكمية: 1
  ├─ نوع الدفع: ديْن
  └─ العميل: علي

الحسابات:
  subtotal = $500
  tax (5%) = $25
  final_total = $525
  profit = $500 - $300 = $200 (معلق)

النتيجة:
  الفاتورة: INV-001 (status: pending)
  الدين: DBT-20260822-001
  ├─ total_debt: $525
  ├─ total_paid: $0
  ├─ remaining: $525
  └─ due_date: 2026-09-22

بعد 5 أيام (2026-08-27):

السداد الأول: $200
  new_paid = $0 + $200 = $200
  new_remaining = $525 - $200 = $325
  status = 'partially_paid'
  
  الأرباح:
    ratio = $200 / $525 = 0.381 (38.1%)
    profit_confirmed = $200 × 0.381 = $76.2
    profit_pending = $200 × 0.619 = $123.8

بعد 10 أيام من البيع (2026-09-01):

السداد الثاني: $325
  new_paid = $200 + $325 = $525
  new_remaining = $525 - $525 = $0
  status = 'fully_paid'
  
  الأرباح:
    ratio = $325 / $525 = 0.619 (61.9%)
    profit_confirmed = $200 × 0.619 = $123.8
    profit_pending = $0

النتيجة النهائية:
  ├─ الفاتورة: status = paid
  ├─ الدين: status = fully_paid
  ├─ الصندوق: +$525 ✓
  ├─ الأرباح: $200 مؤكدة ✓
  └─ العميل: debt_remaining = $0
```

---

## 8. جدول الصيغ السريعة

| العملية | الصيغة | مثال |
|:---|:---|:---|
| **سعر البيع** | qty × price | 2 × $50 = $100 |
| **الربح الأساسي** | (price - cost) × qty | (50-30) × 2 = $40 |
| **الخصم (%)** | total × (% / 100) | 100 × (10/100) = $10 |
| **الضريبة** | (total - discount) × (tax% / 100) | (100-10) × (5/100) = $4.50 |
| **الإجمالي** | total - discount + tax | 100 - 10 + 4.50 = $94.50 |
| **نسبة الربح** | (profit / price) × 100% | (40 / 100) × 100% = 40% |
| **الدين المتبقي** | total_debt - total_paid | 500 - 200 = $300 |
| **نسبة السداد** | paid / total_debt | 200 / 500 = 0.4 (40%) |
| **حصة الشريك** | profit × (% / 100) | 1000 × (30/100) = $300 |
| **COGS** | Σ(cost × qty) | (30×2) + (60×1) = $120 |

---

*آخر تحديث: أغسطس 2026*
*المرجع: الحسابات والصيغ الدقيقة للنظام المالي*
