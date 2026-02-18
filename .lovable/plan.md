
# إصلاح مشكلة Android Process Death عند التقاط الصور

## تشخيص المشكلة الجذرية

بعد مراجعة شاملة للكود، وجدت **ثلاث مشاكل متداخلة** تسبب المشكلة معاً:

---

### المشكلة الأولى: إعادة تسجيل الـ Listener في كل render

في `src/hooks/use-camera.tsx` السطر 307:

```text
}, [isNative, processNativePhoto, options]);
```

المتغير `options` هو كائن (object) جديد يُنشأ في كل render لأنه يُمرَّر هكذا من `Products.tsx`:

```text
useCamera({
  maxSize: 640,
  quality: 70,
  onPhotoRestored: handlePhotoRestored,
  fallbackToInline: true,
});
```

هذا يجعل الـ `useEffect` يُعيد التشغيل في كل render، مما يُزيل الـ listener القديم ويسجل جديداً. عند إعادة تشغيل التطبيق بعد Process Death، قد لا يكون هناك listener مسجل في اللحظة التي يُطلق فيها Capacitor حدث `appRestoredResult`.

---

### المشكلة الثانية: ترتيب useEffect غير مضمون

في `src/pages/Products.tsx`، يوجد:
- `useEffect` لاستعادة النموذج من localStorage (السطر 298)
- `useEffect` لتسجيل listener الكاميرا عبر `useCamera` (يُشغَّل في hook منفصل)

عند Android Process Death وإعادة التشغيل:
1. التطبيق يُحمَّل من الصفر
2. `handlePhotoRestored` يُستدعى **قبل** أن يُفعَّل `useEffect` الخاص باستعادة النموذج من localStorage
3. النتيجة: الصورة تُستعاد لكن النموذج يظهر فارغاً

---

### المشكلة الثالثة: `imagePreviewBase64` لا يُحفظ في localStorage

الكود الحالي يحفظ `formData` و `customFieldValues` في localStorage، لكن **لا يحفظ** `imagePreviewBase64` (وهي الصورة المؤقتة للعرض قبل الرفع).

عند Process Death وإعادة التشغيل، يُعاد `formData.image` من localStorage، لكن `imagePreviewBase64` يبقى فارغاً، فتظهر الصورة بشكل خاطئ.

---

## الحل المقترح (ثلاثة تعديلات)

### التعديل 1 - إصلاح `use-camera.tsx`: استخدام useRef بدلاً من options مباشرة

استخدام `useRef` لحفظ دالة `onPhotoRestored` بدلاً من تمريرها في dependency array. هذا يحل مشكلة إعادة تسجيل الـ listener في كل render:

```text
// قبل:
}, [isNative, processNativePhoto, options]);

// بعد:
const onPhotoRestoredRef = useRef(options.onPhotoRestored);
useEffect(() => {
  onPhotoRestoredRef.current = options.onPhotoRestored;
}, [options.onPhotoRestored]);

// وفي الـ listener:
if (compressed && onPhotoRestoredRef.current) {
  onPhotoRestoredRef.current(compressed);
}

// وفي dependency array:
}, [isNative, processNativePhoto]); // بدون options
```

---

### التعديل 2 - إصلاح `handlePhotoRestored` في `Products.tsx`: حفظ الصورة في localStorage فوراً

إضافة حفظ الصورة مؤقتاً في localStorage عند استعادتها، حتى إذا جاءت قبل استعادة النموذج. ثم عند استعادة النموذج، التحقق من وجود صورة مؤقتة لدمجها:

```text
const RESTORED_IMAGE_KEY = 'hyperpos_restored_image_temp';

const handlePhotoRestored = useCallback(async (base64Image: string) => {
  // 1. حفظ الصورة في localStorage فوراً (يضمن بقاءها حتى لو جاءت قبل استعادة النموذج)
  localStorage.setItem(RESTORED_IMAGE_KEY, base64Image);

  // 2. عرض الصورة للمستخدم فوراً
  setImagePreviewBase64(base64Image);

  // 3. حفظ base64 في formData مؤقتاً (يحفظها localStorage تلقائياً)
  setFormData(prev => ({ ...prev, image: base64Image }));

  // 4. رفع الصورة للسحابة في الخلفية
  const toastId = toast.loading('جاري استعادة الصورة...');
  try {
    const imageUrl = await uploadProductImage(base64Image);
    toast.dismiss(toastId);
    if (imageUrl) {
      setFormData(prev => ({ ...prev, image: imageUrl }));
      localStorage.removeItem(RESTORED_IMAGE_KEY); // تنظيف
      toast.success(t('products.imageRestored'));
    } else {
      toast.error(t('products.imageRestoreFailed'));
    }
  } catch (e) {
    toast.dismiss(toastId);
    toast.error(t('products.imageRestoreFailed'));
  }
}, [t]);
```

---

### التعديل 3 - إصلاح استعادة النموذج في `Products.tsx`: التحقق من وجود صورة مؤقتة

في `useEffect` الخاص باستعادة النموذج (السطر 298)، إضافة تحقق من وجود صورة مؤقتة مستعادة لدمجها مع بيانات النموذج:

```text
useEffect(() => {
  try {
    const savedState = localStorage.getItem(FORM_STORAGE_KEY);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      const hour = 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp < hour) {
        
        // التحقق من وجود صورة مؤقتة مستعادة من الكاميرا
        const restoredImage = localStorage.getItem(RESTORED_IMAGE_KEY);
        const formDataToRestore = restoredImage
          ? { ...parsed.formData, image: restoredImage }
          : parsed.formData;

        setFormData(formDataToRestore);

        // إذا كان هناك صورة مؤقتة، اعرضها أيضاً كـ preview
        if (restoredImage) {
          setImagePreviewBase64(restoredImage);
        }

        // ... باقي استعادة الحالة
      }
    }
  } catch (e) { ... }
}, []);
```

---

## ملخص الملفات التي ستتغير

| الملف | نوع التغيير |
|---|---|
| `src/hooks/use-camera.tsx` | استخدام `useRef` لحفظ `onPhotoRestored` لمنع إعادة تسجيل Listener |
| `src/pages/Products.tsx` | إصلاح `handlePhotoRestored` + استعادة الصورة عند تحميل النموذج |

---

## النتيجة المتوقعة

بعد هذه التعديلات:
1. عند التقاط صورة وحدوث Process Death، سيُستعاد النموذج كاملاً عند فتح التطبيق
2. الصورة الملتقطة ستظهر كـ preview فوراً دون الحاجة لإعادة التقاط
3. سيتم رفع الصورة تلقائياً في الخلفية
4. حتى لو فشل الرفع، ستبقى الصورة محفوظة مؤقتاً في النموذج
5. الـ Listener لن يُعاد تسجيله في كل render، مما يُقلل من احتمال فقدان الأحداث
