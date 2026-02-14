

# تصغير الإشعارات وإصلاح الشفافية نهائيًا

## المشاكل الحالية

1. **الإشعارات لا تزال كبيرة**: تم تصغير العرض لكن الحشو الداخلي (padding) وحجم الخط لا يزالان كبيرين
2. **الشفافية لا تزال تؤثر**: قاعدة `.blur-theme [class*="bg-card"]` في CSS تتغلب على حماية الإشعارات لأن الإشعار يحتوي على class يتضمن `bg-card`، وهذه القاعدة لها أولوية أعلى

## التغييرات

### الملف: `src/components/ui/sonner.tsx`

- تقليل العرض من `min(80vw, 340px)` إلى `min(75vw, 300px)`
- إضافة أنماط لتصغير الحشو الداخلي وحجم الخط عبر `style` مباشرة على المكون

### الملف: `src/index.css`

1. **تحديث قاعدة حماية الإشعارات** (السطر 912-917): زيادة أولوية (specificity) القاعدة لتتغلب على `.blur-theme [class*="bg-card"]`:

```css
/* قبل */
[data-sonner-toaster] [data-sonner-toast] { ... }

/* بعد - أولوية أعلى */
.blur-theme [data-sonner-toaster] [data-sonner-toast],
[data-sonner-toaster] [data-sonner-toast] {
  opacity: 1 !important;
  background-color: hsl(var(--card)) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

2. **تحديث قاعدة blur-theme للإشعارات** (السطر 356-363): استخدام ألوان صلبة بدلاً من `hsl(var(--card))` مع التأكد من عدم الشفافية

3. **إضافة قواعد لتصغير حجم الإشعار**:

```css
[data-sonner-toaster] [data-sonner-toast] {
  padding: 10px 14px !important;
  font-size: 0.85rem !important;
  min-height: unset !important;
}
```

## النتيجة المتوقعة

- إشعارات أصغر حجمًا وأكثر أناقة
- تبقى مقروءة دائمًا حتى مع تفعيل وضع الشفافية

