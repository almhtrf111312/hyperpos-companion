

# إضافة فلترة محتوى صفحة التعليمات حسب صلاحيات المستخدم

## الوضع الحالي
- صفحة `/help` متاحة لجميع المستخدمين (كاشير، مالك، بوس) -- هذا صحيح ولا يحتاج تعديل
- لكن محتوى الصفحة (الميزات والأسئلة الشائعة) يعرض كل شيء بما فيه أقسام لا يملك الكاشير صلاحية الوصول إليها

## التعديل المطلوب

### الملف: `src/pages/Help.tsx`

1. **استيراد `useUserRole`** من `@/hooks/use-user-role`

2. **إضافة علامة `adminOnly` للميزات**: الميزات التالية ستظهر فقط للمالك/البوس:
   - مستودعات متعددة (Multi-Warehouse)
   - تقارير ذكية (Smart Reports)
   - خدمات الصيانة (Maintenance) -- تعتمد أيضا على `storeType`

3. **إضافة علامة `adminOnly` للأسئلة الشائعة**: الأسئلة التالية ستظهر فقط للمالك/البوس:
   - "كيف أدير مستودعات متعددة؟"
   - "كيف أصدّر تقارير المبيعات؟"

4. **فلترة المحتوى في الـ render**: استخدام `isOwner` (أي `isAdmin || isBoss`) لإخفاء العناصر المقيدة عن الكاشير

### المنطق:
```text
features.filter(f => !f.adminOnly || isOwner)
faqs.filter(f => !f.adminOnly || isOwner)
```

الكاشير سيرى: باركود متعدد، نظام الأصناف، أمان البيانات، إدارة العملاء، نظام الديون، الفوترة، وحدات مزدوجة + الأسئلة المتعلقة بها فقط.

### التفاصيل التقنية

**ملف واحد يتأثر**: `src/pages/Help.tsx`

التعديلات:
- إضافة `import { useUserRole } from '@/hooks/use-user-role'`
- إضافة خاصية `adminOnly?: boolean` لـ `FeatureItem` interface
- إضافة `adminOnly: true` للميزات: Warehouse, BarChart3 (Reports), Wrench (Maintenance)
- إضافة خاصية `adminOnly?: boolean` لـ `FAQItem` interface
- وضع `adminOnly: true` على أسئلة المستودعات والتقارير
- في المكون: `const { isOwner } = useUserRole()` ثم فلترة المصفوفات قبل العرض
