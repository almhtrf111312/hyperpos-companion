

# تصغير الإشعارات وحماية الشفافية

## المشاكل

1. **الإشعارات كبيرة جدًا** - العرض الحالي `min(85vw, 420px)` مبالغ فيه
2. **الشفافية الكاملة** - الإشعارات تستخدم `!bg-card` الذي يتأثر بنظام الشفافية، فتصبح شفافة بالكامل وغير مقروءة

## التغييرات

### الملف: `src/components/ui/sonner.tsx`

1. **تصغير الحجم**: تقليل العرض من `min(85vw, 420px)` إلى `min(80vw, 340px)`
2. **حماية من الشفافية**: استبدال `!bg-card` بألوان ثابتة غير شفافة باستخدام `!opacity-100` و `!backdrop-blur-none` مع ضمان خلفية صلبة
3. **إضافة أنماط مضمنة** تفرض حد أدنى للشفافية (`opacity: 1 !important`) على الإشعار نفسه

### الملف: `src/index.css`

- إضافة قاعدة CSS تمنع نظام الشفافية من التأثير على الإشعارات:

```css
/* Protect toasts from transparency system */
[data-sonner-toaster] [data-sonner-toast] {
  opacity: 1 !important;
  background-color: hsl(var(--card)) !important;
  backdrop-filter: none !important;
}
```

هذا يضمن أن الإشعارات تبقى مقروءة دائمًا بغض النظر عن إعدادات الشفافية.

