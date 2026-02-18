
## المشكلتان وخطة الإصلاح

### المشكلة 1: الصفر الثابت بجانب كل منتج في الـ POS

**تشخيص الجذر:**

في `src/components/products/DualUnitDisplay.tsx`، المكوّن `DualUnitDisplayCompact` يعرض `totalPieces` من الـ `product.quantity`.

في `src/pages/POS.tsx` عند تحميل المنتجات (السطر 247):
```
quantity: p.quantity, // Default quantity from products table
```

الكمية يتم تمريرها بشكل صحيح من قاعدة البيانات، لكن المشكلة في `DualUnitDisplayCompact`:

```tsx
if (!conversionFactor || conversionFactor <= 1) {
  return (
    <span className="text-[10px] md:text-xs text-muted-foreground">
      {totalPieces} {smallUnit}
    </span>
  );
}

const fullBulkUnits = Math.floor(totalPieces / conversionFactor);
// إذا conversionFactor > 1، يعرض: {fullBulkUnits} {bulkUnit}
// مثلاً: إذا الكمية 10 وmعامل التحويل 12 → 0 كرتونة ✗
```

**السبب الفعلي:** عندما يكون `conversionFactor > 1`، يعرض المكوّن عدد الكراتين الكاملة فقط (`Math.floor(10/12) = 0`) ويُخفي القطع المتبقية إذا كانت أقل من كرتونة كاملة. هذا ما يظهر كـ "صفر" حتى لو الكمية الفعلية 5 أو 10 قطع.

**الحل:** تعديل `DualUnitDisplayCompact` ليعرض دائماً القيمة الأكثر فائدة:
- إذا كانت كرتونة كاملة أو أكثر: يعرض `X كرتونة + Y قطعة`
- إذا كانت أقل من كرتونة: يعرض مباشرة القطع بدلاً من صفر كراتين
- إذا `conversionFactor = 1`: يعرض القطع مباشرة (الحال الحالي يعمل)

---

### المشكلة 2: الخصم بالعملة الأجنبية (TRY/SYP) لا يُحسب بالدولار بشكل صحيح

**تشخيص الجذر:**

في `CartPanel.tsx` السطور 250-252:
```tsx
const discountAmount = discountType === 'percent'
  ? (subtotal * discount) / 100
  : Math.min(discount, subtotal); // Fixed amount should not exceed subtotal
```

والمشكلة هنا: عندما يُدخل المستخدم خصم ثابت `fixed` بالعملة المحددة (مثلاً 10 ليرة تركية)، يُعامَل الرقم `10` كـ دولار (`10 USD`)، وليس كـ `10 TRY`.

**مثال المشكلة:**
- السعر الإجمالي: `$3` → بالتركي `3 × 32 = 96 ₺`
- المستخدم يختار TRY ويُدخل خصم ثابت `10 ₺`
- النظام يخصم `$10` بدلاً من `$10 / 32 = $0.31`
- النتيجة: الفاتورة تصبح خاطئة حسابياً

**الحل:**
عند `discountType === 'fixed'`:
- إذا العملة المختارة USD → لا تغيير (الخصم بالدولار مباشرة)
- إذا العملة TRY أو SYP → تحويل قيمة الخصم إلى USD أولاً بقسمتها على معدل الصرف، ثم استخدام القيمة المحوّلة في حساب `discountAmount`

```
discountInUSD = discount / selectedCurrency.rate
```

يُطبَّق هذا على حسابات `discountAmount` وما يُرسَل في `confirmCashSale` و`confirmDebtSale` وما يُطبع في الفاتورة.

---

## خطة التنفيذ

### الملفات التي سيتم تعديلها:

**1. `src/components/products/DualUnitDisplay.tsx`**

تعديل `DualUnitDisplayCompact` لمعالجة الحالة التي تكون فيها القطع أقل من كرتونة واحدة:

```
السلوك الحالي:
- 5 قطع، conversionFactor=12 → "0 كرتونة" ✗

السلوك الجديد:
- 5 قطع، conversionFactor=12 → "5 قطعة" ✓  (لأن 5 < 12)
- 15 قطع، conversionFactor=12 → "1 كرتونة +3" ✓
- 24 قطع، conversionFactor=12 → "2 كرتونة" ✓
```

**2. `src/components/pos/CartPanel.tsx`**

تعديل حساب `discountAmount` لمراعاة العملة المختارة عند الخصم الثابت:

```
السلوك الحالي (خاطئ):
- خصم ثابت 10 TRY → يخصم $10 من الإجمالي ✗

السلوك الجديد (صحيح):
- خصم ثابت 10 TRY (معدل 32) → يخصم $0.31 من الإجمالي ✓
- الفاتورة تُسجّل بالدولار الصحيح ✓
```

تحديث المواضع التالية في `CartPanel.tsx`:
- حساب `discountAmount` (السطر ~250): إضافة تحويل العملة للخصم الثابت
- نص الـ `placeholder` في حقل الخصم الثابت ليُظهر رمز العملة المختارة
- عرض مبلغ الخصم في "Info chips" بعملة الفاتورة الصحيحة

**ملاحظة مهمة:** قيمة `discount` المُدخلة تبقى كما هي في الحالة المحلية (بوحدة العملة المختارة)، لكن كل الحسابات الحقيقية تستخدم `discountAmount` المحوّلة إلى USD.
