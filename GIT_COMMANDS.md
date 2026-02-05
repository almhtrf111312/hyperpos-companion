# أوامر Git للاستخدام بعد كل تعديل

## الأوامر الأساسية (نسخ ولصق)

### 1️⃣ إضافة جميع التغييرات
```bash
git add .
```

### 2️⃣ عمل Commit مع رسالة وصفية
```bash
git commit -m "وصف التعديلات التي قمت بها"
```

### 3️⃣ رفع التحديثات إلى GitHub
```bash
git push origin main
```

---

## مثال عملي كامل

```bash
# الخطوة 1: إضافة الملفات
git add .

# الخطوة 2: Commit مع وصف
git commit -m "feat: إضافة ميزة جديدة للتطبيق"

# الخطوة 3: Push إلى GitHub
git push origin main
```

---

## أمثلة على رسائل Commit جيدة

### للميزات الجديدة:
```bash
git commit -m "feat: إضافة نظام إدارة المخزون"
```

### للإصلاحات:
```bash
git commit -m "fix: إصلاح مشكلة الباركود في نقطة البيع"
```

### للتحسينات:
```bash
git commit -m "improve: تحسين واجهة المستخدم في صفحة المنتجات"
```

### للتحديثات:
```bash
git commit -m "update: تحديث الرقم التسلسلي إلى 203"
```

---

## الأوامر الثلاثة المختصرة (نسخ كاملة)

**للتحديثات السريعة:**
```bash
git add . && git commit -m "update: تحديثات عامة" && git push origin main
```

**للميزات الجديدة:**
```bash
git add . && git commit -m "feat: ميزة جديدة" && git push origin main
```

**للإصلاحات:**
```bash
git add . && git commit -m "fix: إصلاح مشكلة" && git push origin main
```

---

## أوامر إضافية مفيدة

### التحقق من حالة Git:
```bash
git status
```

### رؤية آخر 5 commits:
```bash
git log --oneline -5
```

### التحقق من الفرع الحالي:
```bash
git branch
```

### التحقق من الملفات المعدلة:
```bash
git diff --name-only
```

---

## ملاحظات مهمة

> [!TIP]
> **استخدم رسائل commit واضحة ووصفية**
> - ❌ سيء: "تحديث"
> - ✅ جيد: "feat: إضافة حوار تفاصيل المنتج في نقطة البيع"

> [!IMPORTANT]
> **قبل Push، تأكد من:**
> - ✅ جميع التغييرات تم إضافتها (`git add .`)
> - ✅ رسالة الـ commit واضحة
> - ✅ لا توجد أخطاء في الكود

> [!WARNING]
> **إذا فشل Push:**
> ```bash
> # اسحب التحديثات أولاً
> git pull origin main
> 
> # ثم حاول Push مرة أخرى
> git push origin main
> ```
