
# اصلاح مشاكل لوحة البوس: الايميلات، الحسابات التابعة، وادوات الادارة

## المشاكل المكتشفة

### 1. حسابات البوس التابعة لا تظهر
في السطر 1384 من `BossPanel.tsx`، الشرط `!isBossUser &&` يمنع عرض الحسابات التابعة لحساب البوس. يعني حساب "عمر الخالد" التابع للبوس (owner_id = boss) لا يظهر ابدا.

### 2. ايميلات الحسابات التابعة لا تظهر
في عرض الحسابات التابعة (السطر 1411)، يظهر فقط الاسم والنوع (كاشير/موزع/نقطة بيع) بدون عرض الايميل، رغم ان البيانات متوفرة من الخادم.

### 3. ادوات ادارة محدودة للحسابات التابعة
الحسابات التابعة لا تملك خيارات كافية في القائمة المنسدلة - لا يوجد خيار تعديل الترخيص او ادارة الجهاز بشكل كامل.

### 4. Edge Function تستخدم `getClaims` غير موثوق
الدالة `getClaims` قد لا تكون متوفرة في جميع اصدارات المكتبة. يجب استخدام `getUser` بدلا منها لضمان الاستقرار.

---

## الحل

### التعديل 1: `supabase/functions/get-users-with-emails/index.ts`
- استبدال `getClaims` بـ `adminClient.auth.getUser(token)` للتحقق من هوية المستخدم بشكل اكثر موثوقية

### التعديل 2: `src/pages/BossPanel.tsx` - عرض حسابات البوس التابعة
- ازالة الشرط `!isBossUser &&` من السطر 1384 ليظهر قسم الحسابات التابعة لحسابات البوس ايضا

### التعديل 3: `src/pages/BossPanel.tsx` - عرض الايميلات
- اضافة عرض الايميل لكل حساب تابع في العرض الشجري (بجانب الاسم والنوع)

### التعديل 4: `src/pages/BossPanel.tsx` - تحسين ادوات الادارة
- التاكد من ان جميع الحسابات التابعة (بما فيها التابعة للبوس) تملك نفس خيارات الادارة: تغيير كلمة المرور، ريست الجهاز، تعديل الاسم، حذف

---

## التفاصيل التقنية

### الملف: `supabase/functions/get-users-with-emails/index.ts`

السطور 34-45 - استبدال:
```typescript
const token = authHeader.replace('Bearer ', '')
const { data: claims, error: claimsError } = await userClient.auth.getClaims(token)
if (claimsError || !claims?.claims?.sub) { ... }
const userId = claims.claims.sub
```
بـ:
```typescript
const token = authHeader.replace('Bearer ', '')
const { data: userData, error: userError } = await adminClient.auth.getUser(token)
if (userError || !userData?.user) { ... }
const userId = userData.user.id
```

### الملف: `src/pages/BossPanel.tsx`

**التغيير 1** - السطر 1384: ازالة `!isBossUser &&` من شرط عرض الحسابات التابعة:
```typescript
// قبل
{!isBossUser && owner.cashiers && owner.cashiers.length > 0 && (
// بعد
{owner.cashiers && owner.cashiers.length > 0 && (
```

**التغيير 2** - السطر 1411: اضافة عرض الايميل في كل حساب تابع:
```typescript
<span className="text-sm font-medium truncate">{cashier.full_name || 'بدون اسم'}</span>
{cashier.email && (
  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">{cashier.email}</span>
)}
```

---

## النتيجة المتوقعة
- حساب "عمر الخالد" سيظهر تحت حساب البوس مباشرة
- جميع الايميلات ستظهر بجانب اسماء الحسابات التابعة
- جميع ادوات الادارة (تغيير كلمة المرور، ريست الجهاز، تعديل، حذف) متاحة لكل حساب تابع
- Edge Function اكثر استقرارا باستخدام `getUser`
