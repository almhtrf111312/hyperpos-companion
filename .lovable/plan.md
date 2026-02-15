

## تقرير المراجعة الشاملة + خطة إضافة تقارير المكتبة ودمج الإعارة مع POS

---

### القسم الأول: المشاكل والتناقضات المكتشفة

#### 1. تكرار تعريف `bakery` في `product-fields-config.ts` (خطأ برمجي)

الملف `src/lib/product-fields-config.ts` يحتوي على **حالة `bakery` مكررة مرتين** (سطر 58 وسطر 70). الحالة الثانية لن تُنفذ أبداً لأن JavaScript تُنفذ أول `case` مطابقة فقط. هذا ليس خطأ وظيفي حالياً لكنه كود ميت يجب إزالته.

#### 2. تكرار تعريف `StoreType` (تعريف مزدوج)

النوع `StoreType` مُعرّف في **مكانين مختلفين**:
- `src/types/index.ts` (سطر 193)
- `src/lib/product-fields-config.ts` (سطر 23)

كلاهما يحتوي على نفس القيم لكن التكرار يُعقّد الصيانة. ملف `store-type-config.ts` يستورد من `product-fields-config.ts` وليس من `types/index.ts`.

#### 3. `CartItem` مُعرّف 3 مرات بشكل مختلف

- `src/types/index.ts` - يحتوي على `CartItem` مع `Product` كامل
- `src/pages/POS.tsx` (سطر 96) - `CartItem` مبسط بدون `laborCost`
- `src/components/pos/CartPanel.tsx` (سطر 70) - `CartItem` مختلف بدون `laborCost`

**المشكلة**: في `CartPanel.tsx` سطر 1279، يتم الوصول لـ `(item as any).laborCost` بدل أن يكون في التعريف الرسمي. هذا يعني أن `laborCost` لا يُمرر أصلاً للسلة في وضع repair.

#### 4. `POSProduct` في POS.tsx يحتوي على `laborCost` لكن `CartItem` لا

عند إضافة منتج للسلة في POS.tsx، لا يتم نسخ `laborCost` من `POSProduct` إلى `CartItem`. وبالتالي يكون `(item as any).laborCost` دائماً `undefined` في CartPanel.

#### 5. تقارير المكتبة غير موجودة

صفحة التقارير `Reports.tsx` لا تحتوي على أي تقرير خاص بالمكتبة (الكتب الأكثر إعارة، الكتب المتأخرة، إحصائيات الأعضاء).

#### 6. نظام الإعارة غير مدمج مع POS

عند مسح باركود كتاب في وضع المكتبة، لا يوجد خيار "إعارة" - فقط بيع عادي. نظام الإعارة محصور في صفحة `/library` فقط.

#### 7. `book_loans` لا يؤثر على كمية المخزون

عند تسجيل إعارة في `library-cloud.ts`، لا يتم خصم الكمية من المنتج. الكتاب يبقى "متاح" حتى لو كان معاراً.

#### 8. تقرير المشتريات يظهر فقط في `noInventory` mode

في `Reports.tsx` سطر 172، تقرير المشتريات يظهر فقط لـ bakery/repair. لكن يجب أن يظهر لجميع الأوضاع بما فيها bookstore وgeneral.

---

### القسم الثاني: خطة الإصلاحات والإضافات

#### الملفات المعدلة

| الملف | التغيير |
|-------|---------|
| `src/lib/product-fields-config.ts` | إزالة case `bakery` المكرر |
| `src/pages/POS.tsx` | إضافة `laborCost` لـ CartItem + إضافة زر إعارة في وضع bookstore |
| `src/components/pos/CartPanel.tsx` | إضافة `laborCost` لتعريف CartItem |
| `src/pages/Reports.tsx` | إضافة تقرير المكتبة + إظهار تقرير المشتريات لجميع الأوضاع |
| `src/components/reports/LibraryReport.tsx` | **ملف جديد** - تقرير المكتبة |
| `src/lib/cloud/library-cloud.ts` | إضافة دالة خصم/إعادة كمية عند الإعارة/الإرجاع |

---

#### 1. إصلاح التكرارات والتناقضات

**`product-fields-config.ts`**: إزالة case `bakery` المكرر (السطور 70-75).

**`POS.tsx` CartItem**: إضافة `laborCost?: number` للتعريف + نسخه عند إضافة المنتج للسلة.

**`CartPanel.tsx` CartItem**: إضافة `laborCost?: number` وإزالة `(item as any).laborCost`.

**`Reports.tsx`**: تغيير شرط إظهار تقرير المشتريات ليشمل جميع الأوضاع (إزالة شرط `noInventory`).

#### 2. تقرير المكتبة (LibraryReport.tsx)

إنشاء مكون تقرير جديد يعرض:
- الكتب الأكثر إعارة (ترتيب حسب عدد الإعارات)
- الكتب المتأخرة (status = active وdue_date < اليوم)
- إحصائيات الأعضاء (عدد الأعضاء، النشطين، المعلقين)
- ملخص الغرامات المحصلة

البيانات تُجلب من `loadLoansCloud()` و`loadMembersCloud()`.

يُضاف كتبويب جديد في `Reports.tsx` يظهر فقط عندما يكون `storeType === 'bookstore'`.

#### 3. دمج الإعارة مع نقطة البيع

في وضع `bookstore` عند إضافة كتاب للسلة أو مسح باركوده:
- إضافة زر "إعارة" بجانب زر "إضافة للسلة" في `ScannedProductDialog` أو `ProductGrid`
- عند الضغط على "إعارة": فتح dialog صغير لاختيار العضو وتاريخ الاسترداد
- استدعاء `addLoanCloud()` + خصم كمية الكتاب
- طباعة إيصال إعارة

سيتم إضافة الدمج في `POS.tsx` عبر:

```text
1. إضافة state: showLoanDialog, loanProduct
2. عند مسح باركود في وضع bookstore: إظهار خيارات (بيع / إعارة)
3. عند اختيار "إعارة": فتح LoanDialog مع قائمة الأعضاء
4. عند التأكيد: addLoanCloud + deductStockBatchCloud
```

#### 4. خصم الكمية عند الإعارة

تعديل `addLoanCloud` في `library-cloud.ts` لخصم كمية الكتاب عند الإعارة، وإعادتها عند الإرجاع (`returnLoanCloud`).

---

### التفاصيل التقنية

#### تقرير المكتبة - البيانات المعروضة

```text
1. أكثر الكتب إعارة:
   - اسم الكتاب | عدد الإعارات | آخر إعارة

2. الكتب المتأخرة:
   - اسم الكتاب | اسم العضو | تاريخ الاستحقاق | أيام التأخير

3. إحصائيات الأعضاء:
   - إجمالي الأعضاء | نشط | معلق | إجمالي الغرامات

4. ملخص الإعارات:
   - إجمالي الإعارات | نشطة | مرتجعة | مفقودة
```

#### دمج الإعارة مع POS - التدفق

```text
مسح باركود كتاب في وضع bookstore:
  ├── ScannedProductDialog يظهر مع زرين:
  │   ├── "بيع" → التدفق العادي (إضافة للسلة)
  │   └── "إعارة" → فتح LoanQuickDialog
  │       ├── اختيار عضو (بحث سريع)
  │       ├── تحديد تاريخ الاسترداد
  │       └── تأكيد → addLoanCloud + خصم كمية
  └── طباعة إيصال إعارة
```

