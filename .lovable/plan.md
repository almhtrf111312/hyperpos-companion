

## خطة إصلاح: صورة المنتج تظهر تالفة + اختفاء النموذج على الهاتف

### السبب الجذري

**الصورة التالفة على التطبيق السحابي:**
بعد التعديل السابق، دالة `uploadProductImage` تُرجع مسار ملف مثل `products/123.jpg`. النموذج يعرض الصورة بـ `<img src="products/123.jpg">` - المتصفح لا يستطيع تحميل هذا المسار فتظهر الصورة تالفة.

**اختفاء النموذج على الهاتف:**
عند فتح الكاميرا عبر `<input type="file" capture="environment">` على بعض المتصفحات المحمولة، يتم إعادة تحميل الصفحة وتُفقد حالة React (Dialog يُغلق).

### الحل

#### 1. إضافة حالة `imagePreviewBase64` للمعاينة المؤقتة
- بعد التقاط/اختيار الصورة، نحفظ نسخة base64 للعرض الفوري في النموذج
- نرفع الصورة في الخلفية ونحفظ المسار في `formData.image`
- النموذج يعرض base64 المؤقت فوراً (لا انتظار)

#### 2. استخدام `ProductImage` للصور المحفوظة مسبقاً
- عند تعديل منتج موجود، `formData.image` يحتوي مسار تخزين
- نستخدم مكوّن `ProductImage` (الذي يولّد signed URL) بدلاً من `<img>` مباشرة

#### 3. حفظ حالة النموذج قبل فتح الكاميرا
- استخدام `form-persistence.ts` الموجود لحفظ بيانات النموذج قبل فتح الكاميرا
- استعادتها عند إعادة تحميل الصفحة

### الملف المطلوب تعديله

| الملف | التعديل |
|-------|---------|
| `src/pages/Products.tsx` | إضافة `imagePreviewBase64` state، تعديل `handleCameraCapture` و `handleGallerySelect`، واستبدال `<img>` بمنطق معاينة ذكي في كلا النموذجين (إضافة + تعديل) |

### التفاصيل التقنية

#### تعديل دوال الرفع (handleCameraCapture + handleGallerySelect):
```text
- حفظ formData في localStorage قبل فتح الكاميرا (form-persistence)
- بعد التقاط الصورة: حفظ base64 في imagePreviewBase64 فوراً للعرض
- رفع الصورة في الخلفية → حفظ المسار في formData.image
- مسح imagePreviewBase64 عند إغلاق النموذج
```

#### تعديل عرض الصورة في النموذجين (إضافة + تعديل):
```text
- إذا وُجد imagePreviewBase64 → عرضه مباشرة (صورة جديدة)
- إذا وُجد formData.image فقط → استخدام ProductImage (صورة محفوظة)
- لا imagePreviewBase64 ولا formData.image → عرض placeholder
```

#### تعديل handlePhotoRestored:
```text
- حفظ base64 المستعاد في imagePreviewBase64 أيضاً للعرض الفوري
```

