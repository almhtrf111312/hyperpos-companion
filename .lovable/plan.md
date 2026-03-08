

# خطة إصلاح شاملة — تقرير التدقيق FlowPOS Pro v2 + إصلاح عرض الكاميرا

---

## ملخص التحقق من الكود

بعد فحص الكود فعلياً، تم تأكيد **12 مشكلة حقيقية** من أصل 14 + مشكلة واجهة الكاميرا:

| # | المشكلة | الحالة | التأكيد |
|---|---------|--------|---------|
| 1 | أرباح في localStorage فقط | ✅ مؤكدة | `profits-store.ts` يستخدم localStorage فقط |
| 2 | حساب الربح قبل الخصم | ❌ غير مؤكدة | الكود يطبق `discountRatio` بشكل صحيح (سطر 420-421) |
| 3 | فواتير الدين بدون ضريبة | ✅ مؤكدة | `debt-sale-handler.ts` سطر 149-168 لا يمرر `taxRate/taxAmount` |
| 4 | فشل بيع الدين بدون Rollback | ✅ مؤكدة جزئياً | سطر 182-185 يسجل خطأ لكن لا يحذف الفاتورة |
| 5 | الخصم لا يُوزع على الشركاء | ❌ غير مؤكدة | الكود يوزع `profitsByCategory * (1-discountRatio)` (سطر 446-448) |
| 6 | ازدواجية تسجيل المصاريف | ⚠️ تحتاج تحقق أعمق | |
| 7 | المرتجع يخصم grossProfit بدل netProfit | ✅ مؤكدة | `processRefund` سطر 267 يحسب `total - COGS` |
| 8 | حذف المصاريف لا يزامن السحابة | ⚠️ تحتاج تحقق | |
| 9 | confirmPendingProfit محلي فقط | ✅ مؤكدة | `Debts.tsx` سطر 280 يستدعي النسخة المحلية فقط |
| 10 | سداد الدين لا يحدث إحصائيات العميل | ✅ مؤكدة | `processDebtPayment` لا يستدعي `updateCustomerStatsCloud` |
| 11 | سداد الدين كإيداع عادي | ✅ مؤكدة | يستدعي `addDepositToShift` بدون نوع مميز |
| 12 | المرتجع لا يحدث إحصائيات العميل أحياناً | ✅ مؤكدة | يعتمد على تمرير `customerId` |
| 13 | ازدواجية رصيد الصندوق | ⚠️ تصميمي | نظامان مستقلان |
| 14 | ترقيم الفواتير من localStorage | ✅ مؤكدة | خطر تكرار بأجهزة متعددة |
| 🎥 | طبقات تغطي عرض الكاميرا على APK | ✅ مؤكدة | `NativeCameraPreview` backdrop يحجب الرؤية |

---

## خطة التنفيذ (مرتبة بالأولوية)

### المرحلة 1: إصلاحات فورية (< ساعة لكل واحدة)

#### 1.1 — إصلاح #3: إضافة الضريبة لفواتير الدين
**ملف:** `src/lib/cloud/debt-sale-handler.ts`
- إضافة `taxRate` و `taxAmount` في استدعاء `addInvoiceCloud` (سطر 149-168)
- إضافة الحقول للـ `DebtSaleBundle` type إذا لم تكن موجودة

#### 1.2 — إصلاح #9: استدعاء confirmPendingProfitCloud
**ملف:** `src/pages/Debts.tsx`
- استيراد `confirmPendingProfitCloud` من `partners-cloud.ts`
- استدعاؤها بعد `confirmPendingProfit` المحلية (سطر 280)

#### 1.3 — إصلاح #10: تحديث إحصائيات العميل عند سداد الدين
**ملف:** `src/pages/Debts.tsx`
- استدعاء `updateCustomerStatsCloud(customerId, -paymentAmount, true)` لخفض رصيد الدين

#### 1.4 — إصلاح #4: Rollback عند فشل إنشاء الدين
**ملف:** `src/lib/cloud/debt-sale-handler.ts`
- عند فشل `addDebtFromInvoiceCloud` (سطر 182)، حذف الفاتورة المُنشأة عبر `deleteInvoiceCloud(invoice.id)`

### المرحلة 2: إصلاحات مهمة

#### 2.1 — إصلاح #7: تصحيح خصم الربح في المرتجع
**ملف:** `src/lib/unified-transactions.ts`
- `removeGrossProfit` يحذف السجل بالكامل — هذا صحيح فعلاً
- المشكلة: إذا لم يوجد `originalInvoiceId`، لا يُخصم أي ربح
- الحل: إضافة `addGrossProfit` بقيمة سالبة كـ fallback

#### 2.2 — إصلاح #11: تمييز سداد الدين عن الإيداع
**ملف:** `src/lib/unified-transactions.ts`
- تغيير `addDepositToShift` إلى نسخة تدعم النوع `debt_payment`

### المرحلة 3: إصلاح واجهة الكاميرا (الأهم للمستخدم)

#### 3.1 — إصلاح عرض الكاميرا على APK
**ملف:** `src/components/camera/NativeCameraPreview.tsx`

**المشكلة:** طبقات شفافة/معتمة تغطي معاينة الكاميرا — المستخدم يرى الكاميرا تعمل لكن بدون صورة واضحة.

**الحل:**
- إزالة `background: 'rgba(0,0,0,0.7)'` من الـ backdrop وجعله شفاف تماماً أو أسود صلب
- التأكد أن `<video>` لا يحجبه أي `backdrop-blur` أو طبقات gradient
- تبسيط الـ header و footer ليكونا شفافين بدون gradient
- إزالة `backdrop-blur-sm` من زر الالتقاط
- جعل الـ video container يعرض مباشرة بدون overlay loading إذا كان الـ stream جاهز

### المرحلة 4: مخطط مستقبلي

| # | المهمة | الأولوية |
|---|--------|---------|
| #1 | نقل profits-store إلى قاعدة البيانات السحابية | مرتفعة |
| #13 | توحيد نظام الصندوق | متوسطة |
| #14 | ترقيم مركزي للفواتير | منخفضة |
| F1 | الاسترداد الجزئي للفاتورة | مخطط |

---

## ملخص الملفات المتأثرة

| الملف | التغييرات |
|-------|----------|
| `src/lib/cloud/debt-sale-handler.ts` | إضافة taxRate/taxAmount + rollback عند الفشل |
| `src/pages/Debts.tsx` | confirmPendingProfitCloud + updateCustomerStats |
| `src/lib/unified-transactions.ts` | تحسين processRefund + تمييز debt_payment |
| `src/components/camera/NativeCameraPreview.tsx` | إزالة الطبقات المعتمة وتحسين عرض الكاميرا |

