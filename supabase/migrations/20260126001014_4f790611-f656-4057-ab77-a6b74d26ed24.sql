-- 1. تحديث سياسة RLS لجدول partners لتشمل boss
DROP POLICY IF EXISTS "Owners manage own partners" ON public.partners;

CREATE POLICY "Owners manage own partners" ON public.partners
  FOR ALL USING (
    (user_id = auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR is_boss(auth.uid()))
  )
  WITH CHECK (
    (user_id = auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR is_boss(auth.uid()))
  );

-- 2. تحديث سياسة RLS لجدول recurring_expenses لتشمل boss
DROP POLICY IF EXISTS "Owners manage recurring expenses" ON public.recurring_expenses;

CREATE POLICY "Owners manage recurring expenses" ON public.recurring_expenses
  FOR ALL USING (
    (user_id = auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR is_boss(auth.uid()))
  )
  WITH CHECK (
    (user_id = auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR is_boss(auth.uid()))
  );