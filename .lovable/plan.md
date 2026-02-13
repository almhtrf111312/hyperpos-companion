
# خطة المزامنة الشاملة: كاش أوفلاين لجميع البيانات + مزامنة الإعدادات سحابياً

## ملخص المشروع
إضافة طبقة تخزين محلي (localStorage) لجميع وحدات البيانات المتبقية التي لا تعمل أوفلاين حالياً، بالإضافة إلى حفظ إعدادات المظهر (الثيم واللون والشفافية) في قاعدة البيانات السحابية بحيث تتزامن بين جميع الأجهزة.

---

## الجزء الأول: كاش أوفلاين للبيانات (7 وحدات)

سيتم تطبيق نفس النمط المستخدم في المنتجات والفواتير (حفظ في localStorage عند التحميل، قراءة من localStorage عند انقطاع الإنترنت) على كل من:

### 1. العملاء (customers-cloud.ts)
- إضافة `saveCustomersToLocalCache()` و `loadCustomersFromLocalCache()`
- عند `loadCustomersCloud`: حفظ محلي بعد التحميل من السحابة، وقراءة من المحلي إذا `!navigator.onLine`

### 2. الديون (debts-cloud.ts)
- نفس النمط: حفظ/قراءة من localStorage
- عند `loadDebtsCloud`: فحص الاتصال أولاً، إرجاع الكاش المحلي إذا أوفلاين

### 3. المصاريف (expenses-cloud.ts)
- إضافة كاش محلي لـ `loadExpensesCloud`

### 4. التصنيفات (categories-cloud.ts)
- إضافة كاش محلي لـ `loadCategoriesCloud`

### 5. الشركاء (partners-cloud.ts)
- إضافة كاش محلي لـ `loadPartnersCloud`

### 6. المستودعات (warehouses-cloud.ts)
- إضافة كاش محلي لـ `loadWarehousesCloud`
- إضافة كاش لـ `loadWarehouseStockCloud` (كاش لكل مستودع)

### 7. فواتير الشراء (purchase-invoices-cloud.ts)
- إضافة كاش محلي لـ `loadPurchaseInvoicesCloud`

---

## الجزء الثاني: مزامنة الإعدادات والمظهر سحابياً

### المشكلة الحالية
إعدادات الثيم (الوضع، اللون، الشفافية) محفوظة فقط في `localStorage` - عند تسجيل الدخول من جهاز آخر تضيع الإعدادات.

### الحل
استخدام جدول `stores` الموجود بالفعل (يحتوي على أعمدة `theme` و `language`) لحفظ إعدادات المظهر الكاملة:

1. **تحديث جدول stores**: إضافة عمود `theme_settings` من نوع `jsonb` لحفظ كل إعدادات المظهر (mode, color, blur, transparency)

2. **تحديث use-theme.tsx**: 
   - عند التهيئة: تحميل الإعدادات من `stores` السحابية أولاً، ثم استخدام localStorage كنسخة احتياطية
   - عند الحفظ: حفظ في localStorage + تحديث `stores` في السحابة

3. **تحديث إعدادات المتجر العامة**: أي إعدادات أخرى في صفحة الإعدادات (العملة، الضريبة، الإشعارات، الطباعة) محفوظة بالفعل في جدول `stores` السحابي

---

## التفاصيل التقنية

### نمط الكاش الموحد لكل وحدة بيانات

```text
loadXxxCloud()
  |
  +-- هل الإنترنت مقطوع؟ --> نعم --> قراءة من localStorage --> إرجاع
  |
  +-- لا --> جلب من السحابة
        |
        +-- نجح؟ --> حفظ في localStorage + إرجاع
        |
        +-- فشل؟ --> قراءة من localStorage (fallback)
```

### مفاتيح التخزين المحلي الجديدة
- `hyperpos_customers_cache`
- `hyperpos_debts_cache`
- `hyperpos_expenses_cache`
- `hyperpos_categories_cache`
- `hyperpos_partners_cache`
- `hyperpos_warehouses_cache`
- `hyperpos_warehouse_stock_cache_{id}`
- `hyperpos_purchase_invoices_cache`

### Migration لجدول stores
```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme_settings jsonb DEFAULT '{}';
```

### تدفق مزامنة الثيم

```text
فتح التطبيق
  |
  +-- مسجل دخول؟
  |     |
  |     +-- نعم --> جلب theme_settings من stores
  |     |             |
  |     |             +-- موجود؟ --> تطبيق + حفظ في localStorage
  |     |             |
  |     |             +-- غير موجود؟ --> استخدام localStorage
  |     |
  |     +-- لا --> استخدام localStorage
  |
  عند تغيير الثيم
  |
  +-- حفظ في localStorage
  +-- تحديث stores في السحابة (إذا مسجل دخول)
```

### الملفات المتأثرة
1. `src/lib/cloud/customers-cloud.ts` - إضافة كاش محلي
2. `src/lib/cloud/debts-cloud.ts` - إضافة كاش محلي
3. `src/lib/cloud/expenses-cloud.ts` - إضافة كاش محلي
4. `src/lib/cloud/categories-cloud.ts` - إضافة كاش محلي
5. `src/lib/cloud/partners-cloud.ts` - إضافة كاش محلي
6. `src/lib/cloud/warehouses-cloud.ts` - إضافة كاش محلي
7. `src/lib/cloud/purchase-invoices-cloud.ts` - إضافة كاش محلي
8. `src/hooks/use-theme.tsx` - مزامنة الثيم مع السحابة
9. **Migration**: إضافة عمود `theme_settings` لجدول `stores`
