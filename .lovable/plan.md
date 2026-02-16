

## خطة: تحسين وضع Dark Mode للوحة التحكم

---

### ملخص

تحسين ألوان الوضع الداكن لتكون أكثر تناسقاً واحترافية في لوحة التحكم، مع إضافة تدرجات لونية خفيفة وتباين أفضل للعناصر المختلفة.

---

### التغييرات

#### 1. تحسين ألوان Dark Mode الأساسية (`src/hooks/use-theme.tsx`)

**الحالي:** الألوان الداكنة موحدة بدرجات navy (`222 47%`) مما يجعل العناصر تبدو مسطحة.

**الجديد:**
- تحسين تباين البطاقات: `card` من `8%` إلى `9%` لفصل أوضح عن الخلفية
- تحسين `muted`: من `14%` إلى `15%` لتباين أفضل في الأيقونات والخلفيات الثانوية
- تحسين `mutedForeground`: من `55%` إلى `60%` لقراءة أفضل للنصوص الثانوية
- إضافة لمعان خفيف للحدود: `border` من `17%` إلى `18%`
- تحسين sidebar: رفع `sidebarForeground` من `90%` إلى `92%` لوضوح أكثر

#### 2. إضافة تأثيرات Dark Mode مخصصة للداشبورد (`src/index.css`)

**إضافات جديدة:**
- `.dark .glass`: تحسين خلفية الزجاج في الوضع الداكن مع `border-white/[0.06]` بدلاً من `border/50` العامة
- `.dark .glass:hover`: إضافة `border-primary/20` عند التمرير لإحياء البطاقات
- تحسين StatCard في الوضع الداكن: إضافة `hover:shadow-primary/10` بدلاً من `/5` لتوهج أقوى
- تحسين QuickActions: إضافة `dark:bg-card/60` للأيقونات الدائرية لتباين أفضل

#### 3. تحسين StatCard للوضع الداكن (`src/components/dashboard/StatCard.tsx`)

**التغييرات:**
- تحسين variant styles لتكون أكثر حيوية في الوضع الداكن:
  - `primary`: إضافة `dark:bg-primary/8 dark:border-primary/25`
  - `success`: إضافة `dark:bg-success/8 dark:border-success/25`
  - `warning`: إضافة `dark:bg-warning/8 dark:border-warning/25`
  - `danger`: إضافة `dark:bg-destructive/8 dark:border-destructive/25`
- تحسين خلفية الأيقونات: رفع شفافية الأيقونات في الداكن من `/20` إلى `/25`
- إضافة `dark:hover:shadow-lg dark:hover:shadow-primary/10` لتوهج خفيف عند التمرير

#### 4. تحسين QuickActions للوضع الداكن (`src/components/dashboard/QuickActions.tsx`)

- تحسين ألوان الأيقونات الدائرية: رفع الشفافية في الداكن (`dark:bg-primary/20` بدلاً من `/15`)

#### 5. تحسين RecentInvoices و DebtAlerts للوضع الداكن

**RecentInvoices:**
- تحسين صفوف الجدول: `dark:hover:bg-primary/5` بدلاً من `hover:bg-muted/30`
- تحسين حدود الصفوف: `dark:border-white/[0.06]`

**DebtAlerts:**
- تحسين بطاقات التنبيهات: إضافة `dark:shadow-sm` لفصل أفضل

---

### الملفات المعدلة

| الملف | التعديل |
|-------|---------|
| `src/hooks/use-theme.tsx` | تحسين `darkModeColors` (تباين أفضل) |
| `src/index.css` | إضافة قواعد `.dark` مخصصة للـ glass و hover |
| `src/components/dashboard/StatCard.tsx` | إضافة dark mode variants محسنة |
| `src/components/dashboard/QuickActions.tsx` | تحسين ألوان الأيقونات في الداكن |
| `src/components/dashboard/RecentInvoices.tsx` | تحسين hover وحدود الجدول في الداكن |
| `src/components/dashboard/DebtAlerts.tsx` | تحسين بطاقات التنبيهات في الداكن |

---

### التفاصيل التقنية

#### darkModeColors المحسنة
```text
background: '222 47% 6%'     (بدون تغيير - جيد)
foreground: '210 40% 98%'    (بدون تغيير)
card: '222 47% 9%'           (كان 8% - أوضح قليلاً)
muted: '215 28% 15%'         (كان 14% - تباين أفضل)
mutedForeground: '215 20% 60%' (كان 55% - قراءة أفضل)
border: '215 28% 18%'        (كان 17% - حدود أوضح)
```

#### CSS Dark Mode Rules الجديدة
```text
.dark .glass {
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.03);
}

.dark .glass:hover {
  border-color: hsl(var(--primary) / 0.2);
}
```

