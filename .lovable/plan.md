
# توحيد عناوين الصفحات

## المشكلة
عناوين الصفحات غير متناسقة في الحجم والموقع:
- **نقطة البيع**: `text-base md:text-lg` (صغير جداً)
- **لوحة التحكم**: `text-3xl` ثابت (كبير على الموبايل)
- **الفواتير**: `text-2xl` بدون `text-foreground` ومع أيقونة داخل العنوان
- **المنتجات**: العنوان مخفي تماماً على الموبايل (`hidden sm:block`)

## النمط الصحيح (من الصفحات الجيدة مثل العملاء والديون)
```text
h1: text-xl md:text-3xl font-bold text-foreground
subtitle: text-sm md:text-base text-muted-foreground mt-1
container: rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0
```

## التغييرات المطلوبة

### 1. لوحة التحكم (`src/pages/Dashboard.tsx` - سطر 201)
- تغيير `text-3xl` الى `text-xl md:text-3xl`
- تغيير subtitle من `text-muted-foreground` الى `text-sm md:text-base text-muted-foreground`

### 2. الفواتير (`src/pages/Invoices.tsx` - سطر 471)
- تغيير `text-2xl font-bold` الى `text-xl md:text-3xl font-bold text-foreground`
- ازالة الأيقونة من داخل العنوان (لتطابق باقي الصفحات)

### 3. المنتجات (`src/pages/Products.tsx` - سطر 689)
- ازالة `hidden sm:block` لإظهار العنوان على الموبايل أيضاً
- التأكد من أن الحجم `text-xl md:text-3xl font-bold text-foreground`

### 4. نقطة البيع (`src/components/pos/POSHeader.tsx` - سطر 25)
- تغيير `font-bold text-base md:text-lg` الى `text-xl md:text-3xl font-bold text-foreground`
- تعديل ارتفاع الهيدر ليتناسب مع الحجم الجديد

## النتيجة
جميع الصفحات ستستخدم نفس حجم العنوان ونفس الموقع، مما يعطي تجربة بصرية متناسقة.
