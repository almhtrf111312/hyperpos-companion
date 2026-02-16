## خطة: إضافة Service Worker للعمل أوفلاين (PWA)

### الهدف

تحويل التطبيق إلى PWA كامل باستخدام `vite-plugin-pwa` بحيث يتم تخزين جميع ملفات التطبيق (HTML, CSS, JS, الخطوط) في الكاش عند أول تحميل، ويعمل التطبيق بدون إنترنت بعدها.

### كيف يعمل؟

1. عند أول زيارة للتطبيق، يتم تحميل وتخزين كل الملفات تلقائياً
2. عند فقدان الإنترنت، يتم تقديم الملفات من الكاش المحلي
3. عند عودة الإنترنت، يتم تحديث الملفات تلقائياً في الخلفية
4. طلبات API (قاعدة البيانات) تمر عبر الشبكة مباشرة (التطبيق يتعامل معها بنظام الأوفلاين الموجود أصلاً)

### الملفات المطلوب تعديلها/إنشاؤها


| الملف            | النوع | الوصف                                                |
| ---------------- | ----- | ---------------------------------------------------- |
| `package.json`   | تعديل | إضافة `vite-plugin-pwa`                              |
| `vite.config.ts` | تعديل | إعداد PWA plugin مع Workbox                          |
| `index.html`     | تعديل | إضافة meta tags للـ PWA (theme-color, manifest link) |
| `src/main.tsx`   | تعديل | تسجيل Service Worker                                 |


### التفاصيل التقنية

#### 1. تثبيت vite-plugin-pwa

إضافة `vite-plugin-pwa` كـ dev dependency.

#### 2. إعداد vite.config.ts

```text
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/^\/~oauth/],
      runtimeCaching: [
        {
          // كاش خطوط Google
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts',
            expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
          },
        },
        {
          // طلبات API تمر عبر الشبكة دائماً (Network Only)
          urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
          handler: 'NetworkOnly',
        },
      ],
    },
    manifest: {
      name: 'FlowPOS Pro',
      short_name: 'FlowPOS',
      description: 'نظام إدارة محاسبي متكامل',
      theme_color: '#1a1a2e',
      background_color: '#1a1a2e',
      display: 'standalone',
      dir: 'rtl',
      lang: 'ar',
      icons: [
        { src: '/app-icon.png', sizes: '512x512', type: 'image/png' },
      ],
    },
  }),
]
```

النقاط المهمة:

- `registerType: 'autoUpdate'` — يحدّث التطبيق تلقائياً عند توفر نسخة جديدة
- `navigateFallbackDenylist: [/^\/~oauth/]` — يمنع كاش مسارات OAuth
- طلبات Supabase/API = `NetworkOnly` (لا يتم تخزينها)
- خطوط Google = `CacheFirst` (تخزين طويل الأمد)

#### 3. تعديل index.html

إضافة:

- `<meta name="theme-color" content="#1a1a2e" />`
- `<link rel="manifest" href="/manifest.webmanifest" />` (يُنشأ تلقائياً من الـ plugin)
- `<meta name="mobile-web-app-capable" content="yes" />`

#### 4. تسجيل SW في main.tsx

```text
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    // تحديث تلقائي عند توفر نسخة جديدة
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
});
```

#### 5. ملاحظة عن Capacitor

بما أن الـ APK الآن يحمّل من `flowpospro.lovable.app`، فإن الـ Service Worker سيعمل داخل WebView أيضاً — مما يعني أن التطبيق على الهاتف سيخزن الملفات محلياً بعد أول تحميل ويعمل أسرع حتى مع اتصال بطيء.

### النتيجة المتوقعة

- التطبيق يعمل بدون إنترنت بعد أول تحميل (الواجهات فقط)
- البيانات تُقدَّم من الكاش المحلي الموجود أصلاً (IndexedDB + localStorage)
- التحديثات تُنزَّل تلقائياً في الخلفية
- أداء أسرع على الاتصالات البطيئة. 
- يجب اضافه حد زمني للبقاء في وضع الاوف لاين مثلا يومين 24 ساعه او 48 ساعه ليكن الحد الزمني هو 48 ساعه للعمل اوف لاين ويجب ان تنتظر جميع التعديلات حتى يعود الانترنت 