

## خطة: تحسين المظهر الاحترافي للتطبيق (UI Polish)

---

### ملخص

التطبيق يمتلك بالفعل بنية تصميمية قوية (ثيمات متعددة، نظام Glassmorphism، خطوط Cairo/Inter). التحسينات المطلوبة هي "لمسات نهائية" على 4 مكونات أساسية لرفع المستوى البصري.

---

### التغييرات المطلوبة

#### 1. القائمة الجانبية - Sidebar (`src/components/layout/Sidebar.tsx`)

**الحالي:** القائمة ملتصقة بحافة الشاشة بتصميم مسطح.

**الجديد:**
- جعل القائمة "عائمة" بهامش داخلي (m-2 على Desktop) مع حواف دائرية (rounded-2xl)
- تحسين العنصر النشط: خلفية primary/10 مع حواف rounded-xl وشريط جانبي أعرض
- زيادة المسافة بين العناصر (space-y-1 بدلاً من space-y-0.5)
- إضافة ظل خفيف على القائمة (shadow-xl)

#### 2. النوافذ المنبثقة - Dialog (`src/components/ui/dialog.tsx`)

**الحالي:** `bg-black/80` بدون blur، حواف `sm:rounded-lg`، ظل `shadow-lg`.

**الجديد:**
- Overlay: `bg-black/60 backdrop-blur-sm` لتأثير العمق
- المحتوى: `rounded-2xl shadow-2xl` بدلاً من `sm:rounded-lg shadow-lg`
- إضافة border خفيف `border-border/50`
- أنيميشن أنعم: الإبقاء على zoom-in/zoom-out الحالي (يعمل جيداً)

#### 3. حقول الإدخال - Input (`src/components/ui/input.tsx`)

**الحالي:** `rounded-md border border-input bg-background` - تصميم قياسي.

**الجديد:**
- `rounded-xl` بدلاً من `rounded-md`
- `bg-muted/30 border-border/50` خلفية رمادية فاتحة بدلاً من الحدود السوداء
- Focus: `focus-visible:ring-primary/20 focus-visible:border-primary/50` حلقة ملونة ناعمة
- ارتفاع أكبر قليلاً `h-11` بدلاً من `h-10`

#### 4. بطاقات المنتجات في السلة (`src/components/pos/CartPanel.tsx`)

**الحالي:** خطوط فاصلة (dividers) بين المنتجات.

**الجديد:**
- كل منتج داخل بطاقة مستقلة مع `bg-card/50 rounded-xl` وظل خفيف
- خلفية السلة `bg-muted/20` لفصل بصري
- إزالة الخطوط الفاصلة واستبدالها بالمسافات بين البطاقات (gap-2)

#### 5. البطاقات العامة - Card (`src/components/ui/card.tsx`)

**الحالي:** `rounded-2xl border-border/50` - جيد بالفعل.

**الجديد:** تعديل طفيف فقط:
- إضافة `hover:shadow-md` لتأثير تفاعلي
- `border-border/30` حدود أخف قليلاً

---

### الملفات المعدلة

| الملف | التغيير |
|-------|---------|
| `src/components/layout/Sidebar.tsx` | قائمة عائمة + عنصر نشط محسن + مسافات أكبر |
| `src/components/ui/dialog.tsx` | Backdrop blur + rounded-2xl + shadow-2xl |
| `src/components/ui/input.tsx` | rounded-xl + خلفية ناعمة + focus محسن |
| `src/components/pos/CartPanel.tsx` | بطاقات منتجات مستقلة بدلاً من خطوط فاصلة |
| `src/components/ui/card.tsx` | hover effect + حدود أخف |

---

### ملاحظات تقنية

- جميع التغييرات متوافقة مع نظام الثيمات الحالي (dark/light + blur-theme)
- لا حاجة لإضافة مكتبات جديدة
- التغييرات في dialog.tsx و input.tsx و card.tsx ستؤثر تلقائياً على كل الشاشات
- نظام Glassmorphism الموجود في index.css سيعمل فوق هذه التحسينات بدون تعارض

