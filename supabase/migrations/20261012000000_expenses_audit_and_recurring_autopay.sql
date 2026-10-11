-- =========================================================================
-- Migration: Add financial reversal audit trail to expenses and autopay
-- =========================================================================

-- 1. إضافة حقول الاسترداد المالي الآمن لجدول المصاريف (Financial Reversal Audit Trail)
ALTER TABLE IF EXISTS public.expenses 
  ADD COLUMN IF NOT EXISTS is_reversed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_reason text;

-- فهرس لتسريع استعلامات تصفية المصاريف النشطة واستثناء المستردة
CREATE INDEX IF NOT EXISTS idx_expenses_is_reversed ON public.expenses (is_reversed);

-- 2. دعم خيار الدفع التلقائي للمصاريف الدورية إن وجد الجدول في Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recurring_expenses') THEN
    ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS auto_pay boolean NOT NULL DEFAULT false;
  END IF;
END $$;
