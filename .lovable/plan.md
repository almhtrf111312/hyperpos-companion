

# تحسين بصري شامل للأزرار والبطاقات + دمج حفظ المظهر مع FABs الإعدادات

## ملخص التغييرات

### 1. دمج قسم المظهر مع نظام الحفظ العائم (FABs) في الإعدادات

**المشكلة الحالية:** قسم المظهر (Appearance) موجود كصفحة مستقلة `/appearance` مع أزرار حفظ/إلغاء خاصة به داخل `ThemeSection.tsx`.

**الحل:**
- نقل قسم المظهر ليكون تبويبًا داخل صفحة الإعدادات بدلاً من صفحة مستقلة
- إزالة أزرار الحفظ/الإلغاء الداخلية من `ThemeSection`
- ربط تغييرات المظهر بنظام `hasUnsavedChanges` الموجود في الإعدادات لإظهار FABs (الحفظ والتراجع) العائمة
- تعديل `ThemeSection` ليقبل props لإرسال التغييرات للصفحة الأم (onPendingChange callback)

### 2. تحسين الأزرار (Global Button Enhancement)

**الملف:** `src/components/ui/button.tsx`

التحسينات:
- إضافة `rounded-xl` بدلاً من `rounded-md` لمظهر أنعم
- إضافة `active:scale-95` لتأثير الضغط
- إضافة `shadow-sm` خفيف للأزرار الأساسية
- تحسين تأثير hover بإضافة `hover:shadow-md`
- الحفاظ على استخدام متغيرات `--primary` بحيث تتبع اللون المختار تلقائياً

### 3. تحسين البطاقات (Global Card Enhancement)

**الملف:** `src/components/ui/card.tsx`

التحسينات:
- تغيير `rounded-lg` إلى `rounded-2xl` 
- إضافة `transition-all duration-300`
- إضافة `hover:shadow-lg hover:-translate-y-0.5` لتأثير رفع عند التمرير
- تحسين الحدود لتكون أخف `border-border/50`

### 4. تحسين CSS العام

**الملف:** `src/index.css`

التحسينات:
- تحديث `.glass` class بتأثيرات أكثر نعومة
- تحسين `.card-hover` بإضافة `hover:border-primary/20` لربط لون الحد باللون المختار
- تحسين `.enhanced-card` و `.enhanced-button` الموجودة
- إضافة class جديد `.card-interactive` للبطاقات القابلة للنقر

### 5. تحسين StatCard في الداشبورد

**الملف:** `src/components/dashboard/StatCard.tsx`

- إضافة `hover:border-primary/30` لربط لون الحد باللون المطبق
- تحسين الحركة والظلال

---

## التفاصيل التقنية

### آلية دمج المظهر مع الإعدادات

```text
ThemeSection (child)
  |-- يرسل pendingTheme عبر onPendingChange callback
  |-- لا يحفظ مباشرة
  
Settings (parent)  
  |-- يتتبع pendingTheme في state
  |-- يقارن مع الثيم الحالي ضمن hasUnsavedChanges
  |-- عند ضغط FAB Save: يستدعي setFullTheme + يحفظ باقي الإعدادات
  |-- عند ضغط FAB Revert: يعيد pendingTheme للقيم الأصلية
```

### التأثيرات البصرية الجديدة للأزرار

```text
Default:  rounded-xl + active:scale-95 + shadow-sm hover:shadow-md
Primary:  + hover:brightness-110
Outline:  + hover:border-primary/50
Ghost:    لا تغيير (يبقى خفيف)
```

### التأثيرات البصرية الجديدة للبطاقات

```text
Card:     rounded-2xl + border-border/40 + transition-all + hover:shadow-lg
Glass:    + hover:border-primary/20 (يتبع اللون المختار)
StatCard: + hover:border-primary/30 + hover:shadow-primary/10
```

### الملفات المتأثرة

| الملف | نوع التعديل |
|-------|-------------|
| `src/components/ui/button.tsx` | تحسين بصري |
| `src/components/ui/card.tsx` | تحسين بصري |
| `src/components/settings/ThemeSection.tsx` | إزالة أزرار الحفظ، إضافة callback |
| `src/pages/Settings.tsx` | إضافة تبويب المظهر، ربط FABs |
| `src/pages/Appearance.tsx` | إعادة توجيه لصفحة الإعدادات |
| `src/index.css` | تحسين classes عامة |
| `src/components/dashboard/StatCard.tsx` | تحسين بصري |
| `src/App.tsx` | تحديث routing (اختياري - إعادة توجيه) |

### ملاحظات مهمة

- جميع الألوان تستخدم متغيرات CSS (`--primary`, `--accent`) التي يتم تحديثها تلقائياً من `use-theme.tsx`، لذا أي تحسين بصري سيتوافق تلقائياً مع اللون المختار
- التحسينات في `button.tsx` و `card.tsx` ستنعكس على كامل البرنامج فوراً لأن جميع الصفحات تستخدم هذه المكونات
- لن يتم المساس بمنطق الشفافية/البلور الموجود في `index.css`

