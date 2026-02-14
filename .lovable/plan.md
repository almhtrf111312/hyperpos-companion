

# تقرير شامل + خطة إصلاح: مشاكل التصميم والتوافق RTL/LTR

---

## المشكلة الرئيسية: أزرار الحفظ العائمة (FABs) تتداخل مع القائمة الجانبية

### السبب
في كلا الصفحتين (المظهر والإعدادات)، الأزرار العائمة تستخدم:
```text
isRTL ? "right-6" : "left-6"
```
هذا يضعها على **نفس جهة** القائمة الجانبية (القائمة على اليمين في RTL، على اليسار في LTR).

### الإصلاح
عكس الاتجاه ليصبح:
```text
isRTL ? "left-6" : "right-6"
```

**الملفات المتأثرة:**
- `src/pages/Appearance.tsx` (سطر 57)
- `src/pages/Settings.tsx` (سطر 1706)

---

## تقرير التدقيق الشامل: مشاكل التوافق RTL/LTR

### المشكلة 1: حشوة الهيدر (pr-14) ثابتة على اليمين فقط

**الوصف:** معظم الصفحات تستخدم `pr-14 md:pr-0` لتجنب تداخل زر القائمة مع العنوان. لكن هذا يعمل فقط في وضع RTL (حيث زر القائمة على اليمين). في وضع LTR، زر القائمة على اليسار، فيجب أن تكون الحشوة `pl-14`.

**الصفحات المتأثرة (10 صفحات):**

| الصفحة | السطر | الكود الحالي |
|--------|-------|-------------|
| Dashboard.tsx | 199 | `pr-14 md:pr-0` |
| Settings.tsx | 1491 | `pr-14 md:pr-0` |
| Products.tsx | 685 | `pr-14 md:pr-6` |
| Invoices.tsx | 469 | `pr-14 md:pr-0` |
| Customers.tsx | 238 | `pr-14 md:pr-0` |
| Debts.tsx | 325 | `pr-14 md:pr-0` |
| Expenses.tsx | 289 | `pr-14 md:pr-0` |
| Partners.tsx | 476 | `pr-14 md:pr-0` |
| Services.tsx | 370 | `pr-14 md:pr-0` |
| CashShifts.tsx | 173 | `pr-14 md:pr-0` |
| Reports.tsx | 819 | `pr-14 md:pr-0` |

**الإصلاح:** استبدال `pr-14` بـ `rtl:pr-14 ltr:pl-14` في كل صفحة.

### المشكلة 2: شارة عدد السلة في POS ثابتة على اليسار

**الملف:** `src/components/pos/POSHeader.tsx` (سطر 44)

**الكود الحالي:** `absolute -top-1 -left-1`

**المشكلة:** شارة العدد فوق زر السلة دائماً على اليسار. في RTL يجب أن تكون على اليمين.

**الإصلاح:** تغيير إلى `absolute -top-1 ltr:-left-1 rtl:-right-1`

---

## خطة التنفيذ

### الملفات والتعديلات

| الملف | التعديل |
|-------|---------|
| `src/pages/Appearance.tsx` | عكس اتجاه FABs |
| `src/pages/Settings.tsx` | عكس اتجاه FABs |
| `src/pages/Dashboard.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Products.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Invoices.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Customers.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Debts.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Expenses.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Partners.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Services.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/CashShifts.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/pages/Reports.tsx` | إصلاح حشوة الهيدر RTL/LTR |
| `src/components/pos/POSHeader.tsx` | إصلاح شارة السلة RTL |

كل تعديل بسيط: سطر واحد أو سطرين في كل ملف.

