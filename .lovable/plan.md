# خطة توحيد الكبسولات والأزرار العائمة (v1.3.4)

## الهدف
1. كل شرائط التبويبات في البرنامج تأخذ نفس تصميم وحجم كبسولة المنتجات (النشطة / التصنيفات / الأرشيف).
2. زر إضافة عائم واحد موحّد (دائري، أكبر، أعلى قليلاً، على اليمين بالعربي واليسار بالإنجليزي)، يختفي بانسيابية عند النزول ويعود عند الصعود — مثل Google.
3. نقل أزرار الإضافة الثابتة (العميل، الخدمات/الصيانة، المصروف) إلى هذا الزر العائم.
4. المظهر والخطوط: زرّا «حفظ» و«تراجع» عائمان بنفس شكل الإعدادات، يظهران عند أي تعديل، ويختفيان عند النزول ويعودان عند الصعود.
5. القائمة الجانبية تغطي الزر العائم عند فتحها.

لا تغيير في أي حساب مالي أو قاعدة بيانات أو ملفات المستودعات المجمّدة.

---

## المرحلة 1 — مكوّن كبسولة موحّد

ملف جديد `src/components/ui/SegmentedCapsule.tsx` يحمل أنماط كبسولة المنتجات حرفياً:

```tsx
// الإطار الخارجي (مطابق لـ Products.tsx سطر 2209)
export const capsuleOuter =
  "bg-muted/60 p-1 rounded-2xl grid gap-1 w-full sm:w-fit border border-border/40 shadow-xs select-none";
// الزر الداخلي (مطابق لأزرار المنتجات)
export const capsuleItem =
  "rounded-xl p-1.5 sm:px-3.5 sm:py-2 min-h-11 text-[clamp(0.65rem,2.6vw,0.85rem)] font-bold min-w-0 leading-tight whitespace-normal text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors duration-200 cursor-pointer";
export const capsuleActive = "bg-gradient-primary text-primary-foreground shadow-xs";
export const capsuleIdle = "text-muted-foreground hover:text-foreground hover:bg-card/60";

interface Item { id: string; label: ReactNode; icon?: LucideIcon; badge?: number; tone?: 'default' | 'danger'; }
export function SegmentedCapsule({ items, value, onChange, minWidth = "sm:min-w-[24rem]" }) {
  // grid-cols-{items.length} عبر style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}
  // الأيقونة: w-3.5 h-3.5 sm:w-4 sm:h-4
  // tone='danger' يستخدم bg-destructive / text-destructive (بدل ألوان red الصريحة)
}
```

ملاحظة: زر الأرشيف حالياً يستخدم `!bg-red-600 !text-white` — سيُستبدل بمتغيرات `destructive` نفس اللون تقريباً لكن يحترم الثيم.

## المرحلة 2 — تطبيق الكبسولة على كل الشاشات

| الشاشة | الموقع الحالي | الأزرار |
|---|---|---|
| المنتجات | `Products.tsx` ~2209 | النشطة، التصنيفات، الأرشيف (المرجع) |
| المشتريات | `Purchases.tsx` ~55-75 | إضافة فاتورة شراء، شراء سريع → كبسولة بنفس الحجم |
| العملاء | `Customers.tsx` ~390 (TabsList) | العملاء، الديون |
| التقارير | `Reports.tsx` ~2200 و~2506 | الذكية/الاحترافية + تبويبات التقارير |
| الفواتير | `Invoices.tsx` ~2148 | فلاتر الحالة (تبقى قابلة للتمرير أفقياً إن زادت عن 4) |
| المظهر | `Appearance.tsx` 141 | المظهر، الخطوط، الحجم |
| المساعدة | `Help.tsx` 110 | تبويبان |
| المكتبة | `LibraryMembers.tsx` 183 | TabsList |
| الإعدادات | `Settings.tsx` 3663 | مبدّل الأقسام |

قاعدة: إن كانت الأزرار ≤ 4 → شبكة متساوية مثل المنتجات؛ إن كانت أكثر → نفس الإطار والزر لكن `flex overflow-x-auto scrollbar-none`.
مع `TabsList/TabsTrigger` (Customers, LibraryMembers): نضع `className={capsuleOuter}` على `TabsList` و`capsuleItem` + `data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground` على كل `TabsTrigger`.

صفحات إضافية سأفحصها وأوحّدها بنفس القاعدة: الصندوق، الورديات، الشركاء، الديون، تتبّع الفواتير، الخدمات.

## المرحلة 3 — الزر العائم الموحّد `SmartFab`

تعديل `src/components/ui/SmartFab.tsx` (الموجود ومستخدم في المنتجات والمصاريف):

```tsx
// الموضع: يمين في العربي، يسار في الإنجليزي
const { isRTL } = useLanguage();
<div className={cn(
  "fixed z-30",                       // أقل من القائمة الجانبية (z-40/50) فتغطيه
  isRTL ? "right-5" : "left-5",       // بعيد عن الحافة أكثر (كان end-4 = يسار في العربي)
  "bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:bottom-10", // أعلى قليلاً
  "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
  isVisible ? "translate-y-0 opacity-100" : "translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none"
)}>
  <Button aria-label={label}
    className="size-16 rounded-full p-0 bg-gradient-primary text-primary-foreground shadow-xl shadow-primary/30 ring-4 ring-primary/15 hover:scale-105 active:scale-95">
    <Plus className="w-7 h-7 stroke-[2.5]" />
  </Button>
</div>
```
- دائري تماماً (`size-16` = 64px) بدون نص على الموبايل؛ على الشاشات الكبيرة يبقى دائرياً أيضاً مع `title` للتلميح.
- الاختفاء: انزلاق للأسفل + تلاشي (أسلوب Material/Google)، يظهر فوراً عند الصعود أو عند الوصول لأعلى الصفحة.
- يستمع لتمرير `window` و`<main>` معاً (بعض الصفحات تمرر داخل حاوية).
- يختفي تلقائياً عند فتح القائمة الجانبية (حدث `sidebar-open` من `MainLayout`) لضمان عدم ظهوره فوقها.

## المرحلة 4 — نقل أزرار الإضافة إلى الزر العائم

| الشاشة | الزر الحالي يُحذف | الجديد |
|---|---|---|
| العملاء `Customers.tsx` ~411 | «إضافة عميل» | `<SmartFab label={t('customers.addCustomer')} onClick={openAdd} />` (يظهر في تبويب العملاء فقط) |
| الخدمات `Services.tsx` ~556 | «طلب جديد» | `<SmartFab label={t('services.newRequest')} onClick={...} />` |
| المصاريف `Expenses.tsx` ~575 | «إضافة مصروف» الثابت في الرأس | يبقى الزر العائم الموجود (بقائمته المنسدلة) لكن بالشكل الموحّد الجديد |
| المنتجات | موجود | يستفيد تلقائياً من الشكل الجديد |

الأزرار الصغيرة داخل الحالات الفارغة (Customers ~572/595) تبقى كما هي.

## المرحلة 5 — حفظ/تراجع عائم في المظهر والخطوط

مكوّن جديد `src/components/ui/FloatingSaveBar.tsx` مستخرج من `Settings.tsx` (4218-4258) ليُستخدم في الإعدادات والمظهر معاً:

```tsx
<FloatingSaveBar
  visible={hasUnsavedChanges || isSaveSuccess}
  saving={isSaving}
  success={isSaveSuccess}
  onSave={handleSaveAll}
  onRevert={handleCancelAll}
/>
```
- دائرتان `size-14`: حفظ (`bg-primary`) وتراجع (`variant="secondary"`، أيقونة `Undo2`).
- الموضع: نفس جهة الزر العائم (يمين بالعربي)، `bottom-[calc(6rem+safe-area)]`.
- يظهر عند أي تعديل: المظهر العام، الخط، ليلي/نهاري، اللون، الثيم، وضع الأداء، الشفافية، الحجم.
- يختفي عند النزول ويعود عند الصعود (نفس منطق التمرير — يُستخرج إلى hook مشترك `useScrollDirectionVisibility`).
- `pb-32` في صفحة المظهر حتى لا يغطي آخر الإعدادات.
- يُستبدل الشريط الحالي في `Appearance.tsx` (198-218) وفي `Settings.tsx` بالمكوّن الجديد — نفس السلوك الحالي للإعدادات.

## المرحلة 6 — التحقق والإصدار
- فحص بصري على 393px و1280px، عربي وإنجليزي: الكبسولات متطابقة الحجم، الزر يمين/يسار، يختفي ويعود بالتمرير، القائمة الجانبية تغطيه.
- `tsgo` وبناء ناجح.
- رفع الإصدار إلى v1.3.4 وتحديث `version.json` و`public/changelog.json`.

---

## تفاصيل تقنية
- ملفات جديدة: `SegmentedCapsule.tsx`, `FloatingSaveBar.tsx`, `src/hooks/use-scroll-visibility.ts`.
- ملفات معدّلة: `SmartFab.tsx`, `Products.tsx`, `Purchases.tsx`, `Customers.tsx`, `Reports.tsx`, `Invoices.tsx`, `Appearance.tsx`, `Help.tsx`, `LibraryMembers.tsx`, `Settings.tsx`, `Services.tsx`, `Expenses.tsx`, `MainLayout.tsx` (بث حدث فتح القائمة).
- كل الألوان من المتغيرات (`primary`, `muted`, `card`, `destructive`, `bg-gradient-primary`) — لا ألوان صريحة.
- لمس 48px على الموبايل كحد أدنى، حركة ≤ 300ms.
