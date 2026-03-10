# Electron Build Guide - دليل بناء Electron

## مشاكل سابقة وحلولها

### المشكلة: شاشة سوداء في نسخة EXE
**السبب:** عدم العثور على ملفات `dist/index.html` بعد البناء

**الحل:** تطبيق إجراء البناء الصحيح

---

## خطوات البناء الصحيحة

### 1️⃣ للتطوير (Development Mode):
```bash
# تشغيل التطبيق مباشرة من المصدر
npm run electron:dev
```
سيفتح Electron في وضع التطوير مع DevTools

### 2️⃣ للإنتاج (Production Installer):
```bash
# بناء الويب أولاً
npm run build

# ثم بناء Electron
npm run build:electron
```

هذا سينتج:
- ✅ `electron-dist/FlowPOS-Pro-Setup-x.x.x.exe` - مثبت كامل
- ✅ `dist/` - ملفات الويب المترجمة

### 3️⃣ للحصول على نسخة محمولة (Portable EXE) بدون تثبيت:
```bash
npm run electron:build:portable
```

النتيجة: `electron-dist/FlowPOS-Pro-x.x.x.exe` (نسخة محمولة بدون مثبت)

---

## متطلبات الأنظمة

### Dependencies المطلوبة:
```json
{
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  }
}
```

تثبيت إذا لم توجد:
```bash
npm install --save-dev electron electron-builder
```

---

## معالجة الأخطاء المحسّنة

### عند مواجهة شاشة سوداء:

1. **افتح Developer Console** (Ctrl+Shift+I):
   - ابحث عن الأخطاء في `Console` tab
   - تحقق من التسجيلات:
     ```
     === FlowPOS Pro Electron ===
     NODE_ENV: production
     isDev: false
     app.getAppPath(): /path/to/app
     Searching for dist folder...
     ```

2. **تحقق من هيكل المجلدات**:
   ```
   hyperpos-companion/
   ├── dist/                    ← يجب أن يكون موجود بعد npm run build
   │   ├── index.html
   │   ├── assets/
   │   └── ...
   ├── electron/
   │   ├── main.js
   │   ├── package.json
   │   └── error.html
   └── electron-dist/          ← سيُنشأ بعد npm run build:electron
       └── FlowPOS-Pro-Setup-x.x.x.exe
   ```

3. **تأكد من ترتيب الخطوات**:
   ```
   ✓ npm install                    # تثبيت جميع dependencies
   ✓ npm run build                  # بناء الويب أولاً (يُنشئ /dist)
   ✓ npm run build:electron         # بناء Electron (يستخدم /dist)
   ✗ بناء Electron بدون بناء الويب = شاشة سوداء
   ```

---

## متغيرات البيئة المهمة

يتم تعيينها تلقائياً بواسطة npm scripts:

| المتغير | القيمة | الاستخدام |
|:---|:---|:---|
| `NODE_ENV` | `development` | في `electron:dev` - يفتح DevTools |
| `NODE_ENV` | `production` | في `electron:build*` - يبحث عن dist محلياً |

---

## التسجيلات (Logging) المفيدة

يطبع main.js معلومات تصحيح مفيدة:

```
✓ Found dist at: /path/to/dist
✓ Loading from: /path/to/dist/index.html
File URL: file:///C:/Users/.../dist/index.html
```

أو في حالة الأخطاء:
```
✗ NOT FOUND: file path
✗ Local dist folder not found!
Possible solutions:
  1. Run "npm run build" to build the frontend
  2. Ensure dist folder is in the correct location
  3. Check that the Electron build includes the dist folder
```

---

## الملفات الرئيسية

| الملف | الدور |
|:---|:---|
| `electron/main.js` | نقطة دخول Electron - يحمّل التطبيق |
| `electron/package.json` | إعدادات البناء electron-builder |
| `vite.config.ts` | إعدادات بناء الويب |
| `dist/index.html` | ملف HTML الرئيسي المترجم |

---

## حل سريع إذا علقت في مشكلة

```bash
# تنظيف كامل
rm -r dist node_modules electron-dist

# إعادة تثبيت
npm install

# بناء من الصفر
npm run build
npm run build:electron
```

---

## ملاحظات مهمة

✅ **يجب** بناء الويب (`npm run build`) قبل بناء Electron  
✅ **تأكد** من وجود مجلد `dist/` قبل بناء المثبت  
✅ **استخدم** electron:dev للاختبار السريع  
✅ **تحقق** من DevTools (Ctrl+Shift+I) عند المشاكل  

---

## أسباب الشاشة السوداء الشهيرة

| السبب | الحل |
|:---|:---|
| لم يتم بناء الويب | `npm run build` أولاً |
| dist مفقود | تحقق من وجود `dist/index.html` |
| NODE_ENV غير معين | استخدم npm scripts |
| مسارات خاطئة | تحقق من main.js logging |
| Renderer crashed | ادفع Ctrl+Shift+I لرؤية الأخطاء |

---

**آخر تحديث:** March 10, 2026
