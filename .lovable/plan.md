
# خطة تنفيذ المميزات المطلوبة

تتضمن هذه الخطة ثلاثة محاور رئيسية:
1. **إضافة ثيم البلور (Glassmorphism Theme)**
2. **إصلاح أيقونة التطبيق على أندرويد**
3. **نظام فواتير الشراء والمخزون المتقدم**

---

## المحور الأول: ثيم البلور (Blur/Glass Theme)

### الوصف
إضافة خيار جديد في صفحة المظهر يسمح للمستخدم بتفعيل/إلغاء تفعيل تأثير البلور (Glassmorphism) على جميع عناصر التطبيق كما هو موضح في الصورة المرفقة.

### التغييرات المطلوبة

#### 1. تحديث `src/hooks/use-theme.tsx`
- إضافة خاصية `blurEnabled: boolean` إلى حالة الثيم
- تحديث واجهة `ThemeContextType` لتشمل `blurEnabled` و `setBlurEnabled`
- تحديث `THEME_STORAGE_KEY` لحفظ إعداد البلور
- إضافة دالة `applyBlurTheme()` لتطبيق/إزالة تأثير البلور

#### 2. تحديث `src/index.css`
- إضافة CSS variables جديدة للبلور:
  ```css
  --blur-intensity: 20px;
  --glass-bg: rgba(0, 0, 0, 0.4);
  --glass-border: rgba(255, 255, 255, 0.1);
  ```
- إضافة class `.blur-theme` مع التعريفات:
  ```css
  .blur-theme .card,
  .blur-theme [data-slot="card"] {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--blur-intensity));
    border: 1px solid var(--glass-border);
  }
  ```

#### 3. تحديث `src/components/settings/ThemeSection.tsx`
- إضافة زر Toggle جديد لـ "تفعيل البلور"
- استخدام أيقونة `Sparkles` أو `Blend` لتمثيل الميزة
- ربط الزر بـ `blurEnabled` من `useTheme()`

#### 4. تحديث `src/lib/i18n.ts`
- إضافة ترجمات:
  - `'settings.blurEffect': 'تأثير البلور'`
  - `'settings.blurEffectDesc': 'تفعيل تأثير الزجاج الشفاف'`

---

## المحور الثاني: إصلاح أيقونة التطبيق على أندرويد

### المشكلة
الأيقونة تظهر في الويب فقط ولا تظهر في APK لأن Capacitor يحتاج لتوليد الأيقونات بمقاسات محددة.

### التغييرات المطلوبة

#### 1. تحديث `.github/workflows/build-apk.yml`
إضافة خطوة لتوليد الأيقونات باستخدام `@capacitor/assets`:

```yaml
- name: Generate Android Icons
  run: |
    npm install @capacitor/assets --save-dev
    npx capacitor-assets generate --android
```

#### 2. التأكد من وجود ملف المصدر
- التحقق من وجود `resources/icon.png` (1024x1024)
- أو إنشاء مجلد `assets/` مع الملفات المطلوبة

#### 3. تحديث `package.json`
إضافة سكريبت جديد:
```json
"build:android": "vite build && npx cap copy && npx capacitor-assets generate --android && npx cap sync android"
```

---

## المحور الثالث: نظام فواتير الشراء والمخزون

### الوصف
نظام شامل لتسجيل فواتير شراء البضاعة مع التحقق من المطابقة والربط بالمنتجات.

### المرحلة الأولى: إنشاء قاعدة البيانات

#### جدول `purchase_invoices`
```sql
CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_company TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_items_count INTEGER NOT NULL,
  expected_total_quantity INTEGER NOT NULL,
  expected_grand_total NUMERIC NOT NULL,
  actual_items_count INTEGER DEFAULT 0,
  actual_total_quantity INTEGER DEFAULT 0,
  actual_grand_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, reconciled, finalized
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### جدول `purchase_invoice_items`
```sql
CREATE TABLE purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  cost_price NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  product_name TEXT NOT NULL,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### تحديث جدول `products`
```sql
ALTER TABLE products 
ADD COLUMN purchase_history JSONB DEFAULT '[]';
```

#### سياسات RLS
```sql
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase invoices" ON purchase_invoices
  FOR ALL USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));
```

### المرحلة الثانية: إنشاء الملفات البرمجية

#### 1. `src/lib/cloud/purchase-invoices-cloud.ts`
ملف جديد يحتوي على:
- `loadPurchaseInvoicesCloud()` - جلب جميع فواتير الشراء
- `addPurchaseInvoiceCloud()` - إنشاء فاتورة جديدة (Header)
- `updatePurchaseInvoiceCloud()` - تحديث الفاتورة
- `deletePurchaseInvoiceCloud()` - حذف الفاتورة
- `addPurchaseInvoiceItemCloud()` - إضافة منتج للفاتورة
- `finalizePurchaseInvoiceCloud()` - إتمام الفاتورة وتحديث المخزون

#### 2. `src/components/products/PurchaseInvoiceDialog.tsx`
مكون رئيسي يحتوي على:
- **Step 1**: نموذج بيانات الفاتورة (Header)
  - رقم الفاتورة المرجعي
  - اسم الموزع (dropdown من الشركاء أو إدخال جديد)
  - اسم الشركة
  - تاريخ الفاتورة
  - العدد المتوقع للأصناف
  - إجمالي الكميات المتوقعة
  - إجمالي التكلفة المتوقعة
- **Step 2**: حلقة إضافة المنتجات
  - نموذج إضافة منتج (مشابه للنموذج الحالي)
  - عداد: "تمت إضافة X من Y"
  - زر "إضافة منتج آخر"
  - زر "إنهاء وإغلاق"
- **Step 3**: شاشة المطابقة والتحقق
  - مقارنة القيم المتوقعة بالفعلية
  - تمييز الفروقات باللون الأحمر
  - زر "حفظ نهائي" أو "مراجعة"

#### 3. `src/components/products/PurchaseInvoiceItemForm.tsx`
نموذج إضافة منتج مع الحقول:
- اسم المنتج
- الباركود (مع ماسح)
- الفئة
- سعر الشراء
- الكمية
- الصورة (اختياري)

#### 4. `src/components/products/PurchaseReconciliation.tsx`
شاشة المطابقة:
- جدول مقارنة: المتوقع vs الفعلي
- تنبيهات الفروقات
- قائمة المنتجات المضافة

### المرحلة الثالثة: التكامل مع صفحة المنتجات

#### تحديث `src/pages/Products.tsx`
- إضافة زر "إضافة فاتورة شراء" بجانب "إضافة منتج"
- فتح `PurchaseInvoiceDialog` عند الضغط

#### تحديث عرض تفاصيل المنتج
- إضافة قسم "مصدر الشراء" يعرض:
  - رقم الفاتورة
  - اسم المورد
  - التاريخ
  - سعر الشراء وقت التوريد

### المرحلة الرابعة: تحديث المخزون عند الإتمام

عند الضغط على "حفظ نهائي":
1. تحديث `products.quantity` لكل منتج
2. إضافة سجل في `products.purchase_history`
3. تحديث حالة الفاتورة إلى `finalized`

---

## ملخص الملفات

| الملف | العملية | الوصف |
|-------|---------|-------|
| `src/hooks/use-theme.tsx` | تعديل | إضافة دعم البلور |
| `src/index.css` | تعديل | أنماط Glassmorphism |
| `src/components/settings/ThemeSection.tsx` | تعديل | زر تفعيل البلور |
| `src/lib/i18n.ts` | تعديل | ترجمات جديدة |
| `.github/workflows/build-apk.yml` | تعديل | توليد الأيقونات |
| `package.json` | تعديل | سكريبت البناء |
| `src/lib/cloud/purchase-invoices-cloud.ts` | إنشاء | API فواتير الشراء |
| `src/components/products/PurchaseInvoiceDialog.tsx` | إنشاء | نافذة فاتورة الشراء |
| `src/components/products/PurchaseInvoiceItemForm.tsx` | إنشاء | نموذج المنتج |
| `src/components/products/PurchaseReconciliation.tsx` | إنشاء | شاشة المطابقة |
| `src/pages/Products.tsx` | تعديل | زر فاتورة الشراء |
| قاعدة البيانات | Migration | جداول وسياسات جديدة |

---

## التفاصيل التقنية لثيم البلور

### متغيرات CSS الجديدة
```css
:root {
  --blur-intensity: 20px;
  --glass-bg-light: rgba(255, 255, 255, 0.7);
  --glass-bg-dark: rgba(0, 0, 0, 0.4);
  --glass-border-light: rgba(0, 0, 0, 0.1);
  --glass-border-dark: rgba(255, 255, 255, 0.1);
}
```

### تطبيق البلور عبر JavaScript
```typescript
function applyBlurTheme(enabled: boolean, mode: ThemeMode) {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('blur-theme');
    root.style.setProperty('--glass-bg', 
      mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)');
  } else {
    root.classList.remove('blur-theme');
  }
}
```

### أنماط Glassmorphism
```css
.blur-theme .bg-card,
.blur-theme [class*="bg-card"] {
  background: var(--glass-bg) !important;
  backdrop-filter: blur(var(--blur-intensity)) !important;
  -webkit-backdrop-filter: blur(var(--blur-intensity)) !important;
  border: 1px solid var(--glass-border) !important;
}

.blur-theme .bg-background {
  background: linear-gradient(135deg, 
    hsl(var(--primary) / 0.1), 
    hsl(var(--accent) / 0.1)) !important;
}
```

---

## أولوية التنفيذ

1. **أولاً**: ثيم البلور (الأسهل والأسرع)
2. **ثانياً**: إصلاح أيقونة أندرويد
3. **ثالثاً**: نظام فواتير الشراء (الأكبر والأعقد)
