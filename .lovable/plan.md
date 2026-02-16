

## خطة: إصلاح تنسيق الأرقام (إزالة الأصفار الزائدة)

---

### المشكلة

حالياً دالة `formatNumber` تفرض دائماً 3 خانات عشرية، ودالة `formatCurrency` تفرض 2 خانة عشرية:
- `10` يظهر كـ `10.000` او `$10.00`
- `500` يظهر كـ `500.000` او `$500.00`

### الحل

تعديل `minimumFractionDigits` إلى `0` بدلاً من `decimals` في كلتا الدالتين، مع الإبقاء على `maximumFractionDigits` كما هو. هذا يعني:
- `10` سيظهر كـ `10` او `$10`
- `3.85` سيظهر كـ `3.85` او `$3.85`
- `10.5` سيظهر كـ `10.5` او `$10.5`

---

### التغييرات

| الملف | التعديل |
|-------|---------|
| `src/lib/utils.ts` | تعديل `formatNumber`: `minimumFractionDigits: 0` بدلاً من `decimals` |
| `src/lib/utils.ts` | تعديل `formatCurrency`: `minimumFractionDigits: 0` بدلاً من `decimals` |

### التفاصيل التقنية

في `formatNumber` (سطر 43):
```text
قبل: minimumFractionDigits: decimals
بعد: minimumFractionDigits: 0
```

في `formatCurrency` (سطر 53):
```text
قبل: minimumFractionDigits: decimals
بعد: minimumFractionDigits: 0
```

### ملاحظة

- التعديل على واجهة السلة (UI Redesign) تم تنفيذه بالفعل في الرسالة السابقة
- هذه الخطة تركز فقط على الجزء الثاني: إصلاح تنسيق الأرقام
- التغيير سيؤثر على جميع الشاشات تلقائياً (22+ ملف يستخدم `formatNumber` و17+ ملف يستخدم `formatCurrency`)

