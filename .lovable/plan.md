

# إصلاح خطأ Node.js في GitHub Actions

## المشكلة
Capacitor CLI v8.1.0 يتطلب **Node.js 22 أو أعلى**. الـ workflow يستخدم Node.js 20 حالياً.

رسالة الخطأ:
```
The Capacitor CLI requires NodeJS >=22.0.0
```

## الحل
تغيير سطر واحد في `.github/workflows/build-apk.yml`:

**السطر 29** - تغيير `node-version: 20` إلى `node-version: 22`

## الملف المتأثر
- `.github/workflows/build-apk.yml` - تغيير سطر واحد فقط

