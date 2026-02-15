

## خطة: نظام الضريبة المتكامل + التحكم بالخصومات

---

### نظرة عامة
تفعيل نظام الضريبة الموجود فعلاً في قاعدة البيانات (`tax_enabled`, `tax_rate`) وربطه بالإعدادات ونقطة البيع، مع إضافة إمكانية تعطيل/تفعيل الخصومات من الإعدادات.

---

### التغييرات المطلوبة

#### 1. تعديل `Settings.tsx` - إضافة إعدادات الضريبة والخصومات

في تبويب "المتجر" (`store`):
- إضافة قسم **الضريبة** بعد أسعار الصرف:
  - مفتاح تفعيل/تعطيل الضريبة (Switch)
  - حقل نسبة الضريبة (يظهر فقط عند التفعيل)
- إضافة قسم **التحكم بالخصومات**:
  - مفتاح تفعيل خصم النسبة المئوية (Switch)
  - مفتاح تفعيل خصم المبلغ الثابت (Switch)

إضافة states جديدة:
- `taxEnabled` (boolean) - يُقرأ من `localStorage` → `CloudSyncProvider`
- `taxRate` (number) - نسبة الضريبة
- `discountPercentEnabled` (boolean) - تفعيل خصم النسبة
- `discountFixedEnabled` (boolean) - تفعيل خصم المبلغ

حفظ هذه القيم مع `saveStoreSettings` للسحابة ومع `savePersistedSettings` محلياً.

#### 2. تعديل `CartPanel.tsx` - تفعيل الضريبة الديناميكية

التغييرات:
- قراءة `taxEnabled` و `taxRate` من `localStorage` (الإعدادات المحفوظة) بدل القيمة الثابتة `0`
- إضافة RadioGroup لاختيار نوع الضريبة:
  - "بدون ضريبة" (الافتراضي)
  - "شامل الضريبة" (السعر يتضمن الضريبة)
- عرض سطر الضريبة في الملخص (يختفي إذا الضريبة معطلة)
- قراءة `discountPercentEnabled` و `discountFixedEnabled` وإخفاء حقول الخصم المعطلة

حساب الضريبة:
- وضع "بدون ضريبة": المجموع + الضريبة = الإجمالي
- وضع "شامل الضريبة": السعر يحتوي الضريبة (الضريبة = السعر × النسبة / (100 + النسبة))

#### 3. تعديل `handleSaveSettings` في `Settings.tsx`

إضافة `tax_enabled` و `tax_rate` لاستدعاء `saveStoreSettings()`:

```text
await saveStoreSettings({
  ...الحقول الحالية,
  tax_enabled: taxEnabled,
  tax_rate: taxRate,
});
```

#### 4. تعديل `PersistedSettings` interface

إضافة الحقول الجديدة:
- `taxEnabled?: boolean`
- `taxRate?: number`
- `discountPercentEnabled?: boolean`
- `discountFixedEnabled?: boolean`

#### 5. تعديل `CloudSyncProvider.tsx`

التأكد من أن `taxEnabled` و `taxRate` يُحفظان في localStorage بشكل صحيح عند المزامنة (موجود حالياً - فقط التأكد من الحقول الجديدة للخصومات).

---

### الملفات المعدلة

| الملف | التغيير |
|-------|---------|
| `src/pages/Settings.tsx` | إضافة states للضريبة والخصومات + UI في تبويب المتجر + حفظ للسحابة |
| `src/components/pos/CartPanel.tsx` | قراءة إعدادات الضريبة + RadioGroup للنوع + إخفاء خصومات معطلة + عرض سطر الضريبة |

---

### التفاصيل التقنية

#### قراءة الإعدادات في CartPanel

```text
// قراءة من localStorage
const settings = JSON.parse(localStorage.getItem('hyperpos_settings_v1') || '{}');
const storeTaxEnabled = settings.taxEnabled ?? false;
const storeTaxRate = settings.taxRate ?? 0;
const discountPercentEnabled = settings.discountPercentEnabled ?? true;
const discountFixedEnabled = settings.discountFixedEnabled ?? true;
```

#### حساب الضريبة حسب الوضع

```text
وضع "بدون ضريبة" (net):
  taxAmount = taxableAmount * taxRate / 100
  total = taxableAmount + taxAmount

وضع "شامل الضريبة" (gross):
  taxAmount = taxableAmount * taxRate / (100 + taxRate)
  total = taxableAmount  (السعر يحتوي الضريبة أصلاً)
```

#### UI الخصومات عند التعطيل

```text
إذا discountPercentEnabled = false:
  → إخفاء حقل خصم النسبة المئوية

إذا discountFixedEnabled = false:
  → إخفاء حقل خصم المبلغ الثابت

إذا كلاهما معطل:
  → عرض رسالة "الخصومات معطلة من الإعدادات"
```

#### مثال عملي

```text
الإعدادات:
  الضريبة: مفعلة 15%
  خصم النسبة: مفعل
  خصم المبلغ: معطل

السلة:
  برجر × 2 = 40,000
  بيتزا × 1 = 75,000
  المجموع الفرعي: 115,000
  خصم 10%: -11,500
  بعد الخصم: 103,500
  الضريبة 15%: +15,525
  الإجمالي: 119,025
```

---

### ملاحظة
لا حاجة لتعديل قاعدة البيانات - الأعمدة `tax_enabled` و `tax_rate` موجودة فعلاً في جدول `stores`. الخصومات (`discountPercentEnabled`, `discountFixedEnabled`) ستُحفظ ضمن `sync_settings` JSON.

