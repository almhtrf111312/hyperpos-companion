

## خطة: إصلاح عدم ظهور بطاقة الشرح في الجولة التعليمية

### المشكلة الجذرية

مصفوفة `activeSteps` يتم إعادة إنشائها في كل render لأنها ناتج `.filter()` مباشر (مرجع جديد كل مرة). هذا يتسبب في:

1. `updatePosition` يُعاد إنشاؤه كل render (لأنه يعتمد على `activeSteps`)
2. الـ `useEffect` الذي يتحكم بالإظهار يُعاد تشغيله كل render
3. في كل تشغيل يتم ضبط `isVisible = false` ثم المؤقت يُلغى قبل أن يصل لـ `setIsVisible(true)`
4. النتيجة: البطاقة تبقى بـ `opacity-0` دائماً

### الحل

تعديل `src/components/onboarding/OnboardingTour.tsx`:

1. تثبيت `activeSteps` باستخدام `useMemo` لمنع إعادة الإنشاء في كل render
2. فصل منطق الإظهار عن `updatePosition` لمنع الدورة اللانهائية
3. جعل الـ effect يعتمد فقط على `currentStep` و `isActive` (قيم مستقرة)

### التفاصيل التقنية

```text
التغيير الرئيسي:
- تحويل activeSteps من متغير عادي إلى useMemo
- إزالة activeSteps و updatePosition من dependency array للـ effect
- استخدام ref لـ activeSteps بدلاً من state لتجنب إعادة التشغيل
```

### الملفات المعدلة

| الملف | النوع |
|-------|-------|
| `src/components/onboarding/OnboardingTour.tsx` | تعديل - تثبيت المراجع ومنع الدورة اللانهائية |

