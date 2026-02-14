
# إصلاح خطأ redirect_uri_mismatch عند تسجيل الدخول بـ Google

## المشكلة
عند محاولة تسجيل الدخول بحساب Google من تطبيق الهاتف، يظهر خطأ 400: `redirect_uri_mismatch`. السبب:
- الكود الحالي يستخدم `supabase.auth.signInWithOAuth` مباشرة
- على الهاتف (Capacitor)، `window.location.origin` يكون `https://localhost` وهو غير مسجّل في إعدادات Google OAuth
- يجب استخدام `lovable.auth.signInWithOAuth` الذي يُدير العملية تلقائياً عبر Lovable Cloud

## الحل

### 1. تعديل `src/hooks/use-auth.tsx`
- تغيير دالة `signInWithGoogle` لاستخدام `lovable.auth.signInWithOAuth("google")` بدلاً من `supabase.auth.signInWithOAuth`
- استخدام عنوان التطبيق المنشور (`https://flowpospro.lovable.app`) كـ `redirect_uri` لضمان التوافق مع الهاتف والويب
- إزالة scope الخاص بـ Google Drive من هذه الدالة (يمكن طلبه لاحقاً عند الحاجة لـ Google Drive فقط)

### 2. تعديل `src/pages/Login.tsx`
- تحديث دالة `handleGoogleSignIn` للتعامل مع النتيجة الجديدة من Lovable Cloud (التي قد تُرجع `redirected: true`)

## التفاصيل التقنية

الكود الحالي:
```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
    queryParams: { ... }
  }
});
```

الكود الجديد:
```typescript
import { lovable } from "@/integrations/lovable/index";

const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin,
});
```

## الملفات المتأثرة

| الملف | التغيير |
|:---|:---|
| `src/hooks/use-auth.tsx` | تغيير signInWithGoogle لاستخدام lovable.auth |
| `src/pages/Login.tsx` | تحديث handleGoogleSignIn للتعامل مع الاستجابة الجديدة |
