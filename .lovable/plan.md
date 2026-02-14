

# اصلاح انيميشن القائمة الجانبية وتكبير الخط

## المشكلة
عند النقر على تبويب في القائمة الجانبية (موبايل)، احيانا تختفي القائمة بسلاسة واحيانا تختفي فجأة بدون انيميشن. السبب الجذري هو:

1. **setTimeout مع 250ms**: يتسابق مع اعادة رسم الصفحة الجديدة - احيانا الصفحة الجديدة تُرسم قبل انتهاء المؤقت فيضيع الانيميشن
2. **onToggle غير مستقر**: الدالة تستخدم `!sidebarOpen` الذي قد يكون قيمة قديمة داخل setTimeout
3. **الخلفية المعتمة (overlay) تختفي فورا**: عند تغيير `isOpen` الى false، الخلفية تُزال من DOM مباشرة بدون انيميشن خروج

## الحل

### الملف: `src/components/layout/Sidebar.tsx`

**التغيير 1: استبدال onToggle بدالة اغلاق مباشرة**
- بدلا من استدعاء `onToggle()` (التي تعكس الحالة)، سنمرر دالة `onClose` مباشرة تضبط الحالة على `false`
- او الابقاء على onToggle لكن استخدام `setSidebarOpen(false)` في MainLayout

**التغيير 2: اصلاح useEffect لاغلاق القائمة عند تغيير الصفحة**
- استبدال `setTimeout` بمنطق يضمن تشغيل الانيميشن اولا ثم الاغلاق
- استخدام `requestAnimationFrame` بدلا من setTimeout لضمان ان المتصفح يرسم الاطار قبل الاغلاق
- تقليل التأخير والتأكد من ان الدالة تستخدم القيمة الحالية وليس القديمة

**التغيير 3: انيميشن خروج للخلفية المعتمة (overlay)**
- بدلا من ازالة الـ overlay فورا من DOM عندما `isOpen = false`، سنبقيه في DOM دائما على الموبايل ونتحكم بشفافيته عبر CSS
- عندما `isOpen = true`: `opacity-100 pointer-events-auto`
- عندما `isOpen = false`: `opacity-0 pointer-events-none`
- هذا يضمن انيميشن سلس للخلفية مع القائمة

**التغيير 4: تكبير حجم الخط**
- تكبير نص عناصر القائمة من `text-[13px]` الى `text-sm` (14px)

### الملف: `src/components/layout/MainLayout.tsx`

**التغيير 5: تمرير دالة اغلاق مستقرة**
- تغيير `toggleSidebar` الى دالة اغلاق تستخدم `setSidebarOpen(false)` بدلا من `!sidebarOpen`
- او لف الدالة بـ `useCallback` لضمان الاستقرار

---

## التفاصيل التقنية

### الخلفية المعتمة (قبل وبعد):

قبل:
```text
{isMobile && isOpen && (
  <div className="... opacity ..." onClick={onToggle} />
)}
```

بعد:
```text
{isMobile && (
  <div 
    className={cn(
      "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300",
      isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
    )}
    onClick={onToggle}
  />
)}
```

### useEffect المُصلح:
```text
useEffect(() => {
  if (isMobile && isOpen) {
    // اغلاق القائمة بعد اطار واحد لضمان تشغيل الانيميشن
    requestAnimationFrame(() => {
      onToggle();
    });
  }
  if (isTablet && !collapsed) {
    setCollapsed(true);
  }
}, [location.pathname]);
```

### حجم الخط:
```text
// من
<span className="text-[13px] truncate">

// الى  
<span className="text-sm truncate">
```

