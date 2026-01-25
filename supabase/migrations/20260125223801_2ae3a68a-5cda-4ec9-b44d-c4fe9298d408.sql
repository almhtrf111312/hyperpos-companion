-- تغيير نوع invoice_id من UUID إلى TEXT لدعم أرقام الفواتير النصية
ALTER TABLE public.debts 
  ALTER COLUMN invoice_id TYPE TEXT USING invoice_id::TEXT;

-- إضافة تعليق توضيحي للحقل
COMMENT ON COLUMN public.debts.invoice_id IS 'رقم الفاتورة النصي (invoice_number) من جدول invoices، أو معرف دين نقدي مثل CASH_xxx';