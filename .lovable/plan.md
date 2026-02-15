## تم التنفيذ ✅

### الإصلاحات
1. ✅ إزالة `bakery` المكرر من `product-fields-config.ts`
2. ✅ إضافة `laborCost` لـ `CartItem` في `POS.tsx` و `CartPanel.tsx`
3. ✅ إزالة `(item as any).laborCost` واستبداله بالنوع الصحيح
4. ✅ تقرير المشتريات متاح لجميع أوضاع المتجر

### الإضافات
5. ✅ تقرير المكتبة (`LibraryReport.tsx`) - يظهر في وضع bookstore
6. ✅ دمج الإعارة مع نقطة البيع (`LoanQuickDialog.tsx`)
7. ✅ زر "إعارة" في `ScannedProductDialog` في وضع bookstore
8. ✅ خصم كمية المخزون عند الإعارة + إعادتها عند الإرجاع
