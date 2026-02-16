

## خطة: تحسين أزرار التطبيق وإضافة تأثيرات حركية

---

### ملخص

تحسين مكون الأزرار العام مع إضافة تأثيرات حركية (animations) للقائمة الجانبية وسلة المنتجات. سنستخدم CSS animations الموجودة بدلاً من framer-motion لتجنب إضافة مكتبة ثقيلة (~30KB) بدون داع، خاصة أن المشروع يحتوي بالفعل على نظام animations متكامل في CSS.

---

### التغييرات

#### 1. تحسين مكون الأزرار (`src/components/ui/button.tsx`)

**الحالي:** الأزرار تملك `rounded-xl` و `active:scale-95` و `transition-all duration-200` - جيد لكن يمكن تحسينه.

**الجديد:**
- إضافة `hover:translate-y-[-1px]` لتأثير "رفع" خفيف عند التمرير
- تحسين الظلال: `hover:shadow-lg` للأزرار الرئيسية بدلاً من `hover:shadow-md`
- إضافة `active:translate-y-0` للضغط الطبيعي
- تحسين variant `outline`: إضافة `hover:shadow-sm` وحدود أنعم
- تحسين variant `ghost`: إضافة `active:scale-95` بشكل منفصل
- تحسين variant `secondary`: إضافة `hover:shadow-sm`

#### 2. أنيميشن القائمة الجانبية (`src/components/layout/Sidebar.tsx`)

**الحالي:** الأيقونات والنصوص تظهر بدون حركة عند فتح القائمة على الموبايل.

**الجديد:**
- إضافة `staggered animation` لعناصر القائمة: كل عنصر يظهر بتأخير تدريجي (`animationDelay`) عند فتح القائمة على الموبايل
- تأثير `fade-in-up` لكل عنصر في القائمة
- تأثير حركي عند التمرير على العناصر: `hover:translate-x-1` (أو `hover:-translate-x-1` في RTL)

#### 3. أنيميشن سلة المنتجات (`src/components/pos/CartPanel.tsx`)

**الحالي:** يوجد `slide-in-right` مع `animationDelay` - جيد لكن يمكن تحسينه.

**الجديد:**
- استبدال `slide-in-right` بأنيميشن `fade-in-up` (أنسب لبطاقات السلة)
- إضافة `transition-all duration-200 hover:shadow-md hover:scale-[1.01]` للبطاقات
- تأثير حذف أنعم (يعتمد على CSS transition)

#### 4. إضافة keyframes جديدة (`src/index.css`)

إضافة `@keyframes cart-item-enter` مخصص لعناصر السلة:
- يبدأ من `opacity: 0, translateY(8px), scale(0.97)`
- ينتهي إلى `opacity: 1, translateY(0), scale(1)`
- مدة: `0.25s ease-out`

---

### الملفات المعدلة

| الملف | التعديل |
|-------|---------|
| `src/components/ui/button.tsx` | hover lift effect + ظلال محسنة + active states أنعم |
| `src/components/layout/Sidebar.tsx` | staggered fade-in للعناصر + hover translate |
| `src/components/pos/CartPanel.tsx` | cart-item-enter animation + hover effects على البطاقات |
| `src/index.css` | إضافة `@keyframes cart-item-enter` |

---

### لماذا بدون framer-motion؟

- المشروع يحتوي على **11+ keyframes** مخصصة في CSS بالفعل
- framer-motion تضيف ~30KB للحزمة وهو غير ضروري لهذه التأثيرات البسيطة
- CSS animations أسرع في الأداء وأخف على الموبايل
- جميع التأثيرات المطلوبة يمكن تنفيذها بـ CSS transitions + keyframes

