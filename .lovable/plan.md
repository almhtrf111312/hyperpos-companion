

# Fix Build Errors - Translation Keys, Edge Function, and Type Issues

## Overview
There are three categories of build errors to fix:

1. **Edge Function** - Duplicate `const now` variable in `device-auto-login`
2. **Translation Keys** - ~30+ missing i18n keys used across 4 pages
3. **Type Mismatch** - `Language` type doesn't include `'auto'` but code compares against it

---

## 1. Edge Function Fix (`supabase/functions/device-auto-login/index.ts`)

**Problem:** `const now` is declared twice at lines 60 and 115 in the same block scope.

**Fix:** Rename the second declaration at line 115 to `const nowCheck` or simply reuse the existing `now` variable (remove `const` on line 115).

---

## 2. Missing Translation Keys (`src/lib/i18n.ts`)

Add the following missing keys to all 3 language blocks (Arabic, English, Turkish):

**Customers:**
- `customers.nameExists` - "اسم العميل موجود مسبقاً"
- `customers.addFailed` - "فشل في إضافة العميل"
- `customers.editFailed` - "فشل في تعديل العميل"
- `customers.deleteFailed` - "فشل في حذف العميل"

**Debts:**
- `debts.shareOpened` - "تم فتح المشاركة"
- `debts.deleteSuccess` - "تم حذف الدين بنجاح"
- `debts.deleteFailed` - "فشل في حذف الدين"
- `common.user` - "مستخدم"
- `common.deleteError` - "حدث خطأ أثناء الحذف"

**Expenses:**
- `common.required` - "هذا الحقل مطلوب"
- `common.selectDate` - "اختر تاريخ"
- `expenses.voidSuccess` - "تم إلغاء المصروف بنجاح"
- `expenses.voided` - "ملغى"
- `expenses.void` - "إلغاء"
- `expenses.voidExpense` - "إلغاء المصروف"
- `expenses.voidConfirm` - "هل أنت متأكد من إلغاء هذا المصروف؟"
- `expenses.voidReason` - "سبب الإلغاء"

**Invoices:**
- `invoices.voidSuccess` - "تم إلغاء الفاتورة بنجاح"
- `invoices.printSettingsError` - "خطأ في تحميل إعدادات الطباعة"
- `invoices.maintenanceService` - "خدمة صيانة"
- `invoices.shareOpened` - "تم فتح المشاركة"
- `invoices.voidInvoice` - "إلغاء الفاتورة"

---

## 3. Language Type Fix (`src/hooks/use-language.tsx`)

**Problem:** `Language` type is `'ar' | 'en'` but code compares `savedLang === 'auto'`.

**Fix:** The `getCurrentLanguage()` function returns type `Language` which can never be `'auto'`. Either:
- Cast the comparison: `(savedLang as string) === 'auto'`
- Or update `getCurrentLanguage` return type to `Language | 'auto'`

The safest fix is to cast to string since `'auto'` is a valid stored value but gets resolved before use.

---

## Technical Steps

1. Fix `device-auto-login/index.ts` line 115: remove `const` to reuse existing `now`
2. Add all missing translation keys to `src/lib/i18n.ts` in all 3 language sections (ar, en, tr)
3. Fix `use-language.tsx` lines 56 and 71: cast `savedLang` to `string` for comparison

