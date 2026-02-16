

## خطة: تأثيرات حركية + عداد أرقام + رسم بياني مصغر

---

### 1. عداد أرقام متحرك (Count-Up Animation)

**ملف جديد:** `src/hooks/use-count-up.tsx`

هوك مخصص `useCountUp` يحرك الأرقام من 0 إلى القيمة الفعلية عند التحميل:
- يستقبل `end` (القيمة النهائية) و `duration` (المدة، افتراضياً 800ms)
- يستخدم `requestAnimationFrame` مع easing function (`easeOutExpo`)
- يعيد القيمة الحالية المتحركة كرقم

### 2. تحسين StatCard بالتأثيرات الحركية

**ملف:** `src/components/dashboard/StatCard.tsx`

التغييرات:
- إضافة `useCountUp` لتحريك الأرقام: يتم استخراج الرقم من `value` (إذا كان نصاً مثل `$1,500`) وتحريكه، ثم إعادة تركيبه مع رمز العملة
- إضافة `hover:translate-y-[-2px]` و `hover:shadow-xl` لتأثير رفع عند التمرير
- إضافة `group` class للحاوية و `group-hover:scale-110` للأيقونة
- دعم prop جديد `sparklineData?: number[]` لعرض رسم بياني مصغر

### 3. مكون Sparkline مصغر (SVG)

**ملف جديد:** `src/components/dashboard/MiniSparkline.tsx`

مكون SVG خفيف (بدون مكتبات إضافية) يرسم خط اتجاه:
- يستقبل `data: number[]` (مصفوفة أرقام)
- يرسم polyline بسيط بعرض ~120px وارتفاع ~30px
- لون الخط: `primary` مع تعبئة gradient خفيفة تحت الخط
- يظهر أسفل القيمة في البطاقة

### 4. تمرير بيانات Sparkline من Dashboard

**ملف:** `src/pages/Dashboard.tsx`

التغييرات:
- حساب مبيعات آخر 7 أيام كمصفوفة `dailySales: number[]` من بيانات الفواتير الموجودة
- تمرير `sparklineData={dailySales}` لبطاقة "مبيعات اليوم" فقط
- إضافة state جديد `hourlySales` لبيانات الرسم البياني

---

### الملفات

| الملف | التعديل |
|-------|---------|
| `src/hooks/use-count-up.tsx` | **جديد** - هوك عداد الأرقام المتحرك |
| `src/components/dashboard/MiniSparkline.tsx` | **جديد** - مكون SVG للرسم البياني المصغر |
| `src/components/dashboard/StatCard.tsx` | إضافة count-up + hover effects + دعم sparkline |
| `src/pages/Dashboard.tsx` | حساب بيانات المبيعات اليومية وتمريرها للبطاقة |

---

### التفاصيل التقنية

#### useCountUp Hook
```text
function useCountUp(end: number, duration = 800): number
- يستخدم useRef للتتبع + useEffect للتشغيل
- easing: t => 1 - Math.pow(2, -10 * t) (easeOutExpo)
- يعيد تشغيل الأنيميشن عند تغير end
```

#### MiniSparkline Component
```text
<svg width="100%" height="30" viewBox="0 0 120 30">
  <defs>
    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
    </linearGradient>
  </defs>
  <polygon fill="url(#sparkGrad)" /> <!-- المساحة تحت الخط -->
  <polyline stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" /> <!-- الخط -->
</svg>
```

#### StatCard - التحسينات
- الحاوية: إضافة `group hover:translate-y-[-2px] hover:shadow-xl`
- القيمة: استخدام `useCountUp` لاستخراج الرقم وتحريكه
- sparkline: إذا وُجد `sparklineData`، يظهر `MiniSparkline` أسفل القيمة مباشرة
- الأيقونة: `group-hover:scale-110 transition-transform`

#### Dashboard - حساب بيانات المبيعات
```text
// حساب مبيعات آخر 7 أيام
const last7Days = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - i));
  const dayStr = date.toDateString();
  return invoices
    .filter(inv => new Date(inv.createdAt).toDateString() === dayStr && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.total, 0);
});
```

---

### ملاحظات
- الرسم البياني SVG خفيف جداً (بدون recharts أو مكتبات إضافية) - مناسب للموبايل
- عداد الأرقام يعمل مرة واحدة عند التحميل ويُعاد عند تحديث البيانات
- جميع التأثيرات تستخدم CSS transitions بدون مكتبات إضافية

